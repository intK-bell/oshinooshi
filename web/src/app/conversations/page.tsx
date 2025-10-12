"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "@/components/Header";

type ContactListItem = {
  contactId: string;
  postId: string;
  type: "chat" | "request";
  status: string;
  message: string | null;
  sender: {
    userId: string;
    name: string | null;
    uuid?: string | null;
  };
  recipient: {
    userId: string;
    name?: string | null;
  };
  createdAt: string | null;
  updatedAt: string | null;
  post: {
    title: string;
    postType: "offer" | "request";
    status: string;
  } | null;
  viewerRole: "sender" | "recipient";
};

type ContactListState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "success"; contacts: ContactListItem[] };

type ConversationMessage = {
  messageId: string;
  senderUserId: string;
  senderName: string | null;
  body: string;
  createdAt: string;
};

type ConversationDetail = {
  contactId: string;
  postId: string;
  status: string;
  type: "chat" | "request";
  createdAt: string | null;
  updatedAt: string | null;
  sender: {
    userId: string;
    name: string | null;
  };
  recipient: {
    userId: string;
    name: string | null;
  };
  messages: ConversationMessage[];
};

type ConversationDetailState =
  | { status: "idle" }
  | { status: "loading"; contactId: string }
  | { status: "error"; contactId: string; message: string }
  | { status: "success"; contactId: string; viewerRole: "owner" | "sender"; conversation: ConversationDetail };

const STATUS_FILTERS: Array<{ value: "all" | "pending" | "accepted" | "declined"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "accepted", label: "承認済み" },
  { value: "declined", label: "辞退済み" },
];

