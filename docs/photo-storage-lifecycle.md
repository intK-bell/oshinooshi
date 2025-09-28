# Photo Storage & Lifecycle Design

## Bucket Strategy
- Use dedicated bucket per environment: `oshinooshi-photo-{env}` (`dev`, `stg`, `prod`) to isolate data and allow targeted lifecycle policies.
- Enable bucket versioning and default encryption (SSE-S3). Block all public ACLs; public delivery goes through CloudFront signed URLs.
- Apply event notifications (SQS) for post-processing pipeline (resize, moderation).

## Prefix & Naming Layout
```
public/
  posts/
    {shard}/post-{postId}/
      v{version}/
        img-{sequence}-{timestamp}.jpg
protected/
  archives/{yyyy}/{mm}/post-{postId}/img-{sequence}-{timestamp}.jpg
transient/
  drafts/{userId}/{uuid}.jpg
```
- `{shard}`: first 4 chars of postId hash to avoid hot partitions when listing.
- `sequence`: zero-based index (e.g., `00`, `01`, `02`) matching display order.
- `timestamp`: `YYYYMMDDThhmmssZ` capture for traceability when users replace photos.
- Store derivative sizes (e.g., `cover`, `thumb`) as siblings under same version folder: `img-00-thumb.jpg`.
- Metadata tags: `postId`, `ownerUserId`, `state` (`active|archived|draft`).

## Upload & Processing Flow
1. Client requests pre-signed URL for `transient/drafts/{userId}/{uuid}.jpg` and uploads original.
2. S3 event triggers Lambda to validate format/size, run moderation, generate resized derivatives, and write to `public/posts/{shard}/post-{postId}/v{version}/` with `state=active` tag.
3. When post is closed or photos replaced, service updates DynamoDB entry and either:
   - Copies relevant objects to `protected/archives/...` with new tag `state=archived` (old version retained for dispute handling).
   - Deletes superseded derivatives after archive copy completes.
4. Draft uploads not attached to a post remain in `transient` and are auto-purged.

## Lifecycle Policies
- **Transient drafts**: Expire after 24 hours. Lifecycle rule filters prefix `transient/drafts/` and deletes objects to contain unused storage.
- **Active posts**: Remain in Standard storage while `state=active`. Lifecycle rule transitions to Standard-IA after 90 days inactive (identified by object tag `lastStatusChange>`90 days) to reduce cost without affecting latency.
- **Archived posts**:
  - Immediately tagged `state=archived` and moved to prefix `protected/archives/`.
  - Lifecycle transition: Standard-IA at 30 days, Glacier Instant Retrieval at 365 days, Deep Archive deletion at 730 days unless legal hold.
  - Access limited to signed URLs used in dispute workflows; not exposed via CDN.
- **Version cleanup**: Retain last two versions per photo. Configure Lambda (weekly) to prune older versions after 30 days to control versioning cost.

## Access & Security
- CloudFront distribution mapped to `public/posts/` with signed cookies and aggressive caching (immutable URLs via version folder).
- `protected` prefix accessible only via backend using temporary credentials; audit all accesses.
- Enable S3 Object Lock (governance mode) for `protected` bucket to prevent accidental deletion during dispute window (e.g., 90 days).

## Monitoring
- CloudWatch metrics for bucket size by prefix and lifecycle transitions.
- S3 Storage Lens to review cost trends; alarms when `transient` exceeds 5% of total size (indicates stuck drafts).
- EventBridge alerts on lifecycle failures or moderation Lambda errors.
