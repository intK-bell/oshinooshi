"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Header } from "../components/Header";

const features = [
  {
    title: "AIレコメンド",
    body: "あなたの求める・譲れる条件から、マッチしそうな相手を自動で提案します。",
  },
  {
    title: "匿名配送ガイド",
    body: "佐川急便の匿名配送の手順をアプリ内で確認できます。",
  },
  {
    title: "安全な取引管理",
    body: "チャット状況や評価が一目で分かるダッシュボードを用意しています。",
  },
];

const quickActions = [
  {
    href: "/matches",
    title: "マッチ状況",
    description: "進行中の取引を確認・ステータス更新",
  },
  {
    href: "/post/new",
    title: "投稿を作成",
    description: "求/譲の条件を登録して募集をスタート",
  },
  {
    href: "/profile",
    title: "プロフィール編集",
    description: "自己紹介や準備チェックの更新はこちら",
  },
  {
    href: "/help",
    title: "利用ガイド",
    description: "安心して取引するためのヒントを確認",
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileName(null);
      return;
    }

    let cancelled = false;
    fetch("/api/profile")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load profile: ${response.status}`);
        }
        return response.json() as Promise<{ profile?: { displayName?: string } | null }>;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        const name = data.profile?.displayName;
        setProfileName(name && name.trim().length > 0 ? name : null);
      })
      .catch(() => {
        if (!cancelled) {
          setProfileName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const baseName = profileName ?? session?.user?.name ?? "ようこそ";
  const displayName = baseName;
  const greetingSuffix = profileName || session?.user?.name ? " さん" : "";

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-14 sm:gap-16 sm:py-20">
        {isAuthenticated ? (
          <>
            <section className="space-y-5">
              <p className="text-xs font-semibold text-[color:var(--color-fg-muted)]">
                こんにちは、{displayName}
                {greetingSuffix}
              </p>
              <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">今日のやることを素早くチェックしましょう</h1>
              <p className="max-w-xl text-sm text-[color:var(--color-fg-muted)]">
                進行中のマッチや新しい募集をこのページからまとめて管理できます。気になるメニューを選んで、すぐに次のアクションへ進みましょう。
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              {quickActions.map(({ href, title, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col justify-between rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 shadow-sm transition hover:-translate-y-1 hover:border-[color:var(--color-accent-emerald)] hover:shadow-md"
                >
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-[#0b1f33] group-hover:text-[color:var(--color-accent-emerald-ink)]">
                      {title}
                    </h2>
                    <p className="text-xs text-[color:var(--color-fg-muted)]">{description}</p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)]">
                    開く →
                  </span>
                </Link>
              ))}
            </section>

            <section className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-5 py-6">
              <h2 className="text-sm font-semibold text-[#0b1f33]">最近のアップデート</h2>
              <ul className="space-y-2 text-xs text-[color:var(--color-fg-muted)]">
                <li>・プロフィールの準備チェックがダッシュボードと同期されるようになりました。</li>
                <li>・匿名配送ガイドを最新の発送手順に更新しました。</li>
                <li>・マッチ状況ページに返信リマインドを追加しました。</li>
              </ul>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-5">
              <p className="text-xs font-semibold text-[color:var(--color-fg-muted)]">推し活グッズ交換サービス</p>
              <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">
                「譲ります」と「求めます」が落ち着いて出会える、シンプルな交換プラットフォーム。
              </h1>
              <p className="max-w-xl text-sm text-[color:var(--color-fg-muted)]">
                SNS の DM での取引に不安を感じる方のために。AI のレコメンドと匿名配送ガイドを備えた、安心して使える推し活のための場所です。
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => signIn("line")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent-emerald)] px-5 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm transition hover:bg-[color:var(--color-accent-emerald-hover)]"
                >
                  LINEではじめる
                </button>
                <Link
                  href="/help"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] px-5 py-2 text-xs font-semibold text-black/70 transition hover:bg-[color:var(--color-surface-2)]"
                >
                  サービスの特徴を見る
                </Link>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              {features.map(({ title, body }) => (
                <div
                  key={title}
                  className="space-y-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-5 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-black/75">{title}</h3>
                  <p className="text-xs text-[color:var(--color-fg-muted)]">{body}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-5 py-6">
              <h2 className="text-sm font-semibold text-black/70">推し活をもっと安心に</h2>
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                LINE認証でアカウントを守り、取引の進捗はダッシュボードで確認。匿名配送を案内しながら、評価システムで信頼を可視化します。
              </p>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-[color:var(--color-border)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 text-xs text-[color:var(--color-fg-muted)]">
          <p>© {new Date().getFullYear()} oshinooshi</p>
          <div className="flex gap-4">
            <Link href="/help">ガイドライン</Link>
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシー</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
