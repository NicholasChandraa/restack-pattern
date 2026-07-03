import type { AuthUser, LoginInput, RegisterInput } from "@restack/shared"
import { apiClient } from "@/shared/lib/api-client"

/**
 * Service API layer for the Auth domain.
 * Thin wrappers that perform API calls to the Hono backend endpoints.
 * 
 * Semi-DDD rules:
 * - Domain services (`domains/[feature]/services/*.api.ts`) handle only raw HTTP calls.
 * - Request and response structures are mapped using schemas shared from `@restack/shared`.
 */
export const authApi = {
  register: (data: RegisterInput) =>
    apiClient<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput) =>
    apiClient<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiClient<{ success: boolean }>("/api/auth/logout", { method: "POST" }),
}
