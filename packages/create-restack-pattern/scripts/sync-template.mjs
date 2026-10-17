#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../../..")
const templateDir = path.resolve(__dirname, "..", "template")

const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".next",
  "out",
  ".vercel",
  ".git",
  ".turbo",
])

const EXCLUDE_FILE_NAMES = new Set([
  "next-env.d.ts",
  "sqlite.db",
  "sqlite.db-journal",
  "sqlite.db-wal",
  "sqlite.db-shm",
])

function shouldCopy(source) {
  const base = path.basename(source)
  if (EXCLUDE_DIR_NAMES.has(base)) return false
  if (EXCLUDE_FILE_NAMES.has(base)) return false
  if (base.endsWith(".tsbuildinfo")) return false
  if (base.startsWith(".env") && base !== ".env.example") return false
  // Exclude database-specific files from base
  if (base === "user.model.sqlite.ts" || base === "auth.model.sqlite.ts") return false
  if (base === "sqlite.ts" || base === "cross-dialect.test.ts") return false
  if (base === "drizzle.config.sqlite.ts") return false
  return true
}

if (existsSync(templateDir)) rmSync(templateDir, { recursive: true, force: true })

const baseDir = path.join(templateDir, "base")
const overlaysDir = path.join(templateDir, "overlays")
mkdirSync(baseDir, { recursive: true })
mkdirSync(overlaysDir, { recursive: true })

// 1. Copy Base Monorepo
const BASE_SOURCES = [
  ["frontend", "frontend"],
  ["backend", "backend"],
  ["packages/shared", "packages/shared"],
  ["package.json", "package.json"],
  ["pnpm-workspace.yaml", "pnpm-workspace.yaml"],
  [".gitignore", ".gitignore"],
  ["DEVELOPMENT.md", "DEVELOPMENT.md"],
]

for (const [src, dest] of BASE_SOURCES) {
  cpSync(path.join(repoRoot, src), path.join(baseDir, dest), {
    recursive: true,
    filter: shouldCopy,
  })
}

// 2. Generate Overlay: db-postgres
const dbPostgresDir = path.join(overlaysDir, "db-postgres")
mkdirSync(path.join(dbPostgresDir, "backend/src/infra/db"), { recursive: true })
mkdirSync(path.join(dbPostgresDir, "backend/scripts"), { recursive: true })

writeFileSync(
  path.join(dbPostgresDir, "backend/src/infra/db/index.ts"),
  `import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "../../config/env.js"

const client = postgres(env.DATABASE_URL, { max: 1 })
export const db = drizzle(client)
`,
)

writeFileSync(
  path.join(dbPostgresDir, "backend/drizzle.config.ts"),
  `import { defineConfig } from "drizzle-kit"
import "dotenv/config"

export default defineConfig({
  schema: "./src/domains/*/*.model.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
`,
)

writeFileSync(
  path.join(dbPostgresDir, "backend/scripts/db-check.js"),
  `import postgres from "postgres"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error("\\x1b[31m[ERROR] DATABASE_URL is not set in backend/.env\\x1b[0m")
  process.exit(1)
}

console.log("\\x1b[36mChecking PostgreSQL connection...\\x1b[0m")
const sql = postgres(dbUrl, { max: 1, connect_timeout: 5 })

try {
  await sql\`SELECT 1\`
  console.log("\\x1b[32m✔ PostgreSQL connection successful!\\x1b[0m")
  await sql.end()
  process.exit(0)
} catch (err) {
  console.error("\\x1b[31m[ERROR] Database connection failed!\\x1b[0m", err.message)
  await sql.end()
  process.exit(1)
}
`,
)

writeFileSync(
  path.join(dbPostgresDir, "backend/.env.example"),
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restack_pattern
JWT_SECRET=your-secret-key-min-32-characters
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
COOKIE_SAME_SITE=Lax
`,
)

// 3. Generate Overlay: db-sqlite
const dbSqliteDir = path.join(overlaysDir, "db-sqlite")
mkdirSync(path.join(dbSqliteDir, "backend/src/infra/db"), { recursive: true })
mkdirSync(path.join(dbSqliteDir, "backend/scripts"), { recursive: true })

writeFileSync(
  path.join(dbSqliteDir, "backend/src/infra/db/index.ts"),
  `import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { env } from "../../config/env.js"

const sqlite = new Database(env.DATABASE_URL || "sqlite.db")
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")
export const db = drizzle(sqlite)
`,
)

writeFileSync(
  path.join(dbSqliteDir, "backend/drizzle.config.ts"),
  `import { defineConfig } from "drizzle-kit"
import "dotenv/config"

export default defineConfig({
  schema: "./src/domains/*/*.model.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "sqlite.db",
  },
})
`,
)

writeFileSync(
  path.join(dbSqliteDir, "backend/scripts/db-check.js"),
  `import Database from "better-sqlite3"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const dbUrl = process.env.DATABASE_URL || "sqlite.db"
