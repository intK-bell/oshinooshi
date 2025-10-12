"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "../../../components/Header";
import { PostImageUploader, type PostImageAsset } from "../../../components/PostImageUploader";
import { POST_CATEGORIES, POST_GROUPS } from "../../../constants/postOptions";

type SubmitState = "idle" | "saving" | "success" | "error";

export default function NewPostPage() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);

  const [group, setGroup] = useState<string>(POST_GROUPS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [haveMembersInput, setHaveMembersInput] = useState("");
  const [wantMembersInput, setWantMembersInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [images, setImages] = useState<PostImageAsset[]>([]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
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

  const handleSubmit = async (status: "draft" | "published") => {
    if (!isAuthenticated) {
      setErrorMessage("投稿にはログインが必要です。");
      return;
    }

    resetMessages();
    setSubmitState("saving");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          group: group === POST_GROUPS[0] ? null : group,
          title,
          categories: selectedCategories,
          body,
          status,
          images: images.map((image) => image.url),
          haveMembers: normalizedHaveMembers,
          wantMembers: normalizedWantMembers,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${response.status}`);
      }

      const message = status === "draft" ? "下書きを保存しました。" : "投稿を公開しました。";
      setSuccessMessage(message);
      setSubmitState("success");

      if (status === "published") {
        setGroup(POST_GROUPS[0]);
        setTitle("");
        setBody("");
        setSelectedCategories([]);
        setImages([]);
        setHaveMembersInput("");
        setWantMembersInput("");
      }
    } catch (error) {
      console.error("Failed to submit post", error);
      setErrorMessage((error as Error).message || "投稿に失敗しました。時間をおいて再度お試しください。");
      setSubmitState("error");
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">新規投稿</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            同じシリーズのグッズ同士を交換するための投稿です。手元にあるメンバーと探しているメンバーをそれぞれ入力してください。
          </p>
          {!isAuthenticated && (
            <p className="rounded-lg border border-[#fca5a5] bg-[#fee2e2] px-4 py-2 text-[11px] text-[#b91c1c]">
              投稿機能を利用するには <Link href="/api/auth/signin" className="underline">ログイン</Link> が必要です。
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg border border-[#c6f6d5] bg-[#f0fff4] px-4 py-2 text-[11px] text-[#2f855a]">{successMessage}</p>
          )}
          {errorMessage && (
            <p className="rounded-lg border border-[#fed7d7] bg-[#fff5f5] px-4 py-2 text-[11px] text-[#c53030]">{errorMessage}</p>
          )}
        </section>

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
            <p className="text-[10px] text-[color:var(--color-fg-muted)]">
              改行や読点で区切って入力できます。手元にあるメンバーを列挙してください。
            </p>
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
            <p className="text-[10px] text-[color:var(--color-fg-muted)]">
              交換で探しているメンバーを入力してください。匿名配送など希望条件は詳細メモに記入できます。
            </p>
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
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent-emerald)] px-5 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm"
              onClick={() => handleSubmit("draft")}
            >
              {submitState === "saving" ? "保存中..." : "下書きとして保存"}
            </button>
            <button
              type="button"
              disabled={submitState === "saving" || !isAuthenticated}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] px-5 py-2 text-xs font-semibold text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]"
              onClick={() => handleSubmit("published")}
            >
              公開する
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
