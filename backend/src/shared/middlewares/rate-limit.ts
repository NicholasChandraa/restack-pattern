import type { Context, MiddlewareHandler } from "hono"
import { getConnInfo } from "@hono/node-server/conninfo"

// ponytail: in-memory fixed-window limiter, keyed by route+IP. Single-process only —
// if the backend ever runs more than one instance, swap the Map for a shared store (Redis).
const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

const hits = new Map<string, { count: number; resetAt: number }>()

// getConnInfo reaches into the raw Node socket, which only exists when served via a real
// @hono/node-server connection — it throws in in-memory test harnesses (Hono's `.request()`)
// and some serverless runtimes. Fall back to a shared bucket rather than crashing the request.
const clientIp = (c: Context) => {
  try {
    return getConnInfo(c).remote.address ?? "unknown"
  } catch {
    return "unknown"
  }
}

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const key = `${c.req.path}:${clientIp(c)}`
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else if (entry.count >= MAX_REQUESTS) {
    return c.json({ error: "Too many requests, try again later" }, 429)
  } else {
    entry.count++
  }

  await next()
}
