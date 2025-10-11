import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  type AttributeValue,
  type QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const POSTS_TABLE = process.env.POSTS_TABLE;

const dynamoClient = POSTS_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!POSTS_TABLE || !dynamoClient) {
    throw new Error("POSTS_TABLE is not configured");
  }
}

export type PostRecord = {
  postId: string;
  userId?: string;
  status: string;
  postType: "offer" | "request";
  title: string;
  categories: string[];
  body: string;
  group: string | null;
  images: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type StoredPostItem = {
  post_id: string;
  user_id?: string;
  status?: string;
  post_type?: string;
  title?: string;
  categories?: unknown;
  body?: string;
  group?: string | null;
  images?: unknown;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

function formatPost(item: StoredPostItem): PostRecord {
  return {
    postId: item.post_id,
    userId: item.user_id,
    status: (item.status as string) ?? "draft",
    postType: (item.post_type as string) === "request" ? "request" : "offer",
    title: (item.title as string) ?? "",
    categories: Array.isArray(item.categories) ? (item.categories as string[]) : [],
    body: (item.body as string) ?? "",
    group: (item.group as string | null) ?? null,
    images: Array.isArray(item.images) ? (item.images as string[]) : [],
    createdAt: (item.created_at as string) ?? null,
    updatedAt: (item.updated_at as string) ?? null,
  };
}

export async function getPostById(postId: string): Promise<PostRecord | null> {
  requireClient();

  const result = await dynamoClient!.send(
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

  return formatPost(unmarshall(result.Item) as StoredPostItem);
}

export async function getPublishedPostById(postId: string): Promise<PostRecord | null> {
  const post = await getPostById(postId);
  if (!post || post.status !== "published") {
    return null;
  }
  return post;
}

export type SearchFilters = {
  postType?: "offer" | "request";
  group?: string;
  category?: string;
  keyword?: string;
  limit?: number;
};

export async function searchPublishedPosts(filters: SearchFilters = {}): Promise<PostRecord[]> {
  requireClient();

  const attributeNames: Record<string, string> = {
    "#st": "status",
  };
  const attributeValues: Record<string, AttributeValue> = {
    ":st": { S: "published" },
  };
  const filterExpressions: string[] = [];

  if (filters.postType) {
    attributeNames["#pt"] = "post_type";
    attributeValues[":pt"] = { S: filters.postType };
    filterExpressions.push("#pt = :pt");
  }

  if (filters.group) {
    attributeNames["#grp"] = "group";
    attributeValues[":grp"] = { S: filters.group };
    filterExpressions.push("#grp = :grp");
  }

  if (filters.category) {
    attributeNames["#categories"] = "categories";
    attributeValues[":category"] = { S: filters.category };
    filterExpressions.push("contains(#categories, :category)");
  }

  const limit = filters.limit && Number.isFinite(filters.limit) && filters.limit > 0 ? Math.min(filters.limit, 100) : 60;
  const queryLimit = Math.min(limit * 3, 200);

  const commandInput: QueryCommandInput = {
    TableName: POSTS_TABLE!,
    IndexName: "status-index",
    KeyConditionExpression: "#st = :st",
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
    Limit: queryLimit,
  };

  if (filterExpressions.length > 0) {
    commandInput.FilterExpression = filterExpressions.join(" AND ");
  }

  const result = await dynamoClient!.send(new QueryCommand(commandInput));
  let posts = (result.Items ?? []).map((item) => formatPost(unmarshall(item) as StoredPostItem));

  if (filters.keyword && filters.keyword.trim().length > 0) {
    const lowered = filters.keyword.trim().toLowerCase();
    posts = posts.filter((post) => {
      const title = post.title?.toLowerCase() ?? "";
      const body = post.body?.toLowerCase() ?? "";
      const groupValue = post.group?.toLowerCase() ?? "";
      const categoriesValue = Array.isArray(post.categories) ? post.categories.join(" ").toLowerCase() : "";

      return (
        title.includes(lowered) ||
        body.includes(lowered) ||
        groupValue.includes(lowered) ||
        categoriesValue.includes(lowered)
      );
    });
  }

  posts.sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  return posts.slice(0, limit);
}
