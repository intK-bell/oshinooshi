import { Header } from "../../components/Header";

const sections = [
  {
    title: "チャット中",
    description: "条件のすり合わせを行っている取引です。72時間を目安にレスポンスしましょう。",
    items: [
      {
        id: 1,
        counterpart: "ユーザーA",
        summary: "乃木坂46 生写真コンプ ↔ 櫻坂46 アクスタ",
        updated: "12分前",
        nextStep: "条件が固まったら申請を送りましょう。",
      },
      {
        id: 2,
        counterpart: "ユーザーB",
        summary: "日向坂46 ミーグリチェキ ↔ グッズセット",
        updated: "45分前",
        nextStep: "相手からの返信待ちです。",
      },
    ],
  },
  {
    title: "申請中",
    description: "承認待ちの状態です。24時間以内に返信がない場合はリマインドを送りましょう。",
    items: [
      {
        id: 3,
        counterpart: "ユーザーC",
        summary: "櫻坂46 缶バッジ ↔ 乃木坂46 うちわ",
        updated: "3時間前",
        nextStep: "リマインドを検討してください。",
      },
    ],
  },
  {
    title: "LINEで調整中",
    description: "LINE ID を共有済み。配送方法と日程調整を進めてください。",
    items: [
      {
        id: 4,
        counterpart: "ユーザーD",
        summary: "櫻坂46 ポストカード ↔ 日向坂46 ランダムフォト",
        updated: "昨日",
        nextStep: "配送準備が整ったら評価待ちに進みます。",
      },
    ],
  },
  {
    title: "評価待ち",
    description: "商品が到着したらお互いに星評価とコメントを残してください。",
    items: [
      {
        id: 5,
        counterpart: "ユーザーE",
        summary: "乃木坂46 マフラータオル ↔ ENJIN CD",
        updated: "2日前",
        nextStep: "発送状況を確認し、評価を依頼しましょう。",
      },
    ],
  },
];

export default function MatchesPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-14">
        <section className="space-y-3">
          <h1 className="text-lg font-semibold">マッチ状況</h1>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            ステータスごとの進捗を把握できます。詳細な操作は取引詳細ページで行う設計を想定しています。
          </p>
        </section>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="space-y-4">
              <header className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-[#0b1f33]">{section.title}</h2>
                <p className="text-xs text-[color:var(--color-fg-muted)]">{section.description}</p>
              </header>
              <div className="grid gap-3 xl:grid-cols-2">
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-4 text-xs text-[color:var(--color-fg-muted)]"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#0b1f33]">{item.counterpart}</span>
                      <span>{item.updated}</span>
                    </div>
                    <p>{item.summary}</p>
                    <p className="text-[11px] italic text-[color:var(--color-fg-muted)]">{item.nextStep}</p>
                    <div className="flex gap-2">
                      <button className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-medium text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]">
                        詳細を見る
                      </button>
                      <button className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] text-[#0b1f33] hover:bg-[color:var(--color-surface-2)]">
                        リマインド
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
