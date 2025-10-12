"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type PostInteractionPanelProps = {
  postId: string;
  postTitle: string;
  isOwnPost: boolean;
};

export function PostInteractionPanel({ postId, postTitle, isOwnPost }: PostInteractionPanelProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.id);

  const [message, setMessage] = useState("");
  const [requestState, setRequestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setRequestError("連絡するにはログインが必要です。");
      return;
    }

    if (isOwnPost) {
      setRequestError("自分の投稿に連絡することはできません。");
      return;
    }

    setRequestState("loading");
    setRequestError(null);
    setRequestSuccessMessage(null);

    try {
      const response = await fetch(`/api/posts/${postId}/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "chat",
          message: message.trim().length > 0 ? message.trim() : undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `チャット申請に失敗しました。（${response.status}）`);
      }

      setRequestState("success");
      setMessage("");
      setRequestSuccessMessage("チャット申請を送信しました。返信をお待ちください。");
    } catch (error) {
      console.error("Failed to submit chat request", error);
      setRequestError((error as Error).message ?? "チャット申請の送信に失敗しました。");
      setRequestState("error");
    } finally {
      setRequestState("idle");
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {!isAuthenticated && (
        <p className="rounded border border-[#fca5a5] bg-[#fee2e2] px-3 py-2 text-[11px] text-[#b91c1c]">
          連絡機能を利用するにはログインが必要です。
        </p>
      )}

      {isOwnPost && (
        <div className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
          この投稿に届いたチャット申請は{" "}
          <Link href="/conversations" className="underline">
            チャット
          </Link>{" "}
          画面でまとめて確認できます。
        </div>
      )}

      {!isOwnPost && (
        <>
          <div className="space-y-2">
            <label className="grid gap-2 text-[color:var(--color-fg-muted)]">
              投稿者へのメッセージ（任意）
              <textarea
                rows={4}
                value={message}
                disabled={!isAuthenticated || requestState === "loading"}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={`${postTitle} について気になる点や希望条件があれば入力してください。`}
                className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs disabled:bg-[color:var(--color-border)]/20"
              />
            </label>
          </div>

          {requestSuccessMessage && (
            <p className="rounded border border-[#c6f6d5] bg-[#f0fff4] px-3 py-2 text-[11px] text-[#2f855a]">
              {requestSuccessMessage}
            </p>
          )}

          {requestError && (
            <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-3 py-2 text-[11px] text-[#c53030]">
              {requestError}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!isAuthenticated || requestState === "loading"}
              onClick={handleSubmit}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent-emerald)] px-4 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm disabled:opacity-60 disabled:hover:bg-[color:var(--color-accent-emerald)]"
            >
          チャット申請を送る
            </button>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/conversations"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
          >
            チャット画面へ
          </Link>
          <Link
            href="/line-requests"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
          >
            LINE申請を確認
          </Link>
        </div>
      </div>
    </div>
  );
}