console.log("\\x1b[36mChecking SQLite database...\\x1b[0m")
try {
  const db = new Database(dbUrl)
  db.exec("SELECT 1")
  db.close()
  console.log("\\x1b[32m✔ SQLite database ready!\\x1b[0m")
  process.exit(0)
} catch (err) {
  console.error("\\x1b[31m[ERROR] SQLite database check failed:\\x1b[0m", err.message)
  process.exit(1)
}
`,
)

writeFileSync(
  path.join(dbSqliteDir, "backend/.env.example"),
  `DATABASE_URL=sqlite.db
JWT_SECRET=your-secret-key-min-32-characters
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
COOKIE_SAME_SITE=Lax
`,
)

// 4. Generate Overlays: Models
const modelsDir = path.join(overlaysDir, "models")

// 4a. postgres-uuid
const pgUuidDir = path.join(modelsDir, "postgres-uuid")
mkdirSync(path.join(pgUuidDir, "backend/src/domains/user"), { recursive: true })
mkdirSync(path.join(pgUuidDir, "backend/src/domains/auth"), { recursive: true })

writeFileSync(
  path.join(pgUuidDir, "backend/src/domains/user/user.model.ts"),
  `import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { uuidv7 } from "@restack/shared"

export const usersTable = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
`,
)

writeFileSync(
  path.join(pgUuidDir, "backend/src/domains/auth/auth.model.ts"),
  `import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { uuidv7 } from "@restack/shared"
import { usersTable } from "../user/user.model.js"

export const authSessionsTable = pgTable("auth_sessions", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
`,
)

// 4b. postgres-serial
const pgSerialDir = path.join(modelsDir, "postgres-serial")
mkdirSync(path.join(pgSerialDir, "backend/src/domains/user"), { recursive: true })
mkdirSync(path.join(pgSerialDir, "backend/src/domains/auth"), { recursive: true })

writeFileSync(
  path.join(pgSerialDir, "backend/src/domains/user/user.model.ts"),
  `import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
`,
)

writeFileSync(
  path.join(pgSerialDir, "backend/src/domains/auth/auth.model.ts"),
  `import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { usersTable } from "../user/user.model.js"

export const authSessionsTable = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
`,
)

// 4c. sqlite-uuid
const sqUuidDir = path.join(modelsDir, "sqlite-uuid")
mkdirSync(path.join(sqUuidDir, "backend/src/domains/user"), { recursive: true })
mkdirSync(path.join(sqUuidDir, "backend/src/domains/auth"), { recursive: true })

writeFileSync(
  path.join(sqUuidDir, "backend/src/domains/user/user.model.ts"),
  `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { uuidv7 } from "@restack/shared"

export const usersTable = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
`,
)

writeFileSync(
  path.join(sqUuidDir, "backend/src/domains/auth/auth.model.ts"),
  `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { uuidv7 } from "@restack/shared"
import { usersTable } from "../user/user.model.js"

export const authSessionsTable = sqliteTable("auth_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
`,
)

// 4d. sqlite-serial
const sqSerialDir = path.join(modelsDir, "sqlite-serial")
mkdirSync(path.join(sqSerialDir, "backend/src/domains/user"), { recursive: true })
mkdirSync(path.join(sqSerialDir, "backend/src/domains/auth"), { recursive: true })

writeFileSync(
  path.join(sqSerialDir, "backend/src/domains/user/user.model.ts"),
  `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const usersTable = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
`,
)

writeFileSync(
  path.join(sqSerialDir, "backend/src/domains/auth/auth.model.ts"),
  `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { usersTable } from "../user/user.model.js"

export const authSessionsTable = sqliteTable("auth_sessions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
`,
)

// 5. Generate Overlays: Primary Key Type in @restack/shared
const idUuidDir = path.join(overlaysDir, "id-uuid")
mkdirSync(path.join(idUuidDir, "packages/shared/src/schemas"), { recursive: true })
writeFileSync(
  path.join(idUuidDir, "packages/shared/src/schemas/user.schema.ts"),
  `import { z } from "zod"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
`,
)

const idSerialDir = path.join(overlaysDir, "id-serial")
mkdirSync(path.join(idSerialDir, "packages/shared/src/schemas"), { recursive: true })
writeFileSync(
  path.join(idSerialDir, "packages/shared/src/schemas/user.schema.ts"),
  `import { z } from "zod"

export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
}

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
`,
)

// Rename .gitignore to gitignore so npm packaging does not discard them
function renameGitignoreFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) renameGitignoreFiles(full)
    else if (entry.name === ".gitignore") renameSync(full, path.join(dir, "gitignore"))
  }
}
renameGitignoreFiles(templateDir)

console.log(`Template and overlays synced to ${templateDir}`)
