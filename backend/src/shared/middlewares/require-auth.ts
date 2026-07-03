import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import { authService } from "../../domains/auth/auth.service.js"
import type { AuthTokenPayload } from "../../domains/auth/auth.types.js"

export type AuthVariables = { user: AuthTokenPayload }

/**
 * Authentication guard middleware.
 * Enforces the presence and validity of the short-lived JWT access token in request cookies.
 * Resolves the payload and binds it to Hono context variables (`c.get("user")`).
 * 
 * Usage:
 * Apply to any endpoint requiring authentication (e.g. `userRoutes.get("/me", requireAuth, ...)`).
 */
export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  // Extract token from cookie (JWT)
  const token = getCookie(c, "access_token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  try {
    // Decode and verify signature & expiration
    const payload = await authService.verifyAccessToken(token)
    c.set("user", payload)
  } catch {
    // Return standard 401 response on invalid / expired signature
    return c.json({ error: "Unauthorized" }, 401)
  }

  await next()
}
