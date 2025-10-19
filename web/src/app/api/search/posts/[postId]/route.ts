import { NextResponse } from "next/server";
import { getPublishedPostById } from "../../../../../lib/postRepository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const { postId } = await context.params;

  try {
    const post = await getPublishedPostById(postId);

    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { userId, ...rest } = post;
    void userId;
    return NextResponse.json({ post: rest });
  } catch (error) {
    console.error("Failed to load post for public view", error);
    return NextResponse.json(
      { error: "投稿の取得に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
