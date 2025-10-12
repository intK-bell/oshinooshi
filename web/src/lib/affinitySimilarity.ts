import { AFFINITY_FACTORS, AFFINITY_QUESTIONS, type AffinityFactorId } from "../constants/affinitySurvey";

const MIN_LIKERT = 1;
const MAX_LIKERT = 5;

export type AffinityAnswers = Array<number | null | undefined>;

export type AffinityFactorScores = Record<AffinityFactorId, number>;

function clampLikert(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_LIKERT;
  }
  if (value < MIN_LIKERT) {
    return MIN_LIKERT;
  }
  if (value > MAX_LIKERT) {
    return MAX_LIKERT;
  }
  return value;
}

function normalizeLikert(value: number): number {
  const clamped = clampLikert(value);
  return (clamped - MIN_LIKERT) / (MAX_LIKERT - MIN_LIKERT);
}

export function computeAffinityFactorScores(answers: AffinityAnswers): AffinityFactorScores | null {
  if (!Array.isArray(answers) || answers.length !== AFFINITY_QUESTIONS.length) {
    return null;
  }

  const totals: Record<AffinityFactorId, number> = {
    parasocialBond: 0,
    fanCommunity: 0,
    admiration: 0,
  };

  const weights: Record<AffinityFactorId, number> = {
    parasocialBond: 0,
    fanCommunity: 0,
    admiration: 0,
  };

  let hasSignal = false;

  AFFINITY_QUESTIONS.forEach((question, index) => {
    const answer = answers[index];
    if (typeof answer !== "number") {
      return;
    }

    hasSignal = true;
    const normalized = normalizeLikert(answer);

    for (const factor of AFFINITY_FACTORS) {
      const loading = question.factorLoadings[factor.id];
      totals[factor.id] += normalized * loading;
      weights[factor.id] += Math.abs(loading);
    }
  });

  if (!hasSignal) {
    return null;
  }

  const scores: AffinityFactorScores = {
    parasocialBond: 0,
    fanCommunity: 0,
    admiration: 0,
  };

  for (const factor of AFFINITY_FACTORS) {
    const weight = weights[factor.id];
    scores[factor.id] = weight === 0 ? 0 : totals[factor.id] / weight;
  }

  return scores;
}

export function computeAffinitySimilarity(a: AffinityAnswers, b: AffinityAnswers): number | null {
  const scoresA = computeAffinityFactorScores(a);
  const scoresB = computeAffinityFactorScores(b);

  if (!scoresA || !scoresB) {
    return null;
  }

  const vectorA = AFFINITY_FACTORS.map((factor) => scoresA[factor.id] ?? 0);
  const vectorB = AFFINITY_FACTORS.map((factor) => scoresB[factor.id] ?? 0);

  const dot = vectorA.reduce((sum, value, index) => sum + value * vectorB[index], 0);
  const normA = Math.sqrt(vectorA.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(vectorB.reduce((sum, value) => sum + value * value, 0));

  if (normA === 0 || normB === 0) {
    return null;
  }

  const cosine = dot / (normA * normB);
  if (!Number.isFinite(cosine)) {
    return null;
  }

  const normalized = (cosine + 1) / 2;
  if (normalized <= 0) {
    return 0;
  }
  if (normalized >= 1) {
    return 1;
  }
  return normalized;
}

export function formatSimilarityPercentage(similarity: number | null | undefined): number | null {
  if (typeof similarity !== "number" || Number.isNaN(similarity)) {
    return null;
  }
  const clamped = Math.min(Math.max(similarity, 0), 1);
  return Math.round(clamped * 100);
}

export function sanitizeAffinityAnswers(rawAnswers: unknown): AffinityAnswers | null {
  if (!Array.isArray(rawAnswers)) {
    return null;
  }

  return AFFINITY_QUESTIONS.map((_, index) => {
    const value = rawAnswers[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      return clampLikert(Math.round(value));
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return clampLikert(parsed);
      }
    }
    return null;
  });
}
