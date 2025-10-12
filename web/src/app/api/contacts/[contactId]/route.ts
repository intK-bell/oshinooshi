import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { getContact, updateContactStatus } from "../../../../lib/postContactRepository";
import { publishLineNotification } from "../../../../lib/notificationPublisher";

const ALLOWED_STATUSES = new Set(["accepted", "declined", "pending"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId } = await context.params;

  let payload: {
    postId?: string;
    status?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const postId = payload.postId;
  const requestedStatus = payload.status;

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  if (!requestedStatus || !ALLOWED_STATUSES.has(requestedStatus)) {
    return NextResponse.json({ error: "status must be one of pending, accepted, declined" }, { status: 400 });
  }

  try {
    const contact = await getContact(postId, contactId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (contact.recipientUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contact.status === requestedStatus) {
      return NextResponse.json(
        {
          contactId: contact.contactId,
          status: contact.status,
        },
        { status: 200 },
      );
    }

    const updated = await updateContactStatus(postId, contactId, userId, requestedStatus);

    void publishLineNotification({
      type: "contact.request.updated",
      recipientUserId: updated.senderUserId,
      message:
        requestedStatus === "accepted"
          ? "あなたの連絡リクエストが承認されました。"
          : requestedStatus === "declined"
            ? "あなたの連絡リクエストは辞退されました。"
            : "連絡リクエストのステータスが更新されました。",
      metadata: {
        contactId: updated.contactId,
        postId: updated.postId,
        senderUserId: updated.senderUserId,
        recipientUserId: updated.recipientUserId,
        status: updated.status,
      },
    });

    return NextResponse.json(
      {
        contactId: updated.contactId,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to update contact status", error);
    const message = error instanceof Error ? error.message : "Failed to update contact status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
