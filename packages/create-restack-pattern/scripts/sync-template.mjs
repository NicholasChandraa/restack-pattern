#!/usr/bin/env node
// Copies the live Phase 1 template (frontend/backend/packages/shared + root
// config) into packages/create-restack-pattern/template/, excluding
// build artifacts, secrets, and this template's own internal planning docs
// (docs/, root CLAUDE.md) which aren't relevant to a generated project.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, renameSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../../..")
const templateDir = path.resolve(__dirname, "..", "template")

const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".next",
  "out",
  ".vercel",
  ".git",
  ".turbo",
])

const EXCLUDE_FILE_NAMES = new Set(["next-env.d.ts"])

function shouldCopy(source) {
  const base = path.basename(source)
  if (EXCLUDE_DIR_NAMES.has(base)) return false
  if (EXCLUDE_FILE_NAMES.has(base)) return false
  if (base.endsWith(".tsbuildinfo")) return false
  if (base.startsWith(".env") && base !== ".env.example") return false
  return true
}

const SOURCES = [
  ["frontend", "frontend"],
  ["backend", "backend"],
  ["packages/shared", "packages/shared"],
  ["package.json", "package.json"],
  ["pnpm-workspace.yaml", "pnpm-workspace.yaml"],
  [".gitignore", ".gitignore"],
  ["CLAUDE_TEMPLATE.md", "CLAUDE.md"],
]

if (existsSync(templateDir)) rmSync(templateDir, { recursive: true, force: true })
mkdirSync(templateDir, { recursive: true })

for (const [src, dest] of SOURCES) {
  cpSync(path.join(repoRoot, src), path.join(templateDir, dest), {
    recursive: true,
    filter: shouldCopy,
  })
}

// npm always strips files literally named .gitignore/.npmignore from a
// published tarball (and still reads them for exclusion rules first,
// which drops unrelated files like .env.example along the way) — so the
// template ships them as "gitignore" and the CLI renames them back on scaffold.
function renameGitignoreFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) renameGitignoreFiles(full)
    else if (entry.name === ".gitignore") renameSync(full, path.join(dir, "gitignore"))
  }
}
renameGitignoreFiles(templateDir)

console.log(`Template synced to ${templateDir}`)
