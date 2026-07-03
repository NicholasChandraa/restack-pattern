const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

interface ApiErrorBody {
  error?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  })

  const contentType = res.headers.get("content-type")
  const data: unknown =
    contentType && contentType.includes("application/json")
      ? await res.json()
      : { error: (await res.text()) || "Request failed" }

  if (!res.ok) throw new ApiError((data as ApiErrorBody).error ?? "Request failed", res.status)
  return data as T
}

// The refresh token is single-use (backend rotates it atomically), so if several
// requests 401 at once they must share one refresh call, not each fire their own —
// only the first would succeed and the rest would wrongly fail as "logged out".
let refreshPromise: Promise<unknown> | null = null

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = request("/api/auth/refresh", { method: "POST" }).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function apiClient<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  try {
    return await request<T>(path, options)
  } catch (e) {
    // The access_token cookie is short-lived by design (15m). On a 401, silently
    // exchange the refresh_token for a new pair once, then retry the original call.
    // Auth routes are excluded so a failed refresh can't loop back into itself.
    const isAuthRoute = path.startsWith("/api/auth/")
    if (e instanceof ApiError && e.status === 401 && !isAuthRoute) {
      await refreshSession()
      return request<T>(path, options)
    }
    throw e
  }
}
