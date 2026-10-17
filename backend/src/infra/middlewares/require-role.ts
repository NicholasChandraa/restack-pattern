import type { MiddlewareHandler } from "hono"
import type { AppVariables } from "../../utils/logger.js"

/**
 * Role-Based Access Control (RBAC) guard middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Must be mounted AFTER `requireAuth` in the middleware chain.
 *
 * @param allowedRoles List of roles permitted to access the route (e.g. "admin", "moderator")
 * @returns 401 if user is not authenticated, 403 if user lacks required role, otherwise calls next()
 */
export const requireRole = (
  ...allowedRoles: string[]
): MiddlewareHandler<{ Variables: AppVariables }> => {
  return async (c, next) => {
    const user = c.get("user")
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    if (!allowedRoles.includes(user.role)) {
      const reqLogger = c.get("logger")
      if (reqLogger) {
        reqLogger.warn(
          { userId: user.sub, userRole: user.role, requiredRoles: allowedRoles },
          "Access forbidden: insufficient role permissions",
        )
      }
      return c.json({ error: "Forbidden: insufficient permissions" }, 403)
    }

    return await next()
  }
}