export default function ConversationsPage() {
  const { data: session } = useSession();
  const viewerId = session?.user?.id ?? null;

  const [listState, setListState] = useState<ContactListState>({ status: "loading" });
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<ConversationDetailState>({ status: "idle" });
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("all");
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusActionState, setStatusActionState] = useState<"idle" | "loading">("idle");

  const fetchContacts = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const response = await fetch("/api/contacts?role=all");
      const data = (await response.json().catch(() => ({}))) as { error?: string; contacts?: ContactListItem[] };

      if (!response.ok) {
        throw new Error(data.error ?? `連絡リストの取得に失敗しました。（${response.status}）`);
      }

      setListState({
        status: "success",
        contacts: Array.isArray(data.contacts) ? data.contacts : [],
      });
    } catch (error) {
      console.error("Failed to load contacts", error);
      setListState({
        status: "error",
        message: (error as Error).message ?? "連絡リストの取得に失敗しました。",
      });
    }
  }, []);

  useEffect(() => {
    fetchContacts().catch(() => {
      // handled inside fetchContacts
    });
  }, [fetchContacts]);

  const contacts = useMemo(
    () => (listState.status === "success" ? listState.contacts : []),
    [listState],
  );

  const filteredContacts = useMemo(() => {
    if (filter === "all") {
      return contacts;
    }
    return contacts.filter((contact) => contact.status === filter);
  }, [contacts, filter]);

  useEffect(() => {
    if (filteredContacts.length === 0) {
      return;
    }
    if (selectedContactId && filteredContacts.some((contact) => contact.contactId === selectedContactId)) {
      return;
    }
    setSelectedContactId(filteredContacts[0]?.contactId ?? null);
  }, [filteredContacts, selectedContactId]);

  const loadConversationDetail = useCallback(
    async (contact: ContactListItem) => {
      setDetailState({ status: "loading", contactId: contact.contactId });
      setActionError(null);
      try {
        const response = await fetch(`/api/posts/${contact.postId}/contact/conversations`);
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          contacts?: ConversationDetail[];
          viewerRole?: "owner" | "sender";
        };

        if (!response.ok) {
          throw new Error(data.error ?? `会話の取得に失敗しました。（${response.status}）`);
        }

        const matched = Array.isArray(data.contacts)
          ? data.contacts.find((item) => item.contactId === contact.contactId)
          : null;

        if (!matched) {
          throw new Error("対象の会話が見つかりませんでした。");
        }

        setDetailState({
          status: "success",
          contactId: contact.contactId,
          conversation: matched,
          viewerRole: data.viewerRole ?? (contact.viewerRole === "recipient" ? "owner" : "sender"),
        });
      } catch (error) {
        console.error("Failed to load conversation detail", error);
        setDetailState({
          status: "error",
          contactId: contact.contactId,
          message: (error as Error).message ?? "会話の読み込みに失敗しました。",
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedContactId) {
      setDetailState({ status: "idle" });
      return;
    }
    const target = contacts.find((contact) => contact.contactId === selectedContactId);
    if (!target) {
      setDetailState({ status: "idle" });
      return;
    }
    loadConversationDetail(target).catch(() => {
      // handled in loadConversationDetail
    });
  }, [contacts, selectedContactId, loadConversationDetail]);

  useEffect(() => {
    if (!actionFeedback) {
      return;
    }
    const timer = window.setTimeout(() => setActionFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  const selectedContactSummary = useMemo(() => {
    if (!selectedContactId) {
      return null;
    }
    return contacts.find((contact) => contact.contactId === selectedContactId) ?? null;
  }, [contacts, selectedContactId]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
  };

  const handleSendMessage = async () => {
    if (!selectedContactSummary || detailState.status !== "success") {
      return;
    }

    const draft = (messageDrafts[selectedContactSummary.contactId] ?? "").trim();
    if (draft.length === 0) {
      setActionError("メッセージを入力してください。");
      return;
    }

    setIsSending(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/posts/${selectedContactSummary.postId}/contact/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: selectedContactSummary.contactId,
          message: draft,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `メッセージ送信に失敗しました。（${response.status}）`);
      }

      setActionFeedback("メッセージを送信しました。");
      setMessageDrafts((prev) => ({ ...prev, [selectedContactSummary.contactId]: "" }));
      await Promise.all([
        loadConversationDetail(selectedContactSummary),
        fetchContacts(),
      ]);
    } catch (error) {
      console.error("Failed to send conversation message", error);
      setActionError((error as Error).message ?? "メッセージの送信に失敗しました。");
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusUpdate = async (nextStatus: "accepted" | "declined") => {
    if (!selectedContactSummary) {
      return;
    }

    setStatusActionState("loading");
    setActionError(null);
    try {
      const response = await fetch(`/api/contacts/${selectedContactSummary.contactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: selectedContactSummary.postId,
          status: nextStatus,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `ステータスの更新に失敗しました。（${response.status}）`);
      }

      setActionFeedback(
        nextStatus === "accepted" ? "リクエストを承認しました。" : "リクエストを辞退しました。",
      );
      await Promise.all([
        fetchContacts(),
        loadConversationDetail({
          ...selectedContactSummary,
          status: nextStatus,
        }),
      ]);
    } catch (error) {
      console.error("Failed to update request status", error);
      setActionError((error as Error).message ?? "ステータスの更新に失敗しました。");
    } finally {
      setStatusActionState("idle");
    }
  };

  const renderList = () => {
    if (listState.status === "loading") {
      return <p className="text-xs text-[color:var(--color-fg-muted)]">読み込み中です…</p>;
    }

    if (listState.status === "error") {
      return (
        <div className="space-y-2 text-xs text-[color:var(--color-fg-muted)]">
          <p className="rounded-2xl border border-[#fed7d7] bg-[#fff5f5] p-4 text-[#c53030]">{listState.message}</p>
          <button
            type="button"
            onClick={() => fetchContacts()}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
          >
            再読み込み
          </button>
        </div>
      );
    }

    if (filteredContacts.length === 0) {
      return <p className="text-xs text-[color:var(--color-fg-muted)]">該当するリクエストがありません。</p>;
    }

    return (
      <ul className="space-y-3">
        {filteredContacts.map((contact) => {
          const isSelected = contact.contactId === selectedContactId;
          const counterpartName =
            contact.viewerRole === "sender"
              ? contact.recipient.name ?? contact.recipient.userId ?? "投稿者"
              : contact.sender.name ?? contact.sender.userId;
          const postTitle = contact.post?.title ?? `投稿ID: ${contact.postId}`;
          const updatedLabel = contact.updatedAt
            ? new Date(contact.updatedAt).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;

          return (
            <li key={contact.contactId}>
              <button
                type="button"
                onClick={() => handleSelectContact(contact.contactId)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-xs transition ${
                  isSelected
                    ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/10"
                    : "border-[color:var(--color-border)] bg-white hover:bg-[color:var(--color-surface-2)]"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-[color:var(--color-fg-muted)]">
                  <span className="font-semibold text-[#0b1f33]">{counterpartName}</span>
                  <span>{updatedLabel ?? "日時不明"}</span>
                </div>
                <p className="mt-1 text-[#0b1f33]">{postTitle}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[color:var(--color-fg-muted)]">
                  <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">
                    {contact.type === "chat" ? "チャット" : "リクエスト"}
                  </span>
                  <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">
                    {formatStatus(contact.status)}
                  </span>
                  {contact.message && <span className="truncate">{contact.message}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderDetail = () => {
    if (!selectedContactSummary) {
      return (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 text-xs text-[color:var(--color-fg-muted)]">
          リクエストを選択すると会話が表示されます。
        </div>
      );
    }

    if (detailState.status === "loading") {
      return (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 text-xs text-[color:var(--color-fg-muted)]">
          会話を読み込み中です…
        </div>
      );
    }

    if (detailState.status === "error" && detailState.contactId === selectedContactSummary.contactId) {
      return (
        <div className="space-y-3 rounded-2xl border border-[#fed7d7] bg-[#fff5f5] p-6 text-xs text-[#c53030]">
          <p>{detailState.message}</p>
          <button
            type="button"
            onClick={() => loadConversationDetail(selectedContactSummary)}
            className="inline-flex items-center gap-2 rounded-full border border-[#c53030] px-3 py-1 text-[10px] text-[#c53030] transition hover:bg-[#c530300d]"
          >
            再読み込み
          </button>
        </div>
      );
    }

    if (detailState.status !== "success" || detailState.contactId !== selectedContactSummary.contactId) {
      return null;
    }

    const conversation = detailState.conversation;
    const viewerRole = detailState.viewerRole;
    const counterpartName =
      viewerRole === "owner"
        ? conversation.sender.name ?? conversation.sender.userId
        : conversation.recipient.name ?? conversation.recipient.userId ?? "投稿者";

    const messages = [...conversation.messages].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    const canSend = conversation.status === "accepted";

    return (
      <div className="space-y-6">
        <article className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-xs text-[color:var(--color-fg-muted)]">
          <header className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">対応中の投稿</p>
              <h2 className="text-base font-semibold text-[#0b1f33]">{selectedContactSummary.post?.title ?? "投稿"}</h2>
            </div>
            <Link
              href={`/post/${selectedContactSummary.postId}`}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
            >
              投稿ページを開く
            </Link>
          </header>

          <div className="grid gap-3 text-[11px] text-[color:var(--color-fg-muted)] md:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-4">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">相手</p>
              <p className="mt-1 text-sm font-semibold text-[#0b1f33]">{counterpartName}</p>
              <p className="mt-2 text-[10px] text-[color:var(--color-fg-muted)]">
                現在のステータス: {formatStatus(conversation.status)}
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-4">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">
                リクエスト種別
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0b1f33]">
                {selectedContactSummary.type === "chat" ? "チャット" : "交換・譲渡リクエスト"}
              </p>
              <p className="mt-2 text-[10px] text-[color:var(--color-fg-muted)]">
                受付日時:{" "}
                {conversation.createdAt
                  ? new Date(conversation.createdAt).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "不明"}
              </p>
            </div>
          </div>

          {viewerRole === "owner" && conversation.status === "pending" && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleStatusUpdate("accepted")}
                disabled={statusActionState === "loading"}
                className="inline-flex items-center justify-center rounded-full border border-[#16a34a] px-4 py-2 text-[11px] font-semibold text-[#166534] transition hover:bg-[#16a34a0d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                承認する
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate("declined")}
                disabled={statusActionState === "loading"}
                className="inline-flex items-center justify-center rounded-full border border-[#b91c1c] px-4 py-2 text-[11px] font-semibold text-[#b91c1c] transition hover:bg-[#b91c1c0d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                辞退する
              </button>
            </div>
          )}

          {actionFeedback && (
            <p className="rounded border border-[#c6f6d5] bg-[#f0fff4] px-4 py-2 text-[11px] text-[#2f855a]">
              {actionFeedback}
            </p>
          )}
          {actionError && (
            <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-4 py-2 text-[11px] text-[#c53030]">
              {actionError}
            </p>
          )}
        </article>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 text-xs text-[color:var(--color-fg-muted)]">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0b1f33]">チャット履歴</h3>
            <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1 text-[10px] text-[color:var(--color-fg-muted)]">
              合計 {messages.length} 件
            </span>
          </header>

          <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-[color:var(--color-border)] bg-white p-3">
            {messages.length === 0 && <p className="text-[color:var(--color-fg-muted)]">まだメッセージはありません。</p>}
            {messages.map((message) => {
              const isOwn = viewerId ? message.senderUserId === viewerId : false;
              return (
                <div key={message.messageId} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isOwn
                        ? "bg-[color:var(--color-accent-emerald)] text-[color:var(--color-accent-emerald-ink)]"
                        : "bg-[color:var(--color-surface-2)] text-[#0b1f33]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className="pt-1 text-[10px] opacity-80">
                      {new Date(message.createdAt).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {canSend ? (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={messageDrafts[selectedContactSummary.contactId] ?? ""}
                onChange={(event) =>
                  setMessageDrafts((prev) => ({ ...prev, [selectedContactSummary.contactId]: event.target.value }))
                }
                placeholder={`${counterpartName} へのメッセージを入力`}
                className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || (messageDrafts[selectedContactSummary.contactId] ?? "").trim().length === 0}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent-emerald)] px-4 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  送信
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-[11px] text-[color:var(--color-fg-muted)]">
              現在は承認待ちのため、メッセージ送信はできません。
            </p>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">チャット／リクエスト</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            受信・送信したリクエストを一覧し、承認済みのやり取りはチャットで継続できます。投稿詳細との往復なしで進捗を管理しましょう。
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
          <aside className="space-y-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="space-y-2">
              <h2 className="text-sm font-semibold text-[#0b1f33]">連絡一覧</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                左から対象を選ぶと、右側に投稿と会話が表示されます。
              </p>
            </header>

            <div className="flex flex-wrap gap-2 text-[10px]">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-full border px-3 py-1 transition ${
                    filter === item.value
                      ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/20 text-[#0b1f33]"
                      : "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="max-h-[520px] overflow-y-auto pr-1">{renderList()}</div>
          </aside>

          <section>{renderDetail()}</section>
        </div>
      </main>
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
