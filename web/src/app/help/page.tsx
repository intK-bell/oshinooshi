"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "../../components/Header";
import { faqSections as faqContent, safetyGuidelines, type FaqSection } from "../../content/helpContent";

export default function HelpPage() {
  const [faqQuery, setFaqQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const defaultExpanded: Record<string, boolean> = {};
    for (const section of faqContent) {
      const first = section.entries[0];
      if (first) {
        defaultExpanded[first.question] = true;
      }
    }
    return defaultExpanded;
  });

  const filteredFaqSections = useMemo(() => {
    const lowerQuery = faqQuery.trim().toLowerCase();

    return faqContent
      .map((section) => {
        if (!lowerQuery) {
          return section;
        }

        const filteredEntries = section.entries.filter((entry) => {
          const haystack = `${entry.question}${entry.answer}`.toLowerCase();
          return haystack.includes(lowerQuery);
        });

        return filteredEntries.length > 0 ? { ...section, entries: filteredEntries } : null;
      })
      .filter((section): section is FaqSection => Boolean(section));
  }, [faqQuery]);

  const toggleFaq = (question: string) => {
    setExpanded((prev) => ({ ...prev, [question]: !prev[question] }));
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">ご利用ガイド</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            プロフィールの整え方や、安全にやりとりするためのポイントをまとめています。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="text-sm font-semibold">ミスマッチを防ぐコツ</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 text-[11px] text-[color:var(--color-fg-muted)]">
              <p className="text-xs font-semibold text-[#0b1f33]">やりとりの流れを明記</p>
              <p>申し込み後の返信タイミングや確認したいことを事前に書いておくとスムーズです。</p>
            </div>
            <div className="space-y-2 text-[11px] text-[color:var(--color-fg-muted)]">
              <p className="text-xs font-semibold text-[#0b1f33]">条件は箇条書きで</p>
              <p>希望枚数や同封物など、重要な条件は箇条書きやチェックリストで整理しましょう。</p>
            </div>
            <div className="space-y-2 text-[11px] text-[color:var(--color-fg-muted)]">
              <p className="text-xs font-semibold text-[#0b1f33]">返信速度の目安</p>
              <p>「24時間以内に返信」「夜は既読のみ」など、相手が安心する情報を添えると親切です。</p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="text-sm font-semibold">安全ガイド</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {safetyGuidelines.map((group) => (
              <div key={group.title} className="space-y-2 text-[11px] text-[color:var(--color-fg-muted)]">
                <p className="text-xs font-semibold text-[#0b1f33]">{group.title}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item}>・{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[color:var(--color-fg-muted)]">
            緊急のご相談は <Link href="/help/contact" className="underline">お問い合わせフォーム</Link> またはアプリ内サポートチャットをご利用ください。
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">FAQ</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                キーワードで検索したり、各質問をタップして詳細を確認できます。
              </p>
            </div>
            <label className="flex w-full max-w-xs items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[11px] text-[color:var(--color-fg-muted)]">
              <span className="text-[color:var(--color-fg-muted)]">🔍</span>
              <input
                value={faqQuery}
                onChange={(event) => setFaqQuery(event.target.value)}
                className="w-full bg-transparent text-xs text-[#0b1f33] outline-none"
                placeholder="例: 通知 / プロフィール"
              />
            </label>
          </div>
          <div className="space-y-5">
            {filteredFaqSections.length === 0 && (
              <p className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 text-center text-[11px] text-[color:var(--color-fg-muted)]">
                該当する質問が見つかりませんでした。別のキーワードをお試しください。
              </p>
            )}
            {filteredFaqSections.map((section) => (
              <article key={section.category} className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
                <header className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#0b1f33]">{section.category}</h3>
                  <Link href="/help/contact" className="text-[10px] underline">
                    追加で質問する
                  </Link>
                </header>
                <div className="space-y-3 text-[11px] text-[color:var(--color-fg-muted)]">
                  {section.entries.map((entry) => {
                    const isExpanded = expanded[entry.question] ?? false;
                    return (
                      <div key={entry.question} className="overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                        <button
                          type="button"
                          onClick={() => toggleFaq(entry.question)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-[#0b1f33]"
                        >
                          <span>Q. {entry.question}</span>
                          <span className="text-[color:var(--color-fg-muted)]">{isExpanded ? "－" : "＋"}</span>
                        </button>
                        {isExpanded && (
                          <p className="border-t border-[color:var(--color-border)] px-4 py-3 text-[11px] leading-relaxed">
                            {entry.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
