import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const POSTS_TABLE = process.env.POSTS_TABLE;

const dynamoClient = POSTS_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

type StoredPostItem = {
  post_id: string;
  user_id: string;
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

function requireClient() {
  if (!POSTS_TABLE || !dynamoClient) {
    throw new Error("POSTS_TABLE is not configured");
  }
}

function formatPost(item: StoredPostItem) {
  return {
    postId: item.post_id as string,
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

async function loadPost(postId: string) {
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

  return unmarshall(result.Item) as StoredPostItem;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    requireClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await context.params;

  try {
    const post = await loadPost(postId);

    if (!post || post.user_id !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ post: formatPost(post) });
  } catch (error) {
    console.error("Failed to load post", error);
    return NextResponse.json({ error: "投稿の取得に失敗しました。" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    requireClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await context.params;

  let post: StoredPostItem | null = null;
  try {
    post = await loadPost(postId);
  } catch (error) {
    console.error("Failed to load post before update", error);
    return NextResponse.json({ error: "投稿の取得に失敗しました。" }, { status: 500 });
  }

  if (!post || post.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  const normalizedPostType =
    body.postType === "request" ? "request" : body.postType === "offer" ? "offer" : post.post_type ?? "offer";

  const normalizedStatus =
    body.status === "published"
      ? "published"
      : body.status === "draft"
        ? "draft"
        : post.status ?? "draft";

  const normalizedTitle =
    typeof body.title === "string" ? body.title.trim() : (typeof post.title === "string" ? post.title : "");

  const normalizedCategories = Array.isArray(body.categories)
    ? body.categories.filter((value): value is string => typeof value === "string")
    : Array.isArray(post.categories)
      ? (post.categories as string[])
      : [];

  const normalizedBody = typeof body.body === "string" ? body.body.trim() : typeof post.body === "string" ? post.body : "";

  const normalizedGroup =
    body.group === null
      ? null
      : typeof body.group === "string"
        ? body.group
        : (typeof post.group === "string" ? post.group : null);

  const normalizedImages = Array.isArray(body.images)
    ? body.images.filter((value): value is string => typeof value === "string")
    : Array.isArray(post.images)
      ? (post.images as string[])
      : [];

  const errors: string[] = [];

  if (normalizedTitle.length === 0) {
    errors.push("タイトルを入力してください。");
  }

  if (normalizedCategories.length === 0) {
    errors.push("カテゴリを選択してください。");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updatedItem: StoredPostItem = {
    ...post,
    post_type: normalizedPostType,
    status: normalizedStatus,
    title: normalizedTitle,
    categories: normalizedCategories,
    body: normalizedBody,
    group: normalizedGroup,
    images: normalizedImages,
    updated_at: now,
  };

  try {
    const marshalled = marshall(updatedItem, { removeUndefinedValues: true });

    await dynamoClient!.send(
      new PutItemCommand({
        TableName: POSTS_TABLE,
        Item: marshalled,
      }),
    );
  } catch (error) {
    console.error("Failed to update post", error);
    return NextResponse.json({ error: "投稿の更新に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ post: formatPost(updatedItem) });
}
