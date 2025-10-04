"use client";

import { useMemo, useState } from "react";
import { Header } from "../../components/Header";
import Link from "next/link";
import {
  faqSections as faqContent,
  profileReadiness,
  safetyGuidelines,
  visibilityLevels,
  writingTips,
  type FaqSection,
  type ProfileReadinessItem,
} from "../../content/helpContent";

export default function HelpPage() {
  const [selectedVisibility, setSelectedVisibility] = useState<(typeof visibilityLevels)[number]["key"]>(
    visibilityLevels[0]?.key ?? "public",
  );
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

  const visibilitySummary = useMemo(() => {
    const current = visibilityLevels.find((level) => level.key === selectedVisibility);
    if (!current) {
      return null;
    }
    return {
      label: current.label,
      benefit: current.benefit,
      action: current.key === "public" ? "初期設定のまま公開しましょう" : "プロフィール設定から切り替え可能です",
    };
  }, [selectedVisibility]);

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

  const statusTokens: Record<ProfileReadinessItem["status"], { label: string; badgeClass: string; accentColor: string }> = {
    completed: {
      label: "完了",
      badgeClass: "bg-[color:var(--color-accent-emerald)] text-[color:var(--color-accent-emerald-ink)]",
      accentColor: "var(--color-accent-emerald)",
    },
    in_progress: {
      label: "進行中",
      badgeClass: "bg-[color:var(--color-surface-2)] text-[#0b1f33]",
      accentColor: "#93c5fd",
    },
    todo: {
      label: "未着手",
      badgeClass: "border border-[color:var(--color-border)] bg-white text-[color:var(--color-fg-muted)]",
      accentColor: "#fcd34d",
    },
  };

  const completedCount = profileReadiness.filter((item) => item.status === "completed").length;
  const completionPercent = Math.round((completedCount / Math.max(profileReadiness.length, 1)) * 100);

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
            プロフィールを整えて、安心でスムーズなマッチングへ。公開レベルや書き方のヒントをまとめました。
          </p>
        </section>

        <section className="grid gap-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">プロフィール公開レベル</h2>
            <p className="text-[11px] text-[color:var(--color-fg-muted)]">
              利用状況に合わせて公開範囲を切り替えられます。
            </p>
            <div className="space-y-2 text-[11px]">
              {visibilityLevels.map((level) => {
                const active = selectedVisibility === level.key;
                return (
                  <button
                    key={level.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedVisibility(level.key)}
                    className={`w-full rounded border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)] ${
                      active
                        ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/20 text-[#0b1f33] shadow-sm"
                        : "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-[#0b1f33]">{level.label}</span>
                    <span className="text-[11px] text-[color:var(--color-fg-muted)]">{level.description}</span>
                    <span className="mt-1 block text-[10px] text-[color:var(--color-accent-emerald-ink)]">{level.benefit}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5 text-[11px] text-[color:var(--color-fg-muted)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[#0b1f33]">
              <span>プレビュー</span>
              {visibilitySummary && (
                <span className="rounded-full bg-[color:var(--color-accent-emerald)] px-3 py-1 text-[10px] text-[color:var(--color-accent-emerald-ink)]">
                  {visibilitySummary.label}
                </span>
              )}
            </div>
            <div className="space-y-1 text-sm font-semibold text-[#0b1f33]">
              <p>さくらんぼ@乃木坂</p>
              <p className="text-[11px] font-normal text-[color:var(--color-fg-muted)]">
                乃木坂歴 8 年 / 生写真メイン。関東中心に交換しています。オンラインも対応可。
              </p>
            </div>
            <div className="grid gap-2 text-[10px]">
              <div className="flex items-center justify-between rounded-full bg-white px-3 py-1">
                <span>提供カテゴリ</span>
                <span className="font-semibold text-[#0b1f33]">生写真・グッズ整理</span>
              </div>
              <div className="flex items-center justify-between rounded-full bg-white px-3 py-1">
                <span>エリア</span>
                <span className="font-semibold text-[#0b1f33]">東京都 / オンライン可</span>
              </div>
              <div className="flex items-center justify-between rounded-full bg-white px-3 py-1">
                <span>本人確認</span>
                <span className="font-semibold text-[#0b1f33]">提出待ち</span>
              </div>
            </div>
            <p className="text-[10px]">
              公開プレビューでアイコンや自己紹介の表示バランスを確認できます。
              {visibilitySummary && (
                <span className="ml-1 text-[color:var(--color-accent-emerald-ink)]">{visibilitySummary.benefit}</span>
              )}
            </p>
            {visibilitySummary && (
              <p className="rounded-lg border border-dashed border-[color:var(--color-border)] bg-white px-3 py-2 text-[10px] text-[color:var(--color-fg-muted)]">
                {visibilitySummary.action}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {writingTips.map((tip) => (
            <article key={tip.title} className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
              <h3 className="text-sm font-semibold">{tip.title}</h3>
              <ul className="space-y-2 text-[11px] text-[color:var(--color-fg-muted)]">
                {tip.rows.map((row) => (
                  <li key={row}>・{row}</li>
                ))}
              </ul>
              {tip.title.includes("AIサジェスト") && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
                >
                  AIで文章を整える
                </button>
              )}
            </article>
          ))}
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">プロフィール準備チェック</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                優先度の高い項目から整えていきましょう。ステータスは随時更新できます。
              </p>
            </div>
            <p className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[10px] text-[color:var(--color-fg-muted)]">
              進捗 {completedCount}/{profileReadiness.length}（{completionPercent}%）
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {profileReadiness.map((item) => {
              const token = statusTokens[item.status];
              return (
                <article
                  key={item.key}
                  className="flex h-full flex-col justify-between rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]"
                  style={{ borderLeft: `4px solid ${token.accentColor}` }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#0b1f33]">{item.label}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold ${token.badgeClass}`}>
                        {token.label}
                      </span>
                    </div>
                    <p className="leading-relaxed">{item.description}</p>
                  </div>
                  <div className="mt-3">
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
                    >
                      {item.actionLabel}
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
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
                placeholder="例: 本人確認 / 通知"
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
