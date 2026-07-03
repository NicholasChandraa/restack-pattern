import type { Context, MiddlewareHandler } from "hono"
import { getConnInfo } from "@hono/node-server/conninfo"

/**
 * In-Memory Fixed-Window Rate Limiting Middleware.
 * 
 * Performance/Topology Note:
 * - This implementation stores counts in a local `Map` memory segment.
 * - This works perfectly for single-process deployments (like a standalone Railway node).
 * - If horizontal scaling (multiple instances) is introduced, this must be swapped
 *   for a shared datastore (e.g. Redis) to ensure limits are synchronized globally.
 */
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
