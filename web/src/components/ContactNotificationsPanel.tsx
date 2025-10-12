"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ContactItem = {
  contactId: string;
  postId: string;
  type: "chat" | "request";
  status: string;
  message: string | null;
  sender: {
    userId: string;
    name: string | null;
    uuid: string | null;
  };
  createdAt: string | null;
  updatedAt: string | null;
  post: {
    title: string;
    postType: "offer" | "request";
    status: string;
  } | null;
};

type FetchState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: ContactItem[]; nextCursor: string | null };

const PAGE_LIMIT = 5;

export function ContactNotificationsPanel() {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, "idle" | "loading" | "error">>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }
    const timer = window.setTimeout(() => setFeedbackMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedbackMessage]);

  const loadContacts = useCallback(async (cursor: string | null) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });

    try {
      const params = new URLSearchParams({
        status: "pending",
        limit: String(PAGE_LIMIT),
      });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/contacts?${params.toString()}`, { signal: controller.signal });
      if (response.status === 401) {
        setState({
          status: "error",
          message: "通知を表示するにはログインが必要です。",
        });
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to load contacts: ${response.status}`);
      }
      const data = (await response.json()) as {
        contacts: ContactItem[];
        nextCursor: string | null;
      };
      setState({ status: "success", items: data.contacts, nextCursor: data.nextCursor ?? null });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      console.error("Failed to load contact notifications", error);
      setState({
        status: "error",
        message: "通知の取得に失敗しました。時間をおいて再度お試しください。",
      });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(null);
    loadContacts(null);
    return () => {
      controllerRef.current?.abort();
    };
  }, [loadContacts]);

  const hasData = state.status === "success" && state.items.length > 0;
  const notifications = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }
    return state.items;
  }, [state]);

  const handleRefresh = () => {
    setCursorStack([]);
    setCurrentCursor(null);
    loadContacts(null);
  };

  const handleNextPage = () => {
    if (state.status !== "success" || !state.nextCursor) {
      return;
    }
    setCursorStack((prev) => [...prev, currentCursor]);
    setCurrentCursor(state.nextCursor);
    loadContacts(state.nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorStack.length === 0) {
      return;
    }
    const nextStack = [...cursorStack];
    const previousCursor = nextStack.pop() ?? null;
    setCursorStack(nextStack);
    setCurrentCursor(previousCursor);
    loadContacts(previousCursor);
  };

  const showPrevious = cursorStack.length > 0;
  const showNext = state.status === "success" && Boolean(state.nextCursor);

  const handleAction = async (item: ContactItem, nextStatus: "accepted" | "declined") => {
    setActionError(null);
    setActionStatus((prev) => ({ ...prev, [item.contactId]: "loading" }));
    try {
      const response = await fetch(`/api/contacts/${item.contactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: item.postId,
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = errorPayload?.error ?? `Failed to update contact status: ${response.status}`;
        throw new Error(message);
      }

      setFeedbackMessage(nextStatus === "accepted" ? "リクエストを承認しました。" : "リクエストを辞退しました。");
      await loadContacts(currentCursor);
    } catch (error) {
      console.error("Failed to update contact status", error);
      setActionError(error instanceof Error ? error.message : "リクエストの更新に失敗しました。");
      setActionStatus((prev) => ({ ...prev, [item.contactId]: "error" }));
      return;
    }

    setActionStatus((prev) => ({ ...prev, [item.contactId]: "idle" }));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">連絡リクエスト</h2>
          <p className="text-[11px] text-[color:var(--color-fg-muted)]">
            投稿に対して受信したチャット／リクエストが表示されます。
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
        >
          最新の情報に更新
        </button>
      </div>

      {state.status === "loading" && (
        <p className="text-[11px] text-[color:var(--color-fg-muted)]">通知を読み込み中です…</p>
      )}

      {state.status === "error" && (
        <div className="rounded-xl border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-[11px] text-[#b91c1c]" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-[11px] text-[#b91c1c]" role="alert">
          {actionError}
        </div>
      )}

      {feedbackMessage && (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#dcfce7] px-4 py-3 text-[11px] text-[#166534]" role="status">
          {feedbackMessage}
        </div>
      )}

      {state.status === "success" && !hasData && (
        <p className="text-[11px] text-[color:var(--color-fg-muted)]">新しい連絡はありません。</p>
      )}

      {hasData && (
        <>
          <ul className="space-y-3">
            {notifications.map((item) => {
              const createdLabel =
                item.createdAt && !Number.isNaN(Date.parse(item.createdAt))
                  ? new Date(item.createdAt).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "日時不明";
              const typeBadge =
                item.type === "chat"
                  ? { label: "チャット", className: "bg-[#2563eb0d] text-[#2563eb]" }
                  : { label: "リクエスト", className: "bg-[#0f766e0d] text-[#0f766e]" };

              return (
                <li
                  key={item.contactId}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0b1f33]">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-medium ${typeBadge.className}`}>
                        {typeBadge.label}
                      </span>
                      <span>{item.post?.title ?? `投稿ID: ${item.postId}`}</span>
                    </div>
                    <p className="text-[10px] text-[color:var(--color-fg-muted)]">{createdLabel}</p>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-[color:var(--color-fg-muted)]">
                      送信者: {item.sender.name ?? "表示名なし"}（{item.sender.userId}）
                    </p>
                    {item.message && <p className="whitespace-pre-wrap text-[#0b1f33]">{item.message}</p>}
                  </div>
                  <div className="mt-3 flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleAction(item, "accepted")}
                      disabled={actionStatus[item.contactId] === "loading"}
                      className="inline-flex items-center gap-1 rounded-full border border-[#16a34a] px-3 py-1 font-medium text-[#166534] transition hover:bg-[#16a34a0d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      承認する
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item, "declined")}
                      disabled={actionStatus[item.contactId] === "loading"}
                      className="inline-flex items-center gap-1 rounded-full border border-[#b91c1c] px-3 py-1 font-medium text-[#b91c1c] transition hover:bg-[#b91c1c0d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      辞退する
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end gap-2 pt-2 text-[10px]">
            <button
              type="button"
              onClick={handlePreviousPage}
              disabled={!showPrevious || state.status === "loading"}
              className="rounded-full border border-[color:var(--color-border)] px-3 py-1 transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              前へ
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!showNext || state.status === "loading"}
              className="rounded-full border border-[color:var(--color-border)] px-3 py-1 transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </>
      )}
    </section>
  );
}
