"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "../../../components/Header";

type PostRecord = {
  postId: string;
  status: string;
  postType: string;
  title: string;
  categories: string[];
  body: string;
  group: string | null;
  images: string[];
  haveMembers: string[];
  wantMembers: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

function formatDate(dateString: string | null) {
  if (!dateString) {
    return "日時未設定";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ManagePostsPage() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, "idle" | "loading">>({});

  const sortByUpdated = (items: PostRecord[]) =>
    [...items].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setActionMessage(null);
    setActionError(null);

    fetch("/api/posts")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load posts: ${response.status}`);
        }
        return response.json() as Promise<{ posts: PostRecord[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setPosts(sortByUpdated(data.posts ?? []));
        }
      })
      .catch((error) => {
        console.error("Failed to fetch posts", error);
        if (!cancelled) {
          setErrorMessage("投稿の取得に失敗しました。時間をおいて再度お試しください。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusToggle = async (postId: string, targetStatus: "draft" | "published") => {
    setActionMessage(null);
    setActionError(null);
    setActionStates((prev) => ({ ...prev, [postId]: "loading" }));

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = (await response.json().catch(() => ({}))) as { post?: PostRecord; error?: string };

      if (!response.ok || !data.post) {
        throw new Error(data.error ?? `Failed to update post (${response.status})`);
      }

      setPosts((prev) => {
        const next = prev.map((post) => (post.postId === data.post!.postId ? data.post! : post));
        return sortByUpdated(next);
      });

      setActionMessage(targetStatus === "published" ? "投稿を公開しました。" : "投稿を下書きに戻しました。");
    } catch (error) {
      console.error("Failed to toggle post status", error);
      setActionError((error as Error).message || "投稿の更新に失敗しました。");
    } finally {
      setActionStates((prev) => {
        const nextStates = { ...prev };
        delete nextStates[postId];
        return nextStates;
      });
    }
  };

  const handleDelete = async (post: PostRecord) => {
    setActionMessage(null);
    setActionError(null);

    const title = post.title && post.title.trim().length > 0 ? post.title.trim() : "この投稿";
    const confirmed = typeof window !== "undefined" && window.confirm(`${title}を削除してよろしいですか？`);
    if (!confirmed) {
      return;
    }

    setActionStates((prev) => ({ ...prev, [post.postId]: "loading" }));

    try {
      const response = await fetch(`/api/posts/${post.postId}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to delete post (${response.status})`);
      }

      setPosts((prev) => prev.filter((item) => item.postId !== post.postId));
      setActionMessage("投稿を削除しました。");
    } catch (error) {
      console.error("Failed to delete post", error);
      setActionError((error as Error).message || "投稿の削除に失敗しました。");
    } finally {
      setActionStates((prev) => {
        const nextStates = { ...prev };
        delete nextStates[post.postId];
        return nextStates;
      });
    }
  };

  const draftPosts = useMemo(() => posts.filter((post) => post.status === "draft"), [posts]);
  const publishedPosts = useMemo(() => posts.filter((post) => post.status === "published"), [posts]);

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">投稿管理</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">下書きと公開済みの投稿を確認・編集できます。</p>
          <div className="flex gap-3 text-xs">
            <Link
              href="/post/new"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] px-4 py-2 font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]"
            >
              新しい投稿を作成
            </Link>
          </div>
        </section>

        {errorMessage && (
          <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">{errorMessage}</p>
        )}
        {actionError && (
          <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">{actionError}</p>
        )}
        {actionMessage && (
          <p className="rounded-lg border border-[#c6f6d5] bg-[#f0fff4] px-4 py-3 text-[11px] text-[#2f855a]">{actionMessage}</p>
        )}

        {isLoading ? (
          <p className="text-xs text-[color:var(--color-fg-muted)]">読み込み中です…</p>
        ) : (
          <div className="space-y-8 text-xs">
            <section className="space-y-3">
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0b1f33]">下書き</h2>
                <span className="text-[color:var(--color-fg-muted)]">{draftPosts.length} 件</span>
              </header>
              <PostList
                posts={draftPosts}
                emptyMessage="下書きはまだありません。"
                onToggleStatus={handleStatusToggle}
                onDelete={handleDelete}
                actionStates={actionStates}
              />
            </section>

            <section className="space-y-3">
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0b1f33]">公開済み</h2>
                <span className="text-[color:var(--color-fg-muted)]">{publishedPosts.length} 件</span>
              </header>
              <PostList
                posts={publishedPosts}
                emptyMessage="公開済みの投稿はまだありません。"
                onToggleStatus={handleStatusToggle}
                onDelete={handleDelete}
                actionStates={actionStates}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

type PostListProps = {
  posts: PostRecord[];
  emptyMessage: string;
  onToggleStatus: (postId: string, status: "draft" | "published") => void;
  onDelete: (post: PostRecord) => void;
  actionStates: Record<string, "idle" | "loading">;
};

function PostList({ posts, emptyMessage, onToggleStatus, onDelete, actionStates }: PostListProps) {
  if (posts.length === 0) {
    return (
      <p className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-[color:var(--color-fg-muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <article
          key={post.postId}
          className="space-y-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
        >
          <div className="flex items-center justify-between text-[11px] text-[color:var(--color-fg-muted)]">
            <span className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[#0b1f33]">同種交換</span>
            <span>{formatDate(post.updatedAt)}</span>
          </div>
          {post.images.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
              <img
                src={post.images[0]}
                alt={`${post.title} の画像`}
                className="h-32 w-full object-cover"
              />
            </div>
          )}
          <h3 className="text-sm font-semibold text-[#0b1f33]">{post.title}</h3>
          {post.group && <p className="text-[11px] text-[color:var(--color-fg-muted)]">{post.group}</p>}
          {post.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-[color:var(--color-fg-muted)]">
              {post.categories.map((category) => (
                <span key={category} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                  {category}
                </span>
              ))}
            </div>
          )}
          {post.haveMembers.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-[#0b1f33]">手元にあるメンバー</p>
              <div className="flex flex-wrap gap-2 text-[10px] text-[color:var(--color-fg-muted)]">
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
              <div className="flex flex-wrap gap-2 text-[10px] text-[color:var(--color-fg-muted)]">
                {post.wantMembers.map((member) => (
                  <span key={`${post.postId}-want-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}
          {post.body && <p className="text-[11px] text-[color:var(--color-fg-muted)]">{post.body}</p>}
          <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
            <Link
              href={`/post/${post.postId}/edit`}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-3 py-1 font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]"
            >
              編集する
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-[color:var(--color-surface-2)] px-3 py-1 font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface)] disabled:opacity-60"
              disabled={actionStates[post.postId] === "loading"}
              onClick={() => onToggleStatus(post.postId, post.status === "draft" ? "published" : "draft")}
            >
              {actionStates[post.postId] === "loading"
                ? "更新中..."
                : post.status === "draft"
                  ? "公開する"
                  : "下書きに戻す"}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#b91c1c] px-3 py-1 font-medium text-[#b91c1c] transition hover:bg-[#b91c1c0d] disabled:opacity-60"
              disabled={actionStates[post.postId] === "loading"}
              onClick={() => onDelete(post)}
            >
              削除する
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
