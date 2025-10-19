/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Header } from "@/components/Header";
import { PostInteractionPanel } from "@/components/PostInteractionPanel";
import { authOptions } from "@/lib/authOptions";
import { computeAffinitySimilarity, formatSimilarityPercentage, type AffinityAnswers } from "@/lib/affinitySimilarity";
import { getAffinityAnswers } from "@/lib/profileRepository";
import { getPublishedPostById } from "@/lib/postRepository";

type PageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;

  const post = await getPublishedPostById(postId);

  if (!post) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const isOwnPost = Boolean(session?.user?.id && post.userId && session.user.id === post.userId);

  const viewerId = session?.user?.id ?? null;
  const sellerId = post.userId ?? null;

  let viewerAnswers: AffinityAnswers | null = null;
  let sellerAnswers: AffinityAnswers | null = null;
  let viewerHasSurvey = false;
  let sellerHasSurvey = false;

  if (viewerId) {
    try {
      viewerAnswers = await getAffinityAnswers(viewerId);
      viewerHasSurvey = Array.isArray(viewerAnswers) && viewerAnswers.some((answer) => typeof answer === "number");
    } catch (error) {
      console.warn("Failed to load viewer affinity answers", error);
    }
  }

  if (sellerId) {
    if (sellerId === viewerId && viewerAnswers) {
      sellerAnswers = viewerAnswers;
      sellerHasSurvey = viewerHasSurvey;
    } else {
      try {
        sellerAnswers = await getAffinityAnswers(sellerId);
        sellerHasSurvey = Array.isArray(sellerAnswers) && sellerAnswers.some((answer) => typeof answer === "number");
      } catch (error) {
        console.warn(`Failed to load seller affinity answers for ${sellerId}`, error);
      }
    }
  }

  const affinitySimilarity = viewerAnswers && sellerAnswers ? computeAffinitySimilarity(viewerAnswers, sellerAnswers) : null;
  const similarityPercentage = formatSimilarityPercentage(affinitySimilarity);
  const similarityMessage = !viewerId
    ? "ログインして推し傾向アンケートに回答すると類似度が表示されます。"
    : !viewerHasSurvey
      ? "推し傾向アンケートに回答すると類似度が表示されます。"
      : !sellerHasSurvey
        ? "出品者がアンケート未回答のため、類似度はまだ表示できません。"
        : "推し傾向アンケートの回答をもとに算出しています。";

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-14">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <header className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-[color:var(--color-fg-muted)]">
                <span className="rounded-full bg-[color:var(--color-accent-emerald)]/40 px-3 py-1 font-semibold text-[color:var(--color-accent-emerald-ink)]">
                  同種交換
                </span>
                {post.group && <span>推し・グループ: {post.group}</span>}
                {post.updatedAt && <span>更新: {formatDetailDate(post.updatedAt)}</span>}
              </div>
              <h1 className="text-2xl font-semibold leading-snug text-[#0b1f33]">{post.title}</h1>
            </header>

            {post.images.length > 0 && (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
                  <img
                    src={post.images[0]}
                    alt={`${post.title} の画像`}
                    className="h-72 w-full object-cover"
                  />
                </div>
                {post.images.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {post.images.slice(1).map((image: string) => (
                      <div
                        key={image}
                        className="h-20 w-20 overflow-hidden rounded-lg border border-[color:var(--color-border)]"
                      >
                        <img src={image} alt="投稿画像" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 text-xs text-[color:var(--color-fg-muted)]">
              <h2 className="text-sm font-semibold text-[#0b1f33]">詳細</h2>
              <p className="whitespace-pre-wrap leading-relaxed">{post.body || "詳細情報は未入力です。"}</p>
            </div>

            {post.categories.length > 0 && (
              <div className="space-y-3 text-xs text-[color:var(--color-fg-muted)]">
                <h2 className="text-sm font-semibold text-[#0b1f33]">グッズ種別</h2>
                <div className="flex flex-wrap gap-2">
                  {post.categories.map((category: string) => (
                    <span key={category} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(post.haveMembers.length > 0 || post.wantMembers.length > 0) && (
              <div className="space-y-3 text-xs text-[color:var(--color-fg-muted)]">
                <h2 className="text-sm font-semibold text-[#0b1f33]">交換条件</h2>
                {post.haveMembers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#0b1f33]">手元にあるメンバー</p>
                    <div className="flex flex-wrap gap-2">
                      {post.haveMembers.map((member) => (
                        <span key={`detail-have-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                          {member}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {post.wantMembers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#0b1f33]">探しているメンバー</p>
                    <div className="flex flex-wrap gap-2">
                      {post.wantMembers.map((member) => (
                        <span key={`detail-want-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                          {member}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-white p-4 text-xs text-[color:var(--color-fg-muted)]">
              <h2 className="text-sm font-semibold text-[#0b1f33]">推し傾向の類似度</h2>
              {similarityPercentage !== null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-[#0b1f33]">{similarityPercentage}%</span>
                    <span className="text-[10px] text-[color:var(--color-fg-muted)]">一致度</span>
                  </div>
                  <p className="text-[10px] text-[color:var(--color-fg-muted)]">推し傾向アンケートの回答から算出しています。</p>
                </>
              ) : (
                <p className="text-[10px] leading-relaxed text-[color:var(--color-fg-muted)]">{similarityMessage}</p>
              )}
            </div>
            <div className="space-y-2 text-xs text-[color:var(--color-fg-muted)]">
              <h2 className="text-sm font-semibold text-[#0b1f33]">連絡する</h2>
              <p>
                投稿者にチャットで連絡したり、交換・譲渡のリクエストを送信できます。気になる点があればメッセージを添えてみましょう。
              </p>
            </div>
            <PostInteractionPanel
              postId={post.postId}
              postTitle={post.title}
              isOwnPost={isOwnPost}
            />
          </aside>
        </section>
      </main>
    </div>
  );
}

function formatDetailDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
