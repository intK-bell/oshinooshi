const GROUP_ALIASES: Array<{ canonical: string; variants: string[] }> = [
  { canonical: "nogizaka46", variants: ["乃木坂46", "nogizaka46", "nogizaka", "nogi", "乃木坂"] },
  {
    canonical: "sakurazaka46",
    variants: ["櫻坂46", "欅坂46", "sakurazaka46", "keyakizaka46", "sakurazaka", "欅坂"],
  },
  { canonical: "hinatazaka46", variants: ["日向坂46", "hinatazaka46", "hina", "日向坂"] },
  { canonical: "befirst", variants: ["be: first", "be:first", "be first", "be-first", "befirst", "be フィースト"] },
  { canonical: "enjin", variants: ["enjin", "enjin japan", "円神"] },
];

const CATEGORY_ALIASES: Array<{ canonical: string; variants: string[] }> = [
  { canonical: "photo", variants: ["生写真", "チェキ", "フォト", "photo", "写真"] },
  { canonical: "acrylic-stand", variants: ["アクリルスタンド", "アクスタ", "acrylic stand", "スタンド"] },
  { canonical: "can-badge", variants: ["缶バッジ", "缶バッチ", "バッジ", "缶badge", "badge"] },
  { canonical: "towel", variants: ["タオル", "マフラータオル", "フェイスタオル"] },
  { canonical: "key-holder", variants: ["キーホルダー", "キーリング", "keyholder"] },
  { canonical: "poster", variants: ["ポスター", "poster"] },
  { canonical: "cd", variants: ["cd", "アルバム", "シングル"] },
  { canonical: "lightstick", variants: ["ペンライト", "ライトスティック", "lightstick"] },
];

function buildAliasLookup(entries: Array<{ canonical: string; variants: string[] }>): Map<string, string> {
  const lookup = new Map<string, string>();
  entries.forEach(({ canonical, variants }) => {
    const normalizedCanonical = normalizeForComparison(canonical);
    if (normalizedCanonical) {
      lookup.set(normalizedCanonical, normalizedCanonical);
    }
    variants.forEach((variant) => {
      const normalized = normalizeForComparison(variant);
      if (normalized) {
        lookup.set(normalized, normalizedCanonical || normalized);
      }
    });
  });
  return lookup;
}

const GROUP_LOOKUP = buildAliasLookup(GROUP_ALIASES);
const CATEGORY_LOOKUP = buildAliasLookup(CATEGORY_ALIASES);

export function normalizeForComparison(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .toString()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()[\]{}<>]/g, "")
    .replace(/[・･]/g, "")
    .replace(/[#"'“”‘’、，。,.!?！？:：;；&＆]/g, "")
    .replace(/[\s\u3000_-]+/g, "")
    .trim();
}

export function canonicalizeGroup(value: string | null | undefined): string | null {
  const normalized = normalizeForComparison(value);
  if (!normalized) {
    return null;
  }
  return GROUP_LOOKUP.get(normalized) ?? normalized;
}

export function canonicalizeSeries(value: string | null | undefined): string | null {
  const normalized = normalizeForComparison(value);
  return normalized || null;
}

export function canonicalizeCategory(value: string | null | undefined): string | null {
  const normalized = normalizeForComparison(value);
  if (!normalized) {
    return null;
  }
  return CATEGORY_LOOKUP.get(normalized) ?? normalized;
}

export function canonicalizeCategories(values: string[]): string[] {
  const unique = new Set<string>();
  values.forEach((value) => {
    const canonical = canonicalizeCategory(value);
    if (canonical) {
      unique.add(canonical);
    }
  });
  return Array.from(unique);
}

export function diceCoefficient(a: string, b: string): number {
  const normalizedA = normalizeForComparison(a);
  const normalizedB = normalizeForComparison(b);

  if (!normalizedA || !normalizedB) {
    return 0;
  }
  if (normalizedA === normalizedB) {
    return 1;
  }

  const bigrams = (value: string) => {
    const result: string[] = [];
    for (let i = 0; i < value.length - 1; i += 1) {
      result.push(value.slice(i, i + 2));
    }
    return result;
  };

  const pairsA = bigrams(normalizedA);
  const pairsB = bigrams(normalizedB);
  if (pairsA.length === 0 || pairsB.length === 0) {
    return 0;
  }

  const map = new Map<string, number>();
  pairsA.forEach((pair) => {
    map.set(pair, (map.get(pair) ?? 0) + 1);
  });

  let intersection = 0;
  pairsB.forEach((pair) => {
    const count = map.get(pair) ?? 0;
    if (count > 0) {
      map.set(pair, count - 1);
      intersection += 1;
    }
  });

  return (2 * intersection) / (pairsA.length + pairsB.length);
}

export function stringsAreSimilar(a: string | null | undefined, b: string | null | undefined, threshold = 0.72): boolean {
  if (!a || !b) {
    return false;
  }
  const similarity = diceCoefficient(a, b);
  return similarity >= threshold;
}
