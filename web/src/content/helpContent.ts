export type VisibilityLevel = {
  key: string;
  label: string;
  description: string;
  benefit: string;
};

export type WritingTip = {
  title: string;
  rows: string[];
};

export type SafetyGuide = {
  title: string;
  items: string[];
};

export type FaqEntry = {
  question: string;
  answer: string;
};

export type FaqSection = {
  category: string;
  entries: FaqEntry[];
};

export type ProfileReadinessItem = {
  key: string;
  label: string;
  description: string;
  status: "completed" | "in_progress" | "todo";
  actionLabel: string;
  href: string;
};

export const visibilityLevels: VisibilityLevel[] = [
  {
    key: "public",
    label: "全体公開",
    description: "検索一覧とマッチ一覧に表示されます。初めてのユーザーとも繋がりたい方向け。",
    benefit: "初回の申し込み数が平均 35% 向上します",
  },
  {
    key: "semi",
    label: "マッチ後に公開",
    description: "申し込みが成立した相手にだけ詳細を表示します。様子を見ながらプロフィールを調整したい方に。",
    benefit: "知らない相手に個人情報を出さずにやりとりを開始できます",
  },
  {
    key: "private",
    label: "非公開",
    description: "プロフィールは自分のみ閲覧できます。下書き状態で準備できます。",
    benefit: "準備中でも下書きを保存して内容を温められます",
  },
];

export const writingTips: WritingTip[] = [
  {
    title: "基本構成テンプレート",
    rows: [
      "1. 自己紹介（呼び方・推し歴・交換スタンス）",
      "2. 求めている / 提供できるアイテムと条件",
      "3. 取引の希望日時や場所、NG事項",
      "4. 最後のひとこと（返信タイミングや感謝など）",
    ],
  },
  {
    title: "AIサジェストの活用",
    rows: [
      "・入力途中でも「AIで文章を整える」を押すと推敲案を提示",
      "・過去の投稿やプロフィールから語彙を学習して自然な文体を提案",
      "・安全に配慮した言い換えを含めてハラスメント防止にも活用",
    ],
  },
];

export const safetyGuidelines: SafetyGuide[] = [
  {
    title: "禁止事項",
    items: [
      "先払いを強要する行為や、金銭トラブルにつながるやりとり",
      "転売目的でのアイテム収集や、規約で禁止されているグッズの投稿",
      "個人情報の不適切な共有・SNS での晒し行為",
    ],
  },
  {
    title: "通報・ブロック",
    items: [
      "プロフィール右上の ⋯ メニューから通報・ブロックが可能",
      "証拠となるチャットログや画像を添付すると対応がスムーズ",
    ],
  },
  {
    title: "本人確認",
    items: [
      "顔写真付き書類をアップロードし、通常 1〜2 営業日で審査",
      "承認済みバッジはマッチ一覧や投稿カードに表示されます",
    ],
  },
];

export const faqSections: FaqSection[] = [
  {
    category: "アカウント・本人確認",
    entries: [
      {
        question: "本人確認には何が必要ですか？",
        answer: "学生証・運転免許証など顔写真付きの書類を 1 点アップロードしてください。氏名・生年月日が確認できれば OK です。",
      },
      {
        question: "審査にはどのくらい時間がかかりますか？",
        answer: "通常は 1〜2 営業日です。混雑時はアプリ内通知で進捗をご案内します。",
      },
    ],
  },
  {
    category: "プロフィール編集",
    entries: [
      {
        question: "画像サイズの推奨はありますか？",
        answer: "1:1 の JPG / PNG で 1MB 以内を推奨しています。アップロード後にトリミングが可能です。",
      },
      {
        question: "公開設定を後から変更できますか？",
        answer: "はい。プロフィール設定の『信頼性・安全』セクションでいつでも切り替えできます。",
      },
    ],
  },
  {
    category: "投稿・マッチング",
    entries: [
      {
        question: "求める・譲るを切り替える方法は？",
        answer: "投稿作成画面の最上部で切り替えできます。プロフィールの希望カテゴリとも同期されます。",
      },
      {
        question: "AIサジェストはどこから使えますか？",
        answer: "投稿フォームとプロフィール編集の自己紹介欄に『AIで整える』ボタンがあります。入力内容を保持したまま提案を確認できます。",
      },
    ],
  },
  {
    category: "メッセージ・通知",
    entries: [
      {
        question: "既読機能はありますか？",
        answer: "はい。既読は 1 対 1 チャットでのみ表示されます。グループチャットには付きません。",
      },
      {
        question: "リマインド通知はいつ届きますか？",
        answer: "マッチ後 24 時間で 1 回、未返信が続く場合は 72 時間で再通知します。",
      },
    ],
  },
  {
    category: "トラブル対応",
    entries: [
      {
        question: "取引をキャンセルしたいときは？",
        answer: "マッチ詳細画面の『取引ステータス』からキャンセル申請ができます。双方合意で即時キャンセル、自動キャンセルは 48 時間後です。",
      },
      {
        question: "通報後の流れを教えてください。",
        answer: "専門チームが内容を確認し、必要に応じてチャット停止・アカウント凍結を行います。進捗はアプリ内通知でお知らせします。",
      },
    ],
  },
];

export const profileReadiness: ProfileReadinessItem[] = [
  {
    key: "basic",
    label: "基本情報",
    description: "表示名・ふりがな・自己紹介を入力すると検索結果での印象が安定します。",
    status: "completed",
    actionLabel: "プロフィール設定を開く",
    href: "/profile",
  },
  {
    key: "area",
    label: "活動エリア",
    description: "都道府県やオンライン対応を設定するとマッチング精度が上がります。",
    status: "in_progress",
    actionLabel: "エリア情報を編集",
    href: "/profile#activity",
  },
  {
    key: "contact",
    label: "連絡手段",
    description: "アプリ外の連絡先を追加すると取引後の連絡がスムーズになります。",
    status: "in_progress",
    actionLabel: "連絡方法を追加",
    href: "/profile#contact",
  },
  {
    key: "trust",
    label: "信頼性・安全",
    description: "本人確認やSNSリンクを登録すると申し込みの信頼度が向上します。",
    status: "todo",
    actionLabel: "本人確認を進める",
    href: "/profile#trust",
  },
  {
    key: "policy",
    label: "利用ポリシー",
    description: "コミュニティガイドラインに同意し、通知設定を整備しましょう。",
    status: "completed",
    actionLabel: "通知設定を確認",
    href: "/profile#policy",
  },
];
