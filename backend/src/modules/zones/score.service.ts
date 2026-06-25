import { prisma } from '@/config/database.js'

// Compute safety score from last-30-day data for a zone.
// Returns null if insufficient data (< 3 total events).
export function computeSafetyScore(
  feedbackRatings: number[],
  approvedReportsCount: number
): number | null {
  const total = feedbackRatings.length + approvedReportsCount
  if (total < 3) return null

  // Map average rating to 0–100: rating 1 → 0, 5 → 100
  // If no feedback, use neutral 3.8 as base
  const avgRating =
    feedbackRatings.length > 0
      ? feedbackRatings.reduce((a, b) => a + b, 0) / feedbackRatings.length
      : 3.8

  const ratingScore = ((avgRating - 1) / 4) * 100
  const reportPenalty = Math.min(approvedReportsCount * 5, 25)
  return Math.max(0, Math.min(100, Math.round(ratingScore - reportPenalty)))
}

// Recalculate and persist zone.safetyScore based on 30-day data.
// Called after every new feedback submission.
// Returns the new safetyScore (may be null if data insufficient — keeps existing score then).
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
    prisma.zone.findUnique({ where: { id: zoneId }, select: { safetyScore: true } }),
  ])

  if (!zone) return null

  const computed = computeSafetyScore(
    feedback.map((f) => f.rating),
    approvedReportsCount
  )

  // If insufficient data, keep stored score — do not overwrite with null
  if (computed === null) return zone.safetyScore

  await prisma.zone.update({
    where: { id: zoneId },
    data: { safetyScore: computed },
  })

  return computed
}
