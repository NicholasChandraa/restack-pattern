import { eq } from "drizzle-orm"
import fc from "fast-check"
import { testClient } from "hono/testing"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../../infra/db/index.js"
import { authService } from "../auth/auth.service.js"
import { usersTable } from "./user.model.js"
import { userRoutes } from "./user.routes.js"

const TEST_EMAIL = `user-routes-test-${Date.now()}@example.com`
let accessToken: string
let userId: number

const client = testClient(userRoutes)

beforeAll(async () => {
  const user = await authService.register({
    name: "Route Test",
    email: TEST_EMAIL,
    password: "password123",
  })
  userId = user.id
  const tokens = await authService.issueTokenPair(user)
  accessToken = tokens.accessToken
})

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, userId))
})

const authHeaders = (token?: string) => ({
  ...(token ? { Cookie: `access_token=${token}` } : {}),
})

describe("GET /me", () => {
  it("returns 401 without a token", async () => {
    const res = await client.me.$get()
    expect(res.status).toBe(401)
  })

  it("returns the profile with a valid token", async () => {
    const res = await client.me.$get({}, { headers: authHeaders(accessToken) })
    expect(res.status).toBe(200)
    const body = await res.json()
    if ("error" in body) throw new Error(String(body.error))
    expect(body.user.email).toBe(TEST_EMAIL)
  })
})

describe("PUT /profile", () => {
  it("returns 401 without a token", async () => {
    const res = await client.profile.$put({ json: { name: "x" } })
    expect(res.status).toBe(401)
  })

  it("updates the name with a valid token and body", async () => {
    const res = await client.profile.$put(
      { json: { name: "Updated Name" } },
      { headers: authHeaders(accessToken) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    if ("error" in body) throw new Error(String(body.error))
    expect(body.user.name).toBe("Updated Name")
  })

  it("rejects an invalid body (empty name)", async () => {
    const res = await client.profile.$put(
      { json: { name: "" } },
      { headers: authHeaders(accessToken) },
    )
    expect(res.status).toBe(400)
  })

  it("treats an empty body as a no-op instead of erroring", async () => {
    const res = await client.profile.$put({ json: {} }, { headers: authHeaders(accessToken) })
    expect(res.status).toBe(200)
    const body = await res.json()
    if ("error" in body) throw new Error(String(body.error))
    expect(body.user.email).toBe(TEST_EMAIL)
  })

  it("never returns a 500 crash on arbitrary string payloads (property fuzzing)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (name) => {
        const res = await client.profile.$put(
          { json: { name } },
          { headers: authHeaders(accessToken) },
        )
        // Must either succeed (200) or cleanly reject invalid input (400), never crash (500)
        expect([200, 400]).toContain(res.status)
      }),
      { numRuns: 30 },
    )
  })
})

describe("GET /admin (RBAC Protected Route)", () => {
  it("returns 401 without a token", async () => {
    const res = await client.admin.$get()
    expect(res.status).toBe(401)
  })

  it("returns 403 when user has default 'user' role", async () => {
    const res = await client.admin.$get({}, { headers: authHeaders(accessToken) })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error?: string; message?: string }
    expect(body.error).toBe("Forbidden: insufficient permissions")
  })

  it("returns 200 when user has 'admin' role (via Bearer token)", async () => {
    const adminTokens = await authService.issueTokenPair({
      id: userId,
      name: "Admin User",
      email: TEST_EMAIL,
      role: "admin",
    })
    const res = await client.admin.$get(
      {},
      { headers: { Authorization: `Bearer ${adminTokens.accessToken}` } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    if ("error" in body) throw new Error(String(body.error))
    expect(body.message).toBe("Welcome to the admin area")
  })
})
