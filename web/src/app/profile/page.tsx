"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Header } from "../../components/Header";
import { HintTooltip } from "../../components/HintTooltip";
import { basicProfileTemplate } from "../../content/helpContent";
import { useSession } from "next-auth/react";
import { AFFINITY_QUESTIONS } from "../../constants/affinitySurvey";
import { sanitizeAffinityAnswers } from "../../lib/affinitySimilarity";

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

const AFFINITY_QUESTION_COUNT = AFFINITY_QUESTIONS.length;

const likertScaleOptions = [
  { value: 1, label: "1 まったくそう思わない" },
  { value: 2, label: "2 あまりそう思わない" },
  { value: 3, label: "3 どちらとも言えない" },
  { value: 4, label: "4 ややそう思う" },
  { value: 5, label: "5 とてもそう思う" },
] as const;

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
  favoriteMember: string;
  prefecture: string;
  city: string;
  availability: string[];
  skillTags: string[];
  freeTags: string;
  links: string;
  visibility: string;
  avatarUrl: string;
  policyAgreed: boolean;
  affinitySurvey: AffinitySurveyState;
  notifications: {
    match: boolean;
    reminder: boolean;
  };
};

type AffinitySurveyState = {
  answers: Array<number | null>;
  updatedAt: string | null;
};

const initialProfile: ProfileFormState = {
  displayName: "さくらんぼ@乃木坂",
  phonetic: "さくらんぼ",
  bio: "乃木坂歴 8 年 / 生写真メイン。関東中心に交換しています。オンラインも対応可。",
  favoriteMember: "乃木坂46 山下美月",
  prefecture: "東京都",
  city: "渋谷 / 郡山",
  availability: ["生写真", "グッズ整理"],
  skillTags: ["発送迅速", "評価100件以上"],
  freeTags: "現地引取可",
  links: "https://instagram.com/example",
  visibility: "public",
  avatarUrl: "",
  policyAgreed: false,
  affinitySurvey: {
    answers: Array.from({ length: AFFINITY_QUESTION_COUNT }, () => null),
    updatedAt: null,
  },
  notifications: {
    match: true,
    reminder: false,
  },
};

function mergeProfile(base: ProfileFormState, incoming?: Partial<ProfileFormState> | null): ProfileFormState {
  if (!incoming) {
    return base;
  }

  return {
    ...base,
    ...incoming,
    availability: incoming.availability ?? base.availability,
    skillTags: incoming.skillTags ?? base.skillTags,
    avatarUrl: incoming.avatarUrl ?? base.avatarUrl,
    favoriteMember: incoming.favoriteMember ?? base.favoriteMember,
    affinitySurvey: mergeAffinitySurvey(base.affinitySurvey, incoming.affinitySurvey),
    notifications: {
      ...base.notifications,
      ...(incoming.notifications ?? {}),
    },
  };
}

