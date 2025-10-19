import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { authOptions } from "../../../../../lib/authOptions";
import { getPostById } from "../../../../../lib/postRepository";
import { publishLineNotification } from "../../../../../lib/notificationPublisher";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const CONTACT_TABLE = process.env.POST_CONTACT_TABLE;

const dynamoClient = CONTACT_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!CONTACT_TABLE || !dynamoClient) {
    throw new Error("POST_CONTACT_TABLE is not configured");
  }
}

type ContactPayload = {
  type?: string;
  message?: string;
};

export async function POST(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
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

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const normalizedType = payload.type === "request" ? "request" : payload.type === "chat" ? "chat" : undefined;
  if (!normalizedType) {
    return NextResponse.json({ error: "type は chat または request を指定してください。" }, { status: 400 });
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (message.length > 1000) {
    return NextResponse.json({ error: "メッセージは1000文字以内で入力してください。" }, { status: 400 });
  }

  try {
    const post = await getPostById(postId);

    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりませんでした。" }, { status: 404 });
    }

    if (post.status !== "published") {
      return NextResponse.json({ error: "この投稿には現在連絡できません。" }, { status: 400 });
    }

    if (!post.userId) {
      return NextResponse.json({ error: "投稿の作成者情報が不足しています。" }, { status: 500 });
    }

    if (post.userId === userId) {
      return NextResponse.json({ error: "自分の投稿に連絡することはできません。" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const contactId = randomUUID();
    const normalizedMessage = message.length > 0 ? message : null;
    const initialMessages =
      normalizedMessage !== null
        ? [
            {
              message_id: randomUUID(),
              sender_user_id: userId,
              sender_name: session?.user?.name ?? null,
              body: normalizedMessage,
              created_at: now,
            },
          ]
        : [];

    const item = marshall(
      {
        post_id: postId,
        contact_id: contactId,
        type: normalizedType,
        message: normalizedMessage,
        status: "pending",
        sender_user_id: userId,
        sender_name: session?.user?.name ?? null,
        sender_uuid: session?.user?.uuid ?? null,
        recipient_user_id: post.userId,
        created_at: now,
        updated_at: now,
        messages: initialMessages,
      },
      { removeUndefinedValues: true },
    );

    await dynamoClient!.send(
      new PutItemCommand({
        TableName: CONTACT_TABLE,
        Item: item,
      }),
    );

    void publishLineNotification({
      type: "contact.request.created",
      recipientUserId: post.userId,
      message:
        normalizedType === "chat"
          ? "新しいチャットリクエストが届きました。"
          : "新しい交換リクエストが届きました。",
      metadata: {
        contactId,
        postId,
        senderUserId: userId,
        senderName: session?.user?.name ?? null,
        contactType: normalizedType,
      },
    });

    return NextResponse.json({ contactId, status: "pending" }, { status: 201 });
  } catch (error) {
    console.error("Failed to create post contact", error);
    return NextResponse.json(
      { error: "連絡リクエストの作成に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
