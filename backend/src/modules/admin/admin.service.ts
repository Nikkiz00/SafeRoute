import { prisma } from '@/config/database.js'
import { recalculateZoneScore } from '../zones/score.service.js'
import { createAuditLog } from '@/utils/audit.utils.js'
import type {
  AdminOverview, AdminUserSummary, AdminSOSSummary,
  AdminReportSummary, AdminFeedbackSummary, AdminZoneSummary,
  AdminAuditSummary, PaginatedResult,
} from './admin.types.js'

const thirtyDaysAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

function paginate(page: number, limit: number) {
  return { skip: (Math.max(1, page) - 1) * limit, take: Math.min(100, limit) }
}

// ── Overview ─────────────────────────────────────────────────────────────────

export async function getOverview(): Promise<AdminOverview> {
  const now30 = thirtyDaysAgo()
  const [
    totalUsers,
    registeredLast30d,
    sosCasesLast30d,
    reportsPending,
    feedbackLast30d,
    activeZones,
    failedNotificationsLast30d,
    citiesServed,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: now30 } } }),
    prisma.sOSAlert.count({ where: { createdAt: { gte: now30 } } }),
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.zoneFeedback.count({ where: { createdAt: { gte: now30 } } }),
    prisma.zone.count({ where: { isServiceActive: true } }),
    prisma.notificationLog.count({ where: { status: 'failed', createdAt: { gte: now30 } } }),
    prisma.city.count({ where: { isActive: true } }),
  ])
  return {
    totalUsers, registeredLast30d, sosCasesLast30d, reportsPending,
    feedbackLast30d, activeZones, failedNotificationsLast30d, citiesServed,
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function listUsers(params: {
  page: number; limit: number; role?: string; includeDeleted?: boolean
}): Promise<PaginatedResult<AdminUserSummary>> {
  const { page, limit, role, includeDeleted } = params
  const where: Record<string, unknown> = {}
  if (!includeDeleted) where.deletedAt = null
  if (role) where.role = role

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, plan: true, onboardingCompleted: true, createdAt: true, deletedAt: true },
      orderBy: { createdAt: 'desc' },
      ...paginate(page, limit),
    }),
    prisma.user.count({ where }),
  ])

  return {
    items: users.map(u => ({ ...u, role: u.role as string, plan: u.plan as string, createdAt: u.createdAt.toISOString(), deletedAt: u.deletedAt?.toISOString() ?? null })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  }
}

export async function getUserById(id: string): Promise<(AdminUserSummary & { routeCount: number; sosCount: number; feedbackCount: number }) | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, plan: true,
      onboardingCompleted: true, createdAt: true, deletedAt: true,
      _count: { select: { routeSessions: true, sosAlerts: true, zoneFeedback: true } },
    },
  })
  if (!user) return null
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role as string, plan: user.plan as string,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
    routeCount: user._count.routeSessions,
    sosCount: user._count.sosAlerts,
    feedbackCount: user._count.zoneFeedback,
  }
}

export async function updateUserStatus(adminId: string, userId: string, action: 'delete' | 'restore'): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  const deletedAt = action === 'delete' ? new Date() : null
  await prisma.user.update({ where: { id: userId }, data: { deletedAt } })
  await createAuditLog({
    adminId, action: 'user_status_change', targetType: 'user', targetId: userId,
    previousValue: { deletedAt: user.deletedAt },
    newValue: { deletedAt },
  })
  return true
}

export async function updateUserRole(adminId: string, userId: string, role: string): Promise<boolean> {
  const validRoles = ['USER', 'ADMIN', 'STAFF', 'FAMILY']
  if (!validRoles.includes(role)) return false
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  await prisma.user.update({ where: { id: userId }, data: { role: role as any } })
  await createAuditLog({
    adminId, action: 'user_role_change', targetType: 'user', targetId: userId,
    previousValue: { role: user.role },
    newValue: { role },
  })
  return true
}

// ── SOS ──────────────────────────────────────────────────────────────────────

