import { prisma } from '@/config/database.js'
import { recalculateZoneScore } from './score.service.js'
import type { CreateFeedbackInput } from './feedback.schemas.js'

// Anti-abuse check: returns true if user already submitted feedback for this zone in last 30 days
export async function hasRecentFeedback(userId: string, zoneId: string): Promise<boolean> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const count = await prisma.zoneFeedback.count({
    where: {
      userId,
      zoneId,
      createdAt: { gte: thirtyDaysAgo },
    },
  })
  return count > 0
}

// Create a new feedback and trigger score recalculation
export async function createFeedback(
  userId: string,
  zoneId: string,
  input: CreateFeedbackInput
): Promise<{ feedbackId: string; newScore: number | null }> {
  // Verify zone exists
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } })
  if (!zone) throw new Error('ZONE_NOT_FOUND')

  // Anti-abuse check
  const alreadySubmitted = await hasRecentFeedback(userId, zoneId)
  if (alreadySubmitted) throw new Error('DUPLICATE_FEEDBACK')

  const feedback = await prisma.zoneFeedback.create({
    data: {
      userId,
      zoneId,
      rating: input.rating,
      note: input.note ?? null,
    },
  })

  const newScore = await recalculateZoneScore(zoneId)
  return { feedbackId: feedback.id, newScore }
}

// Aggregate feedback summary for a zone (public, no user info)
export async function getFeedbackSummary(zoneId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const feedback = await prisma.zoneFeedback.findMany({
    where: { zoneId, createdAt: { gte: thirtyDaysAgo } },
    select: { rating: true },
  })

  const count = feedback.length
  const averageRating =
    count > 0
      ? Math.round((feedback.reduce((s, f) => s + f.rating, 0) / count) * 10) / 10
      : null

  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  for (const f of feedback) {
    distribution[String(f.rating)] = (distribution[String(f.rating)] ?? 0) + 1
  }

  return { feedbackCount: count, averageRating, distribution }
}
