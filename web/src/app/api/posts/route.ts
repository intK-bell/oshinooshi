import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  type QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const POSTS_TABLE = process.env.POSTS_TABLE;

const dynamoClient = POSTS_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!POSTS_TABLE || !dynamoClient) {
    throw new Error("POSTS_TABLE is not configured");
  }
}

export async function POST(request: NextRequest) {
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    group,
    title,
    categories,
    body,
    status,
    images,
    haveMembers,
    wantMembers,
  } = payload as Record<string, unknown>;

  const errors: string[] = [];

  const normalizedPostType = "trade";
  const normalizedStatus = status === "published" ? "published" : "draft";

  const normalizedGroup = typeof group === "string" ? group.trim() : "";

  if (normalizedGroup.length === 0) {
    errors.push("推し・グループを入力してください。");
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push("タイトルを入力してください。");
  }

  const normalizedCategories = Array.isArray(categories)
    ? categories
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  if (normalizedCategories.length === 0) {
    errors.push("カテゴリを選択してください。");
  }

  const normalizedHaveMembers = Array.isArray(haveMembers)
    ? haveMembers
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];
  const normalizedWantMembers = Array.isArray(wantMembers)
    ? wantMembers
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  if (normalizedHaveMembers.length === 0) {
    errors.push("交換に出せるメンバーを1名以上入力してください。");
  }

  if (normalizedWantMembers.length === 0) {
    errors.push("探しているメンバーを1名以上入力してください。");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const now = new Date().toISOString();
  const postId = randomUUID();

  const item = marshall(
    {
      post_id: postId,
      user_id: userId,
      status: normalizedStatus,
      post_type: normalizedPostType,
      title: (title as string).trim(),
      group: normalizedGroup,
      categories: normalizedCategories,
      body: typeof body === "string" ? body.trim() : "",
      images: Array.isArray(images)
        ? images.filter((value): value is string => typeof value === "string")
        : [],
      have_members: normalizedHaveMembers,
      want_members: normalizedWantMembers,
      created_at: now,
      updated_at: now,
    },
    { removeUndefinedValues: true },
  );

  try {
    await dynamoClient!.send(
      new PutItemCommand({
        TableName: POSTS_TABLE,
        Item: item,
      }),
    );
  } catch (error) {
    console.error("Failed to create post", error);
    return NextResponse.json({ error: "投稿の保存に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ postId, status: normalizedStatus }, { status: 201 });
}

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status");

  try {
    const queryInput: QueryCommandInput = {
      TableName: POSTS_TABLE,
      IndexName: "user_id-index",
      KeyConditionExpression: "#uid = :uid",
      ExpressionAttributeNames: {
        "#uid": "user_id",
      },
      ExpressionAttributeValues: {
        ":uid": { S: userId },
      },
    } as const;

    const commandInput: QueryCommandInput = { ...queryInput };

    if (statusFilter) {
      const normalized = statusFilter === "published" ? "published" : "draft";
      commandInput.FilterExpression = "#st = :st";
      commandInput.ExpressionAttributeNames = {
        ...commandInput.ExpressionAttributeNames,
        "#st": "status",
      };
      commandInput.ExpressionAttributeValues = {
        ...commandInput.ExpressionAttributeValues,
        ":st": { S: normalized },
      };
    }

    const result = await dynamoClient!.send(new QueryCommand(commandInput));

    const posts = (result.Items ?? []).map((item) => {
      const unmarshalled = unmarshall(item) as Record<string, unknown>;
      return {
        postId: unmarshalled.post_id as string,
        status: unmarshalled.status as string,
        postType: (unmarshalled.post_type as string) ?? "trade",
        title: (unmarshalled.title as string) ?? "",
        categories: (unmarshalled.categories as string[]) ?? [],
        body: (unmarshalled.body as string) ?? "",
        group: (unmarshalled.group as string | null) ?? null,
        images: (unmarshalled.images as string[]) ?? [],
        haveMembers: (unmarshalled.have_members as string[]) ?? [],
        wantMembers: (unmarshalled.want_members as string[]) ?? [],
        createdAt: (unmarshalled.created_at as string) ?? null,
        updatedAt: (unmarshalled.updated_at as string) ?? null,
      };
    });

    posts.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ posts }, { status: 200 });
  } catch (error) {
    console.error("Failed to load posts", error);
    return NextResponse.json({ error: "投稿の取得に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }
}
