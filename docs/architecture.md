# Architecture

## Current Layout

- `apps/api`: Node.js + Express + Socket.IO backend
- `apps/web`: Vue 3 + Vite frontend
- `apps/desktop`: Electron shell
- `prisma`: formal chat schema and seed data
- `infra`: environment, Prisma, Redis, and MinIO configuration
- `scripts`: helper commands for local development
- `tests`: reserved area for automated coverage

## Runtime Flow

1. `npm run dev` starts `apps/api/src/server/index.mjs`
2. `npm run build:web` outputs static files to `apps/web/dist`
3. API serves static files from `apps/web/dist`
4. Browser calls HTTP APIs for auth, profile, conversations, messages
5. Socket.IO pushes realtime updates for newly created, edited, deleted, or read messages
6. `npm run dev:desktop` builds the web frontend, starts the local API, and opens Electron
7. Persistence uses `MySQL`, session state uses `Redis`, and chat file storage uses `MinIO`
8. Browser avatar rendering goes through a public app route, while file presign URLs are rewritten with `MINIO_PUBLIC_ORIGIN`

## Next Recommended Evolution

- Add formal Prisma migrations instead of relying on `prisma db push`
- Expand integration tests for the Docker stack
- Add Electron packaging / auto-update / release pipeline
