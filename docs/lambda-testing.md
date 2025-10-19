# Lambda テスト手順

`oshinooshi` 環境で構築済みの Lambda（`photo-processor`, `profile-readiness-writer`）を手動テストするための手順メモです。SQS トリガー経由での画像処理フロー確認、SNS 通知の受信確認、IAM 認証付き Lambda Function URL の呼び出し方法をまとめています。

## 事前準備
- AWS CLI v2（2.13 以降推奨）、`jq`、`envsubst`（gettext）をローカルにインストール済みであること。
- 適切な AWS 認証プロファイルを用意（例: `AWS_PROFILE=oshinooshi-stg`）。必要に応じて `AWS_REGION=ap-northeast-1` を設定しておく。
- Terraform から最新値を取得。
  ```bash
  cd infra/terraform
  AWS_PROFILE=oshinooshi-stg terraform output -json > ../../tmp/terraform-outputs.json
  ```
- よく使う値をシェル変数に束ねておくと便利。
  ```bash
  export AWS_PROFILE=oshinooshi-stg
  export AWS_REGION=ap-northeast-1
  export PHOTO_BUCKET=$(jq -r '.photo_bucket_name.value' tmp/terraform-outputs.json)
  export PHOTO_QUEUE_URL=$(jq -r '.photo_intake_queue_url.value' tmp/terraform-outputs.json)
  export PHOTO_DLQ_URL=$(jq -r '.photo_intake_dlq_url.value' tmp/terraform-outputs.json)
  export POST_MEDIA_TABLE=$(jq -r '.post_media_table_name.value' tmp/terraform-outputs.json)
  export EVENT_BUS_NAME=$(jq -r '.event_bus_name.value' tmp/terraform-outputs.json)
  export SNS_INAPP_ARN=$(jq -r '.notify_in_app_topic_arn.value' tmp/terraform-outputs.json)
  export SNS_LINE_ARN=$(jq -r '.notify_line_topic_arn.value' tmp/terraform-outputs.json)
  export PROFILE_FN_ARN=$(jq -r '.profile_readiness_writer_function_arn.value' tmp/terraform-outputs.json)
  export ENVIRONMENT=stg   # 開発環境名。必要に応じて terraform.tfvars の environment と合わせる
  ```
- `tmp/` ディレクトリを作成（`.gitignore` 済み）。
- 一連の操作を自動化したスクリプト（`scripts/run-lambda-tests.sh`）も用意している。コマンド個別に追いたい場合は以下手順を参照、自動実行したい場合は
  ```bash
  ./scripts/run-lambda-tests.sh --environment stg --profile oshinooshi-stg
  ```
  を利用できる（`--keep-artifacts` を付けると S3/DynamoDB の検証結果を残す）。Terraform backend へのアクセス権が無い環境では `terraform output -json` を先に実行し、その JSON を `--outputs` で指定する。

---

## SQS → Photo Processor Lambda の動作確認

### 1. 検証用画像を S3 に配置
1. 任意の JPEG ファイルを用意（例: `tmp/sample.jpg`）。ファイルが無い場合は手元の画像やダミーファイルを利用。
2. 避難用キーを決定。
   ```bash
   export TEST_ID=$(date +%Y%m%d-%H%M%S)
   export SOURCE_KEY="transient/drafts/devtools/${TEST_ID}.jpg"
   aws s3 cp tmp/sample.jpg "s3://${PHOTO_BUCKET}/${SOURCE_KEY}"
   aws s3 ls "s3://${PHOTO_BUCKET}/transient/drafts/devtools/"
   ```

### 2. SQS メッセージを投入
1. イベントペイロードを作成。
   ```bash
   cat <<'JSON' > tmp/photo-processor-event.json
   {
     "postId": "post-${TEST_ID}",
     "sequence": "00",
     "version": 1,
     "userId": "user-${TEST_ID}",
     "source": {
       "bucket": "${PHOTO_BUCKET}",
       "key": "${SOURCE_KEY}"
     },
     "target": {
       "baseKey": "public/posts/test/post-${TEST_ID}/v1"
     },
     "uploadedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
     "derivativeOptions": {
       "coverWidth": 1200,
       "thumbSize": 400
     }
   }
   JSON
   envsubst < tmp/photo-processor-event.json > tmp/photo-processor-event.resolved.json
   ```
