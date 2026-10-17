import { hc } from "hono/client"
import { env } from "@/env"
import type { AppType } from "../../backend/src/hono-app"

const BASE_URL = env.NEXT_PUBLIC_API_URL

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

// In-memory Bearer token storage (for mobile clients, native apps, or Bearer auth mode)
let bearerToken: string | null = null

export const setAuthToken = (token: string | null) => {
  bearerToken = token
}

export const getAuthToken = () => bearerToken

// Share a single refresh request promise to prevent TOCTOU race conditions
let refreshPromise: Promise<Response> | null = null

function refreshSession() {
  if (!refreshPromise) {
    const headers: Record<string, string> = {}
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`
    }
    refreshPromise = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers,
    }).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

const customFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers)

  if (bearerToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearerToken}`)
  }

  const newInit: RequestInit = {
    ...init,
    credentials: "include" as const,
    headers,
  }

  const res = await fetch(input, newInit)

  // Silently rotate access token on 401, unless it's the auth endpoints themselves
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
  const isAuthRoute = url.includes("/api/auth/")

  if (res.status === 401 && !isAuthRoute) {
    const refreshRes = await refreshSession()
    if (refreshRes.ok) {
      try {
        const data = (await refreshRes.clone().json()) as { accessToken?: string }
        if (data.accessToken && bearerToken) {
          bearerToken = data.accessToken
          headers.set("Authorization", `Bearer ${bearerToken}`)
        }
      } catch {
        // ignore JSON parse error
      }
      // Retry the original request
      return fetch(input, { ...newInit, headers })
    }
  }

  return res
}

// Expose the Hono RPC client
export const client = hc<AppType>(BASE_URL, { fetch: customFetch })

interface ApiErrorBody {
  error?: string
}

interface RpcResult {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

// Unwrap Hono RPC response helper to parse JSON or throw formatted ApiError
export async function unwrap<T>(promise: Promise<RpcResult>): Promise<T> {
  const res = await promise
  if (!res.ok) {
    let errorMsg = "Request failed"
    try {
      const data = (await res.json()) as ApiErrorBody
      errorMsg = data.error ?? errorMsg
    } catch {
      // fallback
    }
    throw new ApiError(errorMsg, res.status)
  }
  return res.json() as Promise<T>
}
