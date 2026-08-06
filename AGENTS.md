<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Digitix HRMS is a single Next.js 16 (App Router) full-stack app — frontend + API routes in one process — backed by PostgreSQL via Prisma. There is no separate backend service. Standard commands live in `README.md` and `package.json` scripts; only the non-obvious cloud caveats are captured here.

### Services to run (two total)
- App: `npm run dev` (port 3000). Build: `npm run build`. Lint: `npm run lint` (repo currently has pre-existing lint warnings/errors unrelated to setup).
- PostgreSQL 16: installed locally (no Docker in this environment). It is NOT auto-started on boot — start it each session with `sudo pg_ctlcluster 16 main start`. DB `digitix_hrms`, user `hrms` / password `hrms_password`.

### Non-obvious caveats
- Next.js 16 (this modified version) renamed `middleware` → `proxy` and runs it on the Node.js runtime. The auth check imports Prisma/`pg`, which cannot load in the Edge runtime, so it MUST live in `src/proxy.ts` (already migrated). Do NOT recreate `src/middleware.ts` or move auth back to Edge — every route will 500 with `node:util/types` not found.
- `.env` is gitignored (not committed). The app needs at least `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`. Working local values:
  - `DATABASE_URL="postgresql://hrms:hrms_password@localhost:5432/digitix_hrms?schema=public"`
  - `NEXTAUTH_URL="http://localhost:3000"`, `NEXTAUTH_SECRET`/`JWT_SECRET` = any non-empty string.
- After a fresh DB, apply schema + seed before the app is usable: `npm run db:push` then `npm run db:seed`. Seeding is idempotent-ish; re-running recreates sample data. `README.md` lists the seeded login credentials (admin `admin@digitixlabs.com` / `Admin@123`).
- `UPLOADTHING_SECRET` / `UPLOADTHING_APP_ID` are optional (only payslip/file uploads degrade without them).
