import LineProvider from "next-auth/providers/line";
import type { Account, NextAuthOptions, Profile, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const PROFILE_USER_TABLE = process.env.PROFILE_USER_TABLE;

const dynamoClient = PROFILE_USER_TABLE ? new DynamoDBClient({ region: REGION }) : undefined;

type LineProfile = Profile & {
  sub?: string;
  name?: string | null;
  picture?: string | null;
};

export const authOptions: NextAuthOptions & { trustHost?: boolean } = {
  providers: [
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      checks: ["state", "nonce"],
    }),
  ],
  callbacks: {
    async signIn({ account, profile }: { account: Account | null; profile?: LineProfile }) {
      if (!PROFILE_USER_TABLE || !dynamoClient) {
        return true;
      }

      const lineId = profile?.sub ?? account?.providerAccountId ?? undefined;
      if (!lineId) {
        return true;
      }

      const now = new Date().toISOString();
      const updateExpressions = [
        "updated_at = :updated_at",
        "display_name = :display_name",
        "user_uuid = if_not_exists(user_uuid, :user_uuid)",
        "created_at = if_not_exists(created_at, :created_at)",
      ];

      const expressionValues: Record<string, { S: string }> = {
        ":updated_at": { S: now },
        ":display_name": { S: profile?.name && profile.name.length > 0 ? profile.name : "LINEユーザー" },
        ":user_uuid": { S: randomUUID() },
        ":created_at": { S: now },
      };

      if (profile?.picture && profile.picture.length > 0) {
        updateExpressions.push("picture = :picture");
        expressionValues[":picture"] = { S: profile.picture };
      }

      try {
        await dynamoClient.send(
          new UpdateItemCommand({
            TableName: PROFILE_USER_TABLE,
            Key: {
              line_id: { S: lineId },
            },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeValues: expressionValues,
          }),
        );
      } catch (error) {
        console.error("Failed to upsert LINE user profile", error);
      }

      return true;
    },
    async jwt({
      token,
      account,
      profile,
    }: {
      token: JWT;
      account: Account | null;
      profile?: LineProfile;
    }) {
      if (account && profile) {
        const profileLineId = profile.sub ?? account.providerAccountId ?? undefined;
        if (profileLineId) {
          token.lineId = profileLineId;
        }
        token.name = profile.name ?? token.name;
        token.picture = profile.picture ?? token.picture;

        if (PROFILE_USER_TABLE && dynamoClient && profileLineId) {
          try {
            const result = await dynamoClient.send(
              new GetItemCommand({
                TableName: PROFILE_USER_TABLE,
                Key: {
                  line_id: { S: profileLineId },
                },
              }),
            );

            if (result.Item) {
              token.userProfile = unmarshall(result.Item);
            }
          } catch (error) {
            console.error("Failed to load LINE user profile", error);
          }
        }
      } else if (token.lineId && PROFILE_USER_TABLE && dynamoClient && !token.userProfile) {
        try {
          const result = await dynamoClient.send(
            new GetItemCommand({
              TableName: PROFILE_USER_TABLE,
              Key: {
                line_id: { S: token.lineId },
              },
            }),
          );
          if (result.Item) {
            token.userProfile = unmarshall(result.Item);
          }
        } catch (error) {
          console.error("Failed to load LINE user profile", error);
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.lineId as string | undefined;
        const profileData = token.userProfile as Record<string, unknown> | undefined;
        session.user.name = (profileData?.display_name as string | undefined) ?? token.name ?? session.user.name;
        session.user.image = (profileData?.picture as string | undefined) ?? token.picture ?? session.user.image;
        session.user.uuid = profileData?.user_uuid as string | undefined;
      }
      return session;
    },
  },
  trustHost: true,
};
