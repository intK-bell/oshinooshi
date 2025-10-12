/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Header } from "@/components/Header";

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
    images?: string[];
    group?: string | null;
    haveMembers?: string[];
    wantMembers?: string[];
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

type PostSummary = {
  postId: string;
  title: string;
  postType: "offer" | "request" | "trade";
  status: string;
  images: string[];
  categories: string[];
  body: string | null;
  group: string | null;
  haveMembers: string[];
  wantMembers: string[];
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
    lineFriendUrl?: string | null;
  };
  recipient: {
    userId: string;
    name: string | null;
    lineFriendUrl?: string | null;
  };
  messages: ConversationMessage[];
};

type ConversationDetailState =
  | { status: "idle" }
  | { status: "loading"; contactId: string }
  | { status: "error"; contactId: string; message: string }
  | { status: "success"; contactId: string; viewerRole: "owner" | "sender"; conversation: ConversationDetail; post: PostSummary | null };

type PostContactResponse = {
  contacts?: ConversationDetail[];
  viewerRole?: "owner" | "sender";
  post?: PostSummary | null;
  error?: string;
};

type ContactsResponse = {
  contacts?: ContactListItem[];
  error?: string;
};

const STATUS_FILTERS: Array<{ value: "pending" | "accepted" | "declined"; label: string }> = [
  { value: "pending", label: "承認待ち" },
  { value: "accepted", label: "承認済み" },
  { value: "declined", label: "辞退済み" },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  accepted: 1,
  declined: 2,
};

const PENDING_PAGE_SIZE = 5;

function ConversationsPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const viewerId = session?.user?.id ?? null;

  const [listState, setListState] = useState<ContactListState>({ status: "loading" });
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<ConversationDetailState>({ status: "idle" });
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("pending");
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusActionState, setStatusActionState] = useState<"idle" | "loading">("idle");
  const [selfPendingPage, setSelfPendingPage] = useState(1);
  const [counterPendingPage, setCounterPendingPage] = useState(1);
  const [initialSelectionHandled, setInitialSelectionHandled] = useState(false);

  const fetchContacts = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const response = await fetch("/api/contacts?role=all");
      const data = (await response.json().catch(() => ({}))) as ContactsResponse;

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
    const filtered = contacts.filter((contact) => contact.status === filter);
    const sorted = [...filtered].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 99;
      const orderB = STATUS_ORDER[b.status] ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
    return sorted;
  }, [contacts, filter]);

  useEffect(() => {
    if (filter === "pending") {
      setSelectedContactId(null);
      return;
    }
    if (filteredContacts.length === 0) {
      setSelectedContactId(null);
      return;
    }
    if (selectedContactId && filteredContacts.some((contact) => contact.contactId === selectedContactId)) {
      return;
    }
    setSelectedContactId(filteredContacts[0]?.contactId ?? null);
  }, [filteredContacts, selectedContactId, filter]);

  const loadConversationDetail = useCallback(
    async (contact: ContactListItem) => {
      setDetailState({ status: "loading", contactId: contact.contactId });
      setActionError(null);
      try {
        const response = await fetch(`/api/posts/${contact.postId}/contact/conversations`);
        const data = (await response.json().catch(() => ({}))) as PostContactResponse;

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
          post: data.post ?? null,
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
    if (initialSelectionHandled) {
      return;
    }

    const contactIdFromQuery = searchParams.get("contactId");

    if (!contactIdFromQuery) {
      setInitialSelectionHandled(true);
      return;
    }

    const target = contacts.find((contact) => contact.contactId === contactIdFromQuery);
    if (target) {
      setSelectedContactId(contactIdFromQuery);
      setInitialSelectionHandled(true);
    } else if (listState.status === "success") {
      // contacts loaded but target not found
      setInitialSelectionHandled(true);
    }
  }, [contacts, initialSelectionHandled, listState.status, searchParams]);

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

  const resolveCounterpartName = (contact: ContactListItem) => {
    return contact.viewerRole === "sender"
      ? contact.recipient.name ?? contact.recipient.userId ?? "投稿者"
      : contact.sender.name ?? contact.sender.userId;
  };

  const formatCounterpartStatusName = (name: string | null | undefined) => {
    const trimmed = name?.trim();
    if (!trimmed) {
      return "相手";
    }
    return trimmed.endsWith("さん") ? trimmed : `${trimmed}さん`;
  };

  const pendingNeedsMyAction = useMemo(
    () => contacts.filter((contact) => contact.status === "pending" && contact.viewerRole === "recipient"),
    [contacts],
  );
  const pendingWaitingForCounterpart = useMemo(
    () => contacts.filter((contact) => contact.status === "pending" && contact.viewerRole !== "recipient"),
    [contacts],
  );

  useEffect(() => {
    if (filter === "pending") {
      setSelfPendingPage(1);
      setCounterPendingPage(1);
    }
  }, [filter]);

  useEffect(() => {
    if (filter !== "pending") {
      return;
    }
    const selfMax = Math.max(1, Math.ceil(pendingNeedsMyAction.length / PENDING_PAGE_SIZE) || 1);
    const counterpartMax = Math.max(1, Math.ceil(pendingWaitingForCounterpart.length / PENDING_PAGE_SIZE) || 1);
    setSelfPendingPage((prev) => Math.min(Math.max(prev, 1), selfMax));
    setCounterPendingPage((prev) => Math.min(Math.max(prev, 1), counterpartMax));
  }, [filter, pendingNeedsMyAction.length, pendingWaitingForCounterpart.length]);

  const paginatedPendingNeedsMyAction = useMemo(() => {
    const start = (selfPendingPage - 1) * PENDING_PAGE_SIZE;
    return pendingNeedsMyAction.slice(start, start + PENDING_PAGE_SIZE);
  }, [pendingNeedsMyAction, selfPendingPage]);

  const paginatedPendingWaitingForCounterpart = useMemo(() => {
    const start = (counterPendingPage - 1) * PENDING_PAGE_SIZE;
    return pendingWaitingForCounterpart.slice(start, start + PENDING_PAGE_SIZE);
  }, [pendingWaitingForCounterpart, counterPendingPage]);

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
      await Promise.all([loadConversationDetail(selectedContactSummary), fetchContacts()]);
    } catch (error) {
      console.error("Failed to send conversation message", error);
      setActionError((error as Error).message ?? "メッセージの送信に失敗しました。");
    } finally {
      setIsSending(false);
    }
  };

  const updateContactStatus = async (targetContact: ContactListItem, nextStatus: "accepted" | "declined") => {
    if (!targetContact) {
      return;
    }

    setStatusActionState("loading");
    setActionError(null);
    try {
      const response = await fetch(`/api/contacts/${targetContact.contactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: targetContact.postId,
          status: nextStatus,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `ステータスの更新に失敗しました。（${response.status}）`);
      }

      setActionFeedback(nextStatus === "accepted" ? "リクエストを承認しました。" : "リクエストを辞退しました。");
      await fetchContacts();
      if (detailState.status === "success" && detailState.contactId === targetContact.contactId) {
        await loadConversationDetail({ ...targetContact, status: nextStatus });
      }
    } catch (error) {
      console.error("Failed to update request status", error);
      setActionError((error as Error).message ?? "ステータスの更新に失敗しました。");
    } finally {
      setStatusActionState("idle");
    }
  };

  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    onPrevious: () => void,
    onNext: () => void,
  ) => {
    if (totalPages <= 1) {
      return null;
    }

    return (
      <div className="flex items-center justify-between text-[10px] text-[color:var(--color-fg-muted)]">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          前へ
        </button>
        <span>
          ページ {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          次へ
        </button>
      </div>
    );
  };

  const renderPendingSections = () => {
    const selfTotalPages = Math.max(1, Math.ceil(pendingNeedsMyAction.length / PENDING_PAGE_SIZE) || 1);
    const counterpartTotalPages = Math.max(1, Math.ceil(pendingWaitingForCounterpart.length / PENDING_PAGE_SIZE) || 1);

    const renderPendingCard = (contact: ContactListItem, variant: "self" | "counterpart") => {
      const counterpartName = resolveCounterpartName(contact);
      const counterpartStatusName = formatCounterpartStatusName(counterpartName);
      const title = contact.post?.title ?? "投稿";
      const imageUrl = contact.post?.images?.[0] ?? null;
      const groupLabel = contact.post?.group ?? null;
      const pendingStatusLabel =
        variant === "self"
          ? formatStatus("pending", { viewerRole: "owner", counterpartName })
          : `${counterpartStatusName}の承認待ちです`;

      return (
        <article
          key={contact.contactId}
          className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-xs text-[color:var(--color-fg-muted)]"
        >
          <div className="flex gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              {imageUrl ? (
                <img src={imageUrl} alt={`${title} の画像`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--color-fg-muted)]">
                  No Image
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">対応中の投稿</p>
                  <h3 className="text-sm font-semibold text-[#0b1f33]">{title}</h3>
                  <p className="text-[11px] text-[color:var(--color-fg-muted)]">相手: {counterpartName}</p>
                </div>
                <Link
                  href={`/post/${contact.postId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
                >
                  投稿ページを開く
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-[color:var(--color-fg-muted)]">
                <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">同種交換</span>
                <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">{pendingStatusLabel}</span>
                {groupLabel && <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">{groupLabel}</span>}
              </div>
              {(contact.post?.haveMembers?.length || 0) > 0 && (
                <div className="space-y-1 text-[10px] text-[color:var(--color-fg-muted)]">
                  <p className="font-semibold text-[#0b1f33]">手元にあるメンバー</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.post!.haveMembers!.map((member) => (
                      <span key={`pending-have-${contact.contactId}-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(contact.post?.wantMembers?.length || 0) > 0 && (
                <div className="space-y-1 text-[10px] text-[color:var(--color-fg-muted)]">
                  <p className="font-semibold text-[#0b1f33]">探しているメンバー</p>
                  <div className="flex flex-wrap gap-2">
                    {contact.post!.wantMembers!.map((member) => (
                      <span key={`pending-want-${contact.contactId}-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {variant === "self" ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => updateContactStatus(contact, "accepted")}
                    disabled={statusActionState === "loading"}
                    className="inline-flex items-center justify-center rounded-full border border-[#16a34a] px-4 py-2 text-[11px] font-semibold text-[#166534] transition hover:bg-[#16a34a0d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    承認する
                  </button>
                  <button
                    type="button"
                    onClick={() => updateContactStatus(contact, "declined")}
                    disabled={statusActionState === "loading"}
                    className="inline-flex items-center justify-center rounded-full border border-[#b91c1c] px-4 py-2 text-[11px] font-semibold text-[#b91c1c] transition hover:bg-[#b91c1c0d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    辞退する
                  </button>
                </div>
              ) : (
                <p className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-[11px] text-[color:var(--color-fg-muted)]">
                  {pendingStatusLabel}
                </p>
              )}
            </div>
          </div>
        </article>
      );
    };

    return (
      <div className="space-y-6">
        {actionFeedback && (
          <p className="rounded border border-[#c6f6d5] bg-[#f0fff4] px-4 py-2 text-[11px] text-[#2f855a]">{actionFeedback}</p>
        )}
        {actionError && (
          <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-4 py-2 text-[11px] text-[#c53030]">{actionError}</p>
        )}

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
          <header className="space-y-1">
            <h2 className="text-sm font-semibold text-[#0b1f33]">自分の承認待ち</h2>
            <p className="text-[11px] text-[color:var(--color-fg-muted)]">
              あなたの承認が必要なリクエストです。内容を確認して承認または辞退を選びましょう。
            </p>
          </header>

          {paginatedPendingNeedsMyAction.length === 0 ? (
            <p className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
              現在、あなたが対応するリクエストはありません。
            </p>
          ) : (
            <div className="space-y-4">
              {paginatedPendingNeedsMyAction.map((contact) => renderPendingCard(contact, "self"))}
            </div>
          )}

          {pendingNeedsMyAction.length > 0 &&
            renderPaginationControls(
              selfPendingPage,
              selfTotalPages,
              () => setSelfPendingPage((page) => Math.max(page - 1, 1)),
              () => setSelfPendingPage((page) => Math.min(page + 1, selfTotalPages)),
            )}
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
          <header className="space-y-1">
            <h2 className="text-sm font-semibold text-[#0b1f33]">相手の承認待ち</h2>
            <p className="text-[11px] text-[color:var(--color-fg-muted)]">
              相手の承認が完了するとチャットが開始できます。しばらくお待ちください。
            </p>
          </header>

          {paginatedPendingWaitingForCounterpart.length === 0 ? (
            <p className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-[11px] text-[color:var(--color-fg-muted)]">
              現在、相手の承認待ちのリクエストはありません。
            </p>
          ) : (
            <div className="space-y-4">
              {paginatedPendingWaitingForCounterpart.map((contact) => renderPendingCard(contact, "counterpart"))}
            </div>
          )}

          {pendingWaitingForCounterpart.length > 0 &&
            renderPaginationControls(
              counterPendingPage,
              counterpartTotalPages,
              () => setCounterPendingPage((page) => Math.max(page - 1, 1)),
              () => setCounterPendingPage((page) => Math.min(page + 1, counterpartTotalPages)),
            )}
        </section>
      </div>
    );
  };

  const conversation = detailState.status === "success" ? detailState.conversation : null;
  const postSummary = detailState.status === "success" ? detailState.post : null;

  const renderPostCard = () => {
    if (!selectedContactSummary) {
      return null;
    }

    if (detailState.status === "loading" && detailState.contactId === selectedContactSummary.contactId) {
      return <p className="text-[11px] text-[color:var(--color-fg-muted)]">投稿情報を読み込み中です…</p>;
    }

    if (detailState.status === "error" && detailState.contactId === selectedContactSummary.contactId) {
      return (
        <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-3 py-2 text-[11px] text-[#c53030]">
          投稿情報を取得できませんでした。
        </p>
      );
    }

    const fallback: PostSummary = {
      postId: selectedContactSummary.postId,
      title: selectedContactSummary.post?.title ?? "投稿",
      postType: selectedContactSummary.post?.postType ?? "trade",
      status: conversation?.status ?? selectedContactSummary.status,
      images: selectedContactSummary.post?.images ?? [],
      categories: [],
      body: null,
      group: selectedContactSummary.post?.group ?? null,
      haveMembers: [],
      wantMembers: [],
    };

    const summary = postSummary
      ? {
          ...postSummary,
          postType: postSummary.postType ?? "trade",
          haveMembers: postSummary.haveMembers ?? [],
          wantMembers: postSummary.wantMembers ?? [],
        }
      : fallback;
    const viewerRoleForStatus =
      detailState.status === "success"
        ? detailState.viewerRole
        : selectedContactSummary.viewerRole === "recipient"
          ? "owner"
          : "sender";
    const counterpartNameForStatus =
      detailState.status === "success"
        ? detailState.viewerRole === "owner"
          ? detailState.conversation.sender.name ?? detailState.conversation.sender.userId
          : detailState.conversation.recipient.name ?? detailState.conversation.recipient.userId
        : selectedContactSummary.viewerRole === "recipient"
          ? selectedContactSummary.sender.name ?? selectedContactSummary.sender.userId
          : selectedContactSummary.recipient.name ?? selectedContactSummary.recipient.userId;
    const imageUrl = summary.images?.[0] ?? null;
    const statusLabel = formatStatus(conversation?.status ?? selectedContactSummary.status, {
      viewerRole: viewerRoleForStatus,
      counterpartName: counterpartNameForStatus,
    });

    return (
      <article className="flex items-start gap-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-xs text-[color:var(--color-fg-muted)]">
        <div className="h-20 w-20 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
          {imageUrl ? (
            <img src={imageUrl} alt={`${summary.title} の画像`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--color-fg-muted)]">
              No Image
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">対応中の投稿</p>
              <h2 className="text-sm font-semibold text-[#0b1f33]">{summary.title}</h2>
            </div>
            <Link
              href={`/post/${selectedContactSummary.postId}`}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
            >
              投稿ページを開く
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-[color:var(--color-fg-muted)]">
            <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">同種交換</span>
            <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">{statusLabel}</span>
            {summary.group && <span className="rounded-full bg-[color:var(--color-surface-2)] px-2 py-1">{summary.group}</span>}
          </div>
          {(summary.haveMembers.length > 0 || summary.wantMembers.length > 0) && (
            <div className="grid gap-3 text-[10px] text-[color:var(--color-fg-muted)]">
              {summary.haveMembers.length > 0 && (
                <div className="space-y-1">
                  <p className="font-semibold text-[#0b1f33]">手元にあるメンバー</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.haveMembers.map((member) => (
                      <span key={`detail-have-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary.wantMembers.length > 0 && (
                <div className="space-y-1">
                  <p className="font-semibold text-[#0b1f33]">探しているメンバー</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.wantMembers.map((member) => (
                      <span key={`detail-want-${member}`} className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderDetail = () => {
    if (!selectedContactSummary) {
      if (listState.status === "loading") {
        return (
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 text-xs text-[color:var(--color-fg-muted)]">
            会話を読み込み中です…
          </div>
        );
      }
      if (listState.status === "error") {
        return (
          <div className="rounded-2xl border border-[#fed7d7] bg-[#fff5f5] p-6 text-xs text-[#c53030]">
            {listState.message}
          </div>
        );
      }
      if (filter !== "pending" && filteredContacts.length === 0) {
        return (
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 text-xs text-[color:var(--color-fg-muted)]">
            該当するリクエストがありません。
          </div>
        );
      }
      return (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 text-xs text-[color:var(--color-fg-muted)]">
          リクエストを選択すると会話が表示されます。
        </div>
      );
    }

    if (detailState.status === "loading" && detailState.contactId === selectedContactSummary.contactId) {
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

    const conversationDetail = detailState.conversation;
    const counterpartName =
      detailState.viewerRole === "owner"
        ? conversationDetail.sender.name ?? conversationDetail.sender.userId
        : conversationDetail.recipient.name ?? conversationDetail.recipient.userId ?? "投稿者";
    const statusLabel = formatStatus(conversationDetail.status, {
      viewerRole: detailState.viewerRole,
      counterpartName,
    });

    const canSend = conversationDetail.status === "accepted";
    const isOwnerPending = detailState.viewerRole === "owner" && conversationDetail.status === "pending";
    const isSelfPending =
      (detailState.viewerRole === "owner" || detailState.viewerRole === "sender") &&
      conversationDetail.status === "pending";
    const createdLabel = conversationDetail.createdAt
      ? new Date(conversationDetail.createdAt).toLocaleString("ja-JP", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "不明";
    const updatedLabel = conversationDetail.updatedAt
      ? new Date(conversationDetail.updatedAt).toLocaleString("ja-JP", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "不明";

    const messages = [...conversationDetail.messages].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    const counterpartLineFriendUrl =
      selectedContactSummary.viewerRole === "sender"
        ? selectedContactSummary.recipient.lineFriendUrl ?? null
        : selectedContactSummary.sender.lineFriendUrl ?? null;

    return (
      <div className="space-y-6">
        {renderPostCard()}

        <article className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 text-xs text-[color:var(--color-fg-muted)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0b1f33]">{counterpartName}</p>
              <p className="text-[10px] text-[color:var(--color-fg-muted)]">
                リクエスト種別: {selectedContactSummary.type === "chat" ? "チャット" : "交換・譲渡リクエスト"}
              </p>
            </div>
            <div className="text-right text-[10px] text-[color:var(--color-fg-muted)]">
              <p>ステータス: {statusLabel}</p>
              <p>受付日時: {createdLabel}</p>
              <p>最終更新: {updatedLabel}</p>
            </div>
          </div>

          {isOwnerPending && selectedContactSummary && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => updateContactStatus(selectedContactSummary, "accepted")}
                disabled={statusActionState === "loading"}
                className="inline-flex items-center justify-center rounded-full border border-[#16a34a] px-4 py-2 text-[11px] font-semibold text-[#166534] transition hover:bg-[#16a34a0d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                承認する
              </button>
              <button
                type="button"
                onClick={() => updateContactStatus(selectedContactSummary, "declined")}
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

        {isSelfPending ? (
          <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 text-xs text-[color:var(--color-fg-muted)]">
            <header className="space-y-1">
              <h3 className="text-sm font-semibold text-[#0b1f33]">チャット申請は承認待ちです</h3>
              <p>
                承認が完了するとチャットが開き、ここにメッセージ履歴が表示されます。専用ページでステータスをご確認ください。
              </p>
            </header>
            <div className="flex justify-end">
              <Link
                href="/conversations"
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
              >
                チャット画面へ
              </Link>
            </div>
          </section>
        ) : (
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/line-requests?contactId=${selectedContactSummary.contactId}`}
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
                    >
                      LINE友達を申請
                    </Link>
                    {conversationDetail.status === "accepted" && counterpartLineFriendUrl && (
                      <a
                        href={counterpartLineFriendUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--color-accent-emerald)] px-3 py-1 text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)] transition hover:bg-[color:var(--color-accent-emerald)]/20"
                      >
                        LINEでお友達になる
                      </a>
                    )}
                  </div>
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
                現在はメッセージ送信はできません。
              </p>
            )}
          </section>
        )}
      </div>
    );
  };

  const pendingCount = useMemo(
    () => contacts.filter((contact) => contact.status === "pending").length,
    [contacts],
  );
  const acceptedCount = useMemo(
    () => contacts.filter((contact) => contact.status === "accepted").length,
    [contacts],
  );
  const declinedCount = useMemo(
    () => contacts.filter((contact) => contact.status === "declined").length,
    [contacts],
  );

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">チャット</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            ステータスで絞り込み、リクエストを選択すると投稿概要とチャットが表示されます。
          </p>
        </section>

        <section className="space-y-6">
          <article className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-xs text-[color:var(--color-fg-muted)]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">ステータス</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as (typeof STATUS_FILTERS)[number]["value"])}
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                >
                  {STATUS_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {filter !== "pending" && (
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-fg-muted)]">
                    リクエスト
                  </span>
                  <select
                    value={selectedContactId ?? ""}
                    onChange={(event) => handleSelectContact(event.target.value)}
                    className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  >
                    {filteredContacts.length === 0 ? (
                      <option value="" disabled>
                        対象のリクエストがありません
                      </option>
                    ) : (
                      filteredContacts.map((contact) => {
                        const counterpartName = resolveCounterpartName(contact);
                        const postTitle = contact.post?.title ?? `投稿ID: ${contact.postId}`;
                        return (
                          <option key={contact.contactId} value={contact.contactId}>
                            {`${counterpartName} ／ ${postTitle}`}
                          </option>
                        );
                      })
                    )}
                  </select>
                </label>
              )}
            </div>

            <p className="text-[10px] text-[color:var(--color-fg-muted)]">
              承認待ち {pendingCount} 件／承認済み {acceptedCount} 件／辞退済み {declinedCount} 件
            </p>
          </article>

          {filter === "pending" ? renderPendingSections() : renderDetail()}
        </section>
      </main>
    </div>
  );
}

function formatStatus(
  status: string,
  options?: {
    viewerRole?: "owner" | "sender";
    counterpartName?: string | null;
  },
) {
  if (status === "pending") {
    if (options?.viewerRole === "owner") {
      const trimmed = options.counterpartName?.trim();
      const displayName =
        trimmed && trimmed.endsWith("さん")
          ? trimmed
          : trimmed
            ? `${trimmed}さん`
            : "相手";
      return `${displayName}の申請待ち`;
    }
    if (options?.viewerRole === "sender") {
      return "相手の申請待ち";
    }
  }

  switch (status) {
    case "accepted":
      return "承認済み";
    case "declined":
      return "辞退済み";
    default:
      return "承認待ち";
  }
}

function ConversationsPageFallback() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-14">
        <p className="text-xs text-[color:var(--color-fg-muted)]">読み込み中です…</p>
      </main>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<ConversationsPageFallback />}>
      <ConversationsPageContent />
    </Suspense>
  );
}
