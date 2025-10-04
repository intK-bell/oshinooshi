import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const TABLE_NAME = process.env.PROFILE_READINESS_TABLE;
const DEFAULT_USER_ID = process.env.PROFILE_READINESS_DEFAULT_USER_ID;
const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const WRITER_FUNCTION_NAME = process.env.PROFILE_READINESS_WRITER_FUNCTION_NAME;

type ReadinessStatus = "completed" | "in_progress" | "todo";

type DynamoItem = {
  user_id: string;
  updated_at?: string;
  sections?: Record<string, ReadinessStatus>;
};

const ddbClient = new DynamoDBClient({ region: REGION });
const lambdaClient = new LambdaClient({ region: REGION });

function buildResponse(data: {
  updatedAt: string | null;
  sections: Record<string, ReadinessStatus>;
  error?: string;
}, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function GET(request: NextRequest) {
  if (!TABLE_NAME) {
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "PROFILE_READINESS_TABLE is not configured",
      },
      { status: 200 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId") ?? DEFAULT_USER_ID;

  if (!userId) {
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "userId is required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await ddbClient.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          user_id: { S: userId },
        },
      }),
    );

    if (!result.Item) {
      return buildResponse(
        {
          updatedAt: null,
          sections: {},
        },
        { status: 200 },
      );
    }

    const unmarshalled = unmarshall(result.Item) as DynamoItem;
    const sections = unmarshalled.sections ?? {};

    return buildResponse(
      {
        updatedAt: unmarshalled.updated_at ?? null,
        sections,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch profile readiness", error);
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "Failed to fetch readiness status",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!WRITER_FUNCTION_NAME) {
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "PROFILE_READINESS_WRITER_FUNCTION_NAME is not configured",
      },
      { status: 200 },
    );
  }

  let payload: {
    userId?: string;
    sections?: Record<string, ReadinessStatus>;
    updatedAt?: string;
  };

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Invalid readiness payload", error);
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "Invalid JSON payload",
      },
      { status: 400 },
    );
  }

  if (!payload.userId) {
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "userId is required",
      },
      { status: 400 },
    );
  }

  if (!payload.sections || Object.keys(payload.sections).length === 0) {
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "sections is required",
      },
      { status: 400 },
    );
  }

  const body = JSON.stringify({
    userId: payload.userId,
    sections: payload.sections,
    updatedAt: payload.updatedAt,
  });

  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: WRITER_FUNCTION_NAME,
        Payload: Buffer.from(body),
        InvocationType: "RequestResponse",
      }),
    );

    return buildResponse(
      {
        updatedAt: payload.updatedAt ?? null,
        sections: payload.sections,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to invoke readiness writer", error);
    return buildResponse(
      {
        updatedAt: null,
        sections: {},
        error: "Failed to persist readiness status",
      },
      { status: 500 },
    );
  }
}
