import { api } from './client'

export interface FeedbackResult {
  feedbackId: string
  newScore: number | null
}

export interface FeedbackSummary {
  feedbackCount: number
  averageRating: number | null
  distribution: Record<string, number>
}

export async function submitFeedback(
  zoneId: string,
  payload: { rating: number; note?: string }
): Promise<FeedbackResult> {
  return api.post<FeedbackResult>(`/api/zones/${zoneId}/feedback`, payload)
}

export async function fetchFeedbackSummary(zoneId: string): Promise<FeedbackSummary> {
  return api.get<FeedbackSummary>(`/api/zones/${zoneId}/feedback-summary`, { skipAuth: true })
}
