import Database from "better-sqlite3"
import { and, eq, gt } from "drizzle-orm"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { describe, expect, it } from "vitest"
import { authSessionsTable } from "../../domains/auth/auth.model.sqlite.js"
import { usersTable } from "../../domains/user/user.model.sqlite.js"

describe("SQLite Cross-Dialect Repository Compatibility", () => {
  function setupTestDb() {
    const sqlite = new Database(":memory:")
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)
    return drizzle(sqlite)
  }

  it("performs insert with returning() on SQLite usersTable", async () => {
    const db = setupTestDb()

    const [user] = await db
      .insert(usersTable)
      .values({
        name: "Test User",
        email: "test@sqlite.com",
        password: "hashedpassword",
      })
      .returning()

    expect(user).toBeDefined()
    expect(user?.name).toBe("Test User")
    expect(user?.email).toBe("test@sqlite.com")
    expect(user?.role).toBe("user")
    expect(user?.id).toBeDefined()
    expect(typeof user?.id).toBe("string")
    expect(user?.createdAt).toBeInstanceOf(Date)
  })

  it("performs select findByEmail and findById on SQLite", async () => {
    const db = setupTestDb()

    const [inserted] = await db
      .insert(usersTable)
      .values({
        name: "Jane Doe",
        email: "jane@sqlite.com",
        password: "hash",
      })
      .returning()

    // 1. findByEmail query
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "jane@sqlite.com"))
    expect(byEmail?.id).toBe(inserted?.id)

    // 2. findById query
    if (!inserted) throw new Error("Expected inserted user")
    const [byId] = await db.select().from(usersTable).where(eq(usersTable.id, inserted.id))
    expect(byId?.email).toBe("jane@sqlite.com")
  })

  it("performs update with returning() on SQLite", async () => {
    const db = setupTestDb()

    const [inserted] = await db
      .insert(usersTable)
      .values({
        name: "Original Name",
        email: "orig@sqlite.com",
        password: "hash",
      })
      .returning()

    if (!inserted) throw new Error("Expected inserted user")
    const [updated] = await db
      .update(usersTable)
      .set({ name: "Updated Name" })
      .where(eq(usersTable.id, inserted.id))
      .returning()

    expect(updated?.name).toBe("Updated Name")
  })

  it("handles session creation and atomic consumeSessionByHash on SQLite", async () => {
    const db = setupTestDb()

    const [user] = await db
      .insert(usersTable)
      .values({
        name: "Session User",
        email: "session@sqlite.com",
        password: "hash",
      })
      .returning()

    if (!user) throw new Error("Expected inserted user")
    const expiresAt = new Date(Date.now() + 60_000)

    // 1. Create session
    const [session] = await db
      .insert(authSessionsTable)
      .values({
        userId: user.id,
        refreshTokenHash: "unique-hash-123",
        expiresAt,
      })
      .returning()

    expect(session).toBeDefined()
    expect(session?.refreshTokenHash).toBe("unique-hash-123")
    expect(session?.userId).toBe(user.id)

    // 2. Atomic consume: DELETE ... RETURNING
    const [consumed] = await db
      .delete(authSessionsTable)
      .where(
        and(
          eq(authSessionsTable.refreshTokenHash, "unique-hash-123"),
          gt(authSessionsTable.expiresAt, new Date()),
        ),
      )
      .returning()

    expect(consumed).toBeDefined()
    expect(consumed?.refreshTokenHash).toBe("unique-hash-123")

    // 3. Second consume must return undefined (already consumed)
    const [alreadyConsumed] = await db
      .delete(authSessionsTable)
      .where(eq(authSessionsTable.refreshTokenHash, "unique-hash-123"))
      .returning()

    expect(alreadyConsumed).toBeUndefined()
  })
})
