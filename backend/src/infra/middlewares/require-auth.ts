import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import { authService } from "../../domains/auth/auth.service.js"
import type { AppVariables } from "../../utils/logger.js"

export type AuthMethod = "bearer" | "cookie"

export interface AuthVariables extends AppVariables {
  authMethod?: AuthMethod
}

/**
 * Authentication guard middleware.
 * Enforces the presence and validity of the short-lived JWT access token
 * from Authorization: Bearer <token> header or request cookies (Hybrid Auth).
 * Resolves the payload, binds it to Hono context variables (`c.get("user")`),
 * and attaches the authenticated userId and authMethod to the request logger context.
 *
 * Usage:
 * Apply to any endpoint requiring authentication (e.g. `userRoutes.get("/me", requireAuth, ...)`).
 */
export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  let token: string | undefined
  let authMethod: AuthMethod | undefined

  // 1. Inspect Authorization header (Bearer token) first
  const authHeader = c.req.header("Authorization") || c.req.header("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim()
    authMethod = "bearer"
  }

  // 2. Fall back to access_token cookie
  if (!token) {
    const cookieToken = getCookie(c, "access_token")
    if (cookieToken) {
      token = cookieToken
      authMethod = "cookie"
    }
  }

  if (!token || !authMethod) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    // Decode and verify signature & expiration
    const payload = await authService.verifyAccessToken(token)
    c.set("user", payload)
    c.set("authMethod", authMethod)

    // Enrich the child logger with the user's ID and authMethod for all downstream actions
    const reqLogger = c.get("logger")
    if (reqLogger) {
      c.set("logger", reqLogger.child({ userId: Number(payload.sub), authMethod }))
    }
  } catch {
    // Return standard 401 response on invalid / expired signature
    return c.json({ error: "Unauthorized" }, 401)
  }

  return await next()
}
