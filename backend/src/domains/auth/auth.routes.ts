import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { LoginSchema, RegisterSchema } from "@restack/shared"
import { authService } from "./auth.service.js"
import { env } from "../../config/env.js"

const isProduction = env.NODE_ENV === "production"
const sameSite = env.COOKIE_SAME_SITE || (isProduction ? "None" : "Lax")
const secure = sameSite === "None" ? true : isProduction

const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export const authRoutes = new Hono()

authRoutes.post("/register", zValidator("json", RegisterSchema), async (c) => {
  try {
    const body = c.req.valid("json")
    const user = await authService.register(body)
    return c.json({ user }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

authRoutes.post("/login", zValidator("json", LoginSchema), async (c) => {
  try {
    const body = c.req.valid("json")
    const { token, user } = await authService.login(body)
    c.header("Set-Cookie", `token=${token}; Path=${cookieOptions.path}; Max-Age=${cookieOptions.maxAge}; HttpOnly${cookieOptions.secure ? "; Secure" : ""}; SameSite=${cookieOptions.sameSite}`)
    return c.json({ user })
  } catch (e: any) {
    return c.json({ error: e.message }, 401)
  }
})

authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", `token=; Path=/; Max-Age=0; HttpOnly; SameSite=${isProduction ? "None" : "Lax"}${isProduction ? "; Secure" : ""}`)
  return c.json({ success: true })
})
