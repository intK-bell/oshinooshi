"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";

const LINE_STATUS_FILTERS = [
  { value: "pending", label: "承認待ち" },
  { value: "accepted", label: "承認済み" },
  { value: "declined", label: "辞退済み" },
] as const;

const LINE_STATUS_SELECT_VALUES = ["pending_sender", "pending_recipient", "accepted", "declined"] as const;

type LineRequestStatus = "pending_sender" | "pending_recipient" | "accepted" | "declined";

type ContactListItem = {
  contactId: string;
  postId: string;
  type: "chat" | "request";
  status: string;
  message: string | null;
  lineRequestStatus?: string | null;
  lineRequestUpdatedAt?: string | null;
  sender: {
    userId: string;
    name: string | null;
    uuid?: string | null;
    lineFriendUrl?: string | null;
  };
  recipient: {
    userId: string;
    name?: string | null;
    lineFriendUrl?: string | null;
  };
  createdAt: string | null;
  updatedAt: string | null;
  post: {
    title: string;
    postType: "offer" | "request" | "trade";
    status: string;
    haveMembers?: string[];
    wantMembers?: string[];
  } | null;
  viewerRole: "sender" | "recipient";
};

type ContactsResponse = {
  contacts?: ContactListItem[];
  error?: string;
};

type ListState =
  | { status: "loading" | "idle" }
  | { status: "error"; message: string }
  | { status: "success"; contacts: ContactListItem[] };

type LineRequestItem = ContactListItem & {
  lineStatus: LineRequestStatus;
  lineStatusUpdatedAt: string | null;
  counterpartFriendUrl: string | null;
};

function normalizeLineStatusValue(value: string | null | undefined): LineRequestStatus | null {
  if (!value) {
    return null;
  }

  if (value === "pending_sender" || value === "pending_self") {
    return "pending_sender";
  }

  if (value === "pending_recipient" || value === "pending-recipient" || value === "pending_counterpart") {
    return "pending_recipient";
  }

  if (value === "accepted" || value === "declined") {
    return value as LineRequestStatus;
  }

  return null;
}

function deriveLineStatus(contact: ContactListItem): LineRequestStatus {
  const normalized = normalizeLineStatusValue(contact.lineRequestStatus);
  if (normalized) {
    return normalized;
  }

  if (contact.status === "declined") {
    return "declined";
  }

  if (contact.status === "accepted") {
    return contact.viewerRole === "sender" ? "pending_sender" : "pending_recipient";
  }

  if (contact.status === "pending") {
    return contact.viewerRole === "sender" ? "pending_sender" : "pending_recipient";
  }

  return "accepted";
}

function formatDisplayName(name: string | null | undefined, fallback: string): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.endsWith("さん") ? trimmed : `${trimmed}さん`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: LineRequestStatus, viewerRole: "sender" | "recipient"): string {
  switch (status) {
    case "pending_sender":
      return viewerRole === "sender" ? "自分の承認待ち" : "相手の承認待ち";
    case "pending_recipient":
      return viewerRole === "recipient" ? "自分の承認待ち" : "相手の承認待ち";
    case "accepted":
      return "承認済み";
    case "declined":
      return "辞退済み";
    default:
      return "未設定";
  }
}

function getStatusBadgeClass(status: LineRequestStatus): string {
  switch (status) {
    case "accepted":
      return "bg-[color:var(--color-accent-emerald)] text-[color:var(--color-accent-emerald-ink)]";
    case "declined":
      return "bg-[#fee2e2] text-[#b91c1c]";
    default:
      return "bg-[color:var(--color-surface-2)] text-[#0b1f33]";
  }
}

