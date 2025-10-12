import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const LINE_TOPIC_ARN = process.env.NOTIFY_LINE_TOPIC_ARN;

const snsClient = LINE_TOPIC_ARN ? new SNSClient({ region: REGION }) : undefined;

type LineNotificationPayload = {
  type: string;
  recipientUserId: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function publishLineNotification(payload: LineNotificationPayload): Promise<boolean> {
  if (!LINE_TOPIC_ARN || !snsClient) {
    return false;
  }

  try {
    await snsClient.send(
      new PublishCommand({
        TopicArn: LINE_TOPIC_ARN,
        Message: JSON.stringify(payload),
      }),
    );
    return true;
  } catch (error) {
    console.error("Failed to publish LINE notification", error);
    return false;
  }
}
