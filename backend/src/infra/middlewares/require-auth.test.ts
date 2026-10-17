import { Hono } from "hono"
import { SignJWT } from "jose"
import { describe, expect, it } from "vitest"
import { env } from "../../config/env.js"
import type { AuthVariables } from "./require-auth.js"
import { requireAuth } from "./require-auth.js"

const secret = new TextEncoder().encode(env.JWT_SECRET)

const signTestToken = (payload: Record<string, unknown>, expiresIn = "15m") =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(secret)

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use("/protected", requireAuth)
  app.get("/protected", (c) => c.json({ user: c.get("user"), authMethod: c.get("authMethod") }))
  return app
}

describe("requireAuth", () => {
  it("returns 401 when no token is present in cookie or header", async () => {
    const res = await buildApp().request("/protected")
    expect(res.status).toBe(401)
  })

  it("returns 401 when the token is garbage", async () => {
    const res = await buildApp().request("/protected", {
      headers: { Cookie: "access_token=not-a-real-token" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 when the token is expired", async () => {
    const expired = await signTestToken({ sub: "user-1", email: "a@b.com", role: "user" }, "-1s")
    const res = await buildApp().request("/protected", {
      headers: { Cookie: `access_token=${expired}` },
    })
    expect(res.status).toBe(401)
  })

  it("calls next() and exposes payload with authMethod='cookie' when cookie token is valid", async () => {
    const token = await signTestToken({ sub: "user-1", email: "a@b.com", role: "user" })
    const res = await buildApp().request("/protected", {
      headers: { Cookie: `access_token=${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.sub).toBe("user-1")
    expect(body.user.email).toBe("a@b.com")
    expect(body.authMethod).toBe("cookie")
  })

  it("calls next() and exposes payload with authMethod='bearer' when Authorization header is valid", async () => {
    const token = await signTestToken({ sub: "user-2", email: "b@b.com", role: "admin" })
    const res = await buildApp().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.sub).toBe("user-2")
    expect(body.user.email).toBe("b@b.com")
    expect(body.user.role).toBe("admin")
    expect(body.authMethod).toBe("bearer")
  })

  it("prefers Bearer token over cookie when both are supplied", async () => {
    const cookieToken = await signTestToken({
      sub: "user-cookie",
      email: "cookie@b.com",
      role: "user",
    })
    const bearerToken = await signTestToken({
      sub: "user-bearer",
      email: "bearer@b.com",
      role: "admin",
    })
    const res = await buildApp().request("/protected", {
      headers: {
        Cookie: `access_token=${cookieToken}`,
        Authorization: `Bearer ${bearerToken}`,
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.sub).toBe("user-bearer")
    expect(body.authMethod).toBe("bearer")
  })
})
