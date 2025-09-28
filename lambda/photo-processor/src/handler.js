import { loadConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { downloadObject, uploadObject, copyObject, deleteObject, putObjectTags } from './lib/s3.js';
import { evaluateModeration } from './lib/moderation.js';
import { generateDerivatives, detectBlur } from './lib/image.js';
import { upsertMediaRecord } from './lib/mediaStore.js';
import { emitModerationEvent, publishSns } from './lib/notifications.js';

const config = loadConfig();
const logger = createLogger({ lambda: 'photo-processor' });

const THRESHOLDS = {
  reject: 0.85,
  manualReview: 0.6
};

export const handler = async (event) => {
  logger.info('Received SQS event', { recordCount: event.Records?.length ?? 0 });

  const results = [];
  for (const record of event.Records ?? []) {
    try {
      const payload = JSON.parse(record.body);
      const result = await processMessage(payload);
      results.push(result);
    } catch (error) {
      logger.error('Failed to process record', { error: error.message, stack: error.stack, recordId: record.messageId });
      throw error; // trigger DLQ handling
    }
  }

  return {
    status: 'ok',
    processed: results.length
  };
};

async function processMessage(message) {
  validateMessage(message);

  const { source, postId, sequence, version = 1, userId } = message;
  const targetBaseKey = message.target?.baseKey ?? deriveTargetBaseKey(message);
  const targetBucket = config.photoBucket;
  const stem = `img-${sequence}`;
  const targetKeys = {
    original: `${targetBaseKey}/${stem}.jpg`,
    cover: `${targetBaseKey}/${stem}-cover.jpg`,
    thumb: `${targetBaseKey}/${stem}-thumb.jpg`
  };

  logger.info('Downloading original image', { source });
  const { body: originalBuffer, contentType } = await downloadObject(source.bucket, source.key);

  const blurScore = detectBlur(originalBuffer);

  logger.info('Running moderation', { bucket: source.bucket, key: source.key });
  const moderation = await evaluateModeration({ bucket: source.bucket, key: source.key, minConfidence: config.rekognitionMinConfidence });

  const moderationState = resolveModerationState(moderation.highestConfidence);

  logger.info('Generating derivatives', { targetBaseKey, moderationState });
  const derivatives = await generateDerivatives(originalBuffer, message.derivativeOptions);

  await Promise.all([
    uploadObject(targetBucket, targetKeys.cover, derivatives.cover, { ContentType: 'image/jpeg' }),
    uploadObject(targetBucket, targetKeys.thumb, derivatives.thumb, { ContentType: 'image/jpeg' }),
    copyObject(source.bucket, source.key, targetBucket, targetKeys.original, { MetadataDirective: 'COPY' })
  ]);

  await Promise.all([
    putObjectTags(targetBucket, targetKeys.original, buildTags({ postId, sequence, userId, state: moderationState })),
    putObjectTags(targetBucket, targetKeys.cover, buildTags({ postId, sequence, userId, state: moderationState, derivative: 'cover' })),
    putObjectTags(targetBucket, targetKeys.thumb, buildTags({ postId, sequence, userId, state: moderationState, derivative: 'thumb' }))
  ]);

  if (message.cleanupSource !== false) {
    await deleteObject(source.bucket, source.key);
  }

  await upsertMediaRecord(config.postMediaTable, {
    postId,
    sequence,
    state: moderationState,
    version,
    paths: targetKeys,
    metadata: {
      contentType,
      userId,
      blurScore,
      sourceKey: source.key,
      uploadedAt: message.uploadedAt ?? new Date().toISOString()
    },
    moderation
  });

  const eventDetail = {
    postId,
    sequence,
    state: moderationState,
    moderation,
    paths: targetKeys,
    userId,
    version
  };

  await emitModerationEvent(config.eventBusName, eventDetail);

  const subject = moderationState === 'rejected' ? 'Photo rejected' : moderationState === 'manual_review' ? 'Photo pending review' : 'Photo approved';
  await publishSns(config.inAppTopicArn, subject, eventDetail);
  await publishSns(config.lineTopicArn, subject, eventDetail);

  logger.info('Processing complete', { postId, sequence, moderationState });

  return { postId, sequence, state: moderationState };
}

function validateMessage(message) {
  const requiredFields = ['postId', 'sequence', 'source'];
  for (const field of requiredFields) {
    if (!message[field]) {
      throw new Error(`Invalid message: missing ${field}`);
    }
  }
  if (!message.source.bucket || !message.source.key) {
    throw new Error('Invalid message: source.bucket and source.key are required');
  }
}

function deriveTargetBaseKey(message) {
  const shard = shardFromPostId(message.postId);
  const version = message.version ?? 1;
  return `public/posts/${shard}/post-${message.postId}/v${version}`;
}

function shardFromPostId(postId) {
  const hash = [...postId].reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
  return Math.abs(hash).toString(16).slice(0, 4).padStart(4, '0');
}

function resolveModerationState(highestConfidence) {
  if (highestConfidence >= THRESHOLDS.reject * 100) return 'rejected';
  if (highestConfidence >= THRESHOLDS.manualReview * 100) return 'manual_review';
  return 'approved';
}

function buildTags({ postId, sequence, userId, state, derivative }) {
  return {
    postId,
    sequence,
    userId: userId ?? 'unknown',
    state,
    ...(derivative ? { derivative } : {})
  };
}
