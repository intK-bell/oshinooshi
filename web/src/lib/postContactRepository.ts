import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  type AttributeValue,
  type QueryCommandInput,
  type QueryCommandOutput,
  type UpdateItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const CONTACT_TABLE = process.env.POST_CONTACT_TABLE;

const dynamoClient = CONTACT_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!CONTACT_TABLE || !dynamoClient) {
    throw new Error("POST_CONTACT_TABLE is not configured");
  }
}

export type ContactRecord = {
  contactId: string;
  postId: string;
  type: "chat" | "request";
  status: string;
  message: string | null;
  senderUserId: string;
  senderName: string | null;
  senderUuid: string | null;
  recipientUserId: string;
  createdAt: string | null;
  updatedAt: string | null;
  lineRequestStatus?: string | null;
  lineRequestUpdatedAt?: string | null;
  messages: ContactMessage[];
};

export type ContactMessage = {
  messageId: string;
  senderUserId: string;
  senderName: string | null;
  body: string;
  createdAt: string;
};

type StoredContactItem = {
  contact_id?: string;
  post_id?: string;
  type?: string;
  status?: string;
  message?: string | null;
  sender_user_id?: string;
  sender_name?: string | null;
  sender_uuid?: string | null;
  recipient_user_id?: string;
  created_at?: string;
  updated_at?: string;
  messages?: unknown;
  line_request_status?: string | null;
  line_request_updated_at?: string | null;
  [key: string]: unknown;
};

function formatContact(item: StoredContactItem): ContactRecord {
  const messagesRaw = Array.isArray(item.messages) ? (item.messages as unknown[]) : [];
  const messages: ContactMessage[] = messagesRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const value = entry as Record<string, unknown>;
      const messageId = typeof value.message_id === "string" ? value.message_id : randomUUID();
      const body = typeof value.body === "string" ? value.body : "";
      const createdAt = typeof value.created_at === "string" ? value.created_at : new Date().toISOString();
      return {
        messageId,
        senderUserId: typeof value.sender_user_id === "string" ? value.sender_user_id : "",
        senderName: typeof value.sender_name === "string" ? value.sender_name : null,
        body,
        createdAt,
      };
    })
    .filter((value): value is ContactMessage => Boolean(value));

  return {
    contactId: item.contact_id ?? "",
    postId: item.post_id ?? "",
    type: (item.type as "chat" | "request") ?? "chat",
    status: item.status ?? "pending",
    message: typeof item.message === "string" && item.message.length > 0 ? item.message : null,
    senderUserId: item.sender_user_id ?? "",
    senderName: typeof item.sender_name === "string" ? item.sender_name : null,
    senderUuid: typeof item.sender_uuid === "string" ? item.sender_uuid : null,
    recipientUserId: item.recipient_user_id ?? "",
    createdAt: item.created_at ?? null,
    updatedAt: item.updated_at ?? null,
    lineRequestStatus: typeof item.line_request_status === "string" ? item.line_request_status : null,
    lineRequestUpdatedAt: typeof item.line_request_updated_at === "string" ? item.line_request_updated_at : null,
    messages,
  };
}

export type ContactQueryOptions = {
  limit?: number;
  status?: string | null;
  cursor?: string | null;
};

export type ContactQueryResult = {
  contacts: ContactRecord[];
  nextCursor?: string;
};

export async function getContact(postId: string, contactId: string): Promise<ContactRecord | null> {
  requireClient();

  const result = await dynamoClient!.send(
    new GetItemCommand({
      TableName: CONTACT_TABLE,
      Key: {
        post_id: { S: postId },
        contact_id: { S: contactId },
      },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return formatContact(unmarshall(result.Item) as StoredContactItem);
}

export async function listContactsForRecipient(userId: string, options: ContactQueryOptions = {}): Promise<ContactQueryResult> {
  requireClient();

  const limit =
    options.limit && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(Number(options.limit), 50))
      : 20;

  const commandInput: QueryCommandInput = {
    TableName: CONTACT_TABLE!,
    IndexName: "recipient_user_id-index",
    KeyConditionExpression: "#rid = :rid",
    ExpressionAttributeNames: {
      "#rid": "recipient_user_id",
    },
    ExpressionAttributeValues: {
      ":rid": { S: userId },
    },
    Limit: limit,
    ScanIndexForward: false,
  };

  if (options.status) {
    commandInput.FilterExpression = "#status = :status";
    commandInput.ExpressionAttributeNames = {
      ...commandInput.ExpressionAttributeNames,
      "#status": "status",
    };
    commandInput.ExpressionAttributeValues = {
      ...commandInput.ExpressionAttributeValues,
      ":status": { S: options.status },
    };
  }

  if (options.cursor) {
    try {
      const decoded = Buffer.from(options.cursor, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded) as Record<string, AttributeValue>;
      commandInput.ExclusiveStartKey = parsed;
    } catch (error) {
      console.warn("Failed to parse contacts cursor", error);
    }
  }

  const result: QueryCommandOutput = await dynamoClient!.send(new QueryCommand(commandInput));
  const contacts = (result.Items ?? []).map((item) => formatContact(unmarshall(item) as StoredContactItem));

  let nextCursor: string | undefined;
  if (result.LastEvaluatedKey && Object.keys(result.LastEvaluatedKey).length > 0) {
    nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey), "utf-8").toString("base64");
  }

  return { contacts, nextCursor };
}

