import { api } from './client'

export interface AdminOverview {
  totalUsers: number
  registeredLast30d: number
  sosCasesLast30d: number
  reportsPending: number
  feedbackLast30d: number
  activeZones: number
  failedNotificationsLast30d: number
  citiesServed: number
}

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  role: string
  plan: string
  onboardingCompleted: boolean
  createdAt: string
  deletedAt: string | null
}

export interface AdminSOSSummary {
  id: string
  status: string
  lat: number
  lng: number
  message: string | null
  createdAt: string
  resolvedAt: string | null
  userId: string
  userName: string
  followupResponse: string | null
  trackingToken: string | null
}

export interface AdminReportSummary {
  id: string
  category: string
  description: string | null
  status: string
  createdAt: string
  zoneId: string
  zoneName: string
  cityName: string
  userId: string | null
  userName: string | null
}

export interface AdminFeedbackSummary {
  id: string
  rating: number
  note: string | null
  createdAt: string
  zoneId: string
  zoneName: string
  userId: string
  userName: string
}

export interface AdminZoneSummary {
  id: string
  name: string
  type: string
  isServiceActive: boolean
  finalSafetyScore: number | null
  cityId: string
  cityName: string
  feedbackCount30d: number
  reportsCount30d: number
}

export interface AdminAuditSummary {
  id: string
  action: string
  targetType: string
  targetId: string
  previousValue: unknown | null
  newValue: unknown | null
  createdAt: string
  adminId: string
  adminName: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function buildQS(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') {
      qs.set(key, String(val))
    }
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

export const adminApi = {
  getOverview(): Promise<AdminOverview> {
    return api.get<AdminOverview>('/api/admin/overview')
  },

  listUsers(params?: { page?: number; limit?: number; role?: string; includeDeleted?: boolean }): Promise<PaginatedResult<AdminUserSummary>> {
    const qs = buildQS({
      page: params?.page,
      limit: params?.limit,
      role: params?.role,
      includeDeleted: params?.includeDeleted,
    })
    return api.get<PaginatedResult<AdminUserSummary>>(`/api/admin/users${qs}`)
  },

  updateUserStatus(id: string, action: 'delete' | 'restore'): Promise<unknown> {
    return api.patch(`/api/admin/users/${id}/status`, { action })
  },

  updateUserRole(id: string, role: string): Promise<unknown> {
    return api.patch(`/api/admin/users/${id}/role`, { role })
  },

  listSOS(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResult<AdminSOSSummary>> {
    const qs = buildQS({
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
    })
    return api.get<PaginatedResult<AdminSOSSummary>>(`/api/admin/sos${qs}`)
  },

  listReports(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResult<AdminReportSummary>> {
    const qs = buildQS({
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
    })
    return api.get<PaginatedResult<AdminReportSummary>>(`/api/admin/reports${qs}`)
  },

  moderateReport(id: string, status: 'approved' | 'rejected'): Promise<{ success: boolean; newScore: number | null }> {
    return api.patch<{ success: boolean; newScore: number | null }>(`/api/admin/reports/${id}/status`, { status })
  },

  listFeedback(params?: { page?: number; limit?: number }): Promise<PaginatedResult<AdminFeedbackSummary>> {
    const qs = buildQS({
      page: params?.page,
      limit: params?.limit,
    })
    return api.get<PaginatedResult<AdminFeedbackSummary>>(`/api/admin/feedback${qs}`)
  },

  listZones(params?: { page?: number; limit?: number }): Promise<PaginatedResult<AdminZoneSummary>> {
    const qs = buildQS({
      page: params?.page,
      limit: params?.limit,
    })
    return api.get<PaginatedResult<AdminZoneSummary>>(`/api/admin/zones${qs}`)
  },

  updateZoneServiceStatus(id: string, isServiceActive: boolean): Promise<unknown> {
    return api.patch(`/api/admin/zones/${id}/service-status`, { isServiceActive })
  },

  listAuditLogs(params?: { page?: number; limit?: number }): Promise<PaginatedResult<AdminAuditSummary>> {
    const qs = buildQS({
      page: params?.page,
      limit: params?.limit,
    })
    return api.get<PaginatedResult<AdminAuditSummary>>(`/api/admin/audit-logs${qs}`)
  },
}
