"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

type InteractionType = "chat" | "request";

type PostInteractionPanelProps = {
  postId: string;
  postTitle: string;
  isOwnPost: boolean;
};

export function PostInteractionPanel({ postId, postTitle, isOwnPost }: PostInteractionPanelProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.id);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const disabled = !isAuthenticated || isOwnPost || state === "loading";

  const handleAction = async (type: InteractionType) => {
    if (!isAuthenticated) {
      setError("連絡するにはログインが必要です。");
      return;
    }

    if (isOwnPost) {
      setError("自分の投稿に連絡することはできません。");
      return;
    }

    setState("loading");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/posts/${postId}/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          message: message.trim().length > 0 ? message.trim() : undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `リクエストに失敗しました。（${response.status}）`);
      }

      setState("success");
      setMessage("");
      setSuccessMessage(
        type === "chat"
          ? "チャットのリクエストを送信しました。返信をお待ちください。"
          : "交換・譲渡のリクエストを送信しました。返信をお待ちください。",
      );
    } catch (error_) {
      console.error("Failed to submit contact request", error_);
      setError((error_ as Error).message || "リクエストの送信に失敗しました。");
      setState("error");
    } finally {
      setState((prev) => (prev === "loading" ? "idle" : prev));
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-2">
        <label className="grid gap-2 text-[color:var(--color-fg-muted)]">
          投稿者へのメッセージ（任意）
          <textarea
            rows={4}
            value={message}
            disabled={disabled}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`${postTitle} について気になる点や希望条件があれば入力してください。`}
            className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs disabled:bg-[color:var(--color-border)]/20"
          />
        </label>
      </div>

      {!isAuthenticated && (
        <p className="rounded border border-[#fca5a5] bg-[#fee2e2] px-3 py-2 text-[11px] text-[#b91c1c]">
          連絡機能を利用するにはログインが必要です。
        </p>
      )}

      {isOwnPost && (
        <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-3 py-2 text-[11px] text-[#c53030]">
          この投稿はあなたが作成しました。自分自身には連絡できません。
        </p>
      )}

      {successMessage && (
        <p className="rounded border border-[#c6f6d5] bg-[#f0fff4] px-3 py-2 text-[11px] text-[#2f855a]">
          {successMessage}
        </p>
      )}

      {error && (
        <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-3 py-2 text-[11px] text-[#c53030]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction("chat")}
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent-emerald)] px-4 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm disabled:opacity-60 disabled:hover:bg-[color:var(--color-accent-emerald)]"
        >
          チャットを開始する
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction("request")}
          className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold text-[#0b1f33] hover:bg-[color:var(--color-surface-2)] disabled:opacity-60 disabled:hover:bg-[color:var(--color-surface-2)]"
        >
          リクエストを送信
        </button>
      </div>
    </div>
  );
}
