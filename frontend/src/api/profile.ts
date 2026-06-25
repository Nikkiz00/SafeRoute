import { api } from './client'
import type { User } from '@/types'

export function getProfile(): Promise<{ user: User }> {
  return api.get<{ user: User }>('/api/profile')
}

export function updateProfile(data: { name?: string }): Promise<{ user: User }> {
  return api.patch<{ user: User }>('/api/profile', data)
}

export function completeOnboarding(): Promise<{ message: string }> {
  return api.patch<{ message: string }>('/api/profile/onboarding', {})
}

export function changeEmail(data: { newEmail: string; password: string }): Promise<{ user: User }> {
  return api.patch<{ user: User }>('/api/profile/email', data)
}

export function changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
  return api.patch<{ message: string }>('/api/profile/password', data)
}

export function deleteAccount(data: { password: string }): Promise<{ message: string }> {
  return api.delete<{ message: string }>('/api/profile', data)
}

export function resendVerification(): Promise<{ message: string; sent: boolean; skipped?: boolean }> {
  return api.post<{ message: string; sent: boolean; skipped?: boolean }>('/api/auth/resend-verification', {})
}

export function verifyEmail(token: string): Promise<{ message: string }> {
  return api.get<{ message: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
}
