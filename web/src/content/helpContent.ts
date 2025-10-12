export type VisibilityLevel = {
  key: string;
  label: string;
  description: string;
  benefit: string;
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

export const basicProfileTemplate: string[] = [
  "1. 自己紹介（呼び方・推し歴・交換スタンス）",
  "2. 求めている / 提供できるアイテムと条件",
  "3. 取引の希望日時や場所、NG事項",
  "4. 最後のひとこと（返信タイミングや感謝など）",
];

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
];

export const faqSections: FaqSection[] = [
  {
    category: "アカウント・ログイン",
    entries: [
      {
        question: "ログインできないときはどうすればいいですか？",
        answer: "LINE アプリで承認済みか、ブラウザの Cookie が無効になっていないかをご確認ください。再ログインで解消しない場合はサポートまでご連絡ください。",
      },
      {
        question: "複数端末から利用できますか？",
        answer: "同じ LINE アカウントであれば PC とスマートフォンの両方からご利用いただけます。",
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
