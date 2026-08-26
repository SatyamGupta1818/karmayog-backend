# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Karmayog — a multi-tenant SaaS platform for organization operations & project execution (SME-focused, Jira/ClickUp-style). NestJS 11 + TypeScript + PostgreSQL (TypeORM) + Redis. Modular monolith. See `ai_context/` for the full product/architecture vision.

## Commands

```bash
npm run start:dev        # watch-mode dev server
npm run start:debug      # watch + --inspect
npm run build            # nest build → dist/
npm run start:prod       # node dist/main
npm run lint             # eslint --fix over src/apps/libs/test
npm run format           # prettier write
npm test                 # jest (unit, *.spec.ts under src/)
npm run test:watch
npm run test:cov
npm test -- tasks.service   # run one spec file by name pattern
npm run test:e2e         # jest with test/jest-e2e.json
```

There is no separate lint-check script — `lint` auto-fixes. Node/postinstall strips a broken `exports` field from `@nestjs-modules/mailer`; if mailer imports break after a fresh install, re-run `npm install`.

## Runtime shape (main.ts)

- Global prefix `api` + URI versioning, default v1 → routes live at `/api/v1/...`.
- Swagger at `/api/docs` (non-production only).
- Global: `ValidationPipe` (whitelist + forbidNonWhitelisted + transform), `AllExceptionsFilter`, `LoggingInterceptor`, `ClassSerializerInterceptor`, `ThrottlerGuard`.
- Env is Joi-validated at boot (`src/configs/env.config.ts`) — **the app crashes on any missing required env var**. Required: `NODE_ENV`, `DB_*`, `JWT_SECRET`, `API_KEY`, `MAIL_*`.

## Auth & authorization

- **`CompositeAuthGuard` is registered globally** (`main.ts`), so every route requires a JWT bearer token by default. To change that per-route/controller, use decorators from `src/common/decorators/`:
  - `@Public()` — no auth.
  - `@RequireApiKey()` — validates `x-api-key` header instead of JWT.
  - `@Roles(...)` — enforced by `RolesGuard` against `user.roles`.
- The authenticated user is on `request.user` (`AuthenticatedUser`, see `src/modules/auth/interfaces/jwt-payload.interface.ts`). Access it in controllers via `@GetCurrentUser()` (whole object) or `@GetCurrentUser('userId')` (single field).
- JWT strategies (access/refresh) live in `src/modules/auth/strategies/`.

## Multi-tenancy — critical

Almost every entity is scoped to an organization. **Never trust an org id from the request body/query for a normal user.** The established pattern (see `tasks.controller.ts`):

- Controllers derive the effective org from `user.orgId`; only `SUPER_ADMIN` may target another org via a request-supplied `orgId`.
- Services take `orgId` and filter every query by it, plus `isDeleted = false` (soft deletes are the norm — set `isDeleted`/`isActive`, don't hard-delete).

When adding endpoints, follow this: resolve org in the controller, pass it down, filter by it in the service.

## Module conventions

Each feature lives under `src/modules/<name>/` with `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, `entities/`. To wire a new module, add it to `imports` in `src/app.module.ts`.

- **Controllers**: HTTP only — resolve org, call the service, annotate with Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`). No business logic, no DB access.
- **Services**: business logic + TypeORM repository access (injected via `@InjectRepository`). Cross-entity validation lives here (see `ensureFeature`/`ensureUser` helpers in `tasks.service.ts`).
- **DTOs**: validated with `class-validator`; document fields with `@ApiProperty`.
- **Caching**: services cache reads in Redis via `RedisService` (`src/shared/cache/redis/`). Convention: per-entity key prefix + a list-cache prefix; invalidate both on writes (`clearCache`/`clearListCache` pattern). Use `delByPattern` for list caches.

## Database

- **`synchronize: true` is on** (`src/database/database.module.ts`) — the schema auto-syncs from entities in dev. There is a separate `src/database/data-source.ts` for TypeORM CLI migrations (`src/database/migrations/`), but no migrations exist yet and no npm migration scripts are wired. Prefer entity changes for dev; add migration scripts before relying on migrations in prod.
- Entities are auto-loaded (`autoLoadEntities`). Common fields: `id`, `createdAt`, `updatedAt`, soft-delete flags (`isDeleted`/`isActive`).
- User entity exposes `toSafeObject()` to strip sensitive fields before returning nested user relations — call it (see `sanitizeUsers` in `tasks.service.ts`).

## Notes

- `ai_context/CODING_STANDARD.md` describes a plan-then-approve workflow ("Proceed with implementation"). That is the human team's process guidance, not a hard gate for routine edits — use judgment.
- Windows/PowerShell environment.
