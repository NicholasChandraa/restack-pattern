import { uuidv7 } from "@restack/shared"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { usersTable } from "../user/user.model.sqlite.js"

/**
 * Auth Sessions Table Schema (SQLite variant).
 * Houses rotated, hashed refresh tokens and session lifespans.
 */
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
