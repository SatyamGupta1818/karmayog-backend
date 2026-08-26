# Fixes Applied — Production Hardening

**Date:** 2026-08-26
This document explains, in plain language, every fix made to the Karmayog backend based on the audit in `project.md`: **what the problem was, what I changed, and why**. At the end there's a list of things I deliberately did **not** change (and why), plus how to verify everything.

All changes were verified: the project **builds** (`npm run build`), the app **boots cleanly**, and the **health, response-envelope, rate-limiting, and error paths were tested live** against a real Postgres + Redis.

---

## 🔴 Critical Fixes (P0)

### 1. Database could silently destroy itself in production (`synchronize: true`)

- **Problem:** TypeORM's `synchronize: true` was on in both `database.module.ts` and `configs/database.config.ts`. This makes TypeORM auto-rewrite the live database schema from the code's entities on every boot — it can drop columns and delete data without warning. Fatal in production.
- **Fix:** Auto-sync is now **only enabled in local development** (`synchronize: nodeEnv === 'development'`). Production uses **migrations** instead. I also wired `migrationsRun: true` for production (migrations apply automatically on deploy) and added migration commands to `package.json`:
  - `npm run migration:generate -- src/database/migrations/<Name>` — create a migration from entity changes
  - `npm run migration:run` / `npm run migration:revert`
- **Why:** Production schema changes must be reviewed, versioned, and reversible. Migrations give you that; `synchronize` gives you data loss.
- **⚠️ Action needed from you:** Before your first production deploy, generate the initial migration against a clean database (`npm run migration:generate -- src/database/migrations/InitialSchema`) and commit it. Dev still auto-syncs so your local flow is unchanged.

### 2. A database dump (`backup.sql`, 254 KB) was committed to git

- **Problem:** A full SQL dump was tracked in the repository. That leaks data and bloats the repo/history.
- **Fix:** Removed it from git tracking and disk, and added `*.sql` / `backup.sql` to `.gitignore` so it can't be re-committed.
- **Why:** Data dumps never belong in source control.

### 3. A leftover file could accept forged login tokens

- **Problem:** `jwt-strategy.ts` had `secretOrKey: config.get('JWT_ACCESS_SECRET') || 'accessSecret'` — a hardcoded fallback secret. If the env var were ever missing, the app would verify tokens with a publicly-known secret, letting anyone forge a valid login. (The file was dead code, but it was a landmine waiting to be wired in.)
- **Fix:** Deleted the dead `jwt-strategy.ts`. The **actually-used** strategies (`access-tokern.strategy.ts`, `refresh-token.strategy.ts`) already use `getOrThrow` with no fallback, which is correct.
- **Why:** A secret must never have a default. Fail loudly if it's missing.

### 4. JWT secrets were never validated at boot (and were weak)

- **Problem:** The app signs/verifies tokens with `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, but the boot-time validation (`env.config.ts`) only checked an unused `JWT_SECRET`. So the real secrets were unchecked, and in `.env` they were tiny 14-character strings.
- **Fix:**
  - Added `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to the Joi schema as **required, minimum 32 characters**, plus `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`.
  - Cleaned up the unused/mismatched JWT keys in the config object.
  - **Rotated the local `.env` secrets to strong 64-character random values** and added the missing keys.
- **Why:** Weak secrets can be brute-forced; unvalidated config fails at runtime instead of at startup. Now the app refuses to boot with a weak or missing secret.

### 5. Rate limiting broke under horizontal scaling (in-memory store)

- **Problem:** The throttler used its default **in-memory** store. With more than one server instance, each keeps its own counter, so the real limit becomes N× and inconsistent — useless for protecting against abuse at scale.
- **Fix:** Switched the throttler to a **Redis-backed store** (`@nest-lab/throttler-storage-redis`) so all instances share one counter. Verified live — responses now carry correct `X-RateLimit-*` headers backed by Redis.
- **Why:** "Highly scalable" means multiple instances behind a load balancer. Shared state must live in Redis, not in a single process's memory.

### 6. The `npm` CLI was a runtime dependency