2. SQS に投入。
   ```bash
   aws sqs send-message \
     --queue-url "${PHOTO_QUEUE_URL}" \
     --message-body file://tmp/photo-processor-event.resolved.json
   ```

### 3. Lambda 実行結果を確認
- CloudWatch Logs を追跡し、正常完了のログを確認。
  ```bash
  aws logs tail "/aws/lambda/oshinooshi-photo-processor-${ENVIRONMENT}" --follow
  ```
- DynamoDB のレコード追加を検証。
  ```bash
  aws dynamodb get-item \
    --table-name "${POST_MEDIA_TABLE}" \
    --key "{\"post_id\":{\"S\":\"post-${TEST_ID}\"},\"sequence\":{\"S\":\"00\"}}"
  ```
- S3 への派生ファイル配置確認（オリジナル・カバー・サムネイル）。
  ```bash
  aws s3 ls "s3://${PHOTO_BUCKET}/public/posts/test/post-${TEST_ID}/v1/"
  aws s3api get-object-tagging \
    --bucket "${PHOTO_BUCKET}" \
    --key "public/posts/test/post-${TEST_ID}/v1/img-00.jpg"
  ```
- キューが空になっていること（DLQ に転送されていないこと）を確認。
  ```bash
  aws sqs get-queue-attributes \
    --queue-url "${PHOTO_QUEUE_URL}" \
    --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible

  aws sqs get-queue-attributes \
    --queue-url "${PHOTO_DLQ_URL}" \
    --attribute-names ApproximateNumberOfMessages
  ```

### 4. EventBridge / SNS の伝播確認
- EventBridge への投入は `aws events list-archives` だけでは見えないため、CloudWatch Logs に出力された `emitModerationEvent` のログや、下記 SNS テストの通知で間接的に確認する。

---

## SNS 通知の受信確認（任意）
本番 Topic に既存サブスクリプションが無い場合は、検証用の SQS をぶら下げて動作を確認する。作業後はクリーンアップ必須。

```bash
export TEST_SNS_QUEUE="oshinooshi-sns-probe-${TEST_ID}"
aws sqs create-queue --queue-name "${TEST_SNS_QUEUE}"
export TEST_SNS_QUEUE_URL=$(aws sqs get-queue-url --queue-name "${TEST_SNS_QUEUE}" --query QueueUrl --output text)
export TEST_SNS_QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "${TEST_SNS_QUEUE_URL}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
```

1. SQS キューに SNS からの Publish を許可。
   ```bash
  cat <<JSON > tmp/sns-to-sqs-policy.json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "Allow-SNS-SendMessage",
        "Effect": "Allow",
        "Principal": {"Service": "sns.amazonaws.com"},
        "Action": "sqs:SendMessage",
        "Resource": "${TEST_SNS_QUEUE_ARN}",
        "Condition": {
          "ArnEquals": {
            "aws:SourceArn": "${SNS_INAPP_ARN}"
          }
        }
      },
      {
        "Sid": "Allow-SNS-SendMessage-Line",
        "Effect": "Allow",
        "Principal": {"Service": "sns.amazonaws.com"},
        "Action": "sqs:SendMessage",
        "Resource": "${TEST_SNS_QUEUE_ARN}",
        "Condition": {
          "ArnEquals": {
            "aws:SourceArn": "${SNS_LINE_ARN}"
          }
        }
      }
    ]
  }
  JSON

  aws sqs set-queue-attributes \
    --queue-url "${TEST_SNS_QUEUE_URL}" \
    --attributes Policy=file://tmp/sns-to-sqs-policy.json
  ```

2. Topic に一時サブスクリプションを作成（両 Topic 分）。
   ```bash
  export SNS_INAPP_SUB_ARN=$(aws sns subscribe --topic-arn "${SNS_INAPP_ARN}" --protocol sqs --notification-endpoint "${TEST_SNS_QUEUE_ARN}" --query 'SubscriptionArn' --output text)
  export SNS_LINE_SUB_ARN=$(aws sns subscribe --topic-arn "${SNS_LINE_ARN}" --protocol sqs --notification-endpoint "${TEST_SNS_QUEUE_ARN}" --query 'SubscriptionArn' --output text)
  ```