function mergeAffinitySurvey(
  base: AffinitySurveyState,
  incoming?: Partial<AffinitySurveyState> | null,
): AffinitySurveyState {
  const baseAnswers = Array.from({ length: AFFINITY_QUESTION_COUNT }, (_, index) => base.answers[index] ?? null);

  if (!incoming) {
    return {
      answers: baseAnswers,
      updatedAt: base.updatedAt,
    };
  }

  const sanitizedIncoming = sanitizeAffinityAnswers(incoming.answers);
  const mergedAnswers = Array.from({ length: AFFINITY_QUESTION_COUNT }, (_, index) => {
    const explicitNull = Array.isArray(incoming.answers) && incoming.answers[index] === null;
    if (explicitNull) {
      return null;
    }
    const sanitizedValue = sanitizedIncoming ? sanitizedIncoming[index] : undefined;
    if (typeof sanitizedValue === "number") {
      return sanitizedValue;
    }
    if (sanitizedValue === null) {
      return null;
    }
    return baseAnswers[index];
  });

  const updatedAt = typeof incoming.updatedAt === "string" ? incoming.updatedAt : base.updatedAt;

  return {
    answers: mergedAnswers,
    updatedAt,
  };
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const effectiveUserId = session?.user?.id ?? PROFILE_USER_ID;

  const [profile, setProfile] = useState<ProfileFormState>(initialProfile);
  const [avatarUploadState, setAvatarUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
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
  const [previewVisibility, setPreviewVisibility] = useState(profile.visibility);

  const affinityAnsweredCount = useMemo(
    () => profile.affinitySurvey.answers.filter((answer): answer is number => typeof answer === "number").length,
    [profile.affinitySurvey.answers],
  );

  const surveyTargetName = useMemo(() => {
    const trimmed = profile.favoriteMember.trim();
    return trimmed.length > 0 ? trimmed : "推し";
  }, [profile.favoriteMember]);

  const updateProfile = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const updateAffinityAnswer = (index: number, value: number | null) => {
    if (index < 0 || index >= AFFINITY_QUESTION_COUNT) {
      return;
    }

    const normalized = typeof value === "number" ? Math.min(Math.max(Math.round(value), 1), 5) : null;

    setProfile((prev) => {
      const current = prev.affinitySurvey.answers[index] ?? null;
      if (current === normalized) {
        return prev;
      }

      const nextAnswers = [...prev.affinitySurvey.answers];
      nextAnswers[index] = normalized;

      return {
        ...prev,
        affinitySurvey: {
          answers: nextAnswers,
          updatedAt: new Date().toISOString(),
        },
      };
    });
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

  const areaText =
    profile.prefecture === "指定なし" && !profile.city
      ? "未設定"
      : `${profile.prefecture}${profile.city ? ` / ${profile.city}` : ""}`;

  const availabilityText = profile.availability.length ? profile.availability.join("・") : "未選択";
  const skillsText = profile.skillTags.length ? profile.skillTags.join("・") : "未選択";
  const favoriteText = profile.favoriteMember.trim() ? profile.favoriteMember.trim() : "未設定";
  const previewVisibilityLabel =
    visibilityOptions.find((option) => option.value === previewVisibility)?.label ?? "公開設定が未選択です";
  const isPreviewDifferent = previewVisibility !== profile.visibility;
  const currentVisibilityLabel =
    visibilityOptions.find((option) => option.value === profile.visibility)?.label ?? "公開設定が未選択です";

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setAvatarUploadState("uploading");

    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to request upload URL: ${res.status}`);
      }

      const data = (await res.json()) as {
        uploadUrl: string;
        objectUrl: string;
      };

      const uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload avatar: ${uploadResponse.status}`);
      }

      setProfile((prev) => ({ ...prev, avatarUrl: data.objectUrl }));
      setAvatarUploadState("success");
    } catch (error) {
      console.error("Failed to upload avatar", error);
      setAvatarUploadState("error");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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

    const affinityCompleted = affinityAnsweredCount === AFFINITY_QUESTION_COUNT;
    const affinityStarted = affinityAnsweredCount > 0;

    const areaCompleted = profile.prefecture !== "指定なし" && isFilled(profile.city);
    const areaStarted = profile.prefecture !== "指定なし" || isFilled(profile.city);

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
        key: "affinity",
        label: "推し傾向アンケート",
        status: determineStatus(affinityCompleted, affinityStarted),
        description: "9問の設問に回答すると、類似度レコメンドが利用できるようになります。",
        anchor: "#affinity",
        hint: "すべての質問に回答すると完了です。途中保存も可能です。",
      },
      {
        key: "activity",
        label: "活動エリア",
        status: determineStatus(areaCompleted, areaStarted),
        description: "都道府県や市区情報を設定するとマッチング精度が上がります。",
        anchor: "#activity",
        hint: "都道府県と市区/主要駅を入力しましょう。",
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
  }, [profile, serverStatuses, affinityAnsweredCount]);

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
        setProfile((prev) => mergeProfile(prev, parsed.profile));
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
  }, [effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId || !session?.user?.id) {
      return;
    }

    setLoadMessage((current) => current ?? "サーバーのプロフィールを読み込み中です…");

    fetch("/api/profile")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load profile: ${response.status}`);
        }
        return response.json() as Promise<{ profile?: Partial<ProfileFormState> | null }>;
      })
      .then((data) => {
        if (data.profile) {
          setProfile((prev) => mergeProfile(prev, data.profile));
        }
        setLoadMessage(null);
      })
      .catch((error) => {
        console.error("Failed to load profile", error);
        setLoadMessage("サーバーからプロフィールを読み込めませんでした。保存すると上書きされます。");
      });
  }, [effectiveUserId, session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    setProfile((prev) =>
      mergeProfile(prev, {
        displayName: prev.displayName?.trim()?.length ? prev.displayName : session.user?.name ?? "LINEユーザー",
      }),
    );
  }, [session?.user]);

  useEffect(() => {
    setPreviewVisibility((current) => (current === profile.visibility ? current : profile.visibility));
  }, [profile.visibility]);

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

    if (!effectiveUserId) {
      return;
    }

    const controller = new AbortController();
    setReadinessSync({ state: "loading" });

    const url = new URL("/api/profile/readiness", window.location.origin);
    url.searchParams.set("userId", effectiveUserId);

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
  }, [effectiveUserId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors: string[] = [];
    if (!profile.displayName.trim()) {
      validationErrors.push("表示名を入力してください。");
    }
    if (!profile.bio.trim()) {
      validationErrors.push("自己紹介を入力してください。");
    }
    const favoriteInput = profile.favoriteMember.trim();
    if (!favoriteInput) {
      validationErrors.push("推しているメンバー・ユニットを入力してください。");
    } else if (/箱\s*推し/i.test(favoriteInput)) {
      validationErrors.push("推しているメンバーは具体的な名前で入力してください（「箱推し」は選べません）。");
    }
    if (!profile.policyAgreed) {
      validationErrors.push("利用ポリシーへの同意が必要です。");
    }
    if (affinityAnsweredCount < AFFINITY_QUESTION_COUNT) {
      validationErrors.push("推し傾向アンケートの9問すべてに回答してください。");
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSaveState("error");
      return;
    }

    setErrors([]);
    setSaveState("saving");

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

    if (session?.user?.id) {
      try {
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName: profile.displayName,
            phonetic: profile.phonetic,
            bio: profile.bio,
            favoriteMember: profile.favoriteMember,
            prefecture: profile.prefecture,
            city: profile.city,
            availability: profile.availability,
            skillTags: profile.skillTags,
            freeTags: profile.freeTags,
            links: profile.links,
            visibility: profile.visibility,
            avatarUrl: profile.avatarUrl,
            policyAgreed: profile.policyAgreed,
            affinitySurvey: profile.affinitySurvey,
            notifications: profile.notifications,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to persist profile: ${response.status}`);
        }
      } catch (error) {
        console.error("Failed to update profile", error);
        setErrors(["サーバーへのプロフィール保存に失敗しました。時間をおいて再度お試しください。"]);
        setSaveState("error");
        return;
      }
    }

    syncReadinessToServer(readinessSections, isoTimestamp, effectiveUserId);

    setSaveState("success");
    setLastSavedAt(formatted);
    setLoadMessage(null);
  };

  const syncReadinessToServer = (
    sections: Record<string, ReadinessStatus>,
    updatedAt: string,
    userId: string | undefined,
  ) => {
    if (!sections || Object.keys(sections).length === 0 || !userId) {
      return;
    }

    setReadinessSync({ state: "loading" });

    fetch("/api/profile/readiness", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
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
              <div className="flex flex-col gap-4 text-xs text-[color:var(--color-fg-muted)]">
                <label className="flex flex-col gap-2">
                  自己紹介
                  <textarea
                    className="h-32 rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                    placeholder="推しや交換ポリシー、対応できる日時などを書いてください"
                    value={profile.bio}
                    onChange={(event) => updateProfile("bio", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  推しているメンバー・ユニット
                  <input
                    className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                    placeholder="例: 乃木坂46 山下美月 / 新しい学校のリーダーズ SUZUKA"
                    value={profile.favoriteMember}
                    onChange={(event) => updateProfile("favoriteMember", event.target.value)}
                  />
                  <span className="text-[10px] text-[color:var(--color-fg-muted)]">箱推しではなく、具体的なメンバー名を入力してください。</span>
                </label>
              </div>
              <div className="flex flex-col gap-3 text-xs text-[color:var(--color-fg-muted)]">
                <span>アイコン画像</span>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border)] bg-white">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="プロフィール画像" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-[color:var(--color-fg-muted)]">未設定</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] hover:bg-[color:var(--color-surface)]"
                  >
                    画像をアップロード
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  {avatarUploadState === "uploading" && <p className="text-[10px] text-[color:var(--color-fg-muted)]">アップロード中です…</p>}
                  {avatarUploadState === "error" && <p className="text-[10px] text-[#b91c1c]">アップロードに失敗しました。時間をおいてお試しください。</p>}
                  {avatarUploadState === "success" && <p className="text-[10px] text-[color:var(--color-fg-muted)]">アップロード済みです。</p>}
                </div>
                <p className="text-[10px] text-[color:var(--color-fg-muted)]">
                  1MB 以内の JPG / PNG を推奨します。アップロード後に保存するとプロフィールに反映されます。
                </p>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]">
              <div>
                <h3 className="text-xs font-semibold text-[#0b1f33]">自己紹介の基本構成</h3>
                <p className="text-[10px]">テンプレートに沿って書き出すと、伝えたいポイントを整理しやすくなります。</p>
              </div>
              <ul className="space-y-2">
                {basicProfileTemplate.map((item) => (
                  <li key={item} className="flex gap-2 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2">
                    <span className="font-semibold text-[#0b1f33]">・</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px]">
                テンプレートにまとめた内容は、ページ下部のプレビューで確認しながら微調整できます。
              </p>
            </div>
          </section>
          <section id="affinity" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">推し傾向アンケート</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                推しとの距離感やファン同士のつながり方を測る9つの質問です。{surveyTargetName}を思い浮かべて直感で回答してください。
              </p>
            </header>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-[color:var(--color-fg-muted)]">
              <span>回答状況: {affinityAnsweredCount}/{AFFINITY_QUESTION_COUNT}</span>
              <span>対象メンバー: {surveyTargetName}</span>
              {profile.affinitySurvey.updatedAt && (
                <span>
                  最終更新: {new Date(profile.affinitySurvey.updatedAt).toLocaleString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="space-y-4">
              {AFFINITY_QUESTIONS.map((question, index) => {
                const answer = profile.affinitySurvey.answers[index];
                const questionText = question.text.replace(/A/g, surveyTargetName);
                return (
                  <div
                    key={question.id}
                    className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-white p-4 text-[11px] text-[color:var(--color-fg-muted)]"
                  >
                    <p className="text-xs font-semibold text-[#0b1f33]">
                      Q{index + 1}. {questionText}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {likertScaleOptions.map((option) => {
                        const isActive = answer === option.value;
                        return (
                          <label
                            key={option.value}
                            className={`cursor-pointer rounded-full border px-3 py-1 text-[10px] transition ${
                              isActive
                                ? "border-[color:var(--color-accent-emerald)] bg-[color:var(--color-accent-emerald)]/40 text-[#0b1f33]"
                                : "border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-2)]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`affinity-${question.id}`}
                              value={option.value}
                              checked={isActive}
                              onChange={() => updateAffinityAnswer(index, option.value)}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => updateAffinityAnswer(index, null)}
                        className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[10px] transition hover:bg-[color:var(--color-surface-2)]"
                      >
                        クリア
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="activity" className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">活動エリア</h2>
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                メインで活動する都道府県と市区情報を登録すると、マッチングがスムーズになります。
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
              <p className="text-[11px] text-[color:var(--color-fg-muted)]">SNS や実績リンクを登録して安心度を高めましょう。</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <div className="space-y-3">
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
                <p className="text-[10px] text-[color:var(--color-fg-muted)]">公開範囲はいつでも変更できます。</p>
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
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">プレビュー</h2>
                <span className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[10px] text-[color:var(--color-fg-muted)]">
                  保存前に表示内容を確認しましょう
                </span>
              </div>
              <label className="flex flex-col gap-1 text-[10px] text-[color:var(--color-fg-muted)] md:text-right">
                <span className="uppercase tracking-wide">公開レベルを選択</span>
                <select
                  value={previewVisibility}
                  onChange={(event) => setPreviewVisibility(event.target.value as ProfileFormState["visibility"])}
                  className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs text-[#0b1f33]"
                >
                  {visibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </header>
            <div className="space-y-3 text-[color:var(--color-fg-muted)]">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border)] bg-white">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt="プロフィール画像" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-[color:var(--color-fg-muted)]">未設定</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0b1f33]">{profile.displayName}</p>
                  <p className="text-[11px]">{profile.phonetic}</p>
                </div>
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
                  <span className="mr-2 font-semibold text-[#0b1f33]">推しメン</span>
                  <span>{favoriteText}</span>
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--color-border)] px-3 py-3 text-[11px]">
                <p className="font-semibold text-[#0b1f33]">公開設定</p>
                <p className="mt-1">{previewVisibilityLabel}</p>
                {isPreviewDifferent && (
                  <p className="mt-1 text-[color:var(--color-fg-muted)]">
                    実際の公開設定: {currentVisibilityLabel}
                  </p>
                )}
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
