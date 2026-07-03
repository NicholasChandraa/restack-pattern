import { and, eq, gt } from "drizzle-orm"
import { db } from "../../shared/db/index.js"
import { usersTable } from "../user/user.model.js"
import { authSessionsTable } from "./auth.model.js"

type UserRow = typeof usersTable.$inferSelect
type SessionRow = typeof authSessionsTable.$inferSelect

export const authRepo = {
  // Explicit return type matters: without noUncheckedIndexedAccess, TS infers array
  // destructuring as always-defined, so `user ?? null` silently loses the null branch
  // and callers' `if (!user)` checks type-check as always-false without this annotation.
  findByEmail: async (email: string): Promise<UserRow | null> => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email))
    return user ?? null
  },

  create: async (data: { name: string; email: string; password: string }) => {
    const [user] = await db.insert(usersTable).values(data).returning()
    return user
  },

  createSession: async (data: { userId: string; refreshTokenHash: string; expiresAt: Date }) => {
    const [session] = await db.insert(authSessionsTable).values(data).returning()
    return session
  },

  // Atomic find-and-delete: a single DELETE...RETURNING so concurrent refresh
  // calls presenting the same token can't both pass a separate SELECT check
  // before either DELETE lands (TOCTOU) — only one caller ever gets a row back.
  consumeSessionByHash: async (refreshTokenHash: string): Promise<SessionRow | null> => {
    const [session] = await db
      .delete(authSessionsTable)
      .where(and(eq(authSessionsTable.refreshTokenHash, refreshTokenHash), gt(authSessionsTable.expiresAt, new Date())))
      .returning()
    return session ?? null
  },

  deleteSessionByHash: async (refreshTokenHash: string) => {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.refreshTokenHash, refreshTokenHash))
  },
}
