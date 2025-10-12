"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "../../components/Header";
import {
  faqSections as faqContent,
  safetyGuidelines,
  stepGuides,
  usageFlowSteps,
  type FaqSection,
} from "../../content/helpContent";

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
            登録から評価までの流れと、各ステップで押さえておきたいポイントをまとめました。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="text-sm font-semibold">ご利用の流れ</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usageFlowSteps.map((step, index) => (
              <li key={step.title} className="space-y-2 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]">
                <span className="text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)]">STEP {index + 1}</span>
                <h3 className="text-xs font-semibold text-[#0b1f33]">{step.title}</h3>
                <p>{step.summary}</p>
                <a href={step.anchor} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)]">
                  詳しく見る →
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">ステップ別ガイド</h2>
            <p className="text-xs text-[color:var(--color-fg-muted)]">
              各ステップで迷いやすいポイントをまとめました。必要な箇所から読み進めてください。
            </p>
          </div>
          <div className="space-y-5">
            {stepGuides.map((guide) => (
              <article
                key={guide.key}
                id={guide.key}
                className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-[11px] text-[color:var(--color-fg-muted)]"
              >
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-[#0b1f33]">{guide.title}</h3>
                  <p>{guide.intro}</p>
                </div>
                <ul className="space-y-2">
                  {guide.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 rounded-lg border border-[color:var(--color-border)] bg-white px-4 py-3">
                      <span className="text-[color:var(--color-accent-emerald-ink)]">・</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {guide.link && (
                  <a
                    href={guide.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[color:var(--color-accent-emerald-ink)]"
                  >
                    {guide.link.label} →
                  </a>
                )}
              </article>
            ))}
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