export async function updateContactStatus(
  postId: string,
  contactId: string,
  recipientUserId: string,
  nextStatus: string,
): Promise<ContactRecord> {
  requireClient();

  const updateResult: UpdateItemCommandOutput = await dynamoClient!.send(
    new UpdateItemCommand({
      TableName: CONTACT_TABLE,
      Key: {
        post_id: { S: postId },
        contact_id: { S: contactId },
      },
      UpdateExpression: "SET #status = :status, updated_at = :updated_at",
      ConditionExpression: "recipient_user_id = :recipient_user_id",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": { S: nextStatus },
        ":updated_at": { S: new Date().toISOString() },
        ":recipient_user_id": { S: recipientUserId },
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (!updateResult.Attributes) {
    throw new Error("Failed to update contact status");
  }

  return formatContact(unmarshall(updateResult.Attributes) as StoredContactItem);
}

export async function updateLineRequestStatus(
  postId: string,
  contactId: string,
  requesterUserId: string,
  nextStatus: string,
): Promise<ContactRecord> {
  requireClient();

  const now = new Date().toISOString();

  const updateResult: UpdateItemCommandOutput = await dynamoClient!.send(
    new UpdateItemCommand({
      TableName: CONTACT_TABLE,
      Key: {
        post_id: { S: postId },
        contact_id: { S: contactId },
      },
      UpdateExpression: "SET line_request_status = :line_request_status, line_request_updated_at = :line_request_updated_at",
      ConditionExpression: "sender_user_id = :requester OR recipient_user_id = :requester",
      ExpressionAttributeValues: {
        ":line_request_status": { S: nextStatus },
        ":line_request_updated_at": { S: now },
        ":requester": { S: requesterUserId },
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (!updateResult.Attributes) {
    throw new Error("Failed to update line request status");
  }

  return formatContact(unmarshall(updateResult.Attributes) as StoredContactItem);
}

export async function listContactsByPost(postId: string): Promise<ContactRecord[]> {
  requireClient();

  const result = await dynamoClient!.send(
    new QueryCommand({
      TableName: CONTACT_TABLE!,
      KeyConditionExpression: "#pid = :pid",
      ExpressionAttributeNames: {
        "#pid": "post_id",
      },
      ExpressionAttributeValues: {
        ":pid": { S: postId },
      },
      ScanIndexForward: false,
    }),
  );

  return (result.Items ?? []).map((item) => formatContact(unmarshall(item) as StoredContactItem));
}

export async function appendContactMessage(params: {
  postId: string;
  contactId: string;
  senderUserId: string;
  senderName: string | null;
  body: string;
}): Promise<ContactRecord> {
  requireClient();

  const now = new Date().toISOString();
  const message = {
    message_id: randomUUID(),
    sender_user_id: params.senderUserId,
    sender_name: params.senderName,
    body: params.body,
    created_at: now,
  };
  const marshalledMessage = marshall(message, { removeUndefinedValues: true });

  const updateResult = await dynamoClient!.send(
    new UpdateItemCommand({
      TableName: CONTACT_TABLE,
      Key: {
        post_id: { S: params.postId },
        contact_id: { S: params.contactId },
      },
      UpdateExpression: "SET messages = list_append(if_not_exists(messages, :empty), :entry), updated_at = :updated_at",
      ExpressionAttributeValues: {
        ":entry": { L: [{ M: marshalledMessage }] },
        ":empty": { L: [] },
        ":updated_at": { S: now },
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (!updateResult.Attributes) {
    throw new Error("Failed to append contact message");
  }

  return formatContact(unmarshall(updateResult.Attributes) as StoredContactItem);
}

export async function listContactsForSender(userId: string, options: ContactQueryOptions = {}): Promise<ContactQueryResult> {
  requireClient();

  const limit =
    options.limit && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(Number(options.limit), 50))
      : 20;

  const commandInput: QueryCommandInput = {
    TableName: CONTACT_TABLE!,
    IndexName: "sender_user_id-index",
    KeyConditionExpression: "#sid = :sid",
    ExpressionAttributeNames: {
      "#sid": "sender_user_id",
    },
    ExpressionAttributeValues: {
      ":sid": { S: userId },
    },
    Limit: limit,
    ScanIndexForward: false,
  };

  if (options.status) {
    commandInput.FilterExpression = "#status = :status";
    commandInput.ExpressionAttributeNames = {
      ...commandInput.ExpressionAttributeNames,
      "#status": "status",
    };
    commandInput.ExpressionAttributeValues = {
      ...commandInput.ExpressionAttributeValues,
      ":status": { S: options.status },
    };
  }

  if (options.cursor) {
    try {
      const decoded = Buffer.from(options.cursor, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded) as Record<string, AttributeValue>;
      commandInput.ExclusiveStartKey = parsed;
    } catch (error) {
      console.warn("Failed to parse contacts cursor (sender)", error);
    }
  }

  const result = await dynamoClient!.send(new QueryCommand(commandInput));
  const contacts = (result.Items ?? []).map((item) => formatContact(unmarshall(item) as StoredContactItem));

  let nextCursor: string | undefined;
  if (result.LastEvaluatedKey && Object.keys(result.LastEvaluatedKey).length > 0) {
    nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey), "utf-8").toString("base64");
  }

  return { contacts, nextCursor };
}
