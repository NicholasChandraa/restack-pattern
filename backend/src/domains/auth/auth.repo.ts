import { eq } from "drizzle-orm"
import { db } from "../../shared/db/index.js"
import { usersTable } from "../user/user.model.js"

export const authRepo = {
  findByEmail: async (email: string) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email))
    return user ?? null
  },

  create: async (data: { name: string; email: string; password: string }) => {
    const [user] = await db.insert(usersTable).values(data).returning()
    return user
  },
}
