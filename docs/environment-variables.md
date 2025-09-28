# Environment Variables (Staging Reference)

| Key | Description | Staging Value | Notes |
| --- | --- | --- | --- |
| `AWS_REGION` | Default AWS region | `ap-northeast-1` | Align with DynamoDB/Cognito region |
| `PHOTO_BUCKET_NAME` | S3 bucket for photos | `oshinooshi-photo-stg` | Matches IaC naming convention |
| `CLOUDFRONT_DISTRIBUTION_ID` | CDN distribution identifier | `<set post-deploy>` | Required for invalidation Lambda |
| `MODERATION_CONFIG_PATH` | Path to YAML config | `config/moderation-settings.yaml` | Load at Lambda cold start |
| `REKOGNITION_MIN_CONFIDENCE` | Baseline confidence for detections | `0.6` | Should match `manual_review_min` |
| `MODERATION_TEXT_BLOCKLIST` | Comma-separated banned strings | managed via Secrets Manager | Used by text detection module |
| `NOTIFY_IN_APP_TOPIC_ARN` | SNS topic for in-app notifications | `<arn:aws:sns:ap-northeast-1:...:notify-inapp-stg>` | Subscribed by websocket worker |
| `NOTIFY_LINE_TOPIC_ARN` | SNS topic for LINE push | `<arn:aws:sns:ap-northeast-1:...:notify-line-stg>` | Optional; disable by leaving empty |
| `PHOTO_PROCESSOR_QUEUE_URL` | SQS queue intake | `<https://sqs.ap-northeast-1.amazonaws.com/.../photo-intake-stg>` | Used for manual DLQ inspection |
| `PHOTO_PROCESSOR_DLQ_URL` | Dead-letter queue | `<https://sqs.ap-northeast-1.amazonaws.com/.../photo-intake-dlq-stg>` | Alarm on >0 messages |
| `LINE_CHANNEL_ID` | LINE Login channel | managed via Secrets Manager | Not stored in plaintext |
| `LINE_CHANNEL_SECRET` | LINE channel secret | Secrets Manager | Inject via Lambda environment at runtime |
| `LINE_CALLBACK_URL` | LINE OAuth callback | `https://stg.oshinooshi.com/auth/line/callback` | Must be whitelisted | 
| `APP_BASE_URL` | Frontend URL | `https://stg.oshinooshi.com` | For signed URL generation |
| `SIGNED_COOKIE_KEY_PAIR_ID` | CloudFront key pair ID | `<KXXXXXXXXXXXX>` | Required when issuing signed cookies |
| `SIGNED_COOKIE_PRIVATE_KEY` | Private key (PEM) | Stored in AWS Secrets Manager | Rotated quarterly |
| `PHOTO_ARCHIVE_ACCESS_ROLE_ARN` | IAM role to access protected archives | `<arn:aws:iam::...:role/dispute-access-stg>` | Assumed by support tooling |
| `MODERATION_OVERRIDE_TABLE` | DynamoDB table for overrides | `oshinooshi-moderation-override-stg` | Allows whitelist entries |
| `POST_MEDIA_TABLE` | DynamoDB table name | `oshinooshi-post-media-stg` | Tracks versions & status |
| `EVENT_BUS_NAME` | EventBridge bus | `oshinooshi-stg` | For moderation state events |
| `METRICS_NAMESPACE` | CloudWatch metrics namespace | `OshinoOshi/Moderation` | Consistent across envs |

## Notes
- Secrets Manager values referenced above should be granted via IAM policy to the Lambda execution role only.
- For local testing, provide `.env.staging` with non-secret placeholders and rely on `aws-vault` or similar to inject secrets.
- Ensure `config/moderation-settings.yaml` is deployed alongside Lambda package or accessible via S3 configuration bucket.
