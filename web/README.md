This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Environment variables

`/api/profile/readiness` では DynamoDB を参照してプロフィール進捗を返します。開発時は `.env.local` などで以下を設定してください。

- `PROFILE_READINESS_TABLE` — 進捗を保存している DynamoDB テーブル名
- `PROFILE_READINESS_DEFAULT_USER_ID` — クエリパラメータが無い場合に参照するユーザーID
- `NEXT_PUBLIC_PROFILE_READINESS_USER_ID` — フロントエンドから API を呼び出す際に付与するユーザーID
- `PROFILE_READINESS_WRITER_FUNCTION_NAME` — 進捗を書き込む Lambda 関数名（ARN でも可）
- `NEXTAUTH_URL` — NextAuth の公開URL（ローカルでは `http://localhost:3000`）
- `NEXTAUTH_SECRET` — NextAuth 用のシークレット（十分に長いランダム文字列）
- `LINE_CLIENT_ID` / `LINE_CLIENT_SECRET` — LINE Login のチャネルIDとシークレット
- `PROFILE_USER_TABLE` — LINEユーザー情報を格納する DynamoDB テーブル名
- `POSTS_TABLE` — 投稿を格納する DynamoDB テーブル名
- `PROFILE_AVATAR_BUCKET` — プロフィール画像を保存する S3 バケット名
- `PROFILE_AVATAR_BASE_URL` — （任意）CloudFront などの公開URL。未設定の場合は S3 の URL が利用されます
- `PROFILE_AVATAR_ACL` — PUT 時に付与する ACL（既定 `public-read`）。バケットポリシーと合わせて調整してください
- `PROFILE_AVATAR_PREFIX` — S3 上での保存パス（既定 `profile/avatar`）。CloudFront の `origin_path` に合わせて `public/posts/profile/avatar` などに変更できます
- `POST_MEDIA_BUCKET` — 投稿画像を保存する S3 バケット名
- `POST_MEDIA_BASE_URL` — （任意）CloudFront 等の公開URL。未設定の場合は S3 の URL が利用されます
- `POST_MEDIA_PREFIX` — 投稿画像の保存パス（既定 `public/posts/media`）
- `POST_MEDIA_ACL` — 投稿画像アップロード時に付与する ACL。バケットで ACL が無効（BucketOwnerEnforced）の場合は空欄にしてください
- `POST_MEDIA_MAX_SIZE` — アップロードを許可する最大ファイルサイズ（バイト単位、既定は 5MB）

AWS の資格情報は CLI や環境変数で設定したものがそのまま利用されます。

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
