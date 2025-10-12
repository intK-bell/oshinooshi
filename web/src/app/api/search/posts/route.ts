import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { computeAffinitySimilarity } from "../../../../lib/affinitySimilarity";
import type { AffinityAnswers } from "../../../../lib/affinitySimilarity";
import { getAffinityAnswers } from "../../../../lib/profileRepository";
import { searchPublishedPosts } from "../../../../lib/postRepository";

function normalizeStatus(value: string | null) {
  if (value === "draft" || value === "published") {
    return value;
  }
  return "published";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const normalizedStatus = normalizeStatus(searchParams.get("status"));
  const normalizedGroup = searchParams.get("group")?.trim() || undefined;
  const normalizedCategory = searchParams.get("category")?.trim() || undefined;
  const keyword = searchParams.get("keyword")?.trim() || "";
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "60", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 60;

  try {
    if (normalizedStatus !== "published") {
      return NextResponse.json({ posts: [] });
    }

    let viewerAnswers: AffinityAnswers | null = null;

    if (viewerId) {
      try {
        viewerAnswers = await getAffinityAnswers(viewerId);
      } catch (error) {
        console.warn("Failed to load viewer affinity answers", error);
      }
    }

    const posts = await searchPublishedPosts({
      group: normalizedGroup,
      category: normalizedCategory,
      keyword,
      limit,
    });

    const similarityByPostId = new Map<string, number | null>();

    if (viewerAnswers) {
      const uniqueSellerIds = Array.from(
        new Set(posts.map((post) => post.userId).filter((value): value is string => Boolean(value)))
      );

      const sellerAnswerCache = new Map<string, AffinityAnswers | null>();

      await Promise.all(
        uniqueSellerIds.map(async (sellerId) => {
          if (sellerId === viewerId) {
            sellerAnswerCache.set(sellerId, viewerAnswers);
            return;
          }
          try {
            const answers = await getAffinityAnswers(sellerId);
            sellerAnswerCache.set(sellerId, answers);
          } catch (error) {
            console.warn(`Failed to load affinity answers for seller ${sellerId}`, error);
            sellerAnswerCache.set(sellerId, null);
          }
        })
      );

      for (const post of posts) {
        if (!post.userId) {
          similarityByPostId.set(post.postId, null);
          continue;
        }

        const sellerAnswers = sellerAnswerCache.get(post.userId) ?? null;
        if (!sellerAnswers) {
          similarityByPostId.set(post.postId, null);
          continue;
        }

        const similarity = computeAffinitySimilarity(viewerAnswers, sellerAnswers);
        similarityByPostId.set(post.postId, similarity);
      }
    }

    const sanitizedPosts = posts.map(({ userId: _unused, ...rest }) => {
      void _unused;
      return {
        ...rest,
        affinitySimilarity: similarityByPostId.get(rest.postId) ?? null,
      };
    });

    return NextResponse.json({
      posts: sanitizedPosts,
    });
  } catch (error) {
    console.error("Failed to search posts", error);
    return NextResponse.json(
      { error: "投稿の検索に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
