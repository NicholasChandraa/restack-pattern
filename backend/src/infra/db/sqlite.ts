import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

/**
 * SQLite database client initialization.
 * Uses better-sqlite3 with WAL (Write-Ahead Logging) and Foreign Key constraints
 * enabled for reliable, high-performance local or embedded storage.
 *
 * @param dbPath Path to the sqlite database file (defaults to "sqlite.db", or ":memory:" for tests)
 */
export function createSqliteDb(dbPath = "sqlite.db") {
  const sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  return drizzle(sqlite)
}
