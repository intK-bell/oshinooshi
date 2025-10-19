import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { appendContactMessage, getContact } from "@/lib/postContactRepository";
import { publishLineNotification } from "@/lib/notificationPublisher";

export async function POST(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await context.params;

  let payload: {
    contactId?: string;
    message?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const contactId = payload.contactId;
  const messageBody = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  if (messageBody.length === 0) {
    return NextResponse.json({ error: "メッセージを入力してください。" }, { status: 400 });
  }

  if (messageBody.length > 1000) {
    return NextResponse.json({ error: "メッセージは1000文字以内で入力してください。" }, { status: 400 });
  }

  try {
    const contact = await getContact(postId, contactId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const isParticipant = contact.senderUserId === userId || contact.recipientUserId === userId;
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contact.status !== "accepted") {
      return NextResponse.json({ error: "この連絡はまだチャットを開始できません。" }, { status: 400 });
    }

    const updated = await appendContactMessage({
      postId,
      contactId,
      senderUserId: userId,
      senderName: session?.user?.name ?? null,
      body: messageBody,
    });

    const counterpartUserId = contact.senderUserId === userId ? contact.recipientUserId : contact.senderUserId;

    void publishLineNotification({
      type: "contact.message.created",
      recipientUserId: counterpartUserId,
      message: "新しいチャットメッセージが届きました。",
      metadata: {
        contactId: updated.contactId,
        postId: updated.postId,
        senderUserId: userId,
      },
    });

    const newestMessage = updated.messages.at(-1);

    return NextResponse.json(
      {
        contactId: updated.contactId,
        message: newestMessage ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to append contact message", error);
    const message = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
