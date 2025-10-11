export const POST_CATEGORIES = ["生写真", "アクリルスタンド", "ランダム缶バッジ", "タオル", "その他"] as const;

export const POST_GROUPS = ["未選択", "乃木坂46", "櫻坂46", "日向坂46", "その他"] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];
export type PostGroup = (typeof POST_GROUPS)[number];
