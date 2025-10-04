import { Header } from "../../components/Header";
import Link from "next/link";

const filterChips = ["全て", "譲ります", "求めます"];
const dummyPosts = Array.from({ length: 6 }).map((_, index) => ({
  id: index + 1,
  title: `乃木坂46 生写真セット ${index + 1}`,
  summary: "コンプ / 未使用 / 交換希望: 櫻坂46 ランダム缶バッジ",
  status: index % 2 === 0 ? "譲ります" : "求めます",
}));

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-5 py-14">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold">投稿を探す</h1>
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                キーワード・推し・グッズ種別で絞り込みができます。
              </p>
            </div>
            <Link
              href="/post/new"
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
            >
              投稿する
            </Link>
          </div>

          <form className="grid gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-end">
            <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
              キーワード
              <input
                className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs"
                placeholder="例: 櫻坂46 生写真"
              />
            </label>
            <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
              推し・グループ
              <select className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs">
                <option>すべて</option>
                <option>乃木坂46</option>
                <option>櫻坂46</option>
                <option>日向坂46</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-[color:var(--color-fg-muted)]">
              グッズ種別
              <select className="rounded border border-[color:var(--color-border)] px-3 py-2 text-xs">
                <option>指定なし</option>
                <option>生写真</option>
                <option>アクリルスタンド</option>
                <option>ランダム缶バッジ</option>
              </select>
            </label>
            <div className="sm:col-span-3 flex flex-wrap gap-2 text-xs text-[color:var(--color-fg-muted)]">
              {filterChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="rounded-full border border-[color:var(--color-border)] px-3 py-1 hover:bg-[color:var(--color-surface-2)]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </form>
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between text-xs text-[color:var(--color-fg-muted)]">
            <p>検索結果 <span className="font-semibold text-[#0b1f33]">6</span> 件</p>
            <div className="flex gap-3">
              <button className="underline underline-offset-4">最新順</button>
              <button className="underline underline-offset-4">評価順</button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dummyPosts.map((post) => (
              <article
                key={post.id}
                className="space-y-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-5 text-xs text-[color:var(--color-fg-muted)]"
              >
                <p className="text-[11px] font-semibold text-[color:var(--color-accent-emerald-ink)]">{post.status}</p>
                <h2 className="text-sm font-semibold text-[#0b1f33]">{post.title}</h2>
                <p>{post.summary}</p>
                <button className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-medium text-[#0b1f33] transition hover:bg-[color:var(--color-surface-2)]">
                  詳細を見る
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
