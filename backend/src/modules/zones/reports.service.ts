import { prisma } from '@/config/database.js'
import type { CreateReportInput } from './reports.schemas.js'

// Create a new report (status = 'pending')
// Reports do NOT immediately change the safety score — only approved ones count
export async function createReport(
  userId: string | null,
  zoneId: string,
  input: CreateReportInput
): Promise<{ reportId: string }> {
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } })
  if (!zone) throw new Error('ZONE_NOT_FOUND')

  const report = await prisma.report.create({
    data: {
      userId: userId ?? null,
      zoneId,
      category: input.category,
      description: input.description ?? null,
      status: 'pending',
    },
  })

  return { reportId: report.id }
}

// Public summary of reports for a zone (last 30 days, no user info)
export async function getReportsSummary(zoneId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [pending, approved] = await Promise.all([
    prisma.report.count({ where: { zoneId, status: 'pending', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.report.count({ where: { zoneId, status: 'approved', createdAt: { gte: thirtyDaysAgo } } }),
  ])

  // Aggregate by category (approved only — public view)
  const byCategory = await prisma.report.groupBy({
    by: ['category'],
    _count: { id: true },
    where: { zoneId, status: 'approved', createdAt: { gte: thirtyDaysAgo } },
  })

  const categories: Record<string, number> = {}
  for (const row of byCategory) {
    categories[row.category] = row._count.id
  }

  return { pendingCount: pending, approvedCount: approved, categories }
}
