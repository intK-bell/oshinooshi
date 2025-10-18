"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../../components/Header";
import { formatSimilarityPercentage } from "../../lib/affinitySimilarity";
import { POST_CATEGORIES, POST_GROUPS } from "../../constants/postOptions";

type SearchPost = {
  postId: string;
  status: "draft" | "published";
  title: string;
  categories: string[];
  body: string;
  group: string | null;
  images: string[];
  haveMembers: string[];
  wantMembers: string[];
  createdAt: string | null;
  updatedAt: string | null;
  affinitySimilarity: number | null;
};

type ViewerPostSummary = {
  postId: string;
  title: string;
  group: string | null;
  categories: string[];
  haveMembers: string[];
  wantMembers: string[];
  updatedAt: string | null;
};

const groupOptions = ["すべて", ...POST_GROUPS.filter((group) => group !== "未選択")];
const categoryOptions = ["指定なし", ...POST_CATEGORIES];

function formatDate(value: string | null) {
  if (!value) {
    return "更新日時なし";
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

export default function SearchPage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState(groupOptions[0]);
  const [category, setCategory] = useState(categoryOptions[0]);
  const [activeFilters, setActiveFilters] = useState({
    keyword: "",
    group: groupOptions[0],
    category: categoryOptions[0],
  });
  const [myPosts, setMyPosts] = useState<ViewerPostSummary[]>([]);
  const [myPostsState, setMyPostsState] = useState<"idle" | "loading" | "error">("idle");
  const [myPostsError, setMyPostsError] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string>("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiSuggestionState, setAiSuggestionState] = useState<"idle" | "loading">("idle");
  const [aiSuggestionError, setAiSuggestionError] = useState<string | null>(null);

  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasAnySimilarity = useMemo(
    () => posts.some((post) => typeof post.affinitySimilarity === "number"),
    [posts],
  );
  const showSimilarityReminder = useMemo(
    () => !isLoading && posts.length > 0 && !hasAnySimilarity,
    [isLoading, posts.length, hasAnySimilarity],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadPosts() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams();
        params.set("status", "published");
        params.set("limit", "60");

        if (activeFilters.group !== groupOptions[0]) {
          params.set("group", activeFilters.group);
        }
        if (activeFilters.category !== categoryOptions[0]) {
          params.set("category", activeFilters.category);
        }
        if (activeFilters.keyword.trim().length > 0) {
          params.set("keyword", activeFilters.keyword.trim());
        }

        const response = await fetch(`/api/search/posts?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `検索に失敗しました。（${response.status}）`);
        }

        const data = (await response.json()) as { posts?: Array<Record<string, unknown>> };
        const normalizedPosts: SearchPost[] = (data.posts ?? []).map((post) => {
          const categories = Array.isArray(post.categories)
            ? (post.categories as unknown[]).filter((value): value is string => typeof value === "string")
            : [];
          const images = Array.isArray(post.images)
            ? (post.images as unknown[]).filter((value): value is string => typeof value === "string")
            : [];

          return {
            postId: typeof post.postId === "string" ? post.postId : "",
            status: post.status === "draft" ? "draft" : "published",
            title: typeof post.title === "string" ? post.title : "",
            categories,
            body: typeof post.body === "string" ? post.body : "",
            group: typeof post.group === "string" ? post.group : null,
            images,
            haveMembers: Array.isArray(post.haveMembers)
              ? (post.haveMembers as unknown[]).filter((value): value is string => typeof value === "string")
              : [],
            wantMembers: Array.isArray(post.wantMembers)
              ? (post.wantMembers as unknown[]).filter((value): value is string => typeof value === "string")
              : [],
            createdAt: typeof post.createdAt === "string" ? post.createdAt : null,
            updatedAt: typeof post.updatedAt === "string" ? post.updatedAt : null,
            affinitySimilarity: typeof post.affinitySimilarity === "number" ? post.affinitySimilarity : null,
          };
        });
        setPosts(normalizedPosts);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to load posts for search", error);
        setErrorMessage((error as Error).message || "検索に失敗しました。時間をおいて再度お試しください。");
        setPosts([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadPosts();

    return () => controller.abort();
  }, [activeFilters]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyPosts([]);
      setMyPostsState("idle");
      setMyPostsError(null);
      setSelectedPostId("");
      return;
    }

    const controller = new AbortController();
    setMyPostsState("loading");
    setMyPostsError(null);

    fetch("/api/posts?status=published", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `投稿の取得に失敗しました。（${response.status}）`);
        }
        return response.json() as Promise<{ posts?: Array<Record<string, unknown>> }>;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        const normalized: ViewerPostSummary[] = (data.posts ?? [])
          .map((post) => {
            const categories = Array.isArray(post.categories)
              ? (post.categories as unknown[]).filter((value): value is string => typeof value === "string")
              : [];
            const haveMembers = Array.isArray(post.haveMembers)
              ? (post.haveMembers as unknown[]).filter((value): value is string => typeof value === "string")
              : [];
            const wantMembers = Array.isArray(post.wantMembers)
              ? (post.wantMembers as unknown[]).filter((value): value is string => typeof value === "string")
              : [];

            return {
              postId: typeof post.postId === "string" ? post.postId : "",
              title: typeof post.title === "string" ? post.title : "",
              group: typeof post.group === "string" ? post.group : null,
              categories,
              haveMembers,
              wantMembers,
              updatedAt: typeof post.updatedAt === "string" ? post.updatedAt : null,
            };
          })
          .filter((post) => post.postId.length > 0);

        setMyPosts(normalized);
        setMyPostsState("idle");
        setSelectedPostId((prev) => {
          if (prev && normalized.some((post) => post.postId === prev)) {
            return prev;
          }
          return normalized.length > 0 ? normalized[0].postId : "";
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load viewer posts for AI suggestion", error);
        setMyPosts([]);
        setMyPostsState("error");
        setMyPostsError((error as Error).message || "投稿の取得に失敗しました。");
        setSelectedPostId("");
      });

    return () => controller.abort();
  }, [isAuthenticated]);

  const selectedPost = useMemo(
    () => myPosts.find((post) => post.postId === selectedPostId) ?? null,
    [myPosts, selectedPostId],
  );

  useEffect(() => {
    setAiSuggestionError(null);
    setAiSuggestion(null);
  }, [selectedPostId]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setActiveFilters({
      keyword,
      group,
      category,
    });
  };

  const handleGenerateSuggestion = async () => {
    if (!isAuthenticated) {
      setAiSuggestionError("AI検索を利用するにはログインが必要です。");
      return;
    }
    if (!selectedPost) {
      setAiSuggestionError("AI検索に利用する投稿を選択してください。");
      return;
    }
    if (selectedPost.wantMembers.length === 0) {
      setAiSuggestionError("探しているメンバーが登録されている投稿を選択してください。");
      return;
    }

    setAiSuggestionState("loading");
    setAiSuggestionError(null);
    setAiSuggestion(null);

    try {
      const response = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          group: selectedPost.group ?? "",
          series: selectedPost.title,
          categories: selectedPost.categories,
          haveMembers: selectedPost.haveMembers,
          wantMembers: selectedPost.wantMembers,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { suggestion?: string; error?: string };

      if (!response.ok || !data.suggestion) {
        throw new Error(data.error ?? `AIサジェストの生成に失敗しました。（${response.status}）`);
      }

      const suggestionText = data.suggestion.trim();
      setAiSuggestion(suggestionText);

      const nextKeyword = selectedPost.wantMembers.join(" ").trim();
      const nextGroup =
        selectedPost.group && groupOptions.includes(selectedPost.group) ? selectedPost.group : groupOptions[0];
      const nextCategory =
        selectedPost.categories
          .map((value) => (categoryOptions.includes(value) ? value : null))
          .find((value): value is string => Boolean(value)) ?? categoryOptions[0];

      setKeyword(nextKeyword);
      setGroup(nextGroup);
      setCategory(nextCategory);
      setActiveFilters({
        keyword: nextKeyword,
        group: nextGroup,
        category: nextCategory,
      });
    } catch (error) {
      console.error("Failed to generate AI suggestion", error);
      setAiSuggestionError((error as Error).message || "AIサジェストの生成に失敗しました。");
    } finally {
      setAiSuggestionState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-5 py-14">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold">交換投稿を探す</h1>
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                手元にあるメンバーや探しているメンバーが近い交換相手を見つけましょう。
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-end"
          >
            <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
              キーワード
              <input
                className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                placeholder="例: 櫻坂46 生写真"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
              推し・グループ
              <select
                className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                {groupOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
              グッズ種別
              <select
                className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categoryOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent-emerald)] px-4 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm"
              >
                条件で絞り込む
              </button>
            </div>
          </form>
        </section>

        {isAuthenticated && (
          <section className="mt-8 space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6">
            <header className="space-y-1">
              <h2 className="text-sm font-semibold text-[#0b1f33]">自分の投稿からAI検索</h2>
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                公開済みの投稿を選ぶと、AI が条件に合いそうな検索設定と次のアクションを提案します。
              </p>
            </header>

            {myPostsState === "loading" ? (
              <p className="text-xs text-[color:var(--color-fg-muted)]">投稿を読み込んでいます…</p>
            ) : myPostsState === "error" ? (
              <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">
                {myPostsError ?? "投稿の取得に失敗しました。時間をおいて再度お試しください。"}
              </p>
            ) : myPosts.length === 0 ? (
              <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-5 text-xs text-[color:var(--color-fg-muted)]">
                <p>まだ公開済みの投稿がありません。投稿を作成すると AI 検索が利用できます。</p>
                <Link
                  href="/post/new"
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface)]"
                >
                  投稿を作成する
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
                  投稿を選択
                  <select
                    className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                    value={selectedPostId}
                    onChange={(event) => setSelectedPostId(event.target.value)}
                  >
                    {myPosts.map((post) => (
                      <option key={post.postId} value={post.postId}>
                        {post.title || "タイトル未設定"}（更新: {formatDate(post.updatedAt)}）
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSuggestion}
                  disabled={aiSuggestionState === "loading"}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent-emerald)] px-4 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm disabled:opacity-60"
                >
                  {aiSuggestionState === "loading" ? "AI検索中…" : "AI検索を実行"}
                </button>
              </div>
            )}

            {aiSuggestionError && (
              <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">
                {aiSuggestionError}
              </p>
            )}

            {aiSuggestion && (
              <div className="space-y-2 rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-4 text-xs text-[color:var(--color-fg-muted)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0b1f33]">AI提案</p>
                <p className="whitespace-pre-wrap leading-relaxed">{aiSuggestion}</p>
                <p className="text-[10px] text-[color:var(--color-fg-muted)]">
                  ※ 提案内容に応じて検索条件を自動で反映しています。
                </p>
              </div>
            )}
          </section>
        )}

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between text-xs text-[color:var(--color-fg-muted)]">
            <p>
              検索結果 <span className="font-semibold text-[#0b1f33]">{isLoading ? "--" : posts.length}</span> 件
            </p>
            <div className="flex gap-3">
              <span className="text-[color:var(--color-fg-muted)]">最新順に表示</span>
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">
              {errorMessage}
            </p>
          )}

          {isLoading ? (
            <p className="text-xs text-[color:var(--color-fg-muted)]">検索中です…</p>
          ) : posts.length === 0 ? (
            <p className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-5 text-xs text-[color:var(--color-fg-muted)]">
              条件に一致する投稿が見つかりませんでした。条件を変えて再度お試しください。
            </p>
          ) : (
            <>
              {showSimilarityReminder && (
                <p className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
                  {isAuthenticated
                    ? "推し傾向アンケートに回答すると類似度スコアが表示されます。"
                    : "ログインして推し傾向アンケートに回答すると類似度スコアが表示されます。"}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const similarityPercentage = formatSimilarityPercentage(post.affinitySimilarity);
                const similarityLabel =
                  similarityPercentage !== null
                    ? `${similarityPercentage}%`
                    : isAuthenticated
                      ? "アンケート未回答"
                      : "ログインで表示";
                const similarityHighlight = similarityPercentage !== null;

                return (
                  <Link
                    key={post.postId}
                    href={`/post/${post.postId}`}
                    className="group flex h-full flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-xs text-[color:var(--color-fg-muted)] transition hover:border-[color:var(--color-accent-emerald)] hover:shadow-sm"
                  >
                    {post.images.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)] group-hover:border-[color:var(--color-accent-emerald)]">
                        <img
                          src={post.images[0]}
                          alt={`${post.title} の画像`}
                          className="h-36 w-full object-cover transition duration-200 group-hover:scale-[1.01]"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="rounded-full bg-[color:var(--color-accent-emerald)]/30 px-3 py-1 text-[color:var(--color-accent-emerald-ink)]">
                        同種交換
                      </span>
                      <span>{formatDate(post.updatedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[color:var(--color-fg-muted)]">
                      <span>推し類似度</span>
                      <span
                        className={
                          similarityHighlight
                            ? "font-semibold text-[color:var(--color-accent-emerald-ink)]"
                            : ""
                        }
                      >
                        {similarityLabel}
                      </span>
                    </div>
                    <h2 className="text-sm font-semibold text-[#0b1f33]">{post.title}</h2>
                    {post.group && <p>推し・グループ: {post.group}</p>}
                    {post.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.categories.map((categoryValue) => (
                          <span key={categoryValue} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                            {categoryValue}
                          </span>
                        ))}
                      </div>
                    )}
                    {post.haveMembers.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-[#0b1f33]">手元にあるメンバー</p>
                        <div className="flex flex-wrap gap-2">
                          {post.haveMembers.map((member) => (
                            <span key={`${post.postId}-have-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
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
                            <span key={`${post.postId}-want-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                              {member}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {post.body && <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{post.body}</p>}
                  </Link>
                );
              })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