export default function LineRequestsPage() {
  const searchParams = useSearchParams();
  const highlightedContactId = searchParams.get("contactId");

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [filter, setFilter] = useState<(typeof LINE_STATUS_FILTERS)[number]["value"]>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLineRequests = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const response = await fetch("/api/contacts?role=all");
      const data = (await response.json().catch(() => ({}))) as ContactsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? `LINE申請の取得に失敗しました。（${response.status}）`);
      }

      setListState({ status: "success", contacts: Array.isArray(data.contacts) ? data.contacts : [] });
    } catch (error) {
      console.error("Failed to load line requests", error);
      setListState({
        status: "error",
        message: (error as Error).message ?? "LINE申請の取得に失敗しました。",
      });
    }
  }, []);

  useEffect(() => {
    fetchLineRequests().catch(() => {
      // handled inside fetchLineRequests
    });
  }, [fetchLineRequests]);

  useEffect(() => {
    if (!feedbackMessage && !errorMessage) {
      return;
    }
    const timer = window.setTimeout(() => {
      setFeedbackMessage(null);
      setErrorMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [feedbackMessage, errorMessage]);

  const contacts = useMemo(() => (listState.status === "success" ? listState.contacts : []), [listState]);

  const lineRequests: LineRequestItem[] = useMemo(
    () =>
      contacts.map((contact) => {
        const lineStatus = deriveLineStatus(contact);
        const counterpartFriendUrl =
          contact.viewerRole === "sender"
            ? contact.recipient.lineFriendUrl ?? null
            : contact.sender.lineFriendUrl ?? null;

        return {
          ...contact,
          lineStatus,
          lineStatusUpdatedAt: contact.lineRequestUpdatedAt ?? contact.updatedAt ?? contact.createdAt ?? null,
          counterpartFriendUrl,
        };
      }),
    [contacts],
  );

  const pendingSelf = useMemo(
    () =>
      lineRequests.filter((request) =>
        (request.viewerRole === "sender" && request.lineStatus === "pending_sender") ||
        (request.viewerRole === "recipient" && request.lineStatus === "pending_recipient"),
      ),
    [lineRequests],
  );
  const pendingCounterpart = useMemo(
    () =>
      lineRequests.filter((request) =>
        (request.viewerRole === "sender" && request.lineStatus === "pending_recipient") ||
        (request.viewerRole === "recipient" && request.lineStatus === "pending_sender"),
      ),
    [lineRequests],
  );
  const acceptedList = useMemo(
    () =>
      lineRequests
        .filter((request) => request.lineStatus === "accepted")
        .sort((a, b) => {
          const timeA = a.lineStatusUpdatedAt ? new Date(a.lineStatusUpdatedAt).getTime() : 0;
          const timeB = b.lineStatusUpdatedAt ? new Date(b.lineStatusUpdatedAt).getTime() : 0;
          return timeB - timeA;
        }),
    [lineRequests],
  );
  const declinedList = useMemo(
    () =>
      lineRequests
        .filter((request) => request.lineStatus === "declined")
        .sort((a, b) => {
          const timeA = a.lineStatusUpdatedAt ? new Date(a.lineStatusUpdatedAt).getTime() : 0;
          const timeB = b.lineStatusUpdatedAt ? new Date(b.lineStatusUpdatedAt).getTime() : 0;
          return timeB - timeA;
        }),
    [lineRequests],
  );

  const pendingCount = pendingSelf.length + pendingCounterpart.length;
  const acceptedCount = acceptedList.length;
  const declinedCount = declinedList.length;

  const updateLineRequestStatus = useCallback(
    async (request: LineRequestItem, nextStatus: LineRequestStatus) => {
      if (nextStatus === request.lineStatus) {
        return;
      }

      setUpdatingId(request.contactId);
      setErrorMessage(null);
      try {
        const response = await fetch(`/api/line-requests/${request.contactId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            postId: request.postId,
            status: nextStatus,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? `LINE申請の更新に失敗しました。（${response.status}）`);
        }

        const label = getStatusLabel(nextStatus, request.viewerRole);
        setFeedbackMessage(`LINE申請を「${label}」に更新しました。`);
        await fetchLineRequests();
      } catch (error) {
        console.error("Failed to update line request status", error);
        setErrorMessage((error as Error).message ?? "LINE申請の更新に失敗しました。");
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchLineRequests],
  );

  const renderCard = (request: LineRequestItem) => {
    const counterpartName = request.viewerRole === "sender" ? request.recipient.userId : request.sender.userId;
    const friendlyName = formatDisplayName(
      request.viewerRole === "sender" ? request.recipient.name : request.sender.name,
      counterpartName ?? "相手",
    );
    const statusLabel = getStatusLabel(request.lineStatus, request.viewerRole);
    const badgeClass = getStatusBadgeClass(request.lineStatus);
    const isHighlighted = highlightedContactId === request.contactId;

    return (
      <article
        key={request.contactId}
        className={`space-y-3 rounded-2xl border px-4 py-4 text-[11px] text-[color:var(--color-fg-muted)] transition ${
          isHighlighted
            ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-surface)]"
            : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
        }`}
      >
        <header className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#0b1f33]">{friendlyName}</p>
            {request.post && <p className="text-[10px]">投稿: {request.post.title}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${badgeClass}`}>{statusLabel}</span>
        </header>
        <div className="grid gap-2 text-[10px]">
          <p>更新: {formatDateTime(request.lineStatusUpdatedAt)}</p>
          {request.post?.haveMembers && request.post.haveMembers.length > 0 && (
            <p>
              手元: {request.post.haveMembers.join(", ")}
            </p>
          )}
          {request.post?.wantMembers && request.post.wantMembers.length > 0 && (
            <p>
              希望: {request.post.wantMembers.join(", ")}
            </p>
          )}
          <label className="flex items-center justify-between gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-2 text-[11px] text-[color:var(--color-fg-muted)]">
            <span>ステータス変更</span>
            <select
              value={request.lineStatus}
              onChange={(event) => updateLineRequestStatus(request, event.target.value as LineRequestStatus)}
              disabled={updatingId === request.contactId}
              className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-xs text-[#0b1f33]"
            >
              {LINE_STATUS_SELECT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {getStatusLabel(value, request.viewerRole)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/conversations?contactId=${request.contactId}`}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
          >
            チャットを開く →
          </Link>
          {request.lineStatus === "accepted" && request.counterpartFriendUrl && (
            <a
              href={request.counterpartFriendUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-accent-emerald)] px-3 py-1 text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)] transition hover:bg-[color:var(--color-accent-emerald)]/20"
            >
              LINEでお友達になる
            </a>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">LINE申請</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            チャット承認後のLINE友だち申請状況をまとめて確認できます。承認待ちは自分と相手の状況で分けて表示します。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-xs text-[color:var(--color-fg-muted)]">
          <div className="grid gap-3 sm:grid-cols-4">
            <p className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-center">
              <span className="block text-[10px] text-[color:var(--color-fg-muted)]">承認待ち</span>
              <span className="text-lg font-semibold text-[#0b1f33]">{pendingCount}</span>
            </p>
            <p className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-center">
              <span className="block text-[10px] text-[color:var(--color-fg-muted)]">承認済み</span>
              <span className="text-lg font-semibold text-[#0b1f33]">{acceptedCount}</span>
            </p>
            <p className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-center">
              <span className="block text-[10px] text-[color:var(--color-fg-muted)]">辞退済み</span>
              <span className="text-lg font-semibold text-[#0b1f33]">{declinedCount}</span>
            </p>
            <label className="flex items-center justify-between gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-4 py-2 text-[11px] text-[color:var(--color-fg-muted)]">
              <span>ステータス</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as (typeof LINE_STATUS_FILTERS)[number]["value"])}
                className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs text-[#0b1f33]"
              >
                {LINE_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {feedbackMessage && (
          <p className="rounded-2xl border border-[#c6f6d5] bg-[#f0fff4] px-4 py-3 text-[11px] text-[#2f855a]">{feedbackMessage}</p>
        )}
        {errorMessage && (
          <p className="rounded-2xl border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">{errorMessage}</p>
        )}

        {listState.status === "loading" ? (
          <p className="text-xs text-[color:var(--color-fg-muted)]">読み込み中です…</p>
        ) : listState.status === "error" ? (
          <p className="rounded-2xl border border-[#fed7d7] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c53030]">{listState.message}</p>
        ) : lineRequests.length === 0 ? (
          <p className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-5 py-6 text-xs text-[color:var(--color-fg-muted)]">
            表示できるLINE申請はありません。
          </p>
        ) : filter === "pending" ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0b1f33]">自分の承認待ち</h2>
                <span className="text-[10px] text-[color:var(--color-fg-muted)]">{pendingSelf.length} 件</span>
              </header>
              {pendingSelf.length === 0 ? (
                <p className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
                  自分の対応が必要な申請はありません。
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">{pendingSelf.map(renderCard)}</div>
              )}
            </section>
            <section className="space-y-3">
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0b1f33]">相手の承認待ち</h2>
                <span className="text-[10px] text-[color:var(--color-fg-muted)]">{pendingCounterpart.length} 件</span>
              </header>
              {pendingCounterpart.length === 0 ? (
                <p className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
                  相手の対応待ちの申請はありません。
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">{pendingCounterpart.map(renderCard)}</div>
              )}
            </section>
          </div>
        ) : filter === "accepted" ? (
          <section className="space-y-3">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1f33]">承認済みの申請</h2>
              <span className="text-[10px] text-[color:var(--color-fg-muted)]">{acceptedList.length} 件</span>
            </header>
            <div className="grid gap-3 lg:grid-cols-2">{acceptedList.map(renderCard)}</div>
          </section>
        ) : (
          <section className="space-y-3">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1f33]">辞退済みの申請</h2>
              <span className="text-[10px] text-[color:var(--color-fg-muted)]">{declinedList.length} 件</span>
            </header>
            <div className="grid gap-3 lg:grid-cols-2">{declinedList.map(renderCard)}</div>
          </section>
        )}
      </main>
    </div>
  );
}
