import { NextRequest, NextResponse } from "next/server";
import { searchPublishedPosts } from "../../../../lib/postRepository";

function normalizeStatus(value: string | null) {
  if (value === "draft" || value === "published") {
    return value;
  }
  return "published";
}

function normalizePostType(value: string | null) {
  if (value === "offer" || value === "request") {
    return value;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const normalizedStatus = normalizeStatus(searchParams.get("status"));
  const normalizedPostType = normalizePostType(searchParams.get("postType"));
  const normalizedGroup = searchParams.get("group")?.trim() || undefined;
  const normalizedCategory = searchParams.get("category")?.trim() || undefined;
  const keyword = searchParams.get("keyword")?.trim() || "";
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "60", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 60;

  try {
    if (normalizedStatus !== "published") {
      return NextResponse.json({ posts: [] });
    }

    const posts = await searchPublishedPosts({
      postType: normalizedPostType,
      group: normalizedGroup,
      category: normalizedCategory,
      keyword,
      limit,
    });

    const sanitizedPosts = posts.map((post) => {
      const { userId, ...rest } = post;
      void userId;
      return rest;
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
