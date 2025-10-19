import { existsSync, readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  type GetItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

type CliOptions = {
  postId: string;
  senderId: string;
  senderName: string;
  chatMessage: string;
  requestMessage: string;
  includeChat: boolean;
  includeRequest: boolean;
};

type StoredPost = {
  post_id?: string;
  user_id?: string;
  status?: string;
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const CONTACT_TABLE = process.env.POST_CONTACT_TABLE;
const POSTS_TABLE = process.env.POSTS_TABLE;

if (!CONTACT_TABLE) {
  throw new Error("POST_CONTACT_TABLE is not configured.");
}
if (!POSTS_TABLE) {
  throw new Error("POSTS_TABLE is not configured.");
}

const options = parseArgs(process.argv.slice(2));

async function main() {
  const client = new DynamoDBClient({ region: REGION });

  const post = await loadPost(client, options.postId);
  if (!post || !post.post_id || !post.user_id) {
    throw new Error(`Post ${options.postId} was not found or has no owner.`);
  }
  if (post.status !== "published") {
    console.warn(
      `Warning: post ${options.postId} has status ${post.status ?? "unknown"}. Contacts will still be created.`,
    );
  }

  if (post.user_id === options.senderId) {
    throw new Error("Sender user ID matches the post owner. Use a different sender to simulate contact.");
  }

  const tasks: Array<Promise<unknown>> = [];

  if (options.includeChat) {
    tasks.push(createContact(client, CONTACT_TABLE!, options, post.user_id!, "chat", options.chatMessage));
  }

  if (options.includeRequest) {
    tasks.push(createContact(client, CONTACT_TABLE!, options, post.user_id!, "request", options.requestMessage));
  }

  const contactIds = await Promise.all(tasks);

  console.log("Inserted contact records:");
  contactIds.forEach((id, index) => {
    console.log(`  [${index + 1}] ${id}`);
  });
}

main().catch((error) => {
  console.error("Failed to create test contact records.", error);
  process.exit(1);
});

async function loadPost(client: DynamoDBClient, postId: string): Promise<StoredPost | null> {
  const result: GetItemCommandOutput = await client.send(
    new GetItemCommand({
      TableName: POSTS_TABLE,
      Key: {
        post_id: { S: postId },
      },
    }),
  );
  if (!result.Item) {
    return null;
  }
  return unmarshall(result.Item) as StoredPost;
}

async function createContact(
  client: DynamoDBClient,
  tableName: string,
  options: CliOptions,
  recipientUserId: string,
  type: "chat" | "request",
  message: string,
) {
  const contactId = randomUUID();
  const now = new Date().toISOString();

  const item = marshall(
    {
      post_id: options.postId,
      contact_id: contactId,
      type,
      message: message.trim().length > 0 ? message.trim() : null,
      status: "pending",
      sender_user_id: options.senderId,
      sender_name: options.senderName,
      sender_uuid: null,
      recipient_user_id: recipientUserId,
      created_at: now,
      updated_at: now,
    },
    { removeUndefinedValues: true },
  );

  await client.send(
    new PutItemCommand({
      TableName: tableName,
      Item: item,
    }),
  );

  return contactId;
}

function parseArgs(args: string[]): CliOptions {
  const defaults: CliOptions = {
    postId: "",
    senderId: "test-user-sender",
    senderName: "テストユーザー",
    chatMessage: "テストチャットです。通知確認用のメッセージ。",
    requestMessage: "テストリクエストです。お時間あるときにご確認ください。",
    includeChat: true,
    includeRequest: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--post-id":
        defaults.postId = requireNextValue(args, ++index, "--post-id");
        break;
      case "--sender-id":
        defaults.senderId = requireNextValue(args, ++index, "--sender-id");
        break;
      case "--sender-name":
        defaults.senderName = requireNextValue(args, ++index, "--sender-name");
        break;
      case "--chat-message":
        defaults.chatMessage = requireNextValue(args, ++index, "--chat-message");
        break;
      case "--request-message":
        defaults.requestMessage = requireNextValue(args, ++index, "--request-message");
        break;
      case "--only-chat":
        defaults.includeChat = true;
        defaults.includeRequest = false;
        break;
      case "--only-request":
        defaults.includeChat = false;
        defaults.includeRequest = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!defaults.postId) {
    throw new Error("--post-id is required.");
  }

  return defaults;
}

function requireNextValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function loadEnvFile(filename: string) {
  const resolved = path.resolve(process.cwd(), filename);
  if (!existsSync(resolved)) {
    return;
  }

  const content = readFileSync(resolved, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith("#") ||
      !trimmed.includes("=")
    ) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
