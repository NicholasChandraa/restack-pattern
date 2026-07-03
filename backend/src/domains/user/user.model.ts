import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * Users Table Schema.
 * Defines the core database table layout for registered users.
 * Fields: id (random UUID v4), name (raw string), email (unique), password (bcrypt hash), and createdAt.
 */
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
