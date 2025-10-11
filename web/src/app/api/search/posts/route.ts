import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient, QueryCommand, type QueryCommandInput, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const POSTS_TABLE = process.env.POSTS_TABLE;

const dynamoClient = POSTS_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!POSTS_TABLE || !dynamoClient) {
    throw new Error("POSTS_TABLE is not configured");
  }
}

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

function formatPost(item: StoredPostItem) {
  return {
    postId: item.post_id,
    status: (item.status as string) ?? "draft",
    postType: (item.post_type as string) ?? "offer",
    title: (item.title as string) ?? "",
    categories: Array.isArray(item.categories) ? (item.categories as string[]) : [],
    body: (item.body as string) ?? "",
    group: (item.group as string | null) ?? null,
    images: Array.isArray(item.images) ? (item.images as string[]) : [],
    createdAt: (item.created_at as string) ?? null,
    updatedAt: (item.updated_at as string) ?? null,
  };
}

function normalizeStatus(value: string | null) {
  if (value === "draft" || value === "published") {
    return value;
  }
  return "published";
}

function normalizePostType(value: string | null) {
  if (value === "offer" || value === "request") {
    return value;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    requireClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const normalizedStatus = normalizeStatus(searchParams.get("status"));
  const normalizedPostType = normalizePostType(searchParams.get("postType"));
  const normalizedGroup = searchParams.get("group")?.trim() || undefined;
  const normalizedCategory = searchParams.get("category")?.trim() || undefined;
  const keyword = searchParams.get("keyword")?.trim() || "";
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "60", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 60;
  const queryLimit = Math.min(limit * 3, 200);

  try {
    const attributeNames: Record<string, string> = {
      "#st": "status",
    };
    const attributeValues: Record<string, AttributeValue> = {
      ":st": { S: normalizedStatus },
    };
    const filterExpressions: string[] = [];

    if (normalizedPostType) {
      attributeNames["#pt"] = "post_type";
      attributeValues[":pt"] = { S: normalizedPostType };
      filterExpressions.push("#pt = :pt");
    }

    if (normalizedGroup) {
      attributeNames["#grp"] = "group";
      attributeValues[":grp"] = { S: normalizedGroup };
      filterExpressions.push("#grp = :grp");
    }

    if (normalizedCategory) {
      attributeNames["#categories"] = "categories";
      attributeValues[":category"] = { S: normalizedCategory };
      filterExpressions.push("contains(#categories, :category)");
    }

    const commandInput: QueryCommandInput = {
      TableName: POSTS_TABLE,
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
    const items = result.Items ?? [];

    let posts = items.map((item) => formatPost(unmarshall(item) as StoredPostItem));

    if (keyword.length > 0) {
      const lowered = keyword.toLowerCase();
      posts = posts.filter((post) => {
        const title = post.title?.toLowerCase() ?? "";
        const body = post.body?.toLowerCase() ?? "";
        const groupValue = post.group?.toLowerCase() ?? "";
        const categoriesValue = Array.isArray(post.categories)
          ? post.categories.join(" ").toLowerCase()
          : "";

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

    return NextResponse.json({
      posts: posts.slice(0, limit),
    });
  } catch (error) {
    console.error("Failed to search posts", error);
    return NextResponse.json(
      { error: "投稿の検索に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
