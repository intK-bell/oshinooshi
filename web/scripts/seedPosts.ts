import { existsSync, readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { POST_CATEGORIES, POST_GROUPS } from "../src/constants/postOptions";

type CliOptions = {
  count: number;
  includeDrafts: boolean;
  users: string[];
};

type SeedPost = {
  post_id: string;
  user_id: string;
  status: "draft" | "published";
  post_type: "offer" | "request";
  title: string;
  body: string;
  categories: string[];
  group: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const POSTS_TABLE = process.env.POSTS_TABLE;

if (!POSTS_TABLE) {
  throw new Error("POSTS_TABLE environment variable is not set. Please configure it before running the seed script.");
}

const options = parseArgs(process.argv.slice(2));

async function main() {
  const client = new DynamoDBClient({ region: REGION });

  console.log(`Seeding ${options.count} post(s) into ${POSTS_TABLE} (region: ${REGION})...`);

  const seeds = Array.from({ length: options.count }, () => createSeedPost(options));

  for (const post of seeds) {
    await client.send(
      new PutItemCommand({
        TableName: POSTS_TABLE,
        Item: marshall(post, { removeUndefinedValues: true }),
      }),
    );
    console.log(`  ✔ Inserted post ${post.post_id} (${post.status}, ${post.post_type})`);
  }

  console.log("Seeding completed.");
}

main().catch((error) => {
  console.error("Failed to seed posts.", error);
  process.exitCode = 1;
});

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = {
    count: 5,
    includeDrafts: false,
    users: ["demo-user-1", "demo-user-2", "demo-user-3"],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--count") {
      const next = args[index + 1];
      if (!next) {
        throw new Error("--count requires a numeric value.");
      }
      opts.count = Math.max(1, Number.parseInt(next, 10));
      index += 1;
    } else if (arg === "--include-drafts") {
      opts.includeDrafts = true;
    } else if (arg === "--users") {
      const next = args[index + 1];
      if (!next) {
        throw new Error("--users requires a comma-separated list.");
      }
      opts.users = next
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (opts.users.length === 0) {
        throw new Error("At least one user ID must be provided after --users.");
      }
      index += 1;
    }
  }

  return opts;
}

function createSeedPost(options: CliOptions): SeedPost {
  const now = new Date();
  const createdAt = new Date(now.getTime() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
  const updatedAt = new Date(
    createdAt.getTime() + Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 86_400_000),
  );

  const status: "draft" | "published" =
    options.includeDrafts && Math.random() < 0.25 ? "draft" : "published";
  const postType: "offer" | "request" = Math.random() < 0.5 ? "offer" : "request";
  const categories = pickRandomCategories();
  const group = pickRandomGroup();
  const title = createTitle(postType, group);
  const body = createBody(postType, categories);

  return {
    post_id: randomUUID(),
    user_id: pickRandom(options.users),
    status,
    post_type: postType,
    title,
    body,
    categories,
    group,
    images: [createPlaceholderImage(title)],
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
  };
}

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function pickRandomCategories(): string[] {
  const shuffled = [...POST_CATEGORIES].sort(() => Math.random() - 0.5);
  const count = Math.max(1, Math.floor(Math.random() * Math.min(3, POST_CATEGORIES.length)));
  return shuffled.slice(0, count);
}

function pickRandomGroup(): string | null {
  const filteredGroups = POST_GROUPS.filter((value) => value !== "未選択");
  return Math.random() < 0.2 ? null : pickRandom(filteredGroups);
}

function createTitle(postType: "offer" | "request", group: string | null): string {
  const prefixes = postType === "offer" ? ["譲ります", "放出"] : ["求む", "募集"];
  const items = ["生写真セット", "アクリルスタンド", "缶バッジ", "マフラータオル"];
  const suffixes = ["まとめて", "コンプ", "未開封", "美品"];

  return [
    pickRandom(prefixes),
    group ?? pickRandom(POST_GROUPS.filter((value) => value !== "未選択")),
    pickRandom(items),
    pickRandom(suffixes),
  ].join(" ");
}

function createBody(postType: "offer" | "request", categories: string[]): string {
  const intro =
    postType === "offer"
      ? "閲覧ありがとうございます。以下のグッズをお譲りします。"
      : "交換・譲渡を希望しています。条件が合う方はご連絡ください。";

  const categoryLine = `対象カテゴリ: ${categories.join(", ")}`;
  const condition = pickRandom([
    "状態は良好です。",
    "開封済みですが目立った傷はありません。",
    "暗所で保管していました。",
    "スリーブに入れて保護しています。",
  ]);
  const request = pickRandom([
    "送料は相談させてください。",
    "東京近郊で手渡し希望です。",
    "郵送での対応も可能です。",
    "まとめて引き取ってくださる方を優先します。",
  ]);

  return [intro, categoryLine, condition, request].join("\n");
}

function createPlaceholderImage(title: string): string {
  const encoded = encodeURIComponent(title);
  return `https://placehold.co/800x600?text=${encoded}`;
}

function loadEnvFile(filename: string) {
  const resolved = path.resolve(process.cwd(), filename);
  if (existsSync(resolved)) {
    const content = readFileSync(resolved, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
