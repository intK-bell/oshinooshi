"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../../components/Header";

type Recommendation = {
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

type ViewerMeta = {
  hasPublishedPosts: boolean;
  postsCount: number;
};

type RecommendationResponse = {
  matches?: Recommendation[];
  meta?: {
    viewer?: ViewerMeta;
  };
  error?: string;
};

const STATUS_MOCK_SECTIONS = [
  {
    title: "チャット中",
    description: "条件のすり合わせを行っている取引です。72時間を目安にレスポンスしましょう。",
    items: [
      {
        id: 1,
        counterpart: "ユーザーA",
        summary: "乃木坂46 生写真コンプ ↔ 櫻坂46 アクスタ",
        updated: "12分前",
        nextStep: "条件が固まったら申請を送りましょう。",
      },
      {
        id: 2,
        counterpart: "ユーザーB",
        summary: "日向坂46 ミーグリチェキ ↔ グッズセット",
        updated: "45分前",
        nextStep: "相手からの返信待ちです。",
      },
    ],
  },
  {
    title: "申請中",
    description: "承認待ちの状態です。24時間以内に返信がない場合はリマインドを送りましょう。",
    items: [
      {
        id: 3,
        counterpart: "ユーザーC",
        summary: "櫻坂46 缶バッジ ↔ 乃木坂46 うちわ",
        updated: "3時間前",
        nextStep: "リマインドを検討してください。",
      },
    ],
  },
  {
    title: "受け渡し調整中",
    description: "チャットで配送方法と日程調整を進めてください。",
    items: [
      {
        id: 4,
        counterpart: "ユーザーD",
        summary: "櫻坂46 ポストカード ↔ 日向坂46 ランダムフォト",
        updated: "昨日",
        nextStep: "配送準備が整ったら評価待ちに進みます。",
      },
    ],
  },
  {
    title: "評価待ち",
    description: "商品が到着したらお互いに星評価とコメントを残してください。",
    items: [
      {
        id: 5,
        counterpart: "ユーザーE",
        summary: "乃木坂46 マフラータオル ↔ ENJIN CD",
        updated: "2日前",
        nextStep: "発送状況を確認し、評価を依頼しましょう。",
      },
    ],
  },
];

export default function MatchesPage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [viewerMeta, setViewerMeta] = useState<ViewerMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setRecommendations([]);
      setViewerMeta(null);
      setErrorMessage(null);
      setIsUnauthorized(status === "unauthenticated");
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorized(false);

    fetch("/api/matches/recommendations?limit=8", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setIsUnauthorized(true);
          setRecommendations([]);
          setViewerMeta(null);
          return;
        }

        const data = (await response.json().catch(() => ({}))) as RecommendationResponse;

        if (!response.ok) {
          throw new Error(data.error ?? `おすすめマッチの取得に失敗しました。（${response.status}）`);
        }

        setRecommendations(Array.isArray(data.matches) ? data.matches : []);
        setViewerMeta(data.meta?.viewer ?? null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to fetch AI recommendations", error);
        setErrorMessage((error as Error).message ?? "おすすめマッチの取得に失敗しました。");
        setRecommendations([]);
        setViewerMeta(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, status]);

  const hasPublishedPosts = viewerMeta?.hasPublishedPosts ?? false;

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">マッチ状況</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            推し・グループやシリーズ、グッズ種別を名寄せし、条件が噛み合う交換相手をAIが提案します。進行中の取引もこのページから確認できます。
          </p>
        </section>

        {!isAuthenticated && (
          <section className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 text-xs text-[color:var(--color-fg-muted)]">
            <p>マッチの提案を受けるにはログインが必要です。プロフィールの投稿情報を整えると精度が上がります。</p>
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
              >
                トップページへ戻る
              </Link>
            </div>
          </section>
        )}

        {isAuthenticated && (
          <>
            {errorMessage && (
              <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">
                {errorMessage}
              </p>
            )}

            {isUnauthorized && (
              <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">
                セッションが切れています。再度ログインしてください。
              </p>
            )}

            <section className="space-y-4">
              <header className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-[#0b1f33]">AIおすすめマッチ</h2>
                <p className="text-xs text-[color:var(--color-fg-muted)]">
                  手元にあるグッズと探している条件が相互に噛み合う投稿を優先して提案します。
                </p>
              </header>

              {isLoading ? (
                <p className="text-xs text-[color:var(--color-fg-muted)]">おすすめを計算中です…</p>
              ) : recommendations.length === 0 ? (
                <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 text-xs text-[color:var(--color-fg-muted)]">
                  {hasPublishedPosts ? (
                    <p>
                      現時点で条件が噛み合う投稿は見つかりませんでした。投稿の条件を更新するか、検索ページで新着を確認しましょう。
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p>公開済みの投稿がまだありません。投稿を作成すると、AI マッチの提案が表示されます。</p>
                      <Link
                        href="/post/new"
                        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
                      >
                        投稿を作成する
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {recommendations.map((recommendation) => (
                    <RecommendationCard key={`${recommendation.viewerPost.postId}:${recommendation.candidatePost.postId}`} recommendation={recommendation} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <header className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-[#0b1f33]">進行中の取引（モック）</h2>
                <p className="text-xs text-[color:var(--color-fg-muted)]">
                  取引管理のUIサンプルです。チャット・申請・受け渡し状況の API 連携は今後追加予定です。
                </p>
              </header>
              <div className="space-y-6">
                {STATUS_MOCK_SECTIONS.map((section) => (
                  <section key={section.title} className="space-y-4">
                    <header className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-[#0b1f33]">{section.title}</h3>
                      <p className="text-xs text-[color:var(--color-fg-muted)]">{section.description}</p>
                    </header>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {section.items.map((item) => (
                        <article
                          key={item.id}
                          className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-4 text-xs text-[color:var(--color-fg-muted)]"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-[#0b1f33]">{item.counterpart}</span>
                            <span>{item.updated}</span>
                          </div>
                          <p>{item.summary}</p>
                          <p className="text-[11px] italic text-[color:var(--color-fg-muted)]">{item.nextStep}</p>
                          <div className="flex gap-2">
                            <button className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]">
                              詳細を見る
                            </button>
                            <button className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]">
                              リマインド
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

type RecommendationCardProps = {
  recommendation: Recommendation;
};

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const scorePercent = Math.round(recommendation.score.total * 100);
  const counterpartName = recommendation.counterpart.displayName ?? "ユーザー";
  const thumbnail = recommendation.candidatePost.images[0] ?? null;
  const updatedLabel = formatDate(recommendation.candidatePost.updatedAt ?? recommendation.candidatePost.createdAt);
  const counterpartGroup = recommendation.candidatePost.group ?? "推し未設定";
  const seriesLabel = recommendation.candidatePost.title || "シリーズ未設定";
  const commonCategories = recommendation.categoryOverlap.candidate.slice(0, 3).join(" / ");
  const highlightedGive = recommendation.overlap.viewerGives[0] ?? null;
  const highlightedWant = recommendation.overlap.viewerWants[0] ?? null;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-xs text-[color:var(--color-fg-muted)] shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)]">おすすめ度</span>
          <span className="text-2xl font-semibold text-[#0b1f33]">{scorePercent}%</span>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-[10px] text-[color:var(--color-fg-muted)]">
          <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#0b1f33]">推し・グループ: {counterpartGroup}</span>
          <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#0b1f33]">シリーズ: {seriesLabel}</span>
          {commonCategories && (
            <span className="rounded-full bg-white px-3 py-1 text-[color:var(--color-fg-muted)]">共通カテゴリ: {commonCategories}</span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {thumbnail ? (
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-[color:var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnail} alt={`${recommendation.candidatePost.title}のサムネイル`} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[color:var(--color-border)] bg-white text-[10px] text-[color:var(--color-fg-muted)]">
              no image
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">おすすめ相手</p>
            <p className="text-sm font-semibold text-[#0b1f33]">{counterpartName}</p>
            <p className="text-[10px] text-[color:var(--color-fg-muted)]">最終更新 {updatedLabel}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3">
          {(highlightedGive || highlightedWant) && (
            <div className="rounded border border-[color:var(--color-accent-emerald)]/40 bg-[color:var(--color-accent-emerald)]/10 px-3 py-2 text-[10px] text-[color:var(--color-accent-emerald-ink)]">
              {highlightedGive && (
                <p>
                  あなたが出せる <span className="font-semibold">{highlightedGive}</span> を {counterpartName} さんが探しています。
                </p>
              )}
              {highlightedWant && (
                <p>
                  {counterpartName} さんが出している <span className="font-semibold">{highlightedWant}</span> があなたの希望条件に一致します。
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-[#0b1f33]">あなたの投稿</p>
            <p className="font-medium text-[#0b1f33]">{recommendation.viewerPost.title || "タイトル未設定"}</p>
            <MemberList label="出せる" items={recommendation.viewerPost.haveMembers} highlight={recommendation.overlap.viewerGives} />
            <MemberList label="欲しい" items={recommendation.viewerPost.wantMembers} highlight={recommendation.overlap.viewerWants} />
          </div>
          <div className="space-y-2 border-t border-[color:var(--color-border)] pt-3">
            <p className="text-[10px] font-semibold text-[#0b1f33]">相手の投稿</p>
            <p className="font-medium text-[#0b1f33]">{recommendation.candidatePost.title || "タイトル未設定"}</p>
            <div className="flex flex-wrap gap-2">
              {recommendation.candidatePost.categories.map((category) => (
                <span key={category} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[10px]">
                  {category}
                </span>
              ))}
            </div>
            <MemberList label="出せる" items={recommendation.candidatePost.haveMembers} highlight={recommendation.overlap.viewerWants} />
            <MemberList label="欲しい" items={recommendation.candidatePost.wantMembers} highlight={recommendation.overlap.viewerGives} />
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 text-[10px] text-[color:var(--color-fg-muted)]">
          <ScoreBadge label="交換条件" value={recommendation.score.components.trade} />
          <ScoreBadge label="シリーズ/カテゴリ" value={recommendation.score.components.interest} />
          <ScoreBadge label="新着度" value={recommendation.score.components.freshness} />
        </div>
        <div className="flex gap-2">
          <Link
            href={`/post/${recommendation.candidatePost.postId}`}
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
          >
            投稿を開く
          </Link>
          <Link
            href={`/post/manage`}
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[11px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
          >
            条件を調整
          </Link>
        </div>
      </footer>
    </article>
  );
}

type MemberListProps = {
  label: string;
  items: string[];
  highlight: string[];
};

function MemberList({ label, items, highlight }: MemberListProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const highlightSet = new Set(highlight.map((item) => item.trim()));

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-[#0b1f33]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((member) => {
          const trimmed = member.trim();
          const isHighlight = highlightSet.has(trimmed);
          return (
            <span
              key={`${label}-${member}`}
              className={`rounded-full px-3 py-1 text-[10px] ${
                isHighlight
                  ? "bg-[color:var(--color-accent-emerald)]/20 text-[color:var(--color-accent-emerald-ink)]"
                  : "bg-[color:var(--color-surface-2)] text-[#0b1f33]"
              }`}
            >
              {member}
            </span>
          );
        })}
      </div>
    </div>
  );
}

type ScoreBadgeProps = {
  label: string;
  value: number;
};

function ScoreBadge({ label, value }: ScoreBadgeProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <span className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1 text-[10px]">
      {label} {percent}%
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "不明";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
