"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Header } from "../../components/Header";
import { HintTooltip } from "../../components/HintTooltip";

const prefectures = [
  "指定なし",
  "北海道",
  "東京都",
  "神奈川県",
  "愛知県",
  "大阪府",
  "福岡県",
];

const availabilityTags = [
  "生写真",
  "トレカ",
  "アクリルスタンド",
  "ライブチケット",
  "グッズ整理",
  "遠征サポート",
];

const skillTags = [
  "撮影得意",
  "翻訳サポート",
  "初心者歓迎",
  "発送迅速",
  "硬質ケース有り",
  "評価100件以上",
];

const identityStatusOptions = [
  { value: "none", label: "未提出" },
  { value: "in_review", label: "審査中" },
  { value: "verified", label: "承認済み" },
];

const visibilityOptions = [
  { value: "public", label: "全ユーザーに公開" },
  { value: "match_only", label: "マッチ成立後に公開" },
  { value: "private", label: "非公開（自分のみ）" },
];

const STORAGE_KEY = "oshinooshi:profile-draft";
const PROFILE_USER_ID = process.env.NEXT_PUBLIC_PROFILE_READINESS_USER_ID ?? "demo-user";

type ProfileFormState = {
  displayName: string;
  phonetic: string;
  bio: string;
  prefecture: string;
  city: string;
  allowOnline: boolean;
  availability: string[];
  skillTags: string[];
  freeTags: string;
  email: string;
  lineId: string;
  workspace: string;
  links: string;
  visibility: string;
  trustOnly: boolean;
  identityStatus: string;
  policyAgreed: boolean;
  notifications: {
    match: boolean;
    reminder: boolean;
  };
};

