import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { env } from "./config/env.js"
import { authRoutes } from "./domains/auth/auth.routes.js"

const app = new Hono()

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((url) => url.trim())

app.use(
  "/api/*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)

app.route("/api/auth", authRoutes)

app.get("/", (c) => c.json({ status: "ok" }))

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})
