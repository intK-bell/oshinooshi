import { NextRequest, NextResponse } from "next/server";
import { createOpenAIResponse, OpenAIClientError } from "@/lib/openaiClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

type SuggestionRequest = {
  group: unknown;
  series: unknown;
  categories: unknown;
  haveMembers: unknown;
  wantMembers: unknown;
  tone?: unknown;
};

const DEFAULT_TONE =
  "箇条書きで 2 ~ 3 件の提案と、一言のまとめを日本語で返してください。過度に砕けた表現は避け、丁寧で親しみやすい調子で書いてください。";

const DAILY_LIMIT = 20;
const MINUTE_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

type RateRecord = {
  timestamps: number[];
};

declare global {
  var __aiSuggestionRateLimit__: Map<string, RateRecord> | undefined;
}

function getRateLimitStore() {
  if (!globalThis.__aiSuggestionRateLimit__) {
    globalThis.__aiSuggestionRateLimit__ = new Map();
  }
  return globalThis.__aiSuggestionRateLimit__;
}

function checkRateLimit(userId: string) {
  const store = getRateLimitStore();
  const now = Date.now();
  const record = store.get(userId) ?? { timestamps: [] };
  const recent = record.timestamps.filter((timestamp) => now - timestamp <= ONE_DAY_MS);
  const lastMinute = recent.filter((timestamp) => now - timestamp <= ONE_MINUTE_MS);

  if (recent.length >= DAILY_LIMIT) {
    return {
      allowed: false,
      message: "AI検索の上限に達しました。少し時間を空けて再度お試しください。（日次上限）",
    };
  }

  if (lastMinute.length >= MINUTE_LIMIT) {
    return {
      allowed: false,
      message: "AI検索の実行が集中しています。1分ほど待ってから再度お試しください。",
    };
  }

  recent.push(now);
  store.set(userId, { timestamps: recent });
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  let payload: SuggestionRequest;
  try {
    payload = (await request.json()) as SuggestionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const group = typeof payload.group === "string" ? payload.group.trim() : "";
  const series = typeof payload.series === "string" ? payload.series.trim() : "";
  const categories = Array.isArray(payload.categories)
    ? payload.categories.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0)
    : [];
  const haveMembers = Array.isArray(payload.haveMembers)
    ? payload.haveMembers.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0)
    : [];
  const wantMembers = Array.isArray(payload.wantMembers)
    ? payload.wantMembers.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0)
    : [];
  const tone = typeof payload.tone === "string" && payload.tone.trim().length > 0 ? payload.tone.trim() : DEFAULT_TONE;

  if (!group || !series || categories.length === 0 || haveMembers.length === 0 || wantMembers.length === 0) {
    return NextResponse.json(
      {
        error:
          "推し・グループ / シリーズ / グッズ種別 / 出せるメンバー / 探しているメンバーをすべて入力してください。",
      },
      { status: 400 },
    );
  }

  const rateResult = checkRateLimit(userId);
  if (!rateResult.allowed) {
    return NextResponse.json({ error: rateResult.message }, { status: 429 });
  }

  const summaryPrompt = [
    `推し・グループ: ${group}`,
    `シリーズ: ${series}`,
    `グッズ種別: ${categories.join(", ")}`,
    `出せるメンバー: ${haveMembers.join(", ")}`,
    `探しているメンバー: ${wantMembers.join(", ")}`,
  ].join("\n");

  try {
    const suggestion = await createOpenAIResponse(
      [
        {
          role: "system",
          content:
            "あなたは推し活グッズ交換のコーディネーターです。双方の条件を整理し、交換に向けた次のアクションを提案してください。",
        },
        {
          role: "user",
          content: `${summaryPrompt}\n\n${tone}`,
        },
      ],
      { maxTokens: 500 },
    );

    return NextResponse.json({ suggestion });
  } catch (error) {
    if (error instanceof OpenAIClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to generate AI suggestion", error);
    return NextResponse.json({ error: "AIサジェストの生成に失敗しました。" }, { status: 500 });
  }
}
