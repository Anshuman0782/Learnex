# LERNEX Backend

NestJS + PostgreSQL + Prisma API for the LERNEX app. Built phase by phase (see the
project roadmap). Structure is strictly modular — one folder per feature.

## Structure

```
src/
├── config/            # Environment variable validation (fail-fast at startup)
├── prisma/            # PrismaModule + PrismaService (single DB access point)
├── modules/           # Feature modules — one folder each
│   └── health/        #   controller · service (+ dto/guards as features grow)
├── app.module.ts      # Wires config, database, and feature modules together
└── main.ts            # Bootstrap: security headers, validation, CORS, /api/v1 prefix
prisma/
└── schema.prisma      # Database models (grows each phase)
```

Every feature module follows the same split: `*.controller.ts` (routes),
`*.service.ts` (logic), `*.dto.ts` (validated input), `*.module.ts` (wiring).

## Local setup

1. **Install PostgreSQL** and create the database + user (see steps below).
2. Copy env file and adjust the DB credentials if needed:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the database migration:
   ```bash
   npm run prisma:migrate
   ```
5. Start the dev server:
   ```bash
   npm run start:dev
   ```
6. Verify: open http://localhost:3000/api/v1/health — should return
   `{"status":"ok","database":"up",...}`.

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Run API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run prisma:migrate` | Create/apply a DB migration |
| `npm run prisma:generate` | Regenerate the Prisma client after schema changes |
| `npm run prisma:studio` | Open a visual DB browser |
| `npm run lint` | Lint the codebase |

## Security baseline (Phase 0)

- Secrets live only in `.env` (gitignored); `.env.example` documents the shape.
- Environment is validated at startup — the app refuses to run if misconfigured.
- `helmet` sets secure HTTP headers.
- Global validation strips/blocks unexpected request fields.
- Passwords are never stored raw (argon2 hashing arrives in Phase 1).
- Soft-delete (`deletedAt`) on records so nothing is truly lost / can be moderated.
