# UI アーキテクチャ計画

## 目的
- 推し活グッズ交換サービスの体験価値を最大化するフロントエンドを構築する。
- インフラ・バックエンドで整えた機能（投稿検索、取引フロー、通知基盤）を活かし、シンプルかつ安全なUIを提供する。
- 初期段階でも高速に改善できるデザイン体系とコンポーネント設計を整備する。

## 推奨スタック
- **フレームワーク**: Next.js（App Router） + TypeScript
  - ルーティング、SSR/SSG、API連携を統一的に扱える。
  - 将来的な国際化やSEOにも柔軟。
- **スタイリング**: Tailwind CSS + Headless UI
  - モバイル中心のUIを素早く構築し、共通コンポーネントを整備しやすい。
- **状態管理**: React Query + Context
  - API通信は React Query でキャッシュ・エラー制御。
  - 認証や通知設定などのグローバル状態は軽量な Context/Reducer で管理。
- **フォーム**: React Hook Form + Zod（バリデーション）
- **ユーティリティ**: dayjs（日付）、clsx（クラス結合）、axios（API）
- **UIテスト**: Storybook + Playwright （初期はStorybook中心で照合作成）

## 画面構成（WA）
1. **Landing / Onboarding**
   - サービス説明、利用ガイド、LINEログイン導線
   - ガイドライン・FAQ へのリンク、問い合わせフォームへ誘導
2. **Dashboard (Home)**
   - レコメンド（求め/譲り）、保存した検索条件、通知バッジ
   - 新規投稿ボタン（FAB）
3. **Search / Filter**
   - キーワード、カテゴリ（推し、グッズ種別、状態等）
   - 並び替え（新着、距離、評価）
   - 結果一覧（カード表示）
4. **Post Composer**
   - 求 / 譲 切り替え
   - 入力フォーム（推し/グッズ/状態/条件、写真アップロード、AI提案）
   - バリデーション、プレビュー
5. **Post Detail**
   - グッズ情報、派生推奨投稿、写真ギャラリー
   - チャットタブ、申請ボタン、通報リンク
6. **Chat / Match Hub**
   - 進捗（チャット中 / 申請中 / LINE調整中 / 評価待ち）
   - チャット画面（モバイル優先）
7. **Evaluation & History**
   - 完了取引の星評価、レビュー表示、履歴検索
8. **Profile & Settings**
   - 基本情報、通知設定（メール/Discord/LINE連携まで考慮）、ブロックリスト、退会
9. **Ops / Help**
   - トラブルシューティング、問い合わせフォーム、配送ガイド

## レイアウト指針
- **モバイルファースト**: 最大 768px まではボトムナビ（Home/投稿/案件/設定）。
- **レスポンシブ**: タブレット以上でサイドバー（案件ステータス、通知）。
- **カードベース**: 投稿や通知はカード表示で階層を浅く。
- **セマンティックカラー**: 状態（approved/ manual_review/ rejected）に応じた色分け（緑/黄/赤）。

## コンポーネント設計（Atomic）
- Atoms: Button, Icon, Badge, Tag, Avatar, RatingStars, Input, Select, TextArea, Toggle, DateDisplay
- Molecules: SearchBar, FilterPanel, PhotoUploader, ChatBubble, StatusChip, AlertBanner
- Organisms: PostCard, MatchList, ChatPanel, EvaluationForm, OnboardingHero, ModalLayout
- Templates: HomeLayout, SearchLayout, PostDetailLayout
- Pages: `/`, `/home`, `/search`, `/post/new`, `/post/[id]`, `/matches`, `/profile`, `/help`

## データ取得とキャッシュ
- APIクライアント: `axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL })`
- React Query セットアップ: `QueryClientProvider`
- キャッシュキー例:
  - `['posts', filters]`：投稿リスト
  - `['post', id]`：投稿詳細
  - `['matches', userId]`：マッチ一覧
  - `['notifications']`：通知情報
- エラーハンドリング: グローバル `QueryClient` の `onError` で Discord/SNS ログ連携可能

## 認証フロー
1. LINE ログイン起点 → バックエンド経由で JWT 取得
2. フロント: Next.js middleware で `/home` 以降を保護
3. トークンは `httpOnly` Cookie を基本とし、React Query で `credentials: 'include'`
4. CSRF 対策: Next.js API Routes で設定（必要に応じて）

## 写真アップロード
- `PhotoUploader` コンポーネント
  - S3 事前署名URLをバックエンド API から取得
  - 進捗バー・リトライ、画像圧縮（ブラウザ側で300KB程度）
  - アップロード完了後、Lambda が処理 → Websocket/通知で反映

## 通知表示
- React Query で `/notifications` を取得し、リアルタイムは WebSocket or SSE で補完（中長期で）
- Discord / メール 通知設定（トグル）と連携

## アクセシビリティ & QA
- Tailwind + Headless UI で ARIA 対応
- 重要アクション（投稿/申請/評価）には確認モーダル＋キーボード操作考慮
- Storybook を整備してビジュアル回帰テスト（Chromatic など）を導入できるよう設計

## 今後のタスク
1. Next.js プロジェクト初期化、Lint/Prettier/Storybook のセットアップ
2. デザインシステム（テーマカラー、スペーシング、タイポグラフィ）定義
3. ページごとのモック実装（Home, Search, PostDetail）
4. バックエンド API スキーマに合わせた型定義（OpenAPI → TypeScript 対応など）
5. E2Eテスト（Playwright）で主要フロー（投稿→申請→評価）を検証

## Matchesページ詳細 (ドラフト)
- ステータス: チャット中 / 申請中 / LINE調整中 / 評価待ち
- 各セクションに最新更新時刻・相手名・要約・アクションボタン (詳細/リマインド)
- 将来的には取引詳細ページへの導線と、Slack/Discordへの自動リマインドを検討

## 投稿作成ページ 詳細 (ドラフト)
- 投稿タイプ（譲/求）切替、推しグループ、グッズ種別選択
- タイトル、詳細メモ、写真アップロード（後日実装）
- AIサジェストカードで候補提示（仮デザイン）
- 下書き保存／公開予約ボタン（本実装時にAPI接続）

## マッチ状況ページ 詳細 (ドラフト)
- ステータスごとのカード表示 (チャット / 申請 / LINE調整 / 評価待ち)
- 各カードに最新更新時刻・相手・要約・次のアクションヒント
- 将来的には取引詳細ページへのリンク、Slack/Discordリマインドも検討
