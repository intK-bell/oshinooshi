"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type InteractionType = "chat" | "request";

type ConversationSummaryState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "success"; viewerRole: "owner" | "sender"; items: ConversationSummary[] };

type ConversationSummary = {
  contactId: string;
  status: string;
  type: "chat" | "request";
  updatedAt: string | null;
  counterpartName: string;
};

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

  const [summaryState, setSummaryState] = useState<ConversationSummaryState>({ status: "idle" });

  const loadConversationSummary = useCallback(async () => {
    if (!isAuthenticated) {
      setSummaryState({ status: "idle" });
      return;
    }

    setSummaryState({ status: "loading" });
    try {
      const response = await fetch(`/api/posts/${postId}/contact/conversations`);
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        contacts?: Array<{
          contactId: string;
          status: string;
          type: "chat" | "request";
          updatedAt: string | null;
          createdAt: string | null;
          sender: { userId: string; name: string | null };
          recipient: { userId: string; name: string | null };
        }>;
        viewerRole?: "owner" | "sender";
      };

      if (!response.ok) {
        throw new Error(data.error ?? `会話状況の取得に失敗しました。（${response.status}）`);
      }

      const viewerRole = data.viewerRole ?? (isOwnPost ? "owner" : "sender");
      const items: ConversationSummary[] = Array.isArray(data.contacts)
        ? data.contacts.map((contact) => {
            const counterpart =
              viewerRole === "owner" ? contact.sender : contact.recipient ?? contact.sender;
            const name =
              counterpart?.name ??
              counterpart?.userId ??
              (viewerRole === "owner" ? "送信者" : "投稿者");
            return {
              contactId: contact.contactId,
              status: contact.status,
              type: contact.type,
              updatedAt: contact.updatedAt ?? contact.createdAt ?? null,
              counterpartName: name,
            };
          })
        : [];

      items.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      setSummaryState({ status: "success", viewerRole, items });
    } catch (error) {
      console.error("Failed to load conversation summary", error);
      setSummaryState({
        status: "error",
        message: (error as Error).message ?? "会話状況の取得に失敗しました。",
      });
    }
  }, [isAuthenticated, isOwnPost, postId]);

  useEffect(() => {
    loadConversationSummary().catch(() => {
      // handled in loadConversationSummary
    });
  }, [loadConversationSummary]);

  const handleSubmit = async (type: InteractionType) => {
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
          type,
          message: message.trim().length > 0 ? message.trim() : undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `リクエストに失敗しました。（${response.status}）`);
      }

      setRequestState("success");
      setMessage("");
      setRequestSuccessMessage(
        type === "chat"
          ? "チャットのリクエストを送信しました。返信をお待ちください。"
          : "交換・譲渡のリクエストを送信しました。返信をお待ちください。",
      );
      await loadConversationSummary();
    } catch (error) {
      console.error("Failed to submit contact request", error);
      setRequestError((error as Error).message ?? "リクエストの送信に失敗しました。");
      setRequestState("error");
    } finally {
      setRequestState("idle");
    }
  };

  const conversationItems = useMemo(
    () => (summaryState.status === "success" ? summaryState.items : []),
    [summaryState],
  );

  const acceptedCount = useMemo(
    () => conversationItems.filter((item) => item.status === "accepted").length,
    [conversationItems],
  );
  const pendingCount = useMemo(
    () => conversationItems.filter((item) => item.status === "pending").length,
    [conversationItems],
  );

  return (
    <div className="space-y-4 text-xs">
      {!isAuthenticated && (
        <p className="rounded border border-[#fca5a5] bg-[#fee2e2] px-3 py-2 text-[11px] text-[#b91c1c]">
          連絡機能を利用するにはログインが必要です。
        </p>
      )}

      {isOwnPost && (
        <div className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
          この投稿に届いたリクエストは{" "}
          <Link href="/conversations" className="underline">
            チャット／リクエスト
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
              onClick={() => handleSubmit("chat")}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent-emerald)] px-4 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm disabled:opacity-60 disabled:hover:bg-[color:var(--color-accent-emerald)]"
            >
              チャットを開始する
            </button>
            <button
              type="button"
              disabled={!isAuthenticated || requestState === "loading"}
              onClick={() => handleSubmit("request")}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold text-[#0b1f33] hover:bg-[color:var(--color-surface-2)] disabled:opacity-60 disabled:hover:bg-[color:var(--color-surface-2)]"
            >
              リクエストを送信
            </button>
          </div>
        </>
      )}

      {summaryState.status === "loading" && (
        <p className="text-[11px] text-[color:var(--color-fg-muted)]">会話状況を読み込み中です…</p>
      )}

      {summaryState.status === "error" && (
        <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-3 py-2 text-[11px] text-[#c53030]">
          {summaryState.message}
        </p>
      )}

      {summaryState.status === "success" && conversationItems.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0b1f33]">進行中のリクエスト</h3>
            <Link
              href="/conversations"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
            >
              チャット／リクエスト画面を開く
            </Link>
          </div>
          <p className="text-[10px] text-[color:var(--color-fg-muted)]">
            承認待ち {pendingCount} 件／承認済み {acceptedCount} 件
          </p>
          <ul className="space-y-2">
            {conversationItems.map((item) => (
              <li
                key={item.contactId}
                className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-[#0b1f33]">{item.counterpartName}</span>
                  <span className="text-[10px] text-[color:var(--color-fg-muted)]">{formatStatus(item.status)}</span>
                </div>
                <span className="text-[10px] text-[color:var(--color-fg-muted)]">
                  {item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "日時不明"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summaryState.status === "success" &&
        conversationItems.length === 0 &&
        isAuthenticated &&
        !isOwnPost && (
          <p className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-[11px] text-[color:var(--color-fg-muted)]">
            現在この投稿とのやり取りはありません。リクエストを送信すると、チャット／リクエスト画面に表示されます。
          </p>
        )}
    </div>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case "accepted":
      return "承認済み";
    case "declined":
      return "辞退済み";
    case "pending":
    default:
      return "承認待ち";
  }
}
