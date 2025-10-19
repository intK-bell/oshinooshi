import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { sanitizeAffinityAnswers, type AffinityAnswers } from "./affinitySimilarity";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const PROFILE_USER_TABLE = process.env.PROFILE_USER_TABLE;

const dynamoClient = PROFILE_USER_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

function requireClient() {
  if (!PROFILE_USER_TABLE || !dynamoClient) {
    throw new Error("PROFILE_USER_TABLE is not configured");
  }
}

type StoredProfileItem = {
  line_id: string;
  display_name?: string;
  profile?: unknown;
  line_friend_url?: string;
  [key: string]: unknown;
};

export async function getProfileRecord(lineId: string): Promise<StoredProfileItem | null> {
  requireClient();

  const result = await dynamoClient!.send(
    new GetItemCommand({
      TableName: PROFILE_USER_TABLE,
      Key: {
        line_id: { S: lineId },
      },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return unmarshall(result.Item) as StoredProfileItem;
}

export function extractAffinityAnswersFromProfile(profile: unknown): AffinityAnswers | null {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const data = profile as Record<string, unknown>;

  if (data.affinitySurvey && typeof data.affinitySurvey === "object") {
    const survey = data.affinitySurvey as Record<string, unknown>;
    const answers = sanitizeAffinityAnswers(survey.answers);
    if (answers) {
      return answers;
    }
  }

  if (Array.isArray(data.affinityAnswers)) {
    return sanitizeAffinityAnswers(data.affinityAnswers);
  }

  return null;
}

export async function getAffinityAnswers(lineId: string): Promise<AffinityAnswers | null> {
  const record = await getProfileRecord(lineId);
  if (!record) {
    return null;
  }
  return extractAffinityAnswersFromProfile(record.profile);
}

export function extractDisplayNameFromRecord(record: StoredProfileItem | null | undefined): string | null {
  if (!record) {
    return null;
  }

  if (typeof record.display_name === "string" && record.display_name.trim().length > 0) {
    return record.display_name.trim();
  }

  if (record.profile && typeof record.profile === "object") {
    const profile = record.profile as Record<string, unknown>;
    const candidates = [profile["displayName"], profile["name"], profile["display_name"]];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

export type ProfileBasicInfo = {
  displayName: string | null;
};

export async function getProfileBasics(lineIds: string[]): Promise<Map<string, ProfileBasicInfo>> {
  const uniqueIds = Array.from(new Set(lineIds.filter((id): id is string => typeof id === "string" && id.length > 0)));
  const result = new Map<string, ProfileBasicInfo>();

  await Promise.all(
    uniqueIds.map(async (lineId) => {
      try {
        const record = await getProfileRecord(lineId);
        const displayName = extractDisplayNameFromRecord(record);
        result.set(lineId, { displayName });
      } catch (error) {
        console.warn(`Failed to fetch profile basics (${lineId})`, error);
        result.set(lineId, { displayName: null });
      }
    }),
  );

  return result;
}