export async function listSOS(params: {
  page: number; limit: number; status?: string
}): Promise<PaginatedResult<AdminSOSSummary>> {
  const { page, limit, status } = params
  const where = status ? { status } : {}

  const [alerts, total] = await Promise.all([
    prisma.sOSAlert.findMany({
      where,
      include: {
        user: { select: { name: true } },
        followup: { select: { response: true } },
        routeSession: { select: { trackingToken: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginate(page, limit),
    }),
    prisma.sOSAlert.count({ where }),
  ])

  return {
    items: alerts.map(a => ({
      id: a.id, status: a.status, lat: a.lat, lng: a.lng, message: a.message,
      createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null,
      userId: a.userId, userName: a.user.name,
      followupResponse: a.followup?.response ?? null,
      trackingToken: a.routeSession?.trackingToken ?? null,
    })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  }
}

export async function getSOSById(id: string): Promise<(AdminSOSSummary & { notificationLogs: unknown[] }) | null> {
  const alert = await prisma.sOSAlert.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      followup: true,
      routeSession: { select: { trackingToken: true } },
      notificationLogs: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!alert) return null
  return {
    id: alert.id, status: alert.status, lat: alert.lat, lng: alert.lng, message: alert.message,
    createdAt: alert.createdAt.toISOString(), resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    userId: alert.userId, userName: alert.user.name,
    followupResponse: alert.followup?.response ?? null,
    trackingToken: alert.routeSession?.trackingToken ?? null,
    notificationLogs: alert.notificationLogs.map(l => ({
      channel: (l as any).channel, recipient: (l as any).recipient,
      status: (l as any).status, provider: (l as any).provider,
      errorMessage: (l as any).errorMessage, createdAt: (l as any).createdAt.toISOString(),
    })),
  }
}

// ── Reports ──────────────────────────────────────────────────────────────────

export async function listReports(params: {
  page: number; limit: number; status?: string
}): Promise<PaginatedResult<AdminReportSummary>> {
  const { page, limit, status } = params
  const where = status ? { status } : {}

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        zone: { select: { name: true, city: { select: { name: true } } } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginate(page, limit),
    }),
    prisma.report.count({ where }),
  ])

  return {
    items: reports.map(r => ({
      id: r.id, category: r.category, description: r.description,
      status: r.status, createdAt: r.createdAt.toISOString(),
      zoneId: r.zoneId, zoneName: r.zone.name, cityName: r.zone.city.name,
      userId: r.userId, userName: r.user?.name ?? null,
    })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  }
}

export async function getReportById(id: string): Promise<AdminReportSummary | null> {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      zone: { select: { name: true, city: { select: { name: true } } } },
      user: { select: { name: true } },
    },
  })
  if (!report) return null
  return {
    id: report.id, category: report.category, description: report.description,
    status: report.status, createdAt: report.createdAt.toISOString(),
    zoneId: report.zoneId, zoneName: report.zone.name, cityName: report.zone.city.name,
    userId: report.userId, userName: report.user?.name ?? null,
  }
}

export async function moderateReport(adminId: string, reportId: string, status: 'approved' | 'rejected'): Promise<{ success: boolean; newScore: number | null }> {
  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return { success: false, newScore: null }

  await prisma.report.update({ where: { id: reportId }, data: { status } })
  await createAuditLog({
    adminId,
    action: status === 'approved' ? 'report_approve' : 'report_reject',
    targetType: 'report', targetId: reportId,
    previousValue: { status: report.status },
    newValue: { status },
  })

  let newScore: number | null = null
  if (status === 'approved') {
    newScore = await recalculateZoneScore(report.zoneId)
  }

  return { success: true, newScore }
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export async function listFeedback(params: {
  page: number; limit: number
}): Promise<PaginatedResult<AdminFeedbackSummary>> {
  const { page, limit } = params
  const [feedback, total] = await Promise.all([
    prisma.zoneFeedback.findMany({
      include: {
        zone: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginate(page, limit),
    }),
    prisma.zoneFeedback.count(),
  ])

  return {
    items: feedback.map(f => ({
      id: f.id, rating: f.rating, note: f.note, createdAt: f.createdAt.toISOString(),
      zoneId: f.zoneId, zoneName: f.zone.name, userId: f.userId, userName: f.user.name,
    })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  }
}

// ── Zones ─────────────────────────────────────────────────────────────────────

export async function listZonesAdmin(params: {
  page: number; limit: number
}): Promise<PaginatedResult<AdminZoneSummary>> {
  const { page, limit } = params
  const now30 = thirtyDaysAgo()

  const [zones, total, feedbackGroups, reportGroups] = await Promise.all([
    prisma.zone.findMany({
      include: { city: { select: { name: true } } },
      orderBy: [{ isServiceActive: 'desc' }, { updatedAt: 'desc' }],
      ...paginate(page, limit),
    }),
    prisma.zone.count(),
    prisma.zoneFeedback.groupBy({
      by: ['zoneId'], _count: { id: true },
      where: { createdAt: { gte: now30 } },
    }),
    prisma.report.groupBy({
      by: ['zoneId'], _count: { id: true },
      where: { status: 'approved', createdAt: { gte: now30 } },
    }),
  ])

  const feedbackMap = new Map(feedbackGroups.map(g => [g.zoneId, g._count.id]))
  const reportMap = new Map(reportGroups.map(g => [g.zoneId, g._count.id]))

  return {
    items: zones.map(z => ({
      id: z.id, name: z.name, type: z.type,
      isServiceActive: z.isServiceActive, finalSafetyScore: z.finalSafetyScore,
      cityId: z.cityId, cityName: z.city.name,
      feedbackCount30d: feedbackMap.get(z.id) ?? 0,
      reportsCount30d: reportMap.get(z.id) ?? 0,
    })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  }
}

export async function updateZoneServiceStatus(adminId: string, zoneId: string, isServiceActive: boolean): Promise<boolean> {
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } })
  if (!zone) return false
  await prisma.zone.update({ where: { id: zoneId }, data: { isServiceActive } })
  await createAuditLog({
    adminId, action: 'zone_service_status_change', targetType: 'zone', targetId: zoneId,
    previousValue: { isServiceActive: zone.isServiceActive },
    newValue: { isServiceActive },
  })
  return true
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export async function listAuditLogs(params: {
  page: number; limit: number
}): Promise<PaginatedResult<AdminAuditSummary>> {
  const { page, limit } = params
  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      ...paginate(page, limit),
    }),
    prisma.adminAuditLog.count(),
  ])

  return {
    items: logs.map(l => ({
      id: l.id, action: l.action, targetType: l.targetType, targetId: l.targetId,
      previousValue: l.previousValue, newValue: l.newValue,
      createdAt: l.createdAt.toISOString(),
      adminId: l.adminId, adminName: l.admin.name,
    })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  }
}
