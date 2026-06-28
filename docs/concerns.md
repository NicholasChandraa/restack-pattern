# Concerns & Open Decisions

## Phase 2 (CLI)
- Support multiple package managers: npm, pnpm, bun, deno
- Either prompt user to choose or auto-detect from run context (e.g. `bunx` → bun)

## Monorepo Tool
- pnpm workspaces for now — add Turborepo only if build time becomes a problem
