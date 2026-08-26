# Karmayog Backend — Architecture & Production-Readiness Audit

**Reviewer perspective:** Senior Software Engineer / Solution Architect (10+ yrs)
**Date:** 2026-08-26
**Scope:** Architecture, folder/file structure, authentication & authorization, security, scalability, API & industry-standard compliance.
**Stack reviewed:** NestJS 11, TypeScript, PostgreSQL + TypeORM, Redis (ioredis), JWT/Passport, Swagger, Docker, GitHub Actions.

---

## 1. Executive Summary

Karmayog is a **well-structured, above-average NestJS modular monolith** for a multi-tenant SaaS. The bones are good: clean module separation, global validation, centralized exception handling, Winston logging, request-id tracing, OTP-based passwordless auth with account lockout, Redis caching with cache invalidation, Docker multi-stage build, and a working CI pipeline. For an MVP / portfolio project this is genuinely solid engineering.

**However, it is NOT yet a "highly scalable, production-grade" backend, and it does not fully follow industry standards yet.** There are several **blocking (P0) issues** that would cause real incidents in production — most critically `synchronize: true` on the live database, in-memory rate limiting that breaks under horizontal scaling, a `backup.sql` dump committed to the repo, and inconsistent/unvalidated JWT secret configuration. The fine-grained RBAC permission tables exist but are **not enforced** by any guard.

**Verdict:** Strong MVP foundation. ~3–4 focused weeks of hardening away from being genuinely production-grade.

---

## 2. Overall Rating

### 🟡 Overall: **6.5 / 10** — "Solid MVP, not yet production-grade"

| Category | Score | One-line assessment |
|---|---|---|
| Project structure & modularity | 8.5 / 10 | Clean, consistent, feature-based. Industry standard. |
| Code quality & consistency | 7.5 / 10 | Readable, good patterns, but repetition & `any` in relations. |
| Authentication | 7.5 / 10 | Good OTP + lockout + refresh rotation; config is messy & unsafe defaults. |
| Authorization (RBAC) | 4.5 / 10 | Role guard works but barely used; permission tables **not enforced**. |
| Security | 5.5 / 10 | Good basics (helmet, validation, hashing) undermined by real leaks/gaps. |
| Scalability | 5 / 10 | Caching is good; but in-memory throttler, `KEYS`, no read scaling, stateful bits. |
| Database design | 6.5 / 10 | Good indexes & soft-delete; `synchronize: true` + no migrations is disqualifying for prod. |
| API design / REST standards | 6 / 10 | Versioned + Swagger, but non-REST routes, no unified response envelope. |
| Testing | 3 / 10 | 11 spec files, mostly `should be defined` stubs. No real coverage. |
| Observability & Ops | 6 / 10 | Winston + request-id good; no real healthcheck, metrics, or tracing. |
| DevOps / CI-CD | 7 / 10 | Multi-stage Docker + CI build/push. No migrations step, no env checks. |

---

## 3. What's Done Well (keep this)

- **Feature-based modular architecture** — each domain (`auth`, `tasks`, `projects`, `rbac`, `departments`…) is isolated with `controller / service / dto / entities`. This is the correct NestJS pattern and scales organizationally.
- **Global cross-cutting concerns are centralized** — `ValidationPipe` (whitelist + forbidNonWhitelisted + transform), `AllExceptionsFilter`, `LoggingInterceptor`, `ClassSerializerInterceptor`, Winston logging, `RequestIdMiddleware` for tracing.
- **Env validation via Joi** — app crashes on missing required config (fail-fast). Good instinct.
- **OTP auth done thoughtfully** — hashed OTP in Redis, attempt counters, account lockout, enumeration-safe responses ("If this email is registered…"), refresh-token rotation with reuse detection. This is better than most MVPs.
- **Caching with invalidation** — services cache reads and invalidate list + entity caches on writes (`tasks.service.ts`). Many teams forget invalidation entirely.
- **DB hygiene** — UUID PKs, `timestamptz`, composite + column indexes, soft-delete flags, sensible `onDelete` cascade rules, `select: false` on `password`/`hashedRefreshToken`, `toSafeObject()` to strip secrets.
- **Transactional multi-entity writes** — org+owner registration uses `dataSource.transaction`.
- **Ops baseline** — multi-stage Dockerfile, docker-compose, GitHub Actions (lint→test→build→docker push to GHCR).

---

## 4. Architecture Review

**Style:** Modular monolith — the right choice for this stage. Do **not** jump to microservices; the codebase isn't ready and doesn't need it.

