import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import { authService } from "../../domains/auth/auth.service.js"
import type { AuthTokenPayload } from "../../domains/auth/auth.types.js"

export type AuthVariables = { user: AuthTokenPayload }

export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const token = getCookie(c, "access_token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  try {
    const payload = await authService.verifyAccessToken(token)
    c.set("user", payload)
  } catch {
    return c.json({ error: "Unauthorized" }, 401)
  }

  await next()
}
