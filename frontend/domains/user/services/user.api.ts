import type { AuthUser, UpdateProfileInput } from "@restack/shared"
import { apiClient } from "@/shared/lib/api-client"

/**
 * Service API layer for the User domain.
 * Thin wrappers that perform API calls to the Hono backend endpoints.
 * 
 * Semi-DDD rules:
 * - Domain services (`domains/[feature]/services/*.api.ts`) handle only raw HTTP calls.
 * - They must not contain UI state or react state; delegate that strictly to domain hooks.
 * - Request and response structures are mapped using schemas shared from `@restack/shared`.
 */
export const userApi = {
  me: () => apiClient<{ user: AuthUser }>("/api/user/me"),

  updateProfile: (data: UpdateProfileInput) =>
    apiClient<{ user: AuthUser }>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
}
