export type UserRole = 'USER' | 'ADMIN' | 'STAFF' | 'FAMILY'
export type UserPlan = 'FREE' | 'PREMIUM'
export type ZoneLevel = 'safe' | 'caution' | 'danger' | 'critical' | 'unknown'
export type SOSStatus = 'pending' | 'sent' | 'cancelled' | 'false_alarm'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  plan: UserPlan
  onboardingCompleted: boolean
  geolocationGranted?: boolean
  createdAt: string
  avatarInitials?: string
  emailVerified?: boolean
  emailVerifiedAt?: string | null
  pendingEmail?: string | null
}

export interface EmergencyContact {
  id: string
  userId: string
  name: string
  phone: string | null
  email: string | null
  isPrimary?: boolean
  notifiedOnAdd: boolean
  createdAt?: string
}

export type ZoneGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

export interface Zone {
  id: string
  name: string
  cityId: string
  cityName: string
  province: string | null
  region: string | null
  type: string
  isServiceActive: boolean
  // See docs/step-5-0-safety-data-baseline.md. finalSafetyScore is the score to
  // display/use everywhere (map color, routing) — the rest is provenance/debug info.
  finalSafetyScore: number | null
  baselineSafetyScore: number | null
  liveSafetyScore: number | null
  scoreConfidence: number | null
  scoreSource: string | null
  scoreReferenceYear: number | null
  level: ZoneLevel
  color: string
  feedbackCount: number
  reportsCount: number
  sosCount: number
  lastUpdated: string
  geometry: ZoneGeometry
}

export interface ZoneSafetySummary {
  zoneId: string
  zoneName: string
  cityId: string
  cityName: string
  isServiceActive: boolean
  finalSafetyScore: number | null
  baselineSafetyScore: number | null
  liveSafetyScore: number | null
  scoreConfidence: number | null
  scoreSource: string | null
  scoreReferenceYear: number | null
  level: ZoneLevel
  color: string
  feedbackCount: number
  reportsCount: number
  sosCount: number
  averageRating: number | null
  computedAt: string
}

export interface LocationPing {
  lat: number
  lng: number
  timestamp: string
  accuracy?: number
}

export interface RouteSession {
  id: string
  userId: string
  status: 'active' | 'completed' | 'cancelled' | 'sos'
  startedAt: string
  endedAt: string | null
  trackingToken: string
  trackingTokenExpiresAt: string
  shareEnabled: boolean
  shareUrl: string
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number } | null
  destinationName: string | null
  latestPosition: {
    lat: number
    lng: number
    accuracy: number | null
    timestamp: string
  } | null
}

export interface TrackingData {
  status: 'active' | 'completed' | 'cancelled' | 'sos'
  userName: string
  startedAt: string
  expiresAt: string
  shareEnabled: boolean
  lastPosition: {
    lat: number
    lng: number
    accuracy: number | null
    timestamp: string
  } | null
  sosMessage: string | null
}

export interface SOSAlert {
  id: string
  userId: string
  status: SOSStatus
  triggeredAt: string
  cancelledAt: string | null
  location: { lat: number; lng: number } | null
  locationAvailable: boolean
  message: string | null
  contactsNotified: string[]
  smsDelivered: boolean
  emailDelivered: boolean
}

export interface SOSNotificationChannel {
  channel: 'email' | 'sms'
  status: 'sent' | 'failed' | 'skipped'
  provider: string
  recipient: string
}

export interface SOSNotifiedContact {
  contactId: string
  name: string
  channels: SOSNotificationChannel[]
}

export type SOSNotificationStatus = 'sent' | 'partial' | 'failed' | 'no_contacts'

export interface SOSActivationResult {
  sosId: string
  trackingUrl: string
  trackingToken: string
  notifiedContacts: SOSNotifiedContact[]
  notificationStatus: SOSNotificationStatus
}

export interface SOSFollowupOption {
  value: 'false_alarm' | 'resolved' | 'still_danger' | 'no_response'
  label: string
  emoji: string
}
