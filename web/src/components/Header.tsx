"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const authenticatedNavLinks = [
  { href: "/search", label: "検索" },
  { href: "/conversations", label: "チャット" },
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
      onClick={() => signOut({ callbackUrl: "/api/auth/signin?callbackUrl=/" })}
      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-medium transition hover:bg-[color:var(--color-surface-2)]"
    >
      ログアウト
    </button>
  );
}

export function Header() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [hasPendingChats, setHasPendingChats] = useState<boolean | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasPendingChats(null);
      setIsMenuOpen(false);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let isActive = true;
    let abortController = new AbortController();

    type NotificationContact = {
      status?: string;
    };

    const fetchNotifications = async (signal: AbortSignal) => {
      try {
        const params = new URLSearchParams({
          role: "all",
          limit: "50",
        });
        const response = await fetch(`/api/contacts?${params.toString()}`, { signal });
        if (!response.ok) {
          throw new Error(`Failed to load notifications: ${response.status}`);
        }
        const data = (await response.json()) as { contacts?: NotificationContact[] };
        if (!signal.aborted && isActive) {
          const contacts = Array.isArray(data.contacts) ? data.contacts : [];
          const pendingChat = contacts.some((contact) => contact.status === "pending");
          setHasPendingChats(pendingChat);
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error("Failed to check pending contact notifications", error);
        if (isActive) {
          setHasPendingChats(false);
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
    <header className="border-b border-[color:var(--color-border)] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="text-base font-semibold">
          oshinooshi
        </Link>
        <div className="hidden gap-5 text-xs font-medium text-[color:var(--color-fg-muted)] md:flex">
          {isAuthenticated ? (
            authenticatedNavLinks.map((link) => {
              const showBadge = link.href === "/conversations" && hasPendingChats;
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
            })
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-3 py-2 text-xs text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)] md:hidden"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
          >
            メニュー
          </button>
          {isAuthenticated ? <LogoutButton /> : <LoginButton />}
        </div>
      </div>
      <div
        id="mobile-nav"
        className={`md:hidden ${isMenuOpen ? "max-h-[480px] border-t border-[color:var(--color-border)]" : "max-h-0 overflow-hidden border-t border-transparent"} transition-[max-height] duration-200 ease-in-out`}
      >
        {isAuthenticated ? (
          <nav className="flex flex-col gap-4 px-5 py-4 text-xs font-medium text-[color:var(--color-fg-muted)]">
            {authenticatedNavLinks.map((link) => {
              const showBadge = link.href === "/conversations" && hasPendingChats;
              return (
                <Link
                  key={`mobile-${link.href}`}
                  href={link.href}
                  className="flex items-center justify-between"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>{link.label}</span>
                  {showBadge ? <span className="h-2 w-2 rounded-full bg-[#f97316]" aria-hidden="true" /> : null}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="px-5 py-4 text-xs text-[color:var(--color-fg-muted)]">
            <p className="mb-3">ログインすると検索やチャットを利用できます。</p>
            <LoginButton />
          </div>
        )}
      </div>
    </header>
  );
}
