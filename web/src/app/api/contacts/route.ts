import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { listContactsForRecipient, listContactsForSender, type ContactRecord } from "../../../lib/postContactRepository";
import { getPostById } from "../../../lib/postRepository";
import { getProfileBasics } from "../../../lib/profileRepository";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const roleParam = searchParams.get("role");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
  const normalizedRole =
    roleParam === "sender" || roleParam === "all" || roleParam === "recipient" ? roleParam : "recipient";

  try {
    let contacts: ContactRecord[] = [];
    let nextCursor: string | null = null;

    if (normalizedRole === "sender") {
      const result = await listContactsForSender(userId, {
        status: status && status.length > 0 ? status : null,
        cursor: cursor && cursor.length > 0 ? cursor : null,
        limit: normalizedLimit,
      });
      contacts = result.contacts;
      nextCursor = result.nextCursor ?? null;
    } else if (normalizedRole === "all") {
      const [recipientResult, senderResult] = await Promise.all([
        listContactsForRecipient(userId, { status: null, cursor: null, limit: undefined }),
        listContactsForSender(userId, { status: null, cursor: null, limit: undefined }),
      ]);

      const merged = new Map<string, ContactRecord>();
      [...recipientResult.contacts, ...senderResult.contacts].forEach((contact) => {
        merged.set(contact.contactId, contact);
      });

      contacts = Array.from(merged.values());

      if (status && status.length > 0) {
        contacts = contacts.filter((contact) => contact.status === status);
      }

      contacts.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      if (normalizedLimit && normalizedLimit > 0) {
        contacts = contacts.slice(0, normalizedLimit);
      }
    } else {
      const result = await listContactsForRecipient(userId, {
        status: status && status.length > 0 ? status : null,
        cursor: cursor && cursor.length > 0 ? cursor : null,
        limit: normalizedLimit,
      });
      contacts = result.contacts;
      nextCursor = result.nextCursor ?? null;
    }

    const uniquePostIds = Array.from(new Set(contacts.map((contact) => contact.postId).filter(Boolean)));
    const postSummaries: Record<
      string,
      {
        title: string;
        postType: "offer" | "request" | "trade";
        status: string;
        images: string[];
        group: string | null;
        haveMembers: string[];
        wantMembers: string[];
      }
    > = {};

    await Promise.all(
      uniquePostIds.map(async (postId) => {
        try {
          const post = await getPostById(postId);
          if (post) {
            postSummaries[postId] = {
              title: post.title,
              postType: post.postType,
              status: post.status,
              images: Array.isArray(post.images) ? post.images : [],
              group: typeof post.group === "string" ? post.group : null,
              haveMembers: Array.isArray(post.haveMembers) ? post.haveMembers : [],
              wantMembers: Array.isArray(post.wantMembers) ? post.wantMembers : [],
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch post ${postId} for contact summary`, error);
        }
      }),
    );

    const uniqueUserIds = Array.from(
      new Set(
        contacts
          .flatMap((contact) => [contact.senderUserId, contact.recipientUserId])
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    const profileBasicsMap = await getProfileBasics(uniqueUserIds);

    const payload = contacts.map((contact) => ({
      contactId: contact.contactId,
      postId: contact.postId,
      type: contact.type,
      status: contact.status,
      message: contact.message,
      lineRequestStatus: contact.lineRequestStatus ?? null,
      lineRequestUpdatedAt: contact.lineRequestUpdatedAt ?? null,
      sender: {
        userId: contact.senderUserId,
        name: contact.senderName ?? profileBasicsMap.get(contact.senderUserId)?.displayName ?? null,
        uuid: contact.senderUuid,
        lineFriendUrl: profileBasicsMap.get(contact.senderUserId)?.lineFriendUrl ?? null,
      },
      recipient: {
        userId: contact.recipientUserId,
        name: profileBasicsMap.get(contact.recipientUserId)?.displayName ?? null,
        lineFriendUrl: profileBasicsMap.get(contact.recipientUserId)?.lineFriendUrl ?? null,
      },
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      post: postSummaries[contact.postId] ?? null,
      viewerRole: contact.senderUserId === userId ? "sender" : "recipient",
    }));

    return NextResponse.json(
      {
        contacts: payload,
        nextCursor,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to list contacts for recipient", error);
    const message = error instanceof Error ? error.message : "Failed to load contacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
