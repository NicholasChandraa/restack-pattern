import type { LoginInput, RegisterInput } from "@restack/shared"
import { apiClient } from "@/shared/lib/api-client"

interface AuthUser {
  id: string
  name: string
  email: string
}

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
