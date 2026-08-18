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
