# Concerns & Open Decisions

## Phase 2 (CLI)

- Support multiple package managers: npm, pnpm, bun, deno
- Either prompt user to choose or auto-detect from run context (e.g. `bunx` → bun)

## Monorepo Tool

- pnpm workspaces for now — add Turborepo only if build time becomes a problem

- Aku juga mau didalam monorepo ini, disiapin docs khusus yang dimana tujuannya supaya AI bisa langsung paham mengenai monorepo ini.

- Handle dependencies update. Ini perlu dipikirkan juga kalau misal ada dependencies yang sudah diupdate, apakah sistem scaffoldingn ini sudah auto update tiap kali orang install library ini atau kita sebagai developer harus update manual.

- Perlu handle juga supaya untuk login OAuth ke Google itu sudah ter setup, Telegram Bot, Discord Bot.

- perlu tambahin docs codenya

- perlu review lagi untuk securitynya

- perlu bisa setting ga, user bisa pake drizzle, dan bisa gapake drizzle?

- Perlu ada docs yang kasih tau kalau db nya mau bebas bisa atau engga? kaya misal pake sqllite, postgres, atau mysql. Jadi user dikasih pilihan?
