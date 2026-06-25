import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import * as authApi from '@/api/auth'
import * as profileApi from '@/api/profile'

const USER_KEY = 'sr_user'
const ACCESS_TOKEN_KEY = 'sr_access_token'
const REFRESH_TOKEN_KEY = 'sr_refresh_token'

export const useAuthStore = defineStore('auth', () => {
  // Ripristina utente dal localStorage al boot
  const storedUser = localStorage.getItem(USER_KEY)
  const user = ref<User | null>(storedUser ? (JSON.parse(storedUser) as User) : null)
  const isInitialized = ref(false)
  const isLoading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'STAFF')
  const hasCompletedOnboarding = computed(() => user.value?.onboardingCompleted ?? false)

  function setUser(newUser: User | null) {
    user.value = newUser
    if (newUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }

  function setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  function clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  // Inizializza: verifica sessione al boot dell'app
  async function init() {
    const hasToken = !!localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!hasToken) {
      isInitialized.value = true
      return
    }

    // In DEV: se il token è un mock, non verificare con il backend
    if (import.meta.env.DEV && localStorage.getItem(ACCESS_TOKEN_KEY)?.startsWith('mock_')) {
      isInitialized.value = true
      return
    }

    try {
      const { user: serverUser } = await authApi.me()
      setUser({
        ...serverUser,
        role: serverUser.role as User['role'],
        plan: serverUser.plan as User['plan'],
        emailVerified: serverUser.emailVerified ?? false,
        emailVerifiedAt: serverUser.emailVerifiedAt ?? null,
      })
    } catch {
      // Token scaduto o non valido (anche dopo refresh fallito)
      clearTokens()
      user.value = null
    } finally {
      isInitialized.value = true
    }
  }

  async function login(email: string, password: string) {
    isLoading.value = true
    try {
      const result = await authApi.login(email, password)
      setTokens(result.accessToken, result.refreshToken)
      setUser({
        ...result.user,
        role: result.user.role as User['role'],
        plan: result.user.plan as User['plan'],
        emailVerified: result.user.emailVerified ?? false,
        emailVerifiedAt: result.user.emailVerifiedAt ?? null,
      })
    } finally {
      isLoading.value = false
    }
  }

  async function register(name: string, email: string, password: string) {
    isLoading.value = true
    try {
      const result = await authApi.register(name, email, password)
      setTokens(result.accessToken, result.refreshToken)
      setUser({
        ...result.user,
        role: result.user.role as User['role'],
        plan: result.user.plan as User['plan'],
        emailVerified: result.user.emailVerified ?? false,
        emailVerifiedAt: result.user.emailVerifiedAt ?? null,
      })
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } catch {
      // Logout lato server fallito — puliamo comunque il client
    } finally {
      clearTokens()
      user.value = null
    }
  }

  async function completeOnboarding() {
    try {
      await profileApi.completeOnboarding()
    } catch {
      // Continua anche se l'API fallisce
    }
    if (user.value) {
      setUser({ ...user.value, onboardingCompleted: true })
    }
  }

  function getInitials(): string {
    if (!user.value) return '?'
    return user.value.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('')
  }

  // Mock shortcuts per DEV — non rimuovere
  function loginAsMockUser() {
    const mockUser: User = {
      id: 'mock_user_1',
      name: 'Giulia Ferretti',
      email: 'giulia@example.com',
      role: 'USER',
      plan: 'FREE',
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
    }
    setUser(mockUser)
    localStorage.setItem(ACCESS_TOKEN_KEY, 'mock_access_token')
    localStorage.setItem(REFRESH_TOKEN_KEY, 'mock_refresh_token')
  }

  function loginAsMockAdmin() {
    const mockAdmin: User = {
      id: 'mock_admin_1',
      name: 'Marco Rossi',
      email: 'admin@saferoute.it',
      role: 'ADMIN',
      plan: 'PREMIUM',
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
    }
    setUser(mockAdmin)
    localStorage.setItem(ACCESS_TOKEN_KEY, 'mock_access_token_admin')
    localStorage.setItem(REFRESH_TOKEN_KEY, 'mock_refresh_token_admin')
  }

  function updateUser(partial: Partial<User>) {
    if (user.value) {
      setUser({ ...user.value, ...partial })
    }
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    hasCompletedOnboarding,
    isInitialized,
    isLoading,
    init,
    login,
    register,
    logout,
    completeOnboarding,
    updateUser,
    getInitials,
    loginAsMockUser,
    loginAsMockAdmin,
  }
})
