const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const ACCESS_TOKEN_KEY = 'sr_access_token'
const REFRESH_TOKEN_KEY = 'sr_refresh_token'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (accessToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
    })
  } catch {
    throw new ApiError(0, 'Server non raggiungibile. Verifica che il backend sia avviato.')
  }

  // Handle 401 — attempt token refresh
  if (response.status === 401 && !skipAuth) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      throw new ApiError(401, 'Sessione scaduta. Effettua nuovamente il login.')
    }

    let refreshed = false
    try {
      const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        const newAccessToken: string = refreshData.data?.accessToken ?? refreshData.accessToken
        const newRefreshToken: string = refreshData.data?.refreshToken ?? refreshData.refreshToken

        if (newAccessToken) {
          localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken)
          if (newRefreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
          }
          refreshed = true
        }
      }
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      throw new ApiError(0, 'Server non raggiungibile durante il refresh della sessione.')
    }

    if (!refreshed) {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      throw new ApiError(401, 'Sessione scaduta. Effettua nuovamente il login.')
    }

    // Retry original request with new token
    const newToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const retryResponse = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      },
    })

    const retryData = await retryResponse.json().catch(() => ({}))
    if (!retryResponse.ok) {
      throw new ApiError(retryResponse.status, retryData.error ?? 'Errore')
    }
    return retryData.data as T
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'Errore')
  }

  return data.data as T
}

export const api = {
  get<T>(path: string, options?: RequestInit & { skipAuth?: boolean }): Promise<T> {
    return request<T>(path, { method: 'GET', ...options })
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: RequestInit & { skipAuth?: boolean },
  ): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    })
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: RequestInit & { skipAuth?: boolean },
  ): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    })
  },

  delete<T>(path: string, body?: object, options?: RequestInit & { skipAuth?: boolean }): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    })
  },
}
