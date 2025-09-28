const requiredEnvVars = [
  'PHOTO_BUCKET_NAME',
  'PHOTO_PROCESSOR_QUEUE_URL',
  'PHOTO_PROCESSOR_DLQ_URL',
  'POST_MEDIA_TABLE',
  'MODERATION_OVERRIDE_TABLE',
  'EVENT_BUS_NAME'
];

const optionalEnvVars = {
  MODERATION_CONFIG_PATH: null,
  NOTIFY_IN_APP_TOPIC_ARN: null,
  NOTIFY_LINE_TOPIC_ARN: null,
  REKOGNITION_MIN_CONFIDENCE: '0.6'
};

export function loadConfig() {
  for (const name of requiredEnvVars) {
    if (!process.env[name]) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }

  const config = {
    photoBucket: process.env.PHOTO_BUCKET_NAME,
    queueUrl: process.env.PHOTO_PROCESSOR_QUEUE_URL,
    dlqUrl: process.env.PHOTO_PROCESSOR_DLQ_URL,
    postMediaTable: process.env.POST_MEDIA_TABLE,
    moderationOverrideTable: process.env.MODERATION_OVERRIDE_TABLE,
    eventBusName: process.env.EVENT_BUS_NAME,
    rekognitionMinConfidence: Number(process.env.REKOGNITION_MIN_CONFIDENCE ?? optionalEnvVars.REKOGNITION_MIN_CONFIDENCE),
    moderationConfigPath: process.env.MODERATION_CONFIG_PATH ?? optionalEnvVars.MODERATION_CONFIG_PATH,
    inAppTopicArn: process.env.NOTIFY_IN_APP_TOPIC_ARN ?? optionalEnvVars.NOTIFY_IN_APP_TOPIC_ARN,
    lineTopicArn: process.env.NOTIFY_LINE_TOPIC_ARN ?? optionalEnvVars.NOTIFY_LINE_TOPIC_ARN
  };

  return config;
}
