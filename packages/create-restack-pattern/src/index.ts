#!/usr/bin/env node
import { execSync } from "node:child_process"
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as p from "@clack/prompts"
import color from "picocolors"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templateDir = path.resolve(__dirname, "..", "template")

function isValidProjectName(name: string): boolean {
  return /^[a-z0-9-_]+$/i.test(name)
}

function isCommandAvailable(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
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

type DatabaseChoice = "postgres" | "sqlite"
type IdChoice = "uuid" | "serial"
type PackageManagerChoice = "pnpm" | "npm" | "bun"

interface PackageJson {
  name: string
  workspaces?: string[]
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
  [key: string]: unknown
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
Usage: create-restack-pattern [project-name]

Options:
  -h, --help    Show help message
  -v, --version Show CLI version

Examples:
  pnpm create restack-pattern my-saas-app
  npm create restack-pattern@latest
  bun create restack-pattern@latest
`)
    process.exit(0)
  }

  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "..", "package.json"), "utf-8"))
    console.log(pkg.version)
    process.exit(0)
  }

  console.log()
  p.intro(color.bgCyan(color.black(" create-restack-pattern ")))

  let projectName = process.argv[2]

  if (!projectName || projectName.startsWith("-")) {
    const nameInput = await p.text({
      message: "What is your project named?",
      placeholder: "my-restack-app",
      defaultValue: "my-restack-app",
      validate: (value) => {
        if (!value) return "Project name cannot be empty"
        if (!isValidProjectName(value)) {
          return "Project name may only contain letters, numbers, hyphens, and underscores"
        }
        if (existsSync(path.resolve(process.cwd(), value))) {
          return `Directory "${value}" already exists in the current directory`
        }
      },
    })

    if (p.isCancel(nameInput)) {
      p.cancel("Operation cancelled.")
      process.exit(0)
    }

    projectName = nameInput
  }

  const targetDir = path.resolve(process.cwd(), projectName)
  if (existsSync(targetDir)) {
    p.cancel(color.red(`Error: Directory "${projectName}" already exists.`))
    process.exit(1)
  }

  const database = (await p.select({
    message: "Select your database:",
    options: [
      {
        value: "postgres",
        label: "PostgreSQL",
        hint: "Neon, Supabase, Docker, AWS RDS (Recommended for SaaS)",
      },
      {
        value: "sqlite",
        label: "SQLite",
        hint: "Zero-config local file, Turso, Cloudflare D1",
      },
    ],
    initialValue: "postgres",
  })) as DatabaseChoice

  if (p.isCancel(database)) {
    p.cancel("Operation cancelled.")
    process.exit(0)
  }

  const idStrategy = (await p.select({
    message: "Select primary key strategy:",
    options: [
      {
        value: "uuid",
        label: "UUIDv7",
        hint: "Time-sortable, unguessable, secure against enumeration (Recommended)",
      },
      {
        value: "serial",
        label: "Serial Integer",
        hint: "Auto-incrementing 1, 2, 3... (Simple relational lookups)",
      },
    ],
    initialValue: "uuid",
  })) as IdChoice

  if (p.isCancel(idStrategy)) {
    p.cancel("Operation cancelled.")
    process.exit(0)
  }

  const packageManager = (await p.select({
    message: "Select package manager:",
    options: [
      {
        value: "pnpm",
        label: "pnpm",
        hint: "Fast, disk-efficient workspace monorepo (Recommended)",
      },
      {
        value: "npm",
        label: "npm",
        hint: "Default Node.js package manager",
      },
      {
        value: "bun",
        label: "bun",
        hint: "Fast all-in-one JavaScript runtime & toolkit",
      },
    ],
    initialValue: "pnpm",
  })) as PackageManagerChoice

  if (p.isCancel(packageManager)) {
    p.cancel("Operation cancelled.")
    process.exit(0)
  }

  const s = p.spinner()

  // 1. Scaffold files
  s.start(`Scaffolding ${projectName} (${database} + ${idStrategy}) ...`)

  const baseDir = path.join(templateDir, "base")
  const overlaysDir = path.join(templateDir, "overlays")

  // Copy base template
  cpSync(baseDir, targetDir, { recursive: true })

  // Overlay database configuration
  const dbOverlayDir = path.join(overlaysDir, `db-${database}`)
  if (existsSync(dbOverlayDir)) {
    cpSync(dbOverlayDir, targetDir, { recursive: true })
  }

  // Overlay models
  const modelOverlayDir = path.join(overlaysDir, "models", `${database}-${idStrategy}`)
  if (existsSync(modelOverlayDir)) {
    cpSync(modelOverlayDir, targetDir, { recursive: true })
  }

  // Overlay shared schema
  const idOverlayDir = path.join(overlaysDir, `id-${idStrategy}`)
  if (existsSync(idOverlayDir)) {
    cpSync(idOverlayDir, targetDir, { recursive: true })
  }

  renameGitignoreFilesBack(targetDir)

  // 2. Patch package.json files
  const rootPkgPath = path.join(targetDir, "package.json")
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8")) as PackageJson
  rootPkg.name = projectName

  if (packageManager !== "pnpm") {
    rootPkg.workspaces = ["frontend", "backend", "packages/*"]
  }
  writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)

  const backendPkgPath = path.join(targetDir, "backend/package.json")
  if (existsSync(backendPkgPath)) {
    const backendPkg = JSON.parse(readFileSync(backendPkgPath, "utf-8")) as PackageJson

    if (database === "sqlite") {
      if (backendPkg.dependencies) {
        delete backendPkg.dependencies.postgres
        backendPkg.dependencies["better-sqlite3"] = "^13.0.3"
      }
      if (backendPkg.devDependencies) {
        backendPkg.devDependencies["@types/better-sqlite3"] = "^7.6.13"
      }
    } else {
      if (backendPkg.dependencies) {
        delete backendPkg.dependencies["better-sqlite3"]
      }
      if (backendPkg.devDependencies) {
        delete backendPkg.devDependencies["@types/better-sqlite3"]
      }
    }

    if (packageManager !== "pnpm") {
      if (backendPkg.dependencies?.["@restack/shared"] === "workspace:*") {
        backendPkg.dependencies["@restack/shared"] = "*"
      }
    }

    writeFileSync(backendPkgPath, `${JSON.stringify(backendPkg, null, 2)}\n`)
  }

  const frontendPkgPath = path.join(targetDir, "frontend/package.json")
  if (existsSync(frontendPkgPath) && packageManager !== "pnpm") {
    const frontendPkg = JSON.parse(readFileSync(frontendPkgPath, "utf-8")) as PackageJson
    if (frontendPkg.dependencies?.["@restack/shared"] === "workspace:*") {
      frontendPkg.dependencies["@restack/shared"] = "*"
      writeFileSync(frontendPkgPath, `${JSON.stringify(frontendPkg, null, 2)}\n`)
    }
  }

  s.stop(color.green(`Scaffolded ${projectName} files successfully!`))

  // 3. Install dependencies
  if (isCommandAvailable(packageManager)) {
    s.start(`Installing dependencies using ${packageManager} ...`)
    try {
      execSync(`${packageManager} install`, { cwd: targetDir, stdio: "ignore" })
      s.stop(color.green(`Dependencies installed using ${packageManager}!`))
    } catch {
      s.stop(
        color.yellow(
          `Could not automatically run ${packageManager} install. You can run it manually.`,
        ),
      )
    }

    // 4. Build @restack/shared
    s.start("Building @restack/shared package ...")
    try {
      if (packageManager === "pnpm") {
        execSync("pnpm --filter @restack/shared build", { cwd: targetDir, stdio: "ignore" })
      } else if (packageManager === "bun") {
        execSync("bun --filter @restack/shared build", { cwd: targetDir, stdio: "ignore" })
      } else {
        execSync("npm run build --workspace=@restack/shared", { cwd: targetDir, stdio: "ignore" })
      }
      s.stop(color.green("@restack/shared package built!"))
    } catch {
      s.stop(
        color.yellow(
          "Could not automatically build @restack/shared. Run the build script manually.",
        ),
      )
    }
  } else {
    p.log.warn(
      color.yellow(
        `Note: ${packageManager} was not found on your system. Run '${packageManager} install' manually.`,
      ),
    )
  }

  // 5. Initialize git
  try {
    execSync("git init", { cwd: targetDir, stdio: "ignore" })
  } catch {
    // Non-fatal
  }

  const dbConfigStep =
    database === "postgres"
      ? `• For Backend:
     ${color.cyan("cp backend/.env.example backend/.env")}
     (Set ${color.yellow("DATABASE_URL")} and a min-32-character ${color.yellow("JWT_SECRET")})`
      : `• For Backend:
     ${color.cyan("cp backend/.env.example backend/.env")}
     (SQLite database file will be created automatically at ${color.yellow("sqlite.db")})`

  p.note(
    `1. Go to your project directory:
   ${color.cyan(`cd ${projectName}`)}

2. Configure environment variables:
   ${dbConfigStep}

   • For Frontend:
     ${color.cyan("cp frontend/.env.example frontend/.env")}

3. Push database tables:
   ${color.cyan(`${packageManager} --filter backend db:push`)}

4. Start development servers:
   • Backend (API running at http://localhost:3001):
     ${color.cyan(`${packageManager} --filter backend dev`)}
   • Frontend (Next.js running at http://localhost:3000):
     ${color.cyan(`${packageManager} --filter frontend dev`)}`,
    "Next steps to get started:",
  )

  p.outro(color.green(`All done! Enjoy building with the Restack Pattern!`))
}

main().catch((err) => {
  p.cancel(color.red(String(err)))
  process.exit(1)
})
