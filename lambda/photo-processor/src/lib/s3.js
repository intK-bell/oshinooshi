import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, PutObjectTaggingCommand } from '@aws-sdk/client-s3';
import { readableStreamToBuffer } from './stream.js';

const s3 = new S3Client({});

export async function downloadObject(bucket, key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await readableStreamToBuffer(response.Body);
  return { body, contentType: response.ContentType, metadata: response.Metadata };
}

export async function uploadObject(bucket, key, body, options = {}) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ...options }));
}

export async function copyObject(sourceBucket, sourceKey, targetBucket, targetKey, options = {}) {
  await s3.send(new CopyObjectCommand({
    Bucket: targetBucket,
    Key: targetKey,
    CopySource: `${sourceBucket}/${sourceKey}`,
    ...options
  }));
}

export async function deleteObject(bucket, key) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function headObject(bucket, key) {
  return s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

export async function putObjectTags(bucket, key, tags) {
  const TagSet = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
  await s3.send(new PutObjectTaggingCommand({ Bucket: bucket, Key: key, Tagging: { TagSet } }));
}
