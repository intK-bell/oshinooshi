import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';

const rekognition = new RekognitionClient({});

export async function evaluateModeration({ bucket, key, minConfidence }) {
  const command = new DetectModerationLabelsCommand({
    Image: {
      S3Object: { Bucket: bucket, Name: key }
    },
    MinConfidence: minConfidence
  });

  try {
    const { ModerationLabels = [] } = await rekognition.send(command);
    const highest = ModerationLabels.reduce((max, label) => Math.max(max, label.Confidence ?? 0), 0);
    return { labels: ModerationLabels, highestConfidence: highest };
  } catch (error) {
    error.message = `Rekognition moderation failed: ${error.message}`;
    throw error;
  }
}
