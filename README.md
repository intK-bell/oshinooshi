# oshinooshi

推し活グッズ交換サービス「oshinooshi」のソースコードです。匿名配送やAIレコメンドを活用して、安全に「譲ります / 求めます」をマッチングすることを目指しています。

## プロジェクト構成

```
├── docs/                # 運用手順・UI設計メモ
├── infra/terraform/     # AWS インフラ構成 (S3, DynamoDB, SNS, Lambda など)
├── lambda/              # 画像処理・通知系 Lambda 関数
├── layer/               # Lambda 用レイヤーなど (sharp 等)
├── web/                 # フロントエンド (Next.js + Tailwind CSS v4)
└── tmp/                 # 一時ファイル (gitignore 対象)
```

## 前提
- AWS CLI / Terraform インストール済み
- Node.js (推奨: 20 系) / npm
- LINE Login や Discord Webhook 等は別途取得・設定してください

## インフラ (Terraform)
Secrets Manager に Discord Webhook のシークレットを登録してから、Terraform を実行します。

```bash
# Discord Webhook を Secrets Manager に設定
aws secretsmanager put-secret-value \ 
  --secret-id oshinooshi/discord/webhook \ 
  --secret-string "https://discord.com/api/webhooks/..." 

# Terraform 実行
cd infra/terraform
AWS_PROFILE=oshinooshi-stg terraform plan -out=plan.out
AWS_PROFILE=oshinooshi-stg terraform apply plan.out
```

## Lambda / 画像処理
- `lambda/photo-processor` … S3 + Rekognition を利用した画像処理、メタデータ更新、通知
- `lambda/sns-to-discord` … SNS 通知を Discord Webhook に中継
- `layer/sharp` … Amazon Linux 2 向けにビルド済みの `sharp` バイナリ格納用

Lambda の ZIP は `s3://oshinooshi-artifacts/lambda/...` に配置し、Terraform の変数で参照します。

## フロントエンド (web)
Next.js 15 + Tailwind CSS v4 を使用しています。

```bash
cd web
npm install
npm run dev
# -> http://localhost:3000 (空いていない場合はポート自動変更)
```

色テーマは `globals.css` の CSS カスタムプロパティ (`--color-bg` 等) で定義しています。ページは `src/app/` 配下でフラットに実装します。

## ドキュメント
- `docs/ops-alerts.md` … CloudWatch アラートから Discord 通知までの運用手順
- `docs/ui/ui-plan.md` … UI 設計・モック方針

## コントリビューション
1. issue / task に沿ってブランチを作成
2. 変更内容を反映
3. `npm run lint` `npm run build` などでチェック
4. PR を作成し、レビュー後に `main` へマージ

## ライセンス
本プロジェクトのライセンスについては `LICENSE` を参照してください。
