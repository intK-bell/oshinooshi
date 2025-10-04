import { Header } from "../../components/Header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-14 text-xs text-[color:var(--color-fg-muted)]">
        <h1 className="text-lg font-semibold text-[#0b1f33]">利用規約（ドラフト）</h1>
        <p>
          本サービスの正式リリースまでに、利用規約・プライバシーポリシーを整備します。テスト環境ではダミー文書となります。
        </p>
        <p>
          主な項目: 利用資格、禁止事項、免責事項、問い合わせ先など。詳細は準備が整い次第更新します。
        </p>
      </main>
    </div>
  );
}
