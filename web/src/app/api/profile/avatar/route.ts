import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { parseObjectCannedAcl } from "../../../../lib/s3Acl";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const AVATAR_BUCKET = process.env.PROFILE_AVATAR_BUCKET;
const AVATAR_BASE_URL = process.env.PROFILE_AVATAR_BASE_URL;
const AVATAR_OBJECT_ACL = parseObjectCannedAcl(process.env.PROFILE_AVATAR_ACL);
const AVATAR_PREFIX = (process.env.PROFILE_AVATAR_PREFIX ?? "profile/avatar").replace(/\/$/, "");

const s3Client = AVATAR_BUCKET ? new S3Client({ region: REGION }) : undefined;

export async function POST(request: NextRequest) {
  if (!AVATAR_BUCKET || !s3Client) {
    return NextResponse.json({ error: "PROFILE_AVATAR_BUCKET is not configured" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const lineId = session?.user?.id;

  if (!lineId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { fileName?: string; fileType?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload.fileType) {
    return NextResponse.json({ error: "fileType is required" }, { status: 400 });
  }

  const extension = payload.fileName?.split(".").pop() ?? payload.fileType.split("/").pop() ?? "bin";
  const objectKey = `${AVATAR_PREFIX}/${lineId}/${randomUUID()}.${extension}`;

  try {
    const commandInput: PutObjectCommandInput = {
      Bucket: AVATAR_BUCKET,
      Key: objectKey,
      ContentType: payload.fileType,
    };

    if (AVATAR_OBJECT_ACL) {
      commandInput.ACL = AVATAR_OBJECT_ACL;
    }

    const command = new PutObjectCommand(commandInput);

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 5 });
    const base = AVATAR_BASE_URL?.replace(/\/$/, "");
    const objectPath = base && base.includes("cloudfront.net")
      ? objectKey.replace(/^public\/posts\//, "")
      : objectKey;
    const objectUrl = base
      ? `${base}/${objectPath}`
      : `https://${AVATAR_BUCKET}.s3.${REGION}.amazonaws.com/${objectKey}`;

    return NextResponse.json({ uploadUrl, objectUrl, key: objectKey });
  } catch (error) {
    console.error("Failed to create avatar upload URL", error);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
