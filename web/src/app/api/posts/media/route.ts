import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { parseObjectCannedAcl } from "../../../../lib/s3Acl";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const MEDIA_BUCKET = process.env.POST_MEDIA_BUCKET;
const MEDIA_BASE_URL = process.env.POST_MEDIA_BASE_URL;
const MEDIA_PREFIX = (process.env.POST_MEDIA_PREFIX ?? "public/posts/media").replace(/\/$/, "");
const MEDIA_ACL = parseObjectCannedAcl(process.env.POST_MEDIA_ACL);

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const parsedMaxSize = Number.parseInt(process.env.POST_MEDIA_MAX_SIZE ?? `${DEFAULT_MAX_SIZE}`, 10);
const MEDIA_MAX_SIZE = Number.isFinite(parsedMaxSize) && parsedMaxSize > 0 ? parsedMaxSize : DEFAULT_MAX_SIZE;

const s3Client = MEDIA_BUCKET ? new S3Client({ region: REGION }) : undefined;

function requireClient() {
  if (!MEDIA_BUCKET || !s3Client) {
    throw new Error("POST_MEDIA_BUCKET is not configured");
  }
}

type PresignRequestBody = {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

export async function POST(request: NextRequest) {
  try {
    requireClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PresignRequestBody;
  try {
    payload = (await request.json()) as PresignRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload.fileType || typeof payload.fileType !== "string" || !payload.fileType.startsWith("image/")) {
    return NextResponse.json({ error: "画像ファイルのみアップロードできます。" }, { status: 400 });
  }

  if (payload.fileSize !== undefined) {
    if (typeof payload.fileSize !== "number" || Number.isNaN(payload.fileSize) || payload.fileSize <= 0) {
      return NextResponse.json({ error: "ファイルサイズが不正です。" }, { status: 400 });
    }
    if (payload.fileSize > MEDIA_MAX_SIZE) {
      return NextResponse.json(
        { error: `ファイルサイズは ${(MEDIA_MAX_SIZE / (1024 * 1024)).toFixed(1)}MB 以下にしてください。` },
        { status: 400 },
      );
    }
  }

  const extension = (
    payload.fileName?.split(".").pop() ??
    payload.fileType.split("/").pop() ??
    "bin"
  )
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase() || "bin";

  const objectKey = `${MEDIA_PREFIX}/${userId}/${randomUUID()}.${extension}`;

  const commandInput: PutObjectCommandInput = {
    Bucket: MEDIA_BUCKET,
    Key: objectKey,
    ContentType: payload.fileType,
  };

  if (MEDIA_ACL) {
    commandInput.ACL = MEDIA_ACL;
  }

  try {
    const command = new PutObjectCommand(commandInput);
    const uploadUrl = await getSignedUrl(s3Client!, command, { expiresIn: 60 * 5 });

    const base = MEDIA_BASE_URL?.replace(/\/$/, "");
    const objectPath =
      base && base.includes("cloudfront.net")
        ? objectKey.replace(/^public\/posts\//, "")
        : objectKey;
    const objectUrl = base
      ? `${base}/${objectPath}`
      : `https://${MEDIA_BUCKET}.s3.${REGION}.amazonaws.com/${objectKey}`;

    return NextResponse.json({
      uploadUrl,
      objectUrl,
      key: objectKey,
      maxSize: MEDIA_MAX_SIZE,
    });
  } catch (error) {
    console.error("Failed to create post media upload URL", error);
    return NextResponse.json(
      { error: "アップロードURLの発行に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
