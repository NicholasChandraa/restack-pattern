import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { csrf } from "hono/csrf"
import { logger as honoLogger } from "hono/logger"
import { env } from "./config/env.js"
import { logger } from "./shared/logger/logger.js"
import { authRoutes } from "./domains/auth/auth.routes.js"

const app = new Hono()

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

app.get("/", (c) => c.json({ status: "ok" }))

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`)
})
