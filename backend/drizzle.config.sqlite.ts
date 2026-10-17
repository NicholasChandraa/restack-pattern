import { defineConfig } from "drizzle-kit"
import "dotenv/config"

export default defineConfig({
  schema: "./src/domains/*/*.model.sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH || "sqlite.db",
  },
})
