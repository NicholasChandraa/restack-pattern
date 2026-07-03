import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"
import { usersTable } from "../user/user.model.js"

export const authSessionsTable = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // sha256 of the opaque refresh token — never store the raw token.
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
