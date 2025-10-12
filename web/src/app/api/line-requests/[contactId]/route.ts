import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getContact, updateLineRequestStatus } from "@/lib/postContactRepository";

const ALLOWED_STATUSES = new Set(["pending_sender", "pending_recipient", "accepted", "declined"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> },
) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;

  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId } = await context.params;

  let payload: { postId?: string; status?: string };
  try {
    payload = (await request.json()) as { postId?: string; status?: string };
  } catch (error) {
    console.error("Invalid line request payload", error);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { postId, status } = payload;

  if (typeof postId !== "string" || postId.length === 0) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "status is invalid" }, { status: 400 });
  }

  try {
    const contact = await getContact(postId, contactId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (contact.senderUserId !== viewerId && contact.recipientUserId !== viewerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await updateLineRequestStatus(postId, contactId, viewerId, status);

    return NextResponse.json(
      {
        contactId: updated.contactId,
        postId: updated.postId,
        lineRequestStatus: updated.lineRequestStatus ?? null,
        lineRequestUpdatedAt: updated.lineRequestUpdatedAt ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to update line request", error);
    const message = error instanceof Error ? error.message : "Failed to update line request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
