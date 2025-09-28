# sns-to-discord Lambda

SNS 通知 (主に CloudWatch アラーム) を Discord Webhook に中継する Lambda 関数です。

## デプロイ手順
1. 依存ライブラリは標準ライブラリのみを使用するため zip で固めるだけで OK。
   ```bash
   cd lambda/sns-to-discord
   zip -r ../../tmp/sns-to-discord.zip index.py
   ```
2. 生成した zip を S3 (例: `oshinooshi-artifacts/lambda/sns-to-discord/v1.0.0.zip`) へアップロード。
3. Terraform から `aws_lambda_function.sns_to_discord` を更新し、`DISCORD_WEBHOOK_URL` の環境変数を設定する。
4. SNS トピック (`oshinooshi-ops-alerts`) にサブスクライブし、CloudWatch アラームの `alarm_actions` に同トピック ARN を設定する。

## 環境変数
- `DISCORD_WEBHOOK_URL`: Discord で発行した Incoming Webhook の URL。
