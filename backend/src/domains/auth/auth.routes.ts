import { Hono } from "hono"
import type { Context } from "hono"
import { setCookie, deleteCookie } from "hono/cookie"
import { randomUUID } from "node:crypto"
import { zValidator } from "@hono/zod-validator"
import { LoginSchema, RegisterSchema } from "@restack/shared"
import { authService } from "./auth.service.js"
import { env } from "../../config/env.js"
import { logger } from "../../shared/logger/logger.js"

const isProduction = env.NODE_ENV === "production"
const sameSite = env.COOKIE_SAME_SITE || (isProduction ? "None" : "Lax")
const secure = sameSite === "None" ? true : isProduction

const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite: sameSite as "Lax" | "None" | "Strict",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export const authRoutes = new Hono()

authRoutes.post("/register", zValidator("json", RegisterSchema), async (c) => {
  try {
    const body = c.req.valid("json")
    await authService.register(body)
    const { token, user } = await authService.login({ email: body.email, password: body.password })
    
    setCookie(c, "token", token, cookieOptions)
    
    return c.json({ user }, 201)
  } catch (e: any) {
    logger.error({ err: e.message }, "Register failed")
    return c.json({ error: e.message }, 400)
  }
})

authRoutes.post("/login", zValidator("json", LoginSchema), async (c) => {
  try {
    const body = c.req.valid("json")
    const { token, user } = await authService.login(body)
    
    setCookie(c, "token", token, cookieOptions)
    
    return c.json({ user })
  } catch (e: any) {
    logger.error({ err: e.message }, "Login failed")
    return c.json({ error: e.message }, 401)
  }
})

authRoutes.post("/logout", (c) => {
  deleteCookie(c, "token", {
    path: cookieOptions.path,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  })
  return c.json({ success: true })
})
