import Link from "next/link";

const features = [
  {
    title: "AIレコメンド",
    body: "あなたの求める・譲れる条件から、マッチしそうな相手を自動で提案します。",
  },
  {
    title: "匿名配送ガイド",
    body: "佐川急便の匿名配送の手順をアプリ内で確認できます。",
  },
  {
    title: "安全な取引管理",
    body: "チャット状況や評価が一目で分かるダッシュボードを用意しています。",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <Link href="/" className="text-base font-semibold">
            oshinooshi
          </Link>
          <Link
            href="/auth/login"
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-medium transition hover:bg-black/5"
          >
            LINEでログイン
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-14 sm:gap-16 sm:py-20">
        <section className="space-y-5">
          <p className="text-xs font-semibold text-black/50">推し活グッズ交換サービス</p>
          <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">
            「譲ります」と「求めます」が落ち着いて出会える、シンプルな交換プラットフォーム。
          </h1>
          <p className="max-w-xl text-sm text-black/55">
            SNS の DM での取引に不安を感じる方のために。AI のレコメンドと匿名配送ガイドを備えた、安心して使える推し活のための場所です。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/post/new"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent-emerald)] px-5 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm transition hover:bg-[color:var(--color-accent-emerald-hover)]"
            >
              投稿をはじめる
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-2 text-xs font-semibold text-black/70 transition hover:bg-black/5"
            >
              投稿を探す
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map(({ title, body }) => (
            <div
              key={title}
              className="space-y-2 rounded-xl border border-black/10 bg-white px-4 py-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-black/75">{title}</h3>
              <p className="text-xs text-black/55">{body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border border-black/10 bg-[#f7f7fb] px-5 py-6">
          <h2 className="text-sm font-semibold text-black/70">推し活をもっと安心に</h2>
          <p className="text-xs text-black/55">
            LINE認証でアカウントを守り、取引の進捗はダッシュボードで確認。匿名配送を案内しながら、評価システムで信頼を可視化します。
          </p>
        </section>
      </main>

      <footer className="border-t border-black/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 text-xs text-black/45">
          <p>© {new Date().getFullYear()} oshinooshi</p>
          <div className="flex gap-4">
            <Link href="/help">ガイドライン</Link>
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシー</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
