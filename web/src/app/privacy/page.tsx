import { Header } from "../../components/Header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1f33]">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-14 text-xs text-[color:var(--color-fg-muted)]">
        <h1 className="text-lg font-semibold text-[#0b1f33]">プライバシーポリシー（ドラフト）</h1>
        <p>
          ユーザー情報の取り扱い指針や、匿名配送における個人情報保護については正式版で公開予定です。
        </p>
        <p>
          取得する情報、利用目的、第三者提供、問い合わせ窓口などを整理し、リリース前に更新します。
        </p>
      </main>
    </div>
  );
}
