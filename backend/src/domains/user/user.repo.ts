import { eq } from "drizzle-orm"
import { db } from "../../shared/db/index.js"
import { usersTable } from "./user.model.js"

export type UserRow = typeof usersTable.$inferSelect

export const userRepo = {
  // Explicit return type matters: without noUncheckedIndexedAccess, TS infers array
  // destructuring as always-defined, so `user ?? null` silently loses the null branch
  // and callers' `if (!user)` checks type-check as always-false without this annotation.
  findById: async (id: string): Promise<UserRow | null> => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id))
    return user ?? null
  },

  updateProfile: async (id: string, data: { name?: string }): Promise<UserRow | null> => {
    const [user] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning()
    return user ?? null
  },
}
