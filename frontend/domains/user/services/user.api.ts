import type { AuthUser, UpdateProfileInput } from "@restack/shared"
import { apiClient } from "@/shared/lib/api-client"

export const userApi = {
  me: () => apiClient<{ user: AuthUser }>("/api/user/me"),

  updateProfile: (data: UpdateProfileInput) =>
    apiClient<{ user: AuthUser }>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
}
