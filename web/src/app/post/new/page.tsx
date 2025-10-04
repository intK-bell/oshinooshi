import { Header } from "../../../components/Header";

const categories = ["生写真", "アクリルスタンド", "ランダム缶バッジ", "タオル", "その他"];
const groups = ["乃木坂46", "櫻坂46", "日向坂46", "その他"];

export default function NewPostPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">新規投稿</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            譲ります / 求めます の詳細を入力してください。AI サジェストや撮影済み写真アップロードは後続で接続します。
          </p>
        </section>

        <form className="space-y-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[color:var(--color-fg-muted)]">
              投稿タイプ
              <div className="flex gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-2">
                  <input type="radio" name="postType" defaultChecked /> 譲ります
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-2">
                  <input type="radio" name="postType" /> 求めます
                </label>
              </div>
            </label>
            <label className="grid gap-1 text-[color:var(--color-fg-muted)]">
              推し・グループ
              <select className="rounded border border-[color:var(--color-border)] px-3 py-2">
                {groups.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
            タイトル
            <input
              className="rounded border border-[color:var(--color-border)] px-3 py-2"
              placeholder="例: 乃木坂46 ミニフォト コンプ譲ります"
            />
          </div>
          
          <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
            グッズ種別
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className="rounded-full border border-[color:var(--color-border)] px-3 py-1 hover:bg-[color:var(--color-surface-2)]"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
            詳細メモ
            <textarea
              rows={4}
              className="rounded border border-[color:var(--color-border)] px-3 py-2"
              placeholder="状態・希望条件・引き渡し方法などを記入してください。"
            />
          </div>

          <div className="grid gap-1 text-[color:var(--color-fg-muted)]">
            AI サジェスト (仮)
            <div className="rounded border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-4 text-[11px] text-[color:var(--color-fg-muted)]">
              画像やキーワードから候補を提案します。UIは今後整備予定です。
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent-emerald)] px-5 py-2 text-xs font-semibold text-[color:var(--color-accent-emerald-ink)] shadow-sm"
            >
              下書きとして保存
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] px-5 py-2 text-xs font-semibold text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]"
            >
              公開予約する
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
