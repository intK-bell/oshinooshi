"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

const authenticatedNavLinks = [
  { href: "/matches", label: "マッチ状況" },
  { href: "/search", label: "検索" },
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

  return (
    <header className="border-b border-[color:var(--color-border)]">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="text-base font-semibold">
          oshinooshi
        </Link>
        {isAuthenticated ? (
          <nav className="hidden gap-5 text-xs font-medium text-[color:var(--color-fg-muted)] md:flex">
            {authenticatedNavLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[color:var(--color-accent-emerald-ink)]">
                {link.label}
              </Link>
            ))}
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}
        {isAuthenticated ? <LogoutButton /> : <LoginButton />}
      </div>
    </header>
  );
}