3. 先ほどの SQS テストを再実行し、キューに SNS メッセージが流入することを確認。
   ```bash
  aws sqs receive-message --queue-url "${TEST_SNS_QUEUE_URL}" --max-number-of-messages 10 --wait-time-seconds 2
  ```

4. 終了したら必ず後片付け。
   ```bash
  aws sns unsubscribe --subscription-arn "${SNS_INAPP_SUB_ARN}"
  aws sns unsubscribe --subscription-arn "${SNS_LINE_SUB_ARN}"
  aws sqs delete-queue --queue-url "${TEST_SNS_QUEUE_URL}"
  ```

---

## Lambda Function URL（IAM 認証）テスト
`profile-readiness-writer` Lambda には IAM 認証付きの Function URL が有効化されている。CLI からの呼び出しと DynamoDB 更新を確認する。

### 1. Function URL を取得
```bash
export PROFILE_FN_URL=$(aws lambda get-function-url-config \
  --function-name "${PROFILE_FN_ARN}" \
  --query 'FunctionUrl' --output text)
```

### 2. テストペイロードを送信
- AWS CLI 2.13 以降で `aws lambda invoke-function-url` を利用すると署名付きリクエストを自動送信できる。
  ```bash
  cat <<'JSON' > tmp/profile-readiness-payload.json
  {
    "userId": "user-${TEST_ID}",
    "sections": {
      "profile": "complete",
      "media": "pending"
    }
  }
  JSON
  envsubst < tmp/profile-readiness-payload.json > tmp/profile-readiness-payload.resolved.json

  aws lambda invoke-function-url \
    --function-name "${PROFILE_FN_ARN}" \
    --qualifier "\$LATEST" \
    --payload fileb://tmp/profile-readiness-payload.resolved.json \
    --cli-binary-format raw-in-base64-out \
    tmp/profile-readiness-response.json
  cat tmp/profile-readiness-response.json | jq
  ```
- CLI バージョンが古く同コマンドが使えない場合は、CLI を更新するか、`curl --aws-sigv4`（curl 8.2 以降）または `awscurl` 等を使って IAM 署名を付与して呼び出す。

### 3. DynamoDB テーブルを確認
```bash
aws dynamodb get-item \
  --table-name $(jq -r '.profile_readiness_table_name.value' tmp/terraform-outputs.json) \
  --key "{\"user_id\":{\"S\":\"user-${TEST_ID}\"}}"
```

### 4. エラー時の確認ポイント
- 403: IAM 認証エラー。`AWS_PROFILE` / `aws configure` を再確認。
- 500: Lambda 側で `PROFILE_READINESS_TABLE` などの環境変数未設定。Terraform 再適用が必要。
- JSON パースエラー: `--cli-binary-format raw-in-base64-out` オプション忘れを確認。

---

## 後片付け
- 検証で生成した S3 ファイルを削除。
  ```bash
  aws s3 rm "s3://${PHOTO_BUCKET}/${SOURCE_KEY}"
  aws s3 rm "s3://${PHOTO_BUCKET}/public/posts/test/post-${TEST_ID}/v1/img-00.jpg"
  aws s3 rm "s3://${PHOTO_BUCKET}/public/posts/test/post-${TEST_ID}/v1/img-00-cover.jpg"
  aws s3 rm "s3://${PHOTO_BUCKET}/public/posts/test/post-${TEST_ID}/v1/img-00-thumb.jpg"
  ```
- DynamoDB に作成したテストデータの削除。
  ```bash
  aws dynamodb delete-item \
    --table-name "${POST_MEDIA_TABLE}" \
    --key "{\"post_id\":{\"S\":\"post-${TEST_ID}\"},\"sequence\":{\"S\":\"00\"}}"

  aws dynamodb delete-item \
    --table-name $(jq -r '.profile_readiness_table_name.value' tmp/terraform-outputs.json) \
    --key "{\"user_id\":{\"S\":\"user-${TEST_ID}\"}}"
  ```
- `tmp/` 以下の JSON を削除（必要に応じて）。

以上で Lambda 動作検証の一連手順は完了です。
