import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { listPostsByUser, searchPublishedPosts } from "../../../../lib/postRepository";
import { getProfileBasics } from "../../../../lib/profileRepository";
import { buildMatchRecommendations } from "../../../../lib/matchRecommender";

type RecommendationResponseItem = {
  viewerPost: {
    postId: string;
    title: string;
    haveMembers: string[];
    wantMembers: string[];
    group: string | null;
    categories: string[];
  };
  candidatePost: {
    postId: string;
    title: string;
    group: string | null;
    categories: string[];
    images: string[];
    haveMembers: string[];
    wantMembers: string[];
    updatedAt: string | null;
    createdAt: string | null;
  };
  overlap: {
    viewerGives: string[];
    viewerWants: string[];
  };
  counterpart: {
    userId: string | null;
    displayName: string | null;
  };
  categoryOverlap: {
    viewer: string[];
    candidate: string[];
  };
  score: {
    total: number;
    components: {
      trade: number;
      interest: number;
      freshness: number;
    };
  };
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;

  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 10;

  try {
    const viewerPosts = await listPostsByUser(viewerId, { status: "published", limit: 20 });

    if (viewerPosts.length === 0) {
      return NextResponse.json({
        matches: [],
        meta: {
          viewer: {
            hasPublishedPosts: false,
            postsCount: 0,
          },
        },
      });
    }

    const candidateLimit = Math.min(limit * 6, 90);
    const publishedPosts = await searchPublishedPosts({ limit: candidateLimit });
    const candidates = publishedPosts.filter((post) => post.userId !== viewerId);

    const recommendations = buildMatchRecommendations(viewerPosts, candidates, {
      limit,
      minScore: 0.25,
    });

    if (recommendations.length === 0) {
      return NextResponse.json({
        matches: [],
        meta: {
          viewer: {
            hasPublishedPosts: true,
            postsCount: viewerPosts.length,
          },
        },
      });
    }

    const counterpartIds = Array.from(
      new Set(
        recommendations
          .map((recommendation) => recommendation.candidatePost.userId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    const counterpartProfiles = counterpartIds.length > 0 ? await getProfileBasics(counterpartIds) : new Map();

    const payload: RecommendationResponseItem[] = recommendations.map((recommendation) => {
      const counterpartUserId = recommendation.candidatePost.userId;
      const profileBasics = counterpartUserId ? counterpartProfiles.get(counterpartUserId) ?? null : null;

      return {
        viewerPost: {
          postId: recommendation.viewerPost.postId,
          title: recommendation.viewerPost.title,
          haveMembers: recommendation.viewerPost.haveMembers,
          wantMembers: recommendation.viewerPost.wantMembers,
          group: recommendation.viewerPost.group,
          categories: recommendation.viewerPost.categories,
        },
        candidatePost: {
          postId: recommendation.candidatePost.postId,
          title: recommendation.candidatePost.title,
          group: recommendation.candidatePost.group,
          categories: recommendation.candidatePost.categories,
          images: recommendation.candidatePost.images,
          haveMembers: recommendation.candidatePost.haveMembers,
          wantMembers: recommendation.candidatePost.wantMembers,
          updatedAt: recommendation.candidatePost.updatedAt,
          createdAt: recommendation.candidatePost.createdAt,
        },
        overlap: {
          viewerGives: recommendation.overlap.viewerGives,
          viewerWants: recommendation.overlap.viewerWants,
        },
        counterpart: {
          userId: counterpartUserId,
          displayName: profileBasics?.displayName ?? null,
        },
        categoryOverlap: recommendation.categoryOverlap,
        score: recommendation.score,
      };
    });

    return NextResponse.json({
      matches: payload,
      meta: {
        viewer: {
          hasPublishedPosts: true,
          postsCount: viewerPosts.length,
        },
      },
    });
  } catch (error) {
    console.error("Failed to build AI match recommendations", error);
    return NextResponse.json(
      { error: "おすすめマッチの生成に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
