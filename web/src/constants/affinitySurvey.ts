export const AFFINITY_FACTORS = [
  { id: "parasocialBond", label: "擬似友人" },
  { id: "fanCommunity", label: "ファン・コミュニケーション" },
  { id: "admiration", label: "人間性の評価" },
] as const;

export type AffinityFactorId = (typeof AFFINITY_FACTORS)[number]["id"];

export type AffinityQuestion = {
  id: string;
  text: string;
  factorLoadings: Record<AffinityFactorId, number>;
};

export const AFFINITY_QUESTIONS: AffinityQuestion[] = [
  {
    id: "q1",
    text: "Aと友だちになりたい",
    factorLoadings: {
      parasocialBond: 0.971,
      fanCommunity: 0.017,
      admiration: -0.02,
    },
  },
  {
    id: "q2",
    text: "友だちとしてAと遊びたい",
    factorLoadings: {
      parasocialBond: 0.932,
      fanCommunity: -0.021,
      admiration: -0.021,
    },
  },
  {
    id: "q3",
    text: "友人として、Aに身近にいてほしいと思う",
    factorLoadings: {
      parasocialBond: 0.886,
      fanCommunity: -0.003,
      admiration: 0.057,
    },
  },
  {
    id: "q4",
    text: "他のAのファンに親近感を感じる",
    factorLoadings: {
      parasocialBond: 0.02,
      fanCommunity: 0.962,
      admiration: -0.044,
    },
  },
  {
    id: "q5",
    text: "Aのファンに愛着を感じている",
    factorLoadings: {
      parasocialBond: 0.035,
      fanCommunity: 0.818,
      admiration: 0.005,
    },
  },
  {
    id: "q6",
    text: "私は、他のAのファンがとても好きである",
    factorLoadings: {
      parasocialBond: -0.066,
      fanCommunity: 0.798,
      admiration: 0.064,
    },
  },
  {
    id: "q7",
    text: "Aは自分の目標としたい人物である",
    factorLoadings: {
      parasocialBond: -0.03,
      fanCommunity: -0.031,
      admiration: 0.863,
    },
  },
  {
    id: "q8",
    text: "Aのような生き方をしたい",
    factorLoadings: {
      parasocialBond: 0.011,
      fanCommunity: -0.007,
      admiration: 0.846,
    },
  },
  {
    id: "q9",
    text: "Aには、共感できる要素が多い",
    factorLoadings: {
      parasocialBond: 0.044,
      fanCommunity: 0.078,
      admiration: 0.579,
    },
  },
];
