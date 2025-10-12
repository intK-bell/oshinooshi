"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const authenticatedNavLinks = [
  { href: "/matches", label: "マッチ状況" },
  { href: "/search", label: "検索" },
  { href: "/conversations", label: "チャット／リクエスト" },
  { href: "/post/new", label: "新規投稿" },
  { href: "/post/manage", label: "投稿管理" },
  { href: "/profile", label: "プロフィール" },
  { href: "/help", label: "ガイド" },
];

function LoginButton() {
  return (
    <button
      onClick={() => signIn("line")}
      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-medium transition hover:bg-[color:var(--color-surface-2)]"
    >
      LINEでログイン
    </button>
  );
}

function LogoutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-medium transition hover:bg-[color:var(--color-surface-2)]"
    >
      ログアウト
    </button>
  );
}

export function Header() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [hasPendingContacts, setHasPendingContacts] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasPendingContacts(null);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let isActive = true;
    let abortController = new AbortController();

    const fetchNotifications = async (signal: AbortSignal) => {
      try {
        const params = new URLSearchParams({
          status: "pending",
          limit: "1",
        });
        const response = await fetch(`/api/contacts?${params.toString()}`, { signal });
        if (!response.ok) {
          throw new Error(`Failed to load notifications: ${response.status}`);
        }
        const data = (await response.json()) as { contacts?: unknown[] };
        if (!signal.aborted && isActive) {
          setHasPendingContacts(Array.isArray(data.contacts) && data.contacts.length > 0);
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error("Failed to check pending contact notifications", error);
        if (isActive) {
          setHasPendingContacts(false);
        }
      }
    };

    const triggerFetch = () => {
      abortController.abort();
      abortController = new AbortController();
      void fetchNotifications(abortController.signal);
    };

    triggerFetch();

    const intervalId = window.setInterval(triggerFetch, 10000);

    const handleVisibility = () => {
      if (!document.hidden) {
        triggerFetch();
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      isActive = false;
      abortController.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [isAuthenticated]);

  return (
    <header className="border-b border-[color:var(--color-border)]">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="text-base font-semibold">
          oshinooshi
        </Link>
        {isAuthenticated ? (
          <nav className="hidden gap-5 text-xs font-medium text-[color:var(--color-fg-muted)] md:flex">
            {authenticatedNavLinks.map((link) => {
              const showBadge = link.href === "/profile" && hasPendingContacts;
              return (
                <span key={link.href} className="relative">
                  <Link href={link.href} className="hover:text-[color:var(--color-accent-emerald-ink)]">
                    {link.label}
                  </Link>
                  {showBadge ? (
                    <span className="absolute -right-2 top-0 block h-2 w-2 rounded-full bg-[#f97316]" aria-hidden="true" />
                  ) : null}
                </span>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}
        {isAuthenticated ? <LogoutButton /> : <LoginButton />}
      </div>
    </header>
  );
}