**Strengths:** clear layering (Controller → Service → Repository/TypeORM → DB), global config module, shared module for cross-cutting services (email, redis).

**Gaps:**
- **No explicit repository layer.** `ARCHITECTURE.md` claims a "Repository Pattern" and `repositories/` folders, but services talk to TypeORM repositories directly. That's a perfectly fine and pragmatic choice — but **the docs describe an architecture that doesn't exist**. Either add thin repository classes or (recommended, lazier) update the docs to match reality.
- **No domain/service interfaces or DI abstractions** where it matters (e.g. `EmailService`, `RedisService` are concrete). Fine for now; only abstract when you have a second implementation.
- **No unified success-response envelope.** Errors are standardized by `AllExceptionsFilter`, but success responses are raw. The docs promise "consistent response structure" — add a `TransformInterceptor` to wrap `{ success, data, meta }`.
- **`CompositeAuthGuard` is registered twice** — once via `app.useGlobalGuards()` in `main.ts` and again as `APP_GUARD` in `auth.module.ts`. It runs on every request twice. Pick one (prefer the `APP_GUARD` provider so it's DI-managed and testable) and delete the other.

---

## 5. Project Structure Review — **8.5/10, industry standard**

The `src/common | configs | database | modules | shared` layout is textbook NestJS and easy for a new engineer to navigate. Naming is consistent (`*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.entity.ts`).

**Issues:**
- **`backup.sql` (254 KB) is committed to the repo.** Remove it, add to `.gitignore`, and rotate any credentials/data it contains. DB dumps never belong in git.
- **`npm` is listed as a runtime dependency** in `package.json` (`"npm": "^11.11.0"`). This is a mistake — it pulls the entire npm CLI into `node_modules` and your Docker image. Remove it.
- Two Postman collections + `GEMINI.md` + `ai_context/` docs are committed. Fine, but move API collections to a `docs/` folder to keep root clean.
- Typo in filename: `all-execptions.filters.ts` → `all-exceptions.filter.ts`.
- Empty placeholder entity `rbac.entity.ts` (`export class Rbac {}`) — delete dead code.

---

## 6. Authentication Review — **7.5/10**

**Good:** passwordless OTP login, bcrypt-hashed OTP & refresh tokens, lockout after 5 attempts, refresh rotation + reuse detection, enumeration-safe messages, `ignoreExpiration: false`.

**Problems:**
- **JWT configuration is inconsistent and partly unvalidated — P0/P1.**
  - Joi validates `JWT_SECRET`, `JWT_ACCESS_EXPIRATION_MINUTES`, `JWT_REFRESH_EXPIRATION_DAYS`.
  - But `auth.service.ts` actually uses `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (via `getOrThrow`), `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
  - So the secrets the app depends on are **never validated at boot**, and the validated ones (`JWT_SECRET`) may be unused. Three different naming schemes coexist.
  - **`jwt-strategy.ts` falls back to a hardcoded `'accessSecret'`** if `JWT_ACCESS_SECRET` is unset — a catastrophic default that would accept forged tokens. Remove the fallback; require the secret.
- **Access token default is `120m` (2 hours)** — too long. Use 15m access / 7d refresh.
- Access and refresh tokens are signed with the **same payload**; fine, but ensure separate secrets are enforced (see above).

**Fix:** consolidate to one env naming convention, add all JWT vars to the Joi schema as `required()`, delete all hardcoded secret fallbacks.

---

## 7. Authorization (RBAC) Review — **4.5/10, the weakest area**

- `RolesGuard` is registered globally (`APP_GUARD`) and works — but `@Roles()` is used in only **2 places** across the codebase. Most endpoints have **no role enforcement**; they're protected only by "is authenticated."
- **The fine-grained permission model is not enforced.** You have `Modules`, `Permission`, `ModulePermission`, `RolePermission` entities and an `RbacService` to manage them — but there is **no `PermissionsGuard` / `@RequirePermission()`** anywhere. The permission tables are pure data with no runtime effect. Any authenticated user can hit any endpoint their JWT reaches.
- **Multi-tenant isolation is enforced by convention only.** Every service must remember to filter by `orgId`. There is no row-level security, no request-scoped tenant context, no query interceptor. One forgotten `WHERE organization_id = ?` = cross-tenant data leak. This is the **single biggest architectural risk** for a multi-tenant SaaS.

**Fixes (priority order):**
1. Build a `PermissionsGuard` + `@RequirePermission('tasks:create')` decorator that reads the RBAC tables (cache the role→permission map in Redis). This is what the whole RBAC schema was built for.
2. Apply role/permission decorators to **every** mutating endpoint.
3. Add a tenant-isolation safety net: a base repository or query subscriber that auto-injects `organizationId`, or at minimum a lint/review checklist + integration tests that assert cross-org access returns 404/403.

---

## 8. Security Review — **5.5/10**

**Good:** helmet, CORS allow-list, compression, rate limiting present, input whitelisting, bcrypt, secrets excluded from serialization, generic error messages.

**Issues:**

| Severity | Issue | Fix |
|---|---|---|
| 🔴 P0 | `backup.sql` committed to git | Remove, gitignore, rotate any exposed data |
| 🔴 P0 | Hardcoded JWT secret fallback in `jwt-strategy.ts` | Require secret; no default |
| 🟠 P1 | API key compared with `!==` (not constant-time) | Use `crypto.timingSafeEqual` |
| 🟠 P1 | Single static global API key, no rotation/scoping | Per-client keys, hashed at rest, rotation |
| 🟠 P1 | CORS origins hardcoded to `localhost:5173/5174` | Drive from env per environment |
| 🟠 P1 | `docker-compose.yml` has `postgres/postgres` creds inline | Use env, never commit real creds |
| 🟡 P2 | No security headers beyond helmet defaults; CSP only in prod | Tune CSP, HSTS |
| 🟡 P2 | Throttler is global-only; no stricter limit on `/auth/*` OTP endpoints | Add per-route throttle on OTP/login |
| 🟡 P2 | No audit logging despite being a stated goal | Add audit trail for sensitive actions |
| 🟢 P3 | No dependency/secret scanning in CI | Add `npm audit`, Trivy, gitleaks |

---

## 9. Scalability Assessment — Is it "highly scalable"? **Not yet. 5/10.**

**Honest answer: the application would run on a single instance fine, but it will break or degrade when you scale horizontally (multiple pods/instances) — which is the definition of "highly scalable."**

Blockers to horizontal scaling:

- **🔴 In-memory rate limiting.** `ThrottlerModule` uses the default in-memory store. With N instances behind a load balancer, each instance keeps its own counter → effective limit is N× and inconsistent. **Use `@nest-lab/throttler-storage-redis`** so limits are shared. (You already run Redis — this is low effort.)
- **🟠 `RedisService.delByPattern` uses `KEYS`** — an O(N) blocking command that stalls Redis under load. **Switch to `SCAN`.** Better: track cache keys in a set, or use tag-based invalidation.
- **🟠 Single Redis connection, no cluster/sentinel awareness**, `maxRetriesPerRequest: 3`. Fine for one node; plan for Redis HA before "highly scalable" is true.
- **🟠 No DB read/write separation, no connection pool tuning**, no statement timeouts. TypeORM defaults won't survive real concurrency.
- **🟡 No pagination cap** — `limit` from the client is unbounded in query DTOs; a client can request `limit=100000`. Enforce a max.
- **🟡 List-cache invalidation is broad** (`delByPattern('tasks:list:*')`) — every write nukes all list caches for the org. Acceptable now; won't scale to high write volume.
- **🟡 Stateful `switchOrganization`** mutates the user's active org in the DB — this is a poor multi-tenant pattern (two concurrent sessions of a super-admin fight over the active org). Encode active org in the token/session instead.

What **is** scalable: stateless JWT auth, Redis caching layer, Docker image, modular code that could later be split into services.

---

## 10. API Design / Industry-Standard Compliance — **6/10**

- ✅ URI versioning (`/api/v1`), Swagger docs, DTO validation, bearer + api-key auth documented.
- ❌ **Non-RESTful routes.** `POST /tasks/create`, `PATCH /tasks/update/:id`, `DELETE /tasks/delete/:id`. REST uses the HTTP verb for intent: `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`. The verbs in the path are redundant.
- ❌ **No standard success envelope** — response shape varies per endpoint (`{message}`, raw entity, `{items,total,...}`). Add a `TransformInterceptor`.
- ❌ **Swagger metadata is wrong** — title is `"HealthCare API"` / "HealthCare Backend" (copy-paste leftover). Only `Auth`/`Users` tags declared though many modules exist.
- 🟡 Pagination shape is ad-hoc per service; standardize a `PaginatedDto<T>`.
- 🟡 No `@nestjs/terminus` health endpoint — the manual `server.get('/')` doesn't check DB/Redis. Add `/health` (liveness) and `/ready` (readiness with DB+Redis pings) for k8s/load-balancer probes.

---

## 11. Testing — **3/10**

- 11 `.spec.ts` files exist but most are `should be defined` scaffolds (see `rbac.service.spec.ts` with `repositoryMock = {}`).
- No meaningful unit tests of business logic, no integration tests, no e2e beyond scaffold.
- **For a multi-tenant app, the highest-value tests are cross-tenant isolation tests** — assert user from org A cannot read/modify org B's data. These don't exist and are the ones that prevent your worst incident.
- CI runs `--passWithNoTests`, so it's green while testing nothing.

**Fix:** write real service unit tests for auth + one CRUD module, add e2e tests for the auth flow and tenant isolation. Target coverage on services, not controllers.

---

## 12. Database — **6.5/10**

- ✅ Good indexing (composite index on `[organizationId, projectId, featureId, isDeleted]`), UUIDs, `timestamptz`, soft delete.
- 🔴 **`synchronize: true` in BOTH `database.module.ts` and `configs/database.config.ts`.** This lets TypeORM auto-alter your production schema from entity changes — **it can and will drop columns/data.** Never use in production.
- 🔴 **No migrations exist** despite a `data-source.ts` configured for them and no npm scripts wired.
- 🟡 Entity relations are typed as `any` (`organization: any`, `project: any` in `task.entity.ts`) to avoid circular imports. Use `Relation<Organization>` from TypeORM or forward-referenced types to keep type safety.

**Fix:** set `synchronize: false`, add `migration:generate/run/revert` npm scripts, generate an initial migration, and run migrations as a CI/CD deploy step.

---

## 13. Prioritized Roadmap to Production

### 🔴 P0 — Blocking (do before any production deploy)
1. Set `synchronize: false`; introduce TypeORM migrations + npm scripts + generate initial migration.
2. Remove `backup.sql` from the repo & history; gitignore it; rotate exposed data.
3. Remove the hardcoded JWT secret fallback in `jwt-strategy.ts`; add all real JWT env vars to the Joi schema as `required()`.
4. Switch rate limiting to Redis-backed storage (`@nest-lab/throttler-storage-redis`).
5. Remove `npm` from `package.json` dependencies.

### 🟠 P1 — High (production hardening)
6. Build & enforce `PermissionsGuard` + `@RequirePermission()` using the existing RBAC tables; apply role/permission decorators to all mutating endpoints.
7. Add a tenant-isolation safety net (base repo / query subscriber) + cross-org integration tests.
8. Replace Redis `KEYS` with `SCAN` in `delByPattern`.
9. Env-driven CORS; constant-time API-key compare; per-route throttling on OTP/auth.
10. Fix REST routes (drop `/create`,`/update`,`/delete` verbs) and add a `TransformInterceptor` for a unified response envelope.
11. Add `@nestjs/terminus` `/health` + `/ready` with DB & Redis checks.
12. Reduce access-token TTL to ~15m.

### 🟡 P2 — Medium (quality & robustness)
13. Real test suite (auth flow, one CRUD module, tenant isolation e2e); remove `--passWithNoTests`.
14. Fix Swagger metadata (title/tags); document all modules.
15. Cap pagination `limit`; standardize `PaginatedDto`.
16. De-duplicate `CompositeAuthGuard` registration.
17. Audit logging for sensitive actions.
18. Type entity relations properly (`Relation<T>`); delete `rbac.entity.ts` stub; fix filename typos.

### 🟢 P3 — Nice-to-have (scale & polish)
19. Redis HA (sentinel/cluster) plan; DB pool tuning + statement timeouts.
20. Move `switchOrganization` state out of the DB into token/session.
21. Metrics (Prometheus) + distributed tracing (OpenTelemetry).
22. Security scanning in CI (`npm audit`, Trivy, gitleaks); enable `app.enableShutdownHooks()`.
23. Update `ai_context/ARCHITECTURE.md` to match the real (no explicit repository layer) architecture.

---

## 14. Bottom Line

**Is it highly scalable today?** No — in-memory rate limiting, `KEYS`-based cache invalidation, and stateful org-switching break under horizontal scaling. The caching and stateless-auth foundations are there, but it's a single-instance app right now.

**Does it follow industry standards?** Partially. Structure, validation, logging, and auth fundamentals are industry-standard; RBAC enforcement, migrations, REST conventions, response consistency, and testing are not yet.

**Is it production-ready?** Not yet — the P0 list (especially `synchronize: true` and the committed DB dump) would cause real incidents. But this is a **strong foundation**, clearly built by someone who understands good architecture. Clear the P0 + P1 items (~3–4 weeks) and this becomes a genuinely production-grade, scalable backend rated **8.5/10**.
