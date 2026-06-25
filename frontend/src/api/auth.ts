import { api } from './client'

export interface AuthResponse {
  user: {
    id: string
    name: string
    email: string
    role: string
    plan: string
    onboardingCompleted: boolean
    createdAt: string
    emailVerified?: boolean
    emailVerifiedAt?: string | null
  }
  accessToken: string
  refreshToken: string
}

export function register(name: string, email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/register', { name, email, password }, { skipAuth: true })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/login', { email, password }, { skipAuth: true })
}

export function me(): Promise<{ user: AuthResponse['user'] }> {
  return api.get<{ user: AuthResponse['user'] }>('/api/auth/me')
}

export function logout(refreshToken: string): Promise<void> {
  return api.post<void>('/api/auth/logout', { refreshToken })
}
