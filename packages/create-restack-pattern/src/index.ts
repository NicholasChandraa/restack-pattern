#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs"
import { execSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templateDir = path.resolve(__dirname, "..", "template")

async function promptProjectName(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question("Project name: ")
  rl.close()
  return answer.trim()
}

function isValidProjectName(name: string): boolean {
  return /^[a-z0-9-_]+$/i.test(name)
}

// Undoes sync-template.mjs's .gitignore -> gitignore rename (npm strips
// files literally named .gitignore from the published tarball).
function renameGitignoreFilesBack(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) renameGitignoreFilesBack(full)
    else if (entry.name === "gitignore") renameSync(full, path.join(dir, ".gitignore"))
  }
}

function isPnpmInstalled(): boolean {
  try {
    execSync("pnpm --version", { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!isPnpmInstalled()) {
    console.error("\n\x1b[31mError: pnpm is not installed.\x1b[0m")
    console.error("This template is configured as a pnpm workspace monorepo and requires pnpm to run.")
    console.error("Please install pnpm before continuing:")
    console.error("  npm install -g pnpm")
    console.error("Or visit https://pnpm.io for more installation options.\n")
    process.exit(1)
  }

  const argName = process.argv[2]
  const projectName = argName ?? (await promptProjectName())

  if (!projectName || !isValidProjectName(projectName)) {
    console.error("Invalid project name. Use letters, numbers, hyphens, or underscores only.")
    process.exit(1)
  }

  const targetDir = path.resolve(process.cwd(), projectName)
  if (existsSync(targetDir)) {
    console.error(`Directory "${projectName}" already exists.`)
    process.exit(1)
  }

  console.log(`Scaffolding into ${targetDir} ...`)
  cpSync(templateDir, targetDir, { recursive: true })
  renameGitignoreFilesBack(targetDir)

  const rootPkgPath = path.join(targetDir, "package.json")
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"))
  rootPkg.name = projectName
  writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n")

  console.log("Installing dependencies (pnpm install) ...")
  execSync("pnpm install", { cwd: targetDir, stdio: "inherit" })

  // packages/shared ships no dist/ (gitignored) — backend/frontend resolve
  // @restack/shared to compiled output, so it must be built once up front
  // or the very first `pnpm dev` fails to resolve the import.
  console.log("Building @restack/shared ...")
  execSync("pnpm --filter @restack/shared build", { cwd: targetDir, stdio: "inherit" })

  try {
    execSync("git init", { cwd: targetDir, stdio: "ignore" })
  } catch {
    // git not available — non-fatal, scaffolding still succeeded
  }

  console.log(`
\x1b[32m✔ Scaffolded project successfully!\x1b[0m

Next steps to get started:

  1. Go to your project directory:
     \x1b[36mcd ${projectName}\x1b[0m

  2. Configure environment variables:
     • For Backend:
       \x1b[36mcp backend/.env.example backend/.env\x1b[0m
       (Open backend/.env and set \x1b[33mDATABASE_URL\x1b[0m and a min-32-chars \x1b[33mJWT_SECRET\x1b[0m)

     • For Frontend:
       \x1b[36mcp frontend/.env.example frontend/.env\x1b[0m

  3. Push database tables (creates users & auth_sessions tables):
     \x1b[36mpnpm --filter backend db:push\x1b[0m

  4. Start development servers:
     • Backend (running at http://localhost:3001):
       \x1b[36mpnpm --filter backend dev\x1b[0m

     • Frontend (running at http://localhost:3000):
       \x1b[36mpnpm --filter frontend dev\x1b[0m

Enjoy building your app with the Restack Pattern!
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
