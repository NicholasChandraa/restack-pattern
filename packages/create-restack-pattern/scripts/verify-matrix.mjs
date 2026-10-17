import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templateDir = path.resolve(__dirname, "..", "template")
const baseDir = path.join(templateDir, "base")
const overlaysDir = path.join(templateDir, "overlays")
const testOutDir = path.resolve(__dirname, "..", ".test-matrix")

if (existsSync(testOutDir)) rmSync(testOutDir, { recursive: true, force: true })
mkdirSync(testOutDir, { recursive: true })

const MATRIX = [
  { db: "postgres", id: "uuid", pm: "pnpm" },
  { db: "postgres", id: "serial", pm: "pnpm" },
  { db: "sqlite", id: "uuid", pm: "pnpm" },
  { db: "sqlite", id: "serial", pm: "npm" },
]

console.log("\x1b[36mStarting Scaffolding Matrix Verification...\x1b[0m\n")

for (const { db, id, pm } of MATRIX) {
  const caseName = `${db}-${id}-${pm}`
  const targetDir = path.join(testOutDir, caseName)
  console.log(`Testing variant: \x1b[33m${caseName}\x1b[0m`)

  // 1. Copy base
  cpSync(baseDir, targetDir, { recursive: true })

  // 2. Apply DB overlay
  const dbOverlayDir = path.join(overlaysDir, `db-${db}`)
  if (!existsSync(dbOverlayDir)) throw new Error(`Missing DB overlay: ${dbOverlayDir}`)
  cpSync(dbOverlayDir, targetDir, { recursive: true })

  // 3. Apply model overlay
  const modelOverlayDir = path.join(overlaysDir, "models", `${db}-${id}`)
  if (!existsSync(modelOverlayDir)) throw new Error(`Missing model overlay: ${modelOverlayDir}`)
  cpSync(modelOverlayDir, targetDir, { recursive: true })

  // 4. Apply ID overlay
  const idOverlayDir = path.join(overlaysDir, `id-${id}`)
  if (!existsSync(idOverlayDir)) throw new Error(`Missing ID overlay: ${idOverlayDir}`)
  cpSync(idOverlayDir, targetDir, { recursive: true })

  // Assertions:
  // a. usersTable model
  const userModel = readFileSync(path.join(targetDir, "backend/src/domains/user/user.model.ts"), "utf-8")
  if (db === "postgres") {
    if (!userModel.includes("pgTable")) throw new Error(`Expected pgTable in ${caseName}`)
    if (id === "uuid" && !userModel.includes("uuid(")) throw new Error(`Expected uuid in ${caseName}`)
    if (id === "serial" && !userModel.includes("serial(")) throw new Error(`Expected serial in ${caseName}`)
  } else {
    if (!userModel.includes("sqliteTable")) throw new Error(`Expected sqliteTable in ${caseName}`)
    if (id === "uuid" && !userModel.includes("text(")) throw new Error(`Expected text id in ${caseName}`)
    if (id === "serial" && !userModel.includes("integer(")) throw new Error(`Expected integer id in ${caseName}`)
  }

  // b. user.schema.ts
  const userSchema = readFileSync(path.join(targetDir, "packages/shared/src/schemas/user.schema.ts"), "utf-8")
  if (id === "uuid" && !userSchema.includes("id: string")) throw new Error(`Expected id: string in ${caseName}`)
  if (id === "serial" && !userSchema.includes("id: number")) throw new Error(`Expected id: number in ${caseName}`)

  // c. db client
  const dbClient = readFileSync(path.join(targetDir, "backend/src/infra/db/index.ts"), "utf-8")
  if (db === "postgres" && !dbClient.includes("postgres-js")) throw new Error(`Expected postgres-js client in ${caseName}`)
  if (db === "sqlite" && !dbClient.includes("better-sqlite3")) throw new Error(`Expected better-sqlite3 client in ${caseName}`)

  console.log(`  \x1b[32m✔ Matrix variant ${caseName} passed all verification checks!\x1b[0m`)
}

// Cleanup
rmSync(testOutDir, { recursive: true, force: true })
console.log("\n\x1b[32m✔ All 4 scaffolding matrix variants verified successfully!\x1b[0m\n")
