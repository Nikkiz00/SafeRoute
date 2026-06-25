export interface NotificationResult {
  contactId: string
  name: string
  channels: Array<{
    channel: 'email' | 'sms'
    status: 'sent' | 'failed' | 'skipped'
    provider: string
    recipient: string
  }>
}

export type SOSNotificationStatus = 'sent' | 'partial' | 'failed' | 'no_contacts'

export interface SOSResponse {
  sosId: string
  trackingUrl: string
  trackingToken: string
  notifiedContacts: NotificationResult[]
  notificationStatus: SOSNotificationStatus
}

export interface SOSDetail {
  id: string
  status: 'active' | 'resolved'
  lat: number
  lng: number
  message: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedFeedback: string | null
  routeSessionId: string | null
  trackingUrl: string | null
  followup: {
    response: string
    respondedAt: string
    notes: string | null
  } | null
}
