import { Hono } from "hono"
import type { Context } from "hono"
import { zValidator } from "@hono/zod-validator"
import { UpdateProfileSchema } from "@restack/shared"
import type { AuthVariables } from "../../shared/middlewares/require-auth.js"
import { requireAuth } from "../../shared/middlewares/require-auth.js"
import { userService, UserNotFoundError } from "./user.service.js"
import { rateLimit } from "../../shared/middlewares/rate-limit.js"
import { logger } from "../../shared/logger/logger.js"

export const userRoutes = new Hono<{ Variables: AuthVariables }>()

// Only UserNotFoundError is an expected, safe-to-expose outcome. Anything else (DB/driver
// errors, etc.) gets logged with detail but returned to the caller as a generic 500 —
// leaking raw error messages/mislabeling unexpected failures as 404 would be misleading.
const handleProfileError = (c: Context, e: unknown, action: string) => {
  if (e instanceof UserNotFoundError) return c.json({ error: e.message }, 404)
  logger.error({ err: e instanceof Error ? e.message : String(e) }, action)
  return c.json({ error: "Internal server error" }, 500)
}

userRoutes.get("/me", requireAuth, async (c) => {
  try {
    const profile = await userService.getProfile(c.get("user").sub)
    return c.json({ user: profile })
  } catch (e) {
    return handleProfileError(c, e, "Get profile failed")
  }
})

userRoutes.put("/profile", requireAuth, rateLimit, zValidator("json", UpdateProfileSchema), async (c) => {
  try {
    const body = c.req.valid("json")
    const profile = await userService.updateProfile(c.get("user").sub, body)
    return c.json({ user: profile })
  } catch (e) {
    return handleProfileError(c, e, "Update profile failed")
  }
})
