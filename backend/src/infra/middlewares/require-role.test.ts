import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import type { AppVariables } from "../../utils/logger.js"
import { requireRole } from "./require-role.js"

function buildApp(
  allowedRoles: string[],
  initialUser?: { sub: string; email: string; role: string },
) {
  const app = new Hono<{ Variables: AppVariables }>()

  if (initialUser) {
    app.use("/admin/*", async (c, next) => {
      c.set("user", initialUser)
      await next()
    })
  }

  app.use("/admin/dashboard", requireRole(...allowedRoles))
  app.get("/admin/dashboard", (c) => c.json({ access: "granted", role: c.get("user")?.role }))

  return app
}

describe("requireRole middleware", () => {
  it("returns 401 when user is not authenticated in context", async () => {
    const app = buildApp(["admin"])
    const res = await app.request("/admin/dashboard")

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 when user role does not match required role", async () => {
    const app = buildApp(["admin"], { sub: "1", email: "user@test.com", role: "user" })
    const res = await app.request("/admin/dashboard")

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Forbidden: insufficient permissions")
  })

  it("returns 200 when user has the exact required role", async () => {
    const app = buildApp(["admin"], { sub: "1", email: "admin@test.com", role: "admin" })
    const res = await app.request("/admin/dashboard")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.access).toBe("granted")
    expect(body.role).toBe("admin")
  })

  it("returns 200 when user matches one of several permitted roles", async () => {
    const app = buildApp(["editor", "admin", "superadmin"], {
      sub: "2",
      email: "editor@test.com",
      role: "editor",
    })
    const res = await app.request("/admin/dashboard")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.access).toBe("granted")
  })
})
