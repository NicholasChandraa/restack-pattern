import pino from "pino"
import { env } from "../../config/env.js"

/**
 * Global logger client.
 * Configured using `pino`. Automatically toggles logging verbosity (info vs debug)
 * and formats stdout output using `pino-pretty` during local development.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
})
