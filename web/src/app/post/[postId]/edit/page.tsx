"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "../../../../components/Header";
import { PostImageUploader, type PostImageAsset } from "../../../../components/PostImageUploader";
import { POST_CATEGORIES, POST_GROUPS } from "../../../../constants/postOptions";

type ActionState = "idle" | "saving";

type LoadedPost = {
  postId: string;
  status: "draft" | "published";
  postType: "offer" | "request" | "trade";
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

type EditPostPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default function EditPostPage({ params }: EditPostPageProps) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);

  const { postId } = use(params);

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [group, setGroup] = useState<string>(POST_GROUPS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [haveMembersInput, setHaveMembersInput] = useState("");
  const [wantMembersInput, setWantMembersInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [images, setImages] = useState<PostImageAsset[]>([]);

  const [submitState, setSubmitState] = useState<ActionState>("idle");
  const [statusState, setStatusState] = useState<ActionState>("idle");

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setLoadError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    fetch(`/api/posts/${postId}`)
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          const message =
            response.status === 401
              ? "投稿を編集するにはログインが必要です。"
              : response.status === 404
                ? "投稿が見つかりませんでした。"
                : data.error ?? `投稿の取得に失敗しました。（${response.status}）`;
          throw new Error(message);
        }
        return response.json() as Promise<{ post: LoadedPost }>;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        const loaded = data.post;
        setStatus(loaded.status === "published" ? "published" : "draft");
        setGroup(
          loaded.group && POST_GROUPS.includes(loaded.group as (typeof POST_GROUPS)[number])
            ? loaded.group
            : POST_GROUPS[0],
        );
        setTitle(loaded.title ?? "");
        setBody(loaded.body ?? "");
        setSelectedCategories(Array.isArray(loaded.categories) ? loaded.categories : []);
        setImages(Array.isArray(loaded.images) ? loaded.images.map((url) => ({ url })) : []);
        setHaveMembersInput((loaded.haveMembers ?? []).join("\n"));
        setWantMembersInput((loaded.wantMembers ?? []).join("\n"));
        setLoadState("idle");
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load post", error);
          setLoadError((error as Error).message || "投稿の取得に失敗しました。");
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const resetMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const normalizedHaveMembers = useMemo(
    () =>
      haveMembersInput
        .split(/\r?\n|,|、|\/|\s{2,}/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [haveMembersInput],
  );

  const normalizedWantMembers = useMemo(
    () =>
      wantMembersInput
        .split(/\r?\n|,|、|\/|\s{2,}/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [wantMembersInput],
  );

  const performUpdate = async (targetStatus: "draft" | "published", mode: "content" | "toggle") => {
    if (!isAuthenticated) {
      setErrorMessage("投稿を編集するにはログインが必要です。");
      return;
    }

    if (title.trim().length === 0) {
      setErrorMessage("タイトルを入力してください。");
      return;
    }

    if (selectedCategories.length === 0) {
      setErrorMessage("カテゴリを最低1つ選択してください。");
      return;
    }

    if (normalizedHaveMembers.length === 0) {
      setErrorMessage("交換に出せるメンバーを1名以上入力してください。");
      return;
    }

    if (normalizedWantMembers.length === 0) {
      setErrorMessage("探しているメンバーを1名以上入力してください。");
      return;
    }

    resetMessages();

    if (mode === "content") {
      setSubmitState("saving");
    } else {
      setStatusState("saving");
    }

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          group: group === POST_GROUPS[0] ? null : group,
          title,
          categories: selectedCategories,
          body,
          status: targetStatus,
          images: images.map((image) => image.url),
          haveMembers: normalizedHaveMembers,
          wantMembers: normalizedWantMembers,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { post?: LoadedPost; error?: string };

      if (!response.ok || !data.post) {
        throw new Error(data.error ?? `投稿の更新に失敗しました。（${response.status}）`);
      }

      const updated = data.post;
      setStatus(updated.status === "published" ? "published" : "draft");
      setGroup(
        updated.group && POST_GROUPS.includes(updated.group as (typeof POST_GROUPS)[number])
          ? (updated.group as string)
          : POST_GROUPS[0],
      );
      setTitle(updated.title ?? "");
      setBody(updated.body ?? "");
      setSelectedCategories(Array.isArray(updated.categories) ? updated.categories : []);
      setImages(Array.isArray(updated.images) ? updated.images.map((url) => ({ url })) : []);
      setHaveMembersInput((updated.haveMembers ?? []).join("\n"));
      setWantMembersInput((updated.wantMembers ?? []).join("\n"));

      setSuccessMessage(
        mode === "toggle"
          ? updated.status === "published"
            ? "投稿を公開しました。"
            : "投稿を下書きに戻しました。"
          : updated.status === "published"
            ? "公開内容を更新しました。"
            : "下書きを更新しました。",
      );
    } catch (error) {
      console.error("Failed to update post", error);
      setErrorMessage((error as Error).message || "投稿の更新に失敗しました。");
    } finally {
      if (mode === "content") {
        setSubmitState("idle");
      } else {
        setStatusState("idle");
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">投稿編集</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            同種交換の条件を編集し、公開ステータスを切り替えることができます。
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link
              href="/post/manage"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] px-4 py-2 font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]"
            >
              投稿管理に戻る
            </Link>
            <span
              className={`inline-flex items-center justify-center rounded-full px-4 py-2 font-medium ${
                status === "published"
                  ? "bg-[color:var(--color-accent-emerald)] text-[color:var(--color-accent-emerald-ink)]"
                  : "bg-[color:var(--color-surface-2)] text-[#0b1f33]"
              }`}
            >
              {status === "published" ? "公開中" : "下書き"}
            </span>
          </div>
          {!isAuthenticated && (
            <p className="rounded-lg border border-[#fca5a5] bg-[#fee2e2] px-4 py-2 text-[11px] text-[#b91c1c]">
              投稿を編集するには <Link href="/api/auth/signin" className="underline">ログイン</Link> が必要です。
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg border border-[#c6f6d5] bg-[#f0fff4] px-4 py-2 text-[11px] text-[#2f855a]">{successMessage}</p>
          )}
          {(errorMessage || loadError) && (
            <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-2 text-[11px] text-[#c53030]">
              {errorMessage ?? loadError}
            </p>
          )}
        </section>

        {loadState === "loading" ? (
          <p className="text-xs text-[color:var(--color-fg-muted)]">投稿を読み込み中です…</p>
        ) : loadState === "error" ? (
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            投稿を読み込めませんでした。管理ページに戻って再度お試しください。
          </p>
        ) : (
          <section className="space-y-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-[color:var(--color-fg-muted)]">
                推し・グループ
                <select
                  className="rounded border border-[color:var(--color-border)] px-3 py-2"
                  value={group}
                  onChange={(event) => setGroup(event.target.value)}
                >
                  {POST_GROUPS.map((groupOption) => (
                    <option key={groupOption}>{groupOption}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              タイトル
              <input
                className="rounded border border-[color:var(--color-border)] px-3 py-2"
                placeholder="例: 乃木坂46 ミニフォト コンプ譲ります"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              グッズ種別
              <div className="flex flex-wrap gap-2">
                {POST_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`rounded-full border px-3 py-1 transition ${
                      selectedCategories.includes(category)
                        ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/40 text-[#0b1f33]"
                        : "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
                    }`}
                  >
                    {category}
                  </button>
              ))}
            </div>
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              交換に出せるメンバー
              <textarea
                rows={3}
                className="rounded border border-[color:var(--color-border)] px-3 py-2"
                placeholder="例: KANON\nNAOYA\nRAN"
                value={haveMembersInput}
                onChange={(event) => setHaveMembersInput(event.target.value)}
              />
              <p className="text-[10px] text-[color:var(--color-fg-muted)]">改行や読点で区切って入力できます。</p>
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              探しているメンバー
              <textarea
                rows={3}
                className="rounded border border-[color:var(--color-border)] px-3 py-2"
                placeholder="例: SKY-HI\nRYUHEL\nBE:FIRST メンバー"
                value={wantMembersInput}
                onChange={(event) => setWantMembersInput(event.target.value)}
              />
              <p className="text-[10px] text-[color:var(--color-fg-muted)]">希望するメンバーを入力してください。</p>
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              添付画像
              <PostImageUploader images={images} onChange={setImages} />
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              詳細メモ
              <textarea
                rows={4}
                className="rounded border border-[color:var(--color-border)] px-3 py-2"
                placeholder="状態・希望条件・引き渡し方法などを記入してください。"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
              AI サジェスト (仮)
              <div className="rounded border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-4 text-[11px] text-[color:var(--color-fg-muted)]">
                画像やキーワードから候補を提案します。UIは今後整備予定です。
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={submitState === "saving" || !isAuthenticated}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent-emerald)] px-5 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm disabled:opacity-60"
                onClick={() => performUpdate(status, "content")}
              >
                {submitState === "saving"
                  ? "保存中..."
                  : status === "published"
                    ? "公開内容を更新"
                    : "下書きを更新"}
              </button>
              <button
                type="button"
                disabled={statusState === "saving" || !isAuthenticated}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] px-5 py-2 text-xs font-semibold text-[#0b1f33] hover:bg-[color:var(--color-surface-2)] disabled:opacity-60"
                onClick={() => performUpdate(status === "draft" ? "published" : "draft", "toggle")}
              >
                {statusState === "saving"
                  ? "切替中..."
                  : status === "draft"
                    ? "公開する"
                    : "下書きに戻す"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
