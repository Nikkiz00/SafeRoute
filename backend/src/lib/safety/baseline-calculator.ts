/**
 * Turns a set of territories' weighted crime rates into 0-100 baseline safety
 * scores via national percentile rank — see docs/step-5-0-safety-data-baseline.md
 * §5 for why percentile rank was chosen over z-score/min-max: it is bounded by
 * construction (no separate clamping step needed), immune to a single extreme
 * outlier the way min-max is, and makes no distributional assumption the way a
 * z-score does. This is what the goal calls "normalizzazione robusta".
 *
 * Percentile is always computed within one territoryType at a time (comune vs
 * provincia) — never mixed — because the two are not on the same scale (crime is
 * more concentrated in an urban core than the wider province it sits in; mixing
 * would make a small province look artificially safer than a big city purely from
 * the aggregation level, not real risk difference).
 */

export interface TerritoryInput {
  territoryCode: string
  weightedRatePer100k: number
}

export interface TerritoryScore {
  territoryCode: string
  weightedRatePer100k: number
  /** 0 = lowest rate in this batch (safest), 100 = highest rate (riskiest). */
  percentileNational: number
  /** 100 - percentileNational, i.e. 100 = safest, 0 = riskiest — SafeRoute's scale. */
  baselineScore: number
}

export function computePercentileBaselines(territories: TerritoryInput[]): TerritoryScore[] {
  if (territories.length === 0) return []
  if (territories.length === 1) {
    // A single-territory batch has no distribution to rank against — treat as
    // the national median (neutral) rather than fabricating a 0 or 100 extreme.
    const t = territories[0]
    return [{ territoryCode: t.territoryCode, weightedRatePer100k: t.weightedRatePer100k, percentileNational: 50, baselineScore: 50 }]
  }

  const sorted = [...territories].sort((a, b) => a.weightedRatePer100k - b.weightedRatePer100k)
  const n = sorted.length

  return sorted.map((t, rank) => {
    const percentileNational = Math.round((rank / (n - 1)) * 100 * 100) / 100
    const baselineScore = Math.round(100 - percentileNational)
    return { territoryCode: t.territoryCode, weightedRatePer100k: t.weightedRatePer100k, percentileNational, baselineScore }
  })
}
