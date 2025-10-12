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

export type UsageFlowStep = {
  title: string;
  summary: string;
  anchor: string;
};

export type StepGuide = {
  key: string;
  title: string;
  intro: string;
  bullets: string[];
  link?: {
    label: string;
    href: string;
  };
};

export const basicProfileTemplate: string[] = [
  "自己紹介（推し歴・交換スタンス）",
  "求アイテム / 譲アイテム",
  "取引の希望日時や場所、NG事項",
  "最後のひとこと（返信タイミングや感謝など）",
];

export const usageFlowSteps: UsageFlowStep[] = [
  {
    title: "登録",
    summary: "LINEでログインし、プロフィールと推し傾向アンケートを整えて準備します。",
    anchor: "#guide-registration",
  },
  {
    title: "投稿",
    summary: "求める・譲る条件を投稿して、相手からのアクションを待ちます。",
    anchor: "#guide-posting",
  },
  {
    title: "検索",
    summary: "推し・カテゴリ・キーワードで条件に合う募集を探します。",
    anchor: "#guide-search",
  },
  {
    title: "チャット申請",
    summary: "気になる投稿にメッセージを添えて申請し、マッチ成立を目指します。",
    anchor: "#guide-chat",
  },
  {
    title: "LINE友だちリクエスト",
    summary: "マッチ後はLINEで友だちになり、次の段取りを共有します。",
    anchor: "#guide-line-request",
  },
  {
    title: "LINE上で交換のやりとり",
    summary: "匿名配送の手順や受け渡し方法を確認しながら、交換内容を確定します。",
    anchor: "#guide-line-communication",
  },
  {
    title: "評価",
    summary: "取引完了後は相手を評価し、今後のマッチングに活かしましょう。",
    anchor: "#guide-review",
  },
];

export const stepGuides: StepGuide[] = [
  {
    key: "guide-registration",
    title: "登録のガイド",
    intro: "LINEログイン後、プロフィールと推し傾向アンケートを整えると、レコメンド精度が高まります。",
    bullets: [
      "表示名・自己紹介・推しメンバーを具体的に記入しましょう",
      "推し傾向アンケートの9問に回答すると類似ユーザーが見つかりやすくなります",
      "公開範囲は後から変更できるので、まずは下書き感覚で保存してOKです",
    ],
  },
  {
    key: "guide-posting",
    title: "投稿のガイド",
    intro: "求める条件と譲れる条件を明確にすると、選んでもらいやすくなります。",
    bullets: [
      "タイトルには推しやグッズ種別を入れて検索にヒットさせましょう",
      "本文には希望数量・同封物・NG条件など具体的に記載します",
      "画像を添えると状態が伝わりやすく、申請までのスピードが上がります",
    ],
  },
  {
    key: "guide-search",
    title: "検索のガイド",
    intro: "キーワードとフィルターを組み合わせて、条件に合う募集を絞り込みます。",
    bullets: [
      "推し・グループとカテゴリのフィルターを使って不要な結果を減らします",
      "類似度スコアが表示される投稿は、嗜好が近いユーザーの可能性が高めです",
      "保存した条件は次回アクセス時にも使えるようブラウザが記憶します",
    ],
  },
  {
    key: "guide-chat",
    title: "チャット申請のガイド",
    intro: "気になる投稿には早めに申請し、必要事項をまとめて伝えましょう。",
    bullets: [
      "挨拶と希望内容、調整したい日程をセットで伝えると親切です",
      "取引までの希望スケジュールや発送方法の希望があれば先に共有します",
      "申請後は24時間以内の返信を心がけ、状況をステータスで更新しましょう",
    ],
  },
  {
    key: "guide-line-request",
    title: "LINEお友だちのガイド",
    intro: "マッチ成立後はLINEで友だちになり、匿名配送の有無に関わらずここで詳細を詰めます。",
    bullets: [
      "LINE IDを交換する際は、相手のプロフィール名と一致しているか確認しましょう",
      "初回メッセージで取引内容・希望スケジュール・連絡手段を再確認します",
      "必要に応じてテンプレートメッセージを用意しておくとやり取りが楽になります",
    ],
  },
  {
    key: "guide-line-communication",
    title: "LINE上で交換のやりとり",
    intro: "匿名配送や手渡しの調整、入金タイミングなど大事な事項はLINEで明文化しておきましょう。",
    bullets: [
      "発送方法・伝票番号・受け取り日時などはメッセージで共有して証跡を残します",
      "匿名配送を利用する場合は公式ガイドを参照し、不明点は事前に確認しましょう",
      "やり取りが完了したら双方でメモを整理し、次回に活かせる工夫をまとめておくと安心です",
    ],
    link: {
      label: "ヤマト運輸の匿名配送ガイド",
      href: "https://faq.kuronekoyamato.co.jp/app/answers/detail/a_id/4249",
    },
  },
  {
    key: "guide-review",
    title: "評価のガイド",
    intro: "取引が完了したら、評価とコメントで次のマッチングに繋がるフィードバックを残しましょう。",
    bullets: [
      "スムーズだった点や助かったポイントを具体的に記入すると喜ばれます",
      "改善してほしい点があれば丁寧な言葉で共有し、トラブルはサポートに相談してください",
      "取引が終わったらLINEは必要に応じて友だち解除・ブロックし、次の取引に備えましょう",
    ],
  },
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
