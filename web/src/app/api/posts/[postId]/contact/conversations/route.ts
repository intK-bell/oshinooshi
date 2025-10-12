import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPostById } from "@/lib/postRepository";
import { listContactsByPost } from "@/lib/postContactRepository";
import { getLineFriendUrls } from "@/lib/profileRepository";

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

    const postSummary = {
      postId: post.postId,
      title: post.title,
      postType: post.postType,
      status: post.status,
      images: Array.isArray(post.images) ? post.images : [],
      categories: Array.isArray(post.categories) ? post.categories : [],
      body: typeof post.body === "string" ? post.body : null,
      group: typeof post.group === "string" ? post.group : null,
      haveMembers: Array.isArray(post.haveMembers) ? post.haveMembers : [],
      wantMembers: Array.isArray(post.wantMembers) ? post.wantMembers : [],
    } as const;

    const allContacts = await listContactsByPost(postId);

    const isOwner = Boolean(post.userId && post.userId === viewerId);
    const relevantContacts = isOwner
      ? allContacts
      : allContacts.filter((contact) => contact.senderUserId === viewerId || contact.recipientUserId === viewerId);

    const uniqueUserIds = Array.from(
      new Set(
        relevantContacts
          .flatMap((contact) => [contact.senderUserId, contact.recipientUserId])
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    const friendUrlMap = await getLineFriendUrls(uniqueUserIds);

    const payload = relevantContacts.map((contact) => ({
      contactId: contact.contactId,
      postId: contact.postId,
      status: contact.status,
      type: contact.type,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      lineRequestStatus: contact.lineRequestStatus ?? null,
      lineRequestUpdatedAt: contact.lineRequestUpdatedAt ?? null,
      sender: {
        userId: contact.senderUserId,
        name: contact.senderName,
        lineFriendUrl: friendUrlMap.get(contact.senderUserId) ?? null,
      },
      recipient: {
        userId: contact.recipientUserId,
        name: null,
        lineFriendUrl: friendUrlMap.get(contact.recipientUserId) ?? null,
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
        post: postSummary,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to load post conversations", error);
    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
