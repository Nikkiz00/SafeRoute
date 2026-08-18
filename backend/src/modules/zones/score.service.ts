import { prisma } from '@/config/database.js'

// ── Live score: SafeRoute's own signals (feedback ratings + approved reports) ──
// Renamed from the pre-Step-5.0 "safety score" to make explicit that this is only
// half of finalSafetyScore — see combineFinalScore() below and
// docs/step-5-0-safety-data-baseline.md.
export function computeLiveSafetyScore(
  feedbackRatings: number[],
  approvedReportsCount: number
): { score: number | null; observationCount: number } {
  const observationCount = feedbackRatings.length + approvedReportsCount
  if (observationCount < 3) return { score: null, observationCount }

  // Map average rating to 0-100: rating 1 -> 0, 5 -> 100.
  // If no feedback (reports only), use neutral 3.8 as base.
  const avgRating =
    feedbackRatings.length > 0
      ? feedbackRatings.reduce((a, b) => a + b, 0) / feedbackRatings.length
      : 3.8

  const ratingScore = ((avgRating - 1) / 4) * 100
  const reportPenalty = Math.min(approvedReportsCount * 5, 25)
  const score = Math.max(0, Math.min(100, Math.round(ratingScore - reportPenalty)))
  return { score, observationCount }
}

// ── baseline + live -> final, via empirical-Bayes shrinkage toward the baseline ──
//
// SHRINKAGE_K is the number of live observations (feedback + approved reports,
// 30-day window) at which live data and the official statistical baseline carry
// equal weight in finalSafetyScore. Below K observations the baseline dominates —
// this is the mechanism that stops a single report from turning a zone red
// (n=1 -> liveWeight = 1/9 ≈ 11%). Above K, live signals increasingly take over
// since they are zone-specific and far more current than an annual province/comune
// crime statistic. K=8 is a chosen, documented constant (not fitted to data) —
// see docs/step-5-0-safety-data-baseline.md §5 for the reasoning and comparison
// against alternative techniques (percentile-only, pure z-score, no shrinkage).
export const SHRINKAGE_K = 8

export function combineFinalScore(
  baselineScore: number | null,
  liveScore: number | null,
  liveObservationCount: number
): { finalScore: number | null; confidence: number } {
  if (baselineScore === null && liveScore === null) return { finalScore: null, confidence: 0 }
  // No baseline yet (crime-baseline importer hasn't covered this zone's territory) —
  // fall back to live-only rather than blocking the score entirely.
  if (baselineScore === null) return { finalScore: liveScore, confidence: 1 }
  if (liveScore === null) return { finalScore: Math.round(baselineScore), confidence: 0 }

  const liveWeight = liveObservationCount / (liveObservationCount + SHRINKAGE_K)
  const finalScore = Math.round(baselineScore * (1 - liveWeight) + liveScore * liveWeight)
  return { finalScore: Math.max(0, Math.min(100, finalScore)), confidence: liveWeight }
}

// Recalculate and persist a zone's liveSafetyScore + finalSafetyScore from 30-day
// feedback/report data. Called after every new feedback submission or report
// approval. Never touches baselineSafetyScore/scoreReferenceYear — those are owned
// exclusively by the crime-baseline importer (scripts/import-crime-baseline.ts).
export async function recalculateZoneScore(zoneId: string): Promise<number | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [feedback, approvedReportsCount, zone] = await Promise.all([
    prisma.zoneFeedback.findMany({
      where: { zoneId, createdAt: { gte: thirtyDaysAgo } },
      select: { rating: true },
    }),
    prisma.report.count({
      where: { zoneId, status: 'approved', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.zone.findUnique({
      where: { id: zoneId },
      select: { baselineSafetyScore: true, finalSafetyScore: true, scoreSource: true },
    }),
  ])

  if (!zone) return null

  const { score: liveScore, observationCount } = computeLiveSafetyScore(
    feedback.map((f) => f.rating),
    approvedReportsCount
  )

  const { finalScore, confidence } = combineFinalScore(zone.baselineSafetyScore, liveScore, observationCount)

  // Nothing computable (no baseline, no live signal yet) — keep existing values,
  // do not overwrite with null.
  if (finalScore === null) return zone.finalSafetyScore

  const baseSource = (zone.scoreSource ?? 'no-baseline').replace(/\+live\(n=\d+\)$/, '')
  const nextSource = observationCount > 0 ? `${baseSource}+live(n=${observationCount})` : baseSource

  await prisma.zone.update({
    where: { id: zoneId },
    data: {
      liveSafetyScore: liveScore,
      finalSafetyScore: finalScore,
      scoreConfidence: confidence,
      scoreSource: nextSource,
      scoreUpdatedAt: new Date(),
    },
  })

  return finalScore
}
