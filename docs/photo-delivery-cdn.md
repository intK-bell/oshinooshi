# Photo Delivery: CloudFront & Signed Access Strategy

## Distribution Overview
- Single CloudFront distribution `oshinooshi-media` with two origins:
  1. **Public origin**: S3 bucket `oshinooshi-photo-{env}` restricted via Origin Access Control (OAC). Origin path `/public/posts`.
  2. **Protected origin**: Same bucket with origin path `/protected/archives`; access through signed URLs only (no default path).
- Behaviors:
  - `/*`: default behavior pointing to public origin; Viewer protocol policy `Redirect HTTP to HTTPS`.
  - `/protected/*`: custom behavior requiring signed URL/cookie and short TTL to serve dispute evidence when必要。
- Enable HTTP/3, Brotli/Gzip, and response headers policy enforcing `Cache-Control` and security headers (`Content-Security-Policy`, `Referrer-Policy`).

## Signed URL / Cookie Policy
- **Default consumption**: logged-inアプリはCognito JWTを用いAPIコール→后台がCloudFront signed cookieを発行（有効30分）。Cookieスコープ `*.oshinooshi-media.com`。
- **Direct sharing**: 取引完了後の非公開写真リンクは無効。結果としてユーザーはアプリ経由でのみ閲覧。
- **Protected assets**: 運営やカスタマーサポートが dispute対応 で閲覧する際は、一時的（5分）な署名付きURLを生成。アクセスをCloudTrail + S3 Access Logsで監査。

## Cache Strategy
- Object URLsはバージョンパス `.../v{n}/img-00.jpg` でキャッシュを効かせ、無期限 (`max-age=31536000, immutable`)
- サーバー側が写真差し替え時はバージョン番号を increment して新URLを返す（キャッシュパージ不要）。
- `protected`配下は `Cache-Control: private, max-age=0, no-store` を付与し、CloudFrontも `Minimum TTL = 0` で都度オリジンへ。

### Cache Key Customization
- Default key: `Host + Path + Query`. Strip cookies except `CloudFront-Policy/Signature/Key-Pair-Id`.
- Vary by `Accept` header to serve WebP/AVIF (将来導入) への拡張余地。
- Add custom header `x-client-app` でアプリ種別（web/ios/android）を分岐させる場合はEdge Lambdaで上書き。

## Invalidations & Purge
- 原則としてバージョン付けにより不要。
- 運営が不適切写真を即時非公開にする場合は:
  1. S3 object移動→`protected/archives`。
  2. DynamoDBでステータス更新。
  3. CloudFrontに `/public/posts/{shard}/post-{id}/v{n}/*` の無効化を発行（API経由）。
- 自動化: EventBridgeルールで `moderation_status=removed` を検知し、Invalidate Lambdaをキック。

## Logging & Monitoring
- CloudFront standard logs → S3 `logs/cloudfront/`。Athenaで月次分析。
- Real-time logs (5% sample) によってキャッシュヒット率、署名エラー、地域分布を監視。
- CloudWatch alarms: `5xxErrorRate > 1%`、`CacheHitRate < 80% (5m avg)` で通知。

## Security Controls
- Field-level encryption not needed (画像のみ) だがSigned URLsは短寿命に。
- WAF: Rate-based rule対策、IP block list、OWASP managed rulesets。
- TLS: Viewer TLS v1.2 minimum、オリジンともに TLS 1.2.
- OAC replaces legacy OAI; ensure S3 block public access is ON.

## CI/CD Integration
- Infrastructure as Code (CDK/Terraform) 定義。バージョン増加時に自動デプロイ。
- Stageごとに別ドメイン（`media-dev.oshinooshi.com` 等）で証明書 ACM 管理。
- Smoke test: After deploy, run signed URL fetch + cache hit check to validate行路。
