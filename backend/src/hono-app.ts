import { Hono } from "hono"
import { cors } from "hono/cors"
import { csrf } from "hono/csrf"
import { logger as honoLogger } from "hono/logger"
import { env } from "./config/env.js"
import { logger } from "./shared/logger/logger.js"
import { authRoutes } from "./domains/auth/auth.routes.js"
import { userRoutes } from "./domains/user/user.routes.js"

/**
 * Hono application instance — routes, middleware, everything except the transport.
 * Kept separate from index.ts so this same app can run under a persistent Node
 * server (local dev, Railway/Render/VPS) or as a Vercel serverless function
 * (backend/api/index.ts), which cannot call @hono/node-server's serve().
 */
export const app = new Hono()

const allowedOrigins = env.FRONTEND_URL
  .split(",")
  .map((url) => url.trim())

app.use(honoLogger((...args) => logger.info(args.join(" "))))

app.use(
  "/api/*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)

app.use(
  "/api/*",
  csrf({
    origin: allowedOrigins,
  })
)

app.route("/api/auth", authRoutes)
app.route("/api/user", userRoutes)

app.get("/", (c) => c.json({ status: "ok" }))
