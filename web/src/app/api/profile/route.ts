import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const PROFILE_USER_TABLE = process.env.PROFILE_USER_TABLE;

const dynamoClient = PROFILE_USER_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!PROFILE_USER_TABLE || !dynamoClient) {
    throw new Error("PROFILE_USER_TABLE is not configured");
  }
}

export async function GET() {
  try {
    requireClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const lineId = session?.user?.id;

  if (!lineId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dynamoClient!.send(
      new GetItemCommand({
        TableName: PROFILE_USER_TABLE,
        Key: {
          line_id: { S: lineId },
        },
      }),
    );

    if (!result.Item) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const item = unmarshall(result.Item) as Record<string, unknown>;
    const profile = (item.profile as Record<string, unknown> | undefined) ?? null;

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Failed to load profile", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const lineId = session?.user?.id;
  const existingUuid = session?.user?.uuid;

  if (!lineId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const displayName = (payload.displayName as string | undefined)?.trim() || "LINEユーザー";
  const userUuid = typeof existingUuid === "string" && existingUuid.length > 0 ? existingUuid : randomUUID();

  const expressionValues = marshall(
    {
      ":profile": payload,
      ":updated_at": now,
      ":display_name": displayName,
      ":user_uuid": userUuid,
    },
    { removeUndefinedValues: true },
  );

  const updateExpression = [
    "profile = :profile",
    "updated_at = :updated_at",
    "display_name = :display_name",
    "user_uuid = if_not_exists(user_uuid, :user_uuid)",
  ];

  try {
    await dynamoClient!.send(
      new UpdateItemCommand({
        TableName: PROFILE_USER_TABLE,
        Key: {
          line_id: { S: lineId },
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeValues: expressionValues,
      }),
    );

    return NextResponse.json({ success: true, updatedAt: now }, { status: 200 });
  } catch (error) {
    console.error("Failed to update profile", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
