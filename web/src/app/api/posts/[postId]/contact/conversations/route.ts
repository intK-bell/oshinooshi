import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPostById } from "@/lib/postRepository";
import { listContactsByPost } from "@/lib/postContactRepository";

export async function GET(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;

  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await context.params;

  try {
    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const allContacts = await listContactsByPost(postId);

    const isOwner = Boolean(post.userId && post.userId === viewerId);
    const relevantContacts = isOwner
      ? allContacts
      : allContacts.filter((contact) => contact.senderUserId === viewerId || contact.recipientUserId === viewerId);

    const payload = relevantContacts.map((contact) => ({
      contactId: contact.contactId,
      postId: contact.postId,
      status: contact.status,
      type: contact.type,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      sender: {
        userId: contact.senderUserId,
        name: contact.senderName,
      },
      recipient: {
        userId: contact.recipientUserId,
        name: null,
      },
      messages: contact.messages.map((message) => ({
        messageId: message.messageId,
        body: message.body,
        senderUserId: message.senderUserId,
        senderName: message.senderName,
        createdAt: message.createdAt,
      })),
    }));

    return NextResponse.json(
      {
        contacts: payload,
        viewerRole: isOwner ? "owner" : "sender",
        ownerUserId: post.userId ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to load post conversations", error);
    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