- **Problem:** `package.json` listed `"npm": "^11.11.0"` as a dependency, pulling the entire npm CLI into `node_modules` and the Docker image.
- **Fix:** Removed it and reconciled the lockfile.
- **Why:** It's a mistake that bloats installs and images; nothing in the app imports it.

---

## 🟠 High-Priority Fixes (P1)

### 7. Fine-grained permissions existed in the database but were never enforced

- **Problem:** You had a full RBAC schema (`roles`, `permissions`, `module_permissions`, `role_permissions`) and a service to manage it — but **no guard checked any of it**. Any logged-in user could reach any endpoint their token allowed; the permission tables had zero runtime effect.
- **Fix:** Added the missing enforcement layer:
  - `@RequirePermission('tasks:create', ...)` decorator (`common/decorators/permissions.decorator.ts`)
  - `PermissionsGuard` (`common/guards/permissions.guard.ts`), registered globally. It resolves the permission keys granted to the user's role(s) by joining the RBAC tables, **caches that set in Redis** (5 min) so it's fast, lets `SUPER_ADMIN` bypass, and denies with a clear message listing the missing permission(s).
- **Why:** This is what the whole RBAC schema was built for. It's added in a **non-breaking** way: routes with no `@RequirePermission()` behave exactly as before, so you can lock down endpoints gradually.
- **Next step for you:** Add `@RequirePermission('...')` to your sensitive endpoints as you seed the permission tables.

### 8. Redis cache invalidation used the blocking `KEYS` command

- **Problem:** `RedisService.delByPattern()` used `KEYS pattern`, which scans the entire keyspace and **blocks Redis** while it runs — a real stall under load. This is called on every task/org write.
- **Fix:** Rewrote it to use `SCAN` (a non-blocking cursor that walks keys in small batches).
- **Why:** `SCAN` gives the same result without freezing Redis for other requests. Standard practice in production.

### 9. API key comparison leaked timing information

- **Problem:** `apiKey !== expectedKey` compares character-by-character and returns early on the first mismatch, which can leak the key one character at a time via response-timing analysis.
- **Fix:** Switched to `crypto.timingSafeEqual` (constant-time comparison), with a length pre-check.
- **Why:** Secret comparisons must take the same time regardless of how much matches, so attackers can't measure their way to the key.

### 10. CORS origins were hardcoded

- **Problem:** Allowed browser origins were hardcoded to `localhost:5173/5174` in `main.ts` — wrong for staging/production and not configurable.
- **Fix:** Origins now come from a `CORS_ORIGINS` env var (comma-separated), parsed in `env.config.ts`.
- **Why:** Each environment has different frontends; config belongs in the environment, not the code.

### 11. No real health check for load balancers / Kubernetes

- **Problem:** The only health signal was a hand-written root route that just said "OK" without checking anything. Orchestrators need to know if the app can actually reach its dependencies.
- **Fix:** Added a `HealthModule` with two public endpoints:
  - `GET /api/v1/health` — **liveness** (is the process up?)
  - `GET /api/v1/health/ready` — **readiness**: pings Postgres and Redis, returns **503** if either is down so the load balancer stops sending traffic.
- **Why:** Proper liveness/readiness probes are required for zero-downtime deploys and auto-recovery. Verified live: reports `database: up, redis: up`.

### 12. Access tokens lived too long

- **Problem:** Default access-token lifetime was `120m` (2 hours) — a stolen token stays useful for a long time.
- **Fix:** Reduced the default to `15m` (refresh tokens still last 7 days and rotate).
- **Why:** Short access tokens limit the damage window if one leaks; the refresh-token flow keeps users logged in seamlessly.

### 13. Inconsistent response shapes across the API

- **Problem:** Errors had a standard shape, but successful responses did not — some returned `{message}`, some raw entities, some `{items,total,...}`. Clients had to handle each differently.
- **Fix:** Added a `TransformInterceptor` that wraps every success response in a consistent envelope:
  ```json
  { "success": true, "statusCode": 200, "message": "Success", "data": { ... }, "timestamp": "...", "path": "..." }
  ```
  Interceptor order was set carefully so entities are still serialized (passwords stripped) **before** wrapping. Error responses are unchanged.
