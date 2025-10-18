import type { PostRecord } from "./postRepository";
import { canonicalizeCategory, canonicalizeGroup, canonicalizeSeries, diceCoefficient, stringsAreSimilar } from "./textNormalizer";

export type RecommendationCandidate = PostRecord;

export type MatchRecommendation = {
  viewerPost: RecommendationPostSummary;
  candidatePost: RecommendationPostSummary & { userId: string | null };
  overlap: {
    viewerGives: string[];
    viewerWants: string[];
  };
  categoryOverlap: {
    viewer: string[];
    candidate: string[];
  };
  score: {
    total: number;
    components: {
      trade: number;
      interest: number;
      freshness: number;
    };
  };
};

export type RecommendationPostSummary = {
  postId: string;
  title: string;
  group: string | null;
  categories: string[];
  images: string[];
  haveMembers: string[];
  wantMembers: string[];
  updatedAt: string | null;
  createdAt: string | null;
  canonicalGroup: string | null;
  canonicalSeries: string | null;
  canonicalCategories: string[];
  categoryPairs: Array<{ canonical: string; original: string }>;
};

export type RecommendationOptions = {
  limit?: number;
  minScore?: number;
};

const DEFAULT_LIMIT = 10;

export function buildMatchRecommendations(
  viewerPosts: PostRecord[],
  candidates: RecommendationCandidate[],
  options: RecommendationOptions = {},
): MatchRecommendation[] {
  const normalizedLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0
      ? Math.min(Math.trunc(options.limit), 30)
      : DEFAULT_LIMIT;
  const minScore = typeof options.minScore === "number" && options.minScore >= 0 ? Math.min(options.minScore, 1) : 0;

  const bestByCandidateId = new Map<string, MatchRecommendation>();

  viewerPosts.forEach((viewerPost) => {
    candidates.forEach((candidate) => {
      if (viewerPost.postId === candidate.postId) {
        return;
      }
      if (viewerPost.userId && candidate.userId && viewerPost.userId === candidate.userId) {
        return;
      }

      const recommendation = scorePair(viewerPost, candidate);
      if (!recommendation) {
        return;
      }

      if (recommendation.score.total < minScore) {
        return;
      }

      const existing = bestByCandidateId.get(candidate.postId);
      if (!existing || existing.score.total < recommendation.score.total) {
        bestByCandidateId.set(candidate.postId, recommendation);
      }
    });
  });

  return Array.from(bestByCandidateId.values())
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, normalizedLimit);
}

function scorePair(viewerPost: PostRecord, candidate: RecommendationCandidate): MatchRecommendation | null {
  const viewerSummary = summarizePost(viewerPost);
  const candidateSummary = summarizePost(candidate);

  if (
    !viewerSummary.canonicalGroup ||
    !candidateSummary.canonicalGroup ||
    viewerSummary.canonicalGroup !== candidateSummary.canonicalGroup
  ) {
    return null;
  }

  if (!viewerSummary.canonicalSeries || !candidateSummary.canonicalSeries) {
    return null;
  }

  const seriesSimilarity = diceCoefficient(viewerSummary.canonicalSeries, candidateSummary.canonicalSeries);
  if (seriesSimilarity < 0.65 && !stringsAreSimilar(viewerSummary.title, candidateSummary.title, 0.8)) {
    return null;
  }

  const categoryOverlap = computeCategoryOverlap(viewerSummary, candidateSummary);
  if (categoryOverlap.viewer.length === 0 || categoryOverlap.candidate.length === 0) {
    return null;
  }

  const supplyMatches = intersectMembers(viewerSummary.haveMembers, candidateSummary.wantMembers, "viewer");
  const demandMatches = intersectMembers(candidateSummary.haveMembers, viewerSummary.wantMembers, "candidate");

  if (supplyMatches.length === 0 || demandMatches.length === 0) {
    return null;
  }

  const tradeScore = computeTradeScore(viewerSummary, candidateSummary, supplyMatches.length, demandMatches.length);
  const interestScore = computeInterestScore(seriesSimilarity, viewerSummary, candidateSummary, categoryOverlap);
  const freshnessScore = computeFreshnessScore(candidateSummary.updatedAt ?? candidateSummary.createdAt);

  const weights = {
    trade: 0.7,
    interest: 0.2,
    freshness: 0.1,
  };

  const weighted = tradeScore * weights.trade + interestScore * weights.interest + freshnessScore * weights.freshness;
  const totalWeight = weights.trade + weights.interest + weights.freshness;

  const totalScore = totalWeight > 0 ? weighted / totalWeight : 0;

  const recommendation: MatchRecommendation = {
    viewerPost: viewerSummary,
    candidatePost: {
      ...candidateSummary,
      userId: candidate.userId ?? null,
    },
    overlap: {
      viewerGives: supplyMatches,
      viewerWants: demandMatches,
    },
    categoryOverlap: {
      viewer: categoryOverlap.viewer,
      candidate: categoryOverlap.candidate,
    },
    score: {
      total: clamp01(totalScore),
      components: {
        trade: clamp01(tradeScore),
        interest: clamp01(interestScore),
        freshness: clamp01(freshnessScore),
      },
    },
  };

  return recommendation;
}

