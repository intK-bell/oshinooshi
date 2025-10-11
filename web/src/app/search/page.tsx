"use client";

import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { POST_CATEGORIES, POST_GROUPS } from "../../constants/postOptions";

type PostTypeFilter = "all" | "offer" | "request";

type SearchPost = {
  postId: string;
  status: "draft" | "published";
  postType: "offer" | "request";
  title: string;
  categories: string[];
  body: string;
  group: string | null;
  images: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

const postTypeChips: Array<{ label: string; value: PostTypeFilter }> = [
  { label: "全て", value: "all" },
  { label: "譲ります", value: "offer" },
  { label: "求めます", value: "request" },
];

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
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState(groupOptions[0]);
  const [category, setCategory] = useState(categoryOptions[0]);
  const [selectedPostType, setSelectedPostType] = useState<PostTypeFilter>("all");
  const [activeFilters, setActiveFilters] = useState({
    keyword: "",
    group: groupOptions[0],
    category: categoryOptions[0],
    postType: "all" as PostTypeFilter,
  });

  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPosts() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams();
        params.set("status", "published");
        params.set("limit", "60");

        if (activeFilters.postType !== "all") {
          params.set("postType", activeFilters.postType);
        }
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

        const data = (await response.json()) as { posts?: SearchPost[] };
        setPosts(data.posts ?? []);
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

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setActiveFilters({
      keyword,
      group,
      category,
      postType: selectedPostType,
    });
  };

  const handleChipClick = (value: PostTypeFilter) => {
    if (selectedPostType === value) {
      return;
    }
    setSelectedPostType(value);
    setActiveFilters({
      keyword,
      group,
      category,
      postType: value,
    });
  };

  const statusLabel = (value: "offer" | "request") => (value === "offer" ? "譲ります" : "求めます");

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-5 py-14">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold">投稿を探す</h1>
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                キーワード・推し・グッズ種別で絞り込みができます。
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
            <div className="sm:col-span-3 flex flex-wrap gap-2 text-xs text-[color:var(--color-fg-muted)]">
              {postTypeChips.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => handleChipClick(chip.value)}
                  className={`rounded-full border px-3 py-1 transition ${
                    selectedPostType === chip.value
                      ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/40 text-[#0b1f33]"
                      : "border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-2)]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article
                  key={post.postId}
                  className="flex h-full flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-xs text-[color:var(--color-fg-muted)]"
                >
                  {post.images.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
                      <img
                        src={post.images[0]}
                        alt={`${post.title} の画像`}
                        className="h-36 w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="rounded-full bg-[color:var(--color-accent-emerald)]/30 px-3 py-1 text-[color:var(--color-accent-emerald-ink)]">
                      {statusLabel(post.postType)}
                    </span>
                    <span>{formatDate(post.updatedAt)}</span>
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
                  {post.body && <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{post.body}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
