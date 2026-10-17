import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Users Table Schema.
 * Defines the core database table layout for registered users.
 * Fields: id (sequential serial integer), name (raw string), email (unique), password (bcrypt hash), and createdAt.
 */
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
