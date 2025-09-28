# Lambda: Photo Processor 実装・運用メモ

## ディレクトリ構成
```
lambda/photo-processor/
  package.json          # 依存関係 / スクリプト定義
  scripts/build.mjs     # esbuild を使ったバンドルスクリプト
  src/
    handler.js          # Lambda エントリポイント
    config.js, lib/*.js # S3/DynamoDB/Rekognition 等の共通ユーティリティ
```

## セットアップ & ビルド手順
1. 依存パッケージをインストール
   ```bash
   cd lambda/photo-processor
   npm install
   ```
2. バンドル + 配布物生成
   ```bash
   npm run build
   ```
   `dist/index.js` と `dist/package.json` が生成される（`sharp` は Lambda レイヤー等で別途用意）。
3. ZIP 化して S3 にアップロード
   ```bash
   cd dist
   zip -r ../photo-processor.zip .
   AWS_PROFILE=oshinooshi-stg aws s3 cp ../photo-processor.zip \
     s3://oshinooshi-artifacts/lambda/photo-processor/v1.0.0/package.zip
   ```
4. Terraform で再適用
   ```bash
   cd ../../infra/terraform
   AWS_PROFILE=oshinooshi-stg terraform plan -out=plan.out
   AWS_PROFILE=oshinooshi-stg terraform apply plan.out
   ```

## イベントペイロード想定
SQS からのメッセージは以下の JSON フォーマットを想定。
```json
{
  "postId": "abc123",
  "sequence": "00",
  "version": 1,
  "userId": "user-xyz",
  "source": {
    "bucket": "oshinooshi-photo-stg-aabd",
    "key": "transient/drafts/xyz/uuid.jpg"
  },
  "target": {
    "baseKey": "public/posts/abcd/post-abc123/v1"
  },
  "uploadedAt": "2025-09-27T12:34:56Z",
  "derivativeOptions": {
    "coverWidth": 1200,
    "thumbSize": 400
  }
}
```
`target.baseKey` を省略した場合は `postId` からシャーディングしたパスを自動生成します。

## モデレーション判定
- Rekognition の最高信頼度が 85%以上 → `rejected`
- 60% 以上 85% 未満 → `manual_review`
- 60% 未満 → `approved`

## 通知
- EventBridge: `oshinooshi.moderation` ソースで `photo.moderation.result` を発火。
- SNS: `NOTIFY_IN_APP_TOPIC_ARN` / `NOTIFY_LINE_TOPIC_ARN` が設定されている環境では各 Topic に JSON ペイロードを Publish。

## ログ確認
Lambda 実行時には JSON 形式で CloudWatch Logs (`/aws/lambda/oshinooshi-photo-processor-stg`) に出力されます。CLI で直近ログを見るには:
```bash
AWS_PROFILE=oshinooshi-stg aws logs tail \
  /aws/lambda/oshinooshi-photo-processor-stg --follow
```