const initialProfile: ProfileFormState = {
  displayName: "さくらんぼ@乃木坂",
  phonetic: "さくらんぼ",
  bio: "乃木坂歴 8 年 / 生写真メイン。関東中心に交換しています。オンラインも対応可。",
  prefecture: "東京都",
  city: "渋谷 / 郡山",
  allowOnline: true,
  availability: ["生写真", "グッズ整理"],
  skillTags: ["発送迅速", "評価100件以上"],
  freeTags: "現地引取可",
  email: "",
  lineId: "",
  workspace: "",
  links: "https://instagram.com/example",
  visibility: "public",
  trustOnly: false,
  identityStatus: "none",
  policyAgreed: false,
  notifications: {
    match: true,
    reminder: false,
  },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileFormState>(initialProfile);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ReadinessStatus> | null>(null);
  const [readinessSync, setReadinessSync] = useState<
    | { state: "idle" | "loading" }
    | { state: "synced"; updatedAt: string | null }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const updateProfile = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSelection = (key: "availability" | "skillTags", tag: string) => {
    setProfile((prev) => {
      const list = prev[key];
      const nextList = list.includes(tag)
        ? list.filter((item) => item !== tag)
        : [...list, tag];
      return { ...prev, [key]: nextList };
    });
  };

  const selectedIdentityLabel =
    identityStatusOptions.find((option) => option.value === profile.identityStatus)?.label ?? "未設定";

  const areaText =
    profile.prefecture === "指定なし" && !profile.city
      ? "未設定"
      : `${profile.prefecture}${profile.city ? ` / ${profile.city}` : ""}`;

  const availabilityText = profile.availability.length ? profile.availability.join("・") : "未選択";
  const skillsText = profile.skillTags.length ? profile.skillTags.join("・") : "未選択";

  type ReadinessStatus = "completed" | "in_progress" | "todo";

  type ReadinessItem = {
    key: string;
    label: string;
    status: ReadinessStatus;
    description: string;
    anchor: string;
    hint: string;
    synced?: boolean;
  };

  const { readinessItems, readinessSections } = useMemo(() => {
    const isFilled = (value: string) => value.trim().length > 0;

    const basicCompleted = isFilled(profile.displayName) && isFilled(profile.phonetic) && isFilled(profile.bio);
    const basicStarted = isFilled(profile.displayName) || isFilled(profile.phonetic) || isFilled(profile.bio);

    const areaCompleted = profile.prefecture !== "指定なし" && isFilled(profile.city);
    const areaStarted = profile.prefecture !== "指定なし" || isFilled(profile.city) || profile.allowOnline;

    const contactFields = [profile.email, profile.lineId, profile.workspace];
    const contactCompleted = contactFields.some((field) => isFilled(field));
    const contactStarted = contactCompleted;

    const trustCompleted = profile.identityStatus === "verified" || isFilled(profile.links);
    const trustStarted = profile.identityStatus !== "none" || isFilled(profile.links) || profile.trustOnly;

    const policyCompleted = profile.policyAgreed;

    const determineStatus = (completed: boolean, started: boolean): ReadinessStatus => {
      if (completed) {
        return "completed";
      }
      if (started) {
        return "in_progress";
      }
      return "todo";
    };

    const baseItems: ReadinessItem[] = [
      {
        key: "basic",
        label: "基本情報",
        status: determineStatus(basicCompleted, basicStarted),
        description: "表示名・ふりがな・自己紹介を整えて認知度を高めましょう。",
        anchor: "#basic",
        hint: "表示名・ふりがな・自己紹介の3項目がすべて入力されると完了になります。",
      },
      {
        key: "activity",
        label: "活動エリア",
        status: determineStatus(areaCompleted, areaStarted),
        description: "都道府県やオンライン対応を設定するとマッチング精度が上がります。",
        anchor: "#activity",
        hint: "都道府県と市区/主要駅を入力し、オンライン交換の可否を確認しましょう。",
      },
      {
        key: "contact",
        label: "連絡手段",
        status: determineStatus(contactCompleted, contactStarted),
        description: "メールやSNSを登録して取引後の連絡手段を確保しましょう。",
        anchor: "#contact",
        hint: "メール・LINE・Slack/Discordのいずれか入力で完了とみなします。",
      },
      {
        key: "trust",
        label: "信頼性・安全",
        status: determineStatus(trustCompleted, trustStarted),
        description: "本人確認や外部リンクを登録すると申し込み率が向上します。",
        anchor: "#trust",
        hint: "本人確認ステータスを審査中以上にするか、SNSリンクを登録してください。",
      },
      {
        key: "policy",
        label: "利用ポリシー",
        status: determineStatus(policyCompleted, policyCompleted),
        description: "ガイドラインへの同意と通知設定を忘れず確認しましょう。",
        anchor: "#policy",
        hint: "コミュニティガイドラインへの同意チェックが完了条件です。",
      },
    ];

    const sectionStatus = baseItems.reduce<Record<string, ReadinessStatus>>((acc, item) => {
      acc[item.key] = item.status;
      return acc;
    }, {});

    if (!serverStatuses) {
      return { readinessItems: baseItems, readinessSections: sectionStatus };
    }

    const mergedItems = baseItems.map((item) => {
      const override = serverStatuses[item.key];
      if (!override) {
        return item;
      }
      return { ...item, status: override, synced: true };
    });

    return { readinessItems: mergedItems, readinessSections: sectionStatus };
  }, [profile, serverStatuses]);

  const statusTokens: Record<ReadinessStatus, { label: string; badgeClass: string; accentColor: string }> = {
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

  const completedCount = readinessItems.filter((item) => item.status === "completed").length;
  const completionPercent = Math.round((completedCount / Math.max(readinessItems.length, 1)) * 100);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!storedValue) {
        return;
      }

      const parsed = JSON.parse(storedValue) as {
        profile?: ProfileFormState;
        savedAt?: string;
      };

      if (parsed.profile) {
        setProfile((prev) => ({ ...prev, ...parsed.profile }));
        if (parsed.savedAt) {
          const formatted = new Date(parsed.savedAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          });
          setLastSavedAt(formatted);
          setLoadMessage(`${formatted} の下書きを読み込みました。`);
        } else {
          setLoadMessage("保存済みの下書きを読み込みました。");
        }
      }
    } catch (error) {
      console.error("Failed to restore profile draft", error);
      setLoadMessage("保存済みデータを読み込めませんでした。もう一度保存してください。");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (saveState !== "success") {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaveState("idle");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const controller = new AbortController();
    setReadinessSync({ state: "loading" });

    const url = new URL("/api/profile/readiness", window.location.origin);
    url.searchParams.set("userId", PROFILE_USER_ID);

    fetch(url.toString(), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch readiness status: ${response.status}`);
        }
        return response.json() as Promise<{
          updatedAt?: string | null;
          sections?: Record<string, ReadinessStatus>;
          error?: string;
        }>;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        if (data.sections && Object.keys(data.sections).length > 0) {
          setServerStatuses(data.sections);
        }
        if (data.error) {
          setReadinessSync({ state: "error", message: data.error });
          return;
        }
        setReadinessSync({ state: "synced", updatedAt: data.updatedAt ?? null });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load readiness from server", error);
        setReadinessSync({ state: "error", message: "サーバーの進捗データを取得できませんでした。" });
      });

    return () => {
      controller.abort();
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors: string[] = [];
    if (!profile.displayName.trim()) {
      validationErrors.push("表示名を入力してください。");
    }
    if (!profile.bio.trim()) {
      validationErrors.push("自己紹介を入力してください。");
    }
    if (!profile.policyAgreed) {
      validationErrors.push("利用ポリシーへの同意が必要です。");
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSaveState("error");
      return;
    }

    setErrors([]);
    setSaveState("saving");

    setTimeout(() => {
      const now = new Date();
      const formatted = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      const isoTimestamp = now.toISOString();

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              profile,
              savedAt: isoTimestamp,
            }),
          );
        } catch (error) {
          console.error("Failed to persist profile draft", error);
          setErrors(["ローカル保存に失敗しました。ブラウザのストレージ容量をご確認ください。"]);
          setSaveState("error");
          return;
        }
      }

      setSaveState("success");
      setLastSavedAt(formatted);
      setLoadMessage(null);

      syncReadinessToServer(readinessSections, isoTimestamp);
    }, 700);
  };

  const syncReadinessToServer = (sections: Record<string, ReadinessStatus>, updatedAt: string) => {
    if (!sections || Object.keys(sections).length === 0) {
      return;
    }

    setReadinessSync({ state: "loading" });

    fetch("/api/profile/readiness", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: PROFILE_USER_ID,
        sections,
        updatedAt,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to persist readiness: ${response.status}`);
        }
        return response.json();
      })
      .then(() => {
        setServerStatuses(sections);
        setReadinessSync({ state: "synced", updatedAt });
      })
      .catch((error) => {
        console.error("Failed to sync readiness", error);
        setReadinessSync({ state: "error", message: "サーバーへの進捗保存に失敗しました。" });
      });
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">プロフィール設定</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            公開プロフィールに表示される内容を編集できます。入力内容は保存前にプレビューで確認できます。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">準備状況サマリー</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                各項目の状態をチェックし、未完了のものから更新しましょう。
              </p>
            </div>
            <p className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[10px] text-[color:var(--color-fg-muted)]">
              完了 {completedCount}/{readinessItems.length}（{completionPercent}%）
            </p>
          </div>
          <div className="h-2 w-full rounded-full bg-[color:var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-accent-emerald)] transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[color:var(--color-fg-muted)]">
            {readinessSync.state === "loading" && <span>サーバーの状態を同期中です…</span>}
            {readinessSync.state === "synced" && readinessSync.updatedAt && (
              <span>サーバー同期済み: {new Date(readinessSync.updatedAt).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
            {readinessSync.state === "error" && <span className="text-[#b91c1c]">{readinessSync.message}</span>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {readinessItems.map((item) => {
              const token = statusTokens[item.status];
              return (
                <article
                  key={item.key}
                  className="flex h-full flex-col justify-between rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]"
                  style={{ borderLeft: `4px solid ${token.accentColor}` }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#0b1f33]">{item.label}</p>
                      <div className="flex items-center gap-2">
                        <HintTooltip label={`${item.label}の完了条件`}>
                          <p>{item.hint}</p>
                        </HintTooltip>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold ${token.badgeClass}`}>
                          {token.label}
                        </span>
                      </div>
                    </div>
                    <p className="leading-relaxed">{item.description}</p>
                    {item.synced && (
                      <p className="text-[10px] text-[color:var(--color-fg-muted)]">サーバーの進捗データを表示しています。</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <a
                      href={item.anchor}
                      className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]"
                    >
                      この項目へ移動
                      <span aria-hidden>↓</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {loadMessage && (
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-[11px] text-[color:var(--color-fg-muted)]" role="status">
              {loadMessage}
            </div>
          )}
          {errors.length > 0 && (
            <div className="space-y-1 rounded-xl border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-[11px] text-[#b91c1c]" role="alert">
              {errors.map((error) => (
                <p key={error}>• {error}</p>
              ))}
            </div>
          )}
          <section id="basic" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">基本情報</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                表示名と自己紹介はマッチングリストに表示されます。
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                表示名
                <input
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="例: さくらんぼ@乃木坂"
                  value={profile.displayName}
                  onChange={(event) => updateProfile("displayName", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                ふりがな
                <input
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="例: さくらんぼ"
                  value={profile.phonetic}
                  onChange={(event) => updateProfile("phonetic", event.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <label className="flex flex-col gap-2 text-xs text-[color:var(--color-fg-muted)]">
                自己紹介
                <textarea
                  className="h-32 rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="推しや交換ポリシー、対応できる日時などを書いてください"
                  value={profile.bio}
                  onChange={(event) => updateProfile("bio", event.target.value)}
                />
              </label>
              <div className="flex flex-col gap-3 text-xs text-[color:var(--color-fg-muted)]">
                <span>アイコン画像</span>
                <div className="flex flex-1 items-center justify-center rounded border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
                  <button type="button" className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px]">
                    画像をアップロード
                  </button>
                </div>
                <p className="text-[10px] text-[color:var(--color-fg-muted)]">
                  1MB 以内の JPG / PNG に対応。アップロード後にトリミングできます。
                </p>
              </div>
            </div>
          </section>

          <section id="activity" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">活動エリア</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                オフライン交換が可能な地域とオンライン対応可否を選択します。
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                都道府県
                <select
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  value={profile.prefecture}
                  onChange={(event) => updateProfile("prefecture", event.target.value)}
                >
                  {prefectures.map((prefecture) => (
                    <option key={prefecture}>{prefecture}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                市区 / 主要駅
                <input
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="例: 渋谷 / 郡山"
                  value={profile.city}
                  onChange={(event) => updateProfile("city", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-xs text-[color:var(--color-fg-muted)]">
                <span>オンライン交換</span>
                <div className="flex items-center gap-2 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={profile.allowOnline}
                    onChange={(event) => updateProfile("allowOnline", event.target.checked)}
                  />
                  <span className="text-[11px]">匿名配送やデータ交換に対応する</span>
                </div>
              </label>
            </div>
          </section>

          <section id="contact" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">連絡手段</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                アプリ内チャットは必須です。追加したい連絡方法があれば入力してください。
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">
                <span className="font-medium text-[#0b1f33]">アプリ内メッセージ</span>
                <span className="rounded-full bg-[color:var(--color-accent-emerald)] px-3 py-1 text-[11px] text-[color:var(--color-accent-emerald-ink)]">
                  必須
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                メールアドレス
                <input
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="例: contact@example.com"
                  value={profile.email}
                  onChange={(event) => updateProfile("email", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                LINE ID
                <input
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="任意入力"
                  value={profile.lineId}
                  onChange={(event) => updateProfile("lineId", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                Slack / Discord
                <input
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  placeholder="チャンネルやユーザー名"
                  value={profile.workspace}
                  onChange={(event) => updateProfile("workspace", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section id="skills" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">スキル・提供できるもの</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                カテゴリを選択すると検索結果のフィルターに反映されます。フリーワードも追加できます。
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#0b1f33]">提供カテゴリ</p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {availabilityTags.map((tag) => {
                    const selected = profile.availability.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSelection("availability", tag)}
                        className={`rounded-full border px-3 py-1 transition ${
                          selected
                            ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/40 text-[#0b1f33]"
                            : "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#0b1f33]">強みタグ</p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {skillTags.map((tag) => {
                    const selected = profile.skillTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSelection("skillTags", tag)}
                        className={`rounded-full border px-3 py-1 transition ${
                          selected
                            ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/40 text-[#0b1f33]"
                            : "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
              フリーワードタグ
              <input
                className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                placeholder="例: 現地引取可 / 大阪ドーム周辺"
                value={profile.freeTags}
                onChange={(event) => updateProfile("freeTags", event.target.value)}
              />
            </label>
          </section>

          <section id="trust" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">信頼性・安全</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">本人確認や外部リンクを登録して安心度を高めましょう。</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 text-xs text-[color:var(--color-fg-muted)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0b1f33]">本人確認</p>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] text-[#0b1f33]">{selectedIdentityLabel}</span>
                </div>
                <select
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                  value={profile.identityStatus}
                  onChange={(event) => updateProfile("identityStatus", event.target.value)}
                >
                  {identityStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface)]"
                >
                  提出をはじめる
                </button>
                <p className="text-[10px]">学生証・免許証など、顔写真付きの書類をご用意ください。</p>
              </div>
              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                  SNS / ポートフォリオ URL
                  <input
                    className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                    placeholder="https://"
                    value={profile.links}
                    onChange={(event) => updateProfile("links", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
                  公開範囲
                  <select
                    className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                    value={profile.visibility}
                    onChange={(event) => updateProfile("visibility", event.target.value)}
                  >
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={profile.trustOnly}
                    onChange={(event) => updateProfile("trustOnly", event.target.checked)}
                  />
                  <span>評価 3.5 以上のユーザーのみプロフィールを表示する</span>
                </label>
              </div>
            </div>
          </section>

          <section id="policy" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">利用ポリシーと通知</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                利用規約への同意と通知設定を確認してください。
              </p>
            </header>
            <label className="flex items-start gap-2 rounded border border-[color:var(--color-border)] px-3 py-3 text-xs text-[color:var(--color-fg-muted)]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={profile.policyAgreed}
                onChange={(event) => updateProfile("policyAgreed", event.target.checked)}
              />
              <span>
                コミュニティガイドラインと交換ポリシーに同意する。
                <span className="block text-[10px]">同意済みプロフィールのみ検索結果に掲載されます。</span>
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">
                <span>マッチ成立通知</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={profile.notifications.match}
                  onChange={(event) =>
                    updateProfile("notifications", {
                      ...profile.notifications,
                      match: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">
                <span>リマインド通知</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={profile.notifications.reminder}
                  onChange={(event) =>
                    updateProfile("notifications", {
                      ...profile.notifications,
                      reminder: event.target.checked,
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section id="preview" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">プレビュー</h2>
              <span className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[10px] text-[color:var(--color-fg-muted)]">
                保存前に表示内容を確認しましょう
              </span>
            </header>
            <div className="space-y-3 text-[color:var(--color-fg-muted)]">
              <div>
                <p className="text-sm font-semibold text-[#0b1f33]">{profile.displayName}</p>
                <p className="text-[11px]">{profile.phonetic}</p>
              </div>
              <p className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-3 text-[11px] leading-relaxed">
                {profile.bio || "自己紹介が未入力です。"}
              </p>
              <div className="grid gap-2 text-[11px] md:grid-cols-2">
                <div className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                  <span className="mr-2 font-semibold text-[#0b1f33]">提供カテゴリ</span>
                  <span>{availabilityText}</span>
                </div>
                <div className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                  <span className="mr-2 font-semibold text-[#0b1f33]">強みタグ</span>
                  <span>{skillsText}</span>
                </div>
                <div className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                  <span className="mr-2 font-semibold text-[#0b1f33]">エリア</span>
                  <span>{areaText}</span>
                </div>
                <div className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1">
                  <span className="mr-2 font-semibold text-[#0b1f33]">本人確認</span>
                  <span>{selectedIdentityLabel}</span>
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--color-border)] px-3 py-3 text-[11px]">
                <p className="font-semibold text-[#0b1f33]">公開設定</p>
                <p className="mt-1">
                  {
                    visibilityOptions.find((option) => option.value === profile.visibility)?.label ??
                    "公開設定が未選択です"
                  }
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col items-end gap-2">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="rounded-full bg-[color:var(--color-accent-emerald)] px-5 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm transition hover:bg-[color:var(--color-accent-emerald-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveState === "saving" ? "保存中..." : "下書きを保存"}
            </button>
            {saveState === "success" && (
              <p className="text-[10px] text-[color:var(--color-fg-muted)]" aria-live="polite">
                {lastSavedAt} に下書きを保存しました。
              </p>
            )}
            {saveState === "error" && errors.length === 0 && (
              <p className="text-[10px] text-[#b91c1c]" role="alert">
                保存に失敗しました。時間をおいて再度お試しください。
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
