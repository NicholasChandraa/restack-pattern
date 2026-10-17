<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Guardrails
- **Typed Routes Active**: All internal links `<Link href="...">` are strictly checked at compile time. Never use untyped arbitrary string paths.
- **Typed Environment**: Always import `env` from `@/env` (`@t3-oss/env-nextjs`). Never read raw `process.env`.
- **Semi-DDD Boundary**: Keep `app/` strictly for routing/metadata only. Delegate all rendering to `domains/[feature]/components`.
<!-- END:nextjs-agent-rules -->

