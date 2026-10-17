import { uuidv7 } from "@restack/shared"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * Users Table Schema (SQLite variant).
 * Defines the database table layout for registered users in SQLite.
 * Uses RFC 9562 UUIDv7 by default for primary keys to prevent enumeration.
 */
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
