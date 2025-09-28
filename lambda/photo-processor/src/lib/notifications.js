import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const eventBridge = new EventBridgeClient({});
const sns = new SNSClient({});

export async function emitModerationEvent(eventBusName, detail) {
  const command = new PutEventsCommand({
    Entries: [{
      EventBusName: eventBusName,
      Source: 'oshinooshi.moderation',
      DetailType: 'photo.moderation.result',
      Detail: JSON.stringify(detail)
    }]
  });
  await eventBridge.send(command);
}

export async function publishSns(topicArn, subject, message) {
  if (!topicArn) return;
  const command = new PublishCommand({ TopicArn: topicArn, Subject: subject, Message: JSON.stringify(message) });
  await sns.send(command);
}
