# 運用アラート通知フロー（Discord）

## 構成概要
- CloudWatch アラーム
  - `oshinooshi-photo-processor-errors-stg`
  - `oshinooshi-photo-intake-dlq-depth-stg`
- SNS トピック: `arn:aws:sns:ap-northeast-1:478860598832:oshinooshi-ops-alerts-stg`
- Lambda: `oshinooshi-sns-to-discord-stg`（SNS → Discord Webhook 中継）
- Discord: 運用チャンネルの Incoming Webhook

## 運用手順
1. アラート発生時は Discord に以下形式で通知されます。
   - `AlarmName`, `新しい状態`, `NewStateReason`, `説明`
   - 通知本文例: :rotating_light:**oshinooshi-photo-intake-dlq-depth-stg** ...
2. 初動対応
   - `photo_intake_dlq_depth` → DLQ タスク確認（SQS メッセージ, Lambda エラー）。
   - `photo_processor_errors` → CloudWatch Logs `/aws/lambda/oshinooshi-photo-processor-stg` をチェック。
3. 停止・解除
   - しきい値が戻ると OK 通知が届く。
   - 手動で解除が必要な場合はアラームを「Silence」or CloudWatch でしきい値変更。

## 検証方法
- SNS トピックへテスト送信。
  ```bash
  AWS_PROFILE=oshinooshi-stg aws sns publish \
    --topic-arn arn:aws:sns:ap-northeast-1:478860598832:oshinooshi-ops-alerts-stg \
    --message '{"AlarmName":"Manual Test","NewStateValue":"ALARM","NewStateReason":"Manual milestone","AlarmDescription":"Test dispatch"}'
  ```
- Lambda へ直接イベント投入。
  ```bash
  cat <<'JSON' > tmp/discord-test-event.json
  {
    "Records": [
      {
        "Sns": {
          "Message": "{\"AlarmName\":\"Direct Test\",\"NewStateValue\":\"ALARM\",\"NewStateReason\":\"Manual\",\"AlarmDescription\":\"Lambda testing\"}"
        }
      }
    ]
  }
  JSON

  AWS_PROFILE=oshinooshi-stg aws lambda invoke \
    --function-name oshinooshi-sns-to-discord-stg \
    --payload fileb://tmp/discord-test-event.json tmp/discord-test-response.json
  ```

## Secrets 管理
- Discord Webhook は AWS Secrets Manager (`oshinooshi/discord/webhook`) で管理。
- `terraform.tfvars` に直接書かず、`terraform apply` 時に Secrets を参照して環境変数へ注入。

## 注意事項
- Webhook URL を再発行した場合: Secrets Manager の値を更新 → `terraform apply` で反映。
- テスト用ファイル (`tmp/*.json`) は `.gitignore` 済み。必要に応じて作成し、不要なら削除。
- 403 など Discord 側の拒否は CloudWatch Logs の `response` フィールドで確認。