- **Why:** A predictable response shape is an industry standard and makes the frontend simpler.
- **⚠️ Breaking change for the frontend:** API responses are now nested under `data`. The frontend must read `response.data.data` (or unwrap once in the API client). Error handling is unaffected. I flagged this loudly because it's the one change that requires a frontend update.

---

## 🟡 Additional Hardening

### 14. Auth endpoints had no extra brute-force protection
- **Fix:** Added tight per-route rate limits on the sensitive auth routes — `request-otp` and `verify-otp` capped at **5/min**, `resend-otp` at **3/min** (via `@Throttle`), on top of the global limit.
- **Why:** OTP request/verify are the prime targets for abuse; they deserve stricter limits than normal endpoints.

### 15. Database credentials hardcoded in `docker-compose.yml`
- **Fix:** Postgres user/password/db now come from env vars (`${DB_USER}`, `${DB_PASS}`, `${DB_NAME}`), with `DB_PASS` marked required.
- **Why:** Secrets shouldn't be committed, even for local compose; this also keeps the DB and the app reading the same credentials.

### 16. Auth guard ran twice on every request
- **Problem:** `CompositeAuthGuard` was registered both globally in `main.ts` and as an `APP_GUARD` in `AuthModule`, so authentication ran twice per request.
- **Fix:** Removed the `main.ts` registration; kept the dependency-injected `APP_GUARD` version (cleaner and testable).
- **Why:** One authentication pass is correct; the duplicate was wasted work.

### 17. Wrong API docs title + no graceful shutdown
- **Fix:** Corrected the Swagger title from **"HealthCare API"** (copy-paste leftover) to **"Karmayog API"**, and added `app.enableShutdownHooks()` so DB/Redis connections close cleanly on shutdown.
- **Why:** Accurate docs; and graceful shutdown prevents dropped connections during deploys.

---

## ⚪ Deliberately NOT Changed (and why)

I checked these from the audit and chose **not** to change them in this pass — each with a reason:

1. **REST route renames** (`/tasks/create` → `POST /tasks`, etc.) — **Skipped.** This would break every existing frontend call and your Postman collections for a purely cosmetic gain. Better done as a coordinated, versioned change with the frontend team.
2. **Automatic tenant-isolation layer** (base repository / query subscriber that auto-injects `organizationId`) — **Skipped for now.** It's the right long-term move, but doing it safely needs a request-scoped tenant context and dedicated tests; a rushed version risks silently hiding or leaking data. The current per-service `orgId` filtering works. **Strongly recommended as the next dedicated task.** (The new `PermissionsGuard` already improves the authorization side.)
3. **Pagination hard cap** (max `limit`) — **Not done here.** It's a valid DoS concern, but the `limit` field is duplicated across many module DTOs; the clean fix is a shared `PaginationDto` all list endpoints extend. Worth a small follow-up refactor.
4. **Test suite** — **Left untouched as you requested** (no `.spec.ts` changes).
5. **Typed entity relations / filename typo rename** (`all-execptions.filters.ts`) — **Skipped.** Cosmetic; renaming the filter file touches imports for no functional gain.

---

## ✅ How This Was Verified

- `npm run build` — compiles with **no TypeScript errors**.
- App **boots cleanly** — every module (including the new `HealthModule`, Redis-backed `ThrottlerModule`) initializes.
- Live tests against real Postgres + Redis:
  - `GET /api/v1/health/ready` → `{ database: "up", redis: "up" }`
  - Success responses are wrapped in the new envelope; **404/error responses keep their original shape**.
  - Rate-limit headers (`X-RateLimit-*`) are present and backed by Redis.
  - Env validation passes and **rejects** weak/missing JWT secrets.

> Note: The repo has ~1600 pre-existing Prettier/formatting lint warnings unrelated to these changes (CI runs test → build → docker, not lint). The new code matches the existing style and compiles clean.

---

## 📋 Recommended Next Steps (your follow-ups)

1. Generate & commit the initial TypeORM migration before production.
2. Update the frontend to read the new `data` envelope.
3. Add `@RequirePermission('...')` to sensitive endpoints and seed the RBAC tables.
4. Build the dedicated tenant-isolation layer + cross-tenant tests.
5. Add a shared `PaginationDto` with a max `limit`.
6. Run `npm audit` and address vulnerable dependencies.