function summarizePost(post: PostRecord): RecommendationPostSummary {
  const categoriesRaw = Array.isArray(post.categories)
    ? post.categories.filter((value): value is string => typeof value === "string")
    : [];
  const categoryPairs = categoriesRaw
    .map((category) => {
      const canonical = canonicalizeCategory(category);
      if (!canonical) {
        return null;
      }
      return { canonical, original: category };
    })
    .filter((value): value is { canonical: string; original: string } => Boolean(value));

  const canonicalCategories = Array.from(new Set(categoryPairs.map((entry) => entry.canonical)));

  return {
    postId: post.postId,
    title: post.title ?? "",
    group: typeof post.group === "string" ? post.group : null,
    categories: categoriesRaw,
    images: Array.isArray(post.images) ? post.images.filter((value): value is string => typeof value === "string") : [],
    haveMembers: Array.isArray(post.haveMembers)
      ? post.haveMembers.filter((value): value is string => typeof value === "string")
      : [],
    wantMembers: Array.isArray(post.wantMembers)
      ? post.wantMembers.filter((value): value is string => typeof value === "string")
      : [],
    updatedAt: typeof post.updatedAt === "string" ? post.updatedAt : null,
    createdAt: typeof post.createdAt === "string" ? post.createdAt : null,
    canonicalGroup: canonicalizeGroup(post.group),
    canonicalSeries: canonicalizeSeries(post.title),
    canonicalCategories,
    categoryPairs,
  };
}

function intersectMembers(
  source: string[],
  target: string[],
  preferred: "viewer" | "candidate",
): string[] {
  if (!Array.isArray(source) || !Array.isArray(target) || source.length === 0 || target.length === 0) {
    return [];
  }

  const targetMap = new Map<string, string>();
  target.forEach((member) => {
    const normalized = normalizeMember(member);
    if (!targetMap.has(normalized)) {
      targetMap.set(normalized, member);
    }
  });

  const matches: string[] = [];
  const used = new Set<string>();

  source.forEach((member) => {
    const normalized = normalizeMember(member);
    if (targetMap.has(normalized) && !used.has(normalized)) {
      used.add(normalized);
      matches.push(preferred === "viewer" ? member : targetMap.get(normalized) ?? member);
    }
  });

  return matches;
}

function computeTradeScore(
  viewer: RecommendationPostSummary,
  candidate: RecommendationPostSummary,
  supplyCount: number,
  demandCount: number,
): number {
  const viewerSupplyRatio = viewer.haveMembers.length > 0 ? supplyCount / viewer.haveMembers.length : 0;
  const viewerDemandRatio = viewer.wantMembers.length > 0 ? demandCount / viewer.wantMembers.length : 0;
  const candidateSupplyRatio = candidate.haveMembers.length > 0 ? demandCount / candidate.haveMembers.length : 0;
  const candidateDemandRatio = candidate.wantMembers.length > 0 ? supplyCount / candidate.wantMembers.length : 0;

  const coverage = average([
    viewerSupplyRatio,
    viewerDemandRatio,
    candidateSupplyRatio,
    candidateDemandRatio,
  ]);

  const balance = supplyCount + demandCount > 0 ? 1 - Math.abs(supplyCount - demandCount) / (supplyCount + demandCount) : 0;

  let score = coverage * 0.75 + balance * 0.25;
  if (supplyCount > 0 && demandCount > 0) {
    score = Math.min(1, score + 0.1);
  }

  return clamp01(score);
}

function computeInterestScore(
  seriesSimilarity: number,
  viewer: RecommendationPostSummary,
  candidate: RecommendationPostSummary,
  categoryOverlap: { viewer: string[]; candidate: string[] },
): number {
  const categoryCoverage =
    categoryOverlap.viewer.length / Math.max(viewer.categories.length, candidate.categories.length, 1);

  const score = seriesSimilarity * 0.6 + categoryCoverage * 0.4;
  return clamp01(score);
}

function computeCategoryOverlap(
  viewer: RecommendationPostSummary,
  candidate: RecommendationPostSummary,
): { viewer: string[]; candidate: string[] } {
  if (viewer.canonicalCategories.length === 0 || candidate.canonicalCategories.length === 0) {
    return { viewer: [], candidate: [] };
  }

  const viewerByCanonical = new Map<string, Set<string>>();
  viewer.categoryPairs.forEach(({ canonical, original }) => {
    if (!viewerByCanonical.has(canonical)) {
      viewerByCanonical.set(canonical, new Set());
    }
    viewerByCanonical.get(canonical)!.add(original);
  });

  const candidateByCanonical = new Map<string, Set<string>>();
  candidate.categoryPairs.forEach(({ canonical, original }) => {
    if (!candidateByCanonical.has(canonical)) {
      candidateByCanonical.set(canonical, new Set());
    }
    candidateByCanonical.get(canonical)!.add(original);
  });

  const overlaps = viewer.canonicalCategories.filter((canonical) => candidateByCanonical.has(canonical));
  if (overlaps.length === 0) {
    return { viewer: [], candidate: [] };
  }

  const viewerLabels = new Set<string>();
  const candidateLabels = new Set<string>();

  overlaps.forEach((canonical) => {
    viewerByCanonical.get(canonical)?.forEach((label) => viewerLabels.add(label));
    candidateByCanonical.get(canonical)?.forEach((label) => candidateLabels.add(label));
  });

  return {
    viewer: Array.from(viewerLabels),
    candidate: Array.from(candidateLabels),
  };
}

function computeFreshnessScore(updatedAt: string | null): number {
  if (!updatedAt) {
    return 0.4;
  }

  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return 0.4;
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) {
    return 1;
  }
  if (diffDays <= 3) {
    return 0.85;
  }
  if (diffDays <= 7) {
    return 0.7;
  }
  if (diffDays <= 14) {
    return 0.55;
  }
  if (diffDays <= 30) {
    return 0.4;
  }
  if (diffDays <= 60) {
    return 0.3;
  }
  return 0.2;
}

function normalizeMember(value: string): string {
  return value?.toString().trim().toLowerCase() ?? "";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const numericValues = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (numericValues.length === 0) {
    return 0;
  }
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return total / numericValues.length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}
