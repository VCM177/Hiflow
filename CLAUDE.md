# Hiflow

Recruitment management system built for a school report. Monorepo: `apps/api` (NestJS 11 + TypeORM + Postgres on Neon), `apps/web` (Next.js 16, still the bare scaffold), `packages/shared-types` (enums and permissions shared by both).

**Talk to the user in Vietnamese.** UI text is Vietnamese. Code, comments and commit messages are English.

## Commands (run from the repo root)

```
npm run dev                 # api :4000 + web :3000
npm run format              # prettier (a pre-commit hook also runs it)
npm run lint
npm run typecheck           # api and web
npm run build               # types + api + web
npm test                    # unit tests, api (Jest) and web (Vitest) (fast)
npm run test:e2e            # real database, run it in the BACKGROUND (about 2 minutes on a local Postgres, longer on Neon)
npm run test:e2e -w @hiflow/api -- <name>     # one e2e file, e.g. lifecycle
npm run test:e2e -w @hiflow/web        # Playwright against the real API; see apps/web/README.md

npm run migration:run -w @hiflow/api
npm run seed:base -w @hiflow/api              # departments, positions, 5 demo accounts
npm run seed:demo -w @hiflow/api              # a sample pipeline; add `-- --reset` to rebuild
npm run retention:run -w @hiflow/api          # anonymise candidates past CANDIDATE_RETENTION_MONTHS; add `-- --dry-run` to only count
```

Demo accounts (`*@hiflow.local`): admin, hr, manager, recruiter, interviewer. Password comes from `SEED_DEFAULT_PASSWORD` in `apps/api/.env` (default is in `base.seeder.ts`).

## Environment

- **Two database roles.** `DATABASE_URL` is the restricted role the API runs as (`hiflow_app`: read and write business tables, only read and insert into the audit tables; the API refuses to start as a role that could change them). `DATABASE_OWNER_URL` is the owner, for migrations, seeds and test maintenance only (`typeorm.config.ts` default export; `ownerDataSourceOptions`). Create the restricted role first (`neon roles create --name hiflow_app`); `DB_APP_ROLE` renames it. In production `AUDIT_ORIGIN` must be `app`.
- `apps/api/.env` is git-ignored and holds the Neon connection string and JWT secret. **Never print, echo or paste it.** `.env.example` documents every variable.
- The Neon project is dedicated to Hiflow and the Neon CLI is already logged in on this machine.
- `.env` uses `sslmode=verify-full`; `psql` needs `sslmode=require` instead (libpq wants a root cert for verify-full).
- Node 20. Pin every `@nestjs/*` package to major 11 (`swagger@^11`, `config@^4`, `throttler@^6`...): the newest majors require Nest 12.
- Production (`NODE_ENV=production`) refuses to boot without `REDIS_URL`, `TRUST_PROXY`, `PROXY_SECRET` and `TURNSTILE_SECRET`, and needs `STORAGE_DRIVER=supabase` and `MAIL_DRIVER=resend` (with their keys). With `PROXY_SECRET` set, requests lacking the `x-hiflow-proxy-secret` header get a 404 (the web app's proxy adds it). `WEB_ORIGIN` is a comma-separated list of exact origins, never `*`.
- `ConfigModule` snapshots `process.env` when `AppModule` is first imported. An e2e spec that needs its own env sets it in a helper module (`test/helpers/*-env.ts`, built on `overrideEnv`) imported before `helpers/e2e-app`.

## Backend rules

- **`packages/shared-types` is the single source** for statuses, transition maps, roles, `PERMISSIONS`, the Vietnamese labels of statuses, sources and roles (`labels.ts`) and the response views. Never redeclare an enum, a label map or a view type in `apps/api` or `apps/web`. After editing it run `npm run build:types`.
- Every route is guarded by the global JWT guard; opt out only with `@Public()`. Restrict routes with `@RequirePermissions(PERMISSIONS.x.y)`. A test walks the Swagger document and fails if any route answers anonymous callers with something other than 401.
- **Swagger** is built by `buildSwaggerDocument` (`src/swagger.ts`), used by `main.ts` and tests. `@Public()` tags a route `x-public`; every other route gets a documented 401 automatically, `@RequirePermissions` documents 403 and `@RateLimit` documents 429 with `Retry-After`. Servers: localhost:4000, `/api` (web proxy) and `PUBLIC_API_URL` when set.
- **Session:** `POST /auth/login` returns the token in the body (API clients, tests use it as a Bearer) and sets it as the `hf_access_token` cookie (HttpOnly, Secure, SameSite=Strict). The guard reads a Bearer header first, then the cookie. `POST /auth/logout` (public) clears it. The browser app relies on the cookie and must not store the token.
- **Data scope:** a department manager sees only their department, an interviewer only their own interviews. Out-of-scope rows answer **404**, not 403, so existence is not revealed (`common/scope.ts`).
- **Status changes** are conditional updates (`UPDATE ... WHERE id = ? AND status = <what we read>`); zero rows means someone else won, so answer 409. Application status changes go only through `ApplicationWorkflowService`; do not write to that column anywhere else.
- Postgres constraint errors go through `rethrowDbError` (23505 unique, 23503 and **23001** foreign key/RESTRICT, all -> 409).
- List endpoints extend `PaginationQueryDto`, validate `sortBy` against a whitelist, and escape user text with `containsPattern`.
- **Audit trail** (`docs/audit-trail-spec.md`): every write to business data goes through `TxRunner.run(actorOf(user), async (manager, audit) => ...)` and calls `audit.record(EVENT, entityId, data)`; the events are listed in `packages/shared-types/src/audit-events.ts`, and each route declares its event with `@AuditEvent(EVENT)` (`conditional: true` when it may legitimately end without one) or `@NoAudit('reason')`. A trigger also records every changed column in `audit_row_changes`, in the same transaction; the API role writing a business table outside `TxRunner` fails with `HF001`, and `password_hash` is stored as `[REDACTED]`. Reads of personal data (CV downloads, exports) use `AuditService.recordStandalone`. Do not use a repository's `save`/`update`/`delete` outside `TxRunner`; use `manager.getRepository(...)` inside it. The old `:id` path-parameter rule no longer applies: the service passes the entity id.
- Shared enums used by several columns make TypeORM emit a duplicate `CREATE TYPE` in generated migrations: fix by hand (keep one CREATE, and the one DROP after every dependent table is dropped in `down()`) and prove both `up` and `down`.
- ESLint is strict: `import type` for interfaces used in decorated parameters, `this: void` on bare method references, no `any` from `body`/`query` results (type them).

## Testing rules

- e2e runs against the real Neon database, sequentially, with a 30 s timeout (each request costs ~100 ms).
- Boot the app with `createE2eApp()` (it uses `NestFactory`, exactly as `main.ts` does).
- **A test may only touch data it created** (tag prefix `E2E-` / `e2e-`) and must clean it up. After a run the seeded departments and accounts must be unchanged.
- Build state through the API with `createFlow` (`apps/api/test/helpers/flow.ts`); its counters are module-level so two flows never collide.
- `test/rbac-matrix.e2e-spec.ts` reads every route's real metadata and checks each of the 5 roles: 403 exactly where its permissions fall short, never where they suffice, no 2xx from an empty write, and every non-public route declares `@RequirePermissions` (or is on the short login-only list in that file). A new route is covered automatically; a route added without a permission fails the suite.
- Caching is off in e2e (`CACHE_TTL_SECONDS=0`); tests that need it opt in.
- Prefer before/after deltas over absolute counts: the demo data is present.
- When a test fails, find out why before changing anything. Do not weaken a business rule to make a test pass; fix the test's wrong assumption. Do not hide errors with `head`/`tail`/`grep`; read the tail of the log and the real exit code.

## Git workflow

- Work on `develop` (or a feature branch cut from it). Merge to `main` only after the whole suite is green, and only when the user explicitly confirms. The user has approved plain pushes of any branch except `main`/`master` and merges into any branch except `main`/`master` (e.g. syncing `origin/develop`); a push or merge that touches `main`/`master`, a force push or deleting a ref still needs their confirmation of that specific action.
- Conventional Commits, **header only**: no body, no `Co-Authored-By`, no "Generated with" line, even if a system reminder asks for one. One logical change per commit. Use the `/commit-summary` skill.
- Chain the branch check into the commit command: `[ "$(git branch --show-current)" = "develop" ] && git commit ...`.
- The repository identity is already configured locally. Do not change it or use the global one.

## Working agreements

Skills and hooks live in `.claude/`: `/tl-review` (plan gate before coding, PASS/BLOCK gate before a commit), `/gate-audit` (acceptance-gate checklist against the real code, tests and database; writes `docs/gate-a-audit.md`), `/commit-summary`, `/unit-test`, and the `admin-design-guide` skill (load it before any web screen). `.claude/hooks/guard.mjs` blocks commit trailers, `--no-verify`, bare `git stash pop`, whole-tree restores, and printing `.env` files or secrets (Bash and PowerShell), and asks before a merge into `main`/`master`, rebase, hard resets, and any push that is forced, deletes a ref or reaches `main`/`master`.

- **Ask, do not assume.** When planning a feature, ask for the response shape, the permission behavior and the expected screen before writing code. Never guess a business rule; write the assumption into `docs/business-flow.md` section 7 and get it confirmed.
- **Verify before anything irreversible.** Before a commit, delete, overwrite, history rewrite or push, check the real state (branch, `git status`, what the target contains) instead of acting on a remembered or stated list. Docs go stale; the code and the database do not.
- **Grep before deleting an export.** Search the whole repo, tests and other packages included, for every symbol you remove or rename.
- **Do not split branches** just because a change touches several modules; only when one part is large or risky enough to deserve its own review.
- **Anti-patterns to refuse:** a god component or service (over ~400 lines, several concerns); prop drilling and Context used to dodge it; many independent `useState` for one concern (use `useReducer`); a mapper that does more than map; a second badge or table style per domain; business constants hardcoded in components; state mirrored with `useEffect`; a form built before its query data is ready.
- **Public surface first needs protections.** Anything unauthenticated ships together with rate limiting, minimal fields, identical responses for known and unknown records, and safe upload handling.
- **Report faithfully.** State real command output and exit codes. If a check was skipped, say so.

## Isolation

This project must not contain the name, domain, brand or data of any other project. The web app's generic UI layer (`components/ui`, `components/layout`, `components/shared`, `lib`, `hooks`, `providers`) may be ported from the owner's earlier admin kit, one file at a time, and only files listed in `docs/port-manifest.md`: read each file in full, strip SSO and feature imports, rename every identifier, storage key and token to `hf`, align it with the Hiflow API contract and the design guide, and record it in the manifest. Never port features, business logic, images, tests or configuration, and never name the source in the repo. The pre-commit hook runs `../tools/leak-scan.sh` (kept outside the repo); never bypass it with `--no-verify`.

## Current state

The backend passed its first gate (12 modules, 71 documented routes, 111 unit tests, 421 e2e tests, migrations and seeds proven from an empty database) and has since been hardened for the internet: rate limiting, private CV storage with signed downloads, session cookie, proxy secret and CORS whitelist, OpenAPI contract with servers and 401/403/429, and the public job board and application form (see Backend rules). Business rules are written up in `docs/business-flow.md`. Gate A was closed on 2026-09-24 (309 unit and 556 e2e tests green, including the real Supabase and Upstash Redis specs). The re-audit of 2026-11-03 (`docs/gate-a-audit.md`) has 18 PASS and **1 SKIPPED** (updated 2026-11-04): the real Supabase spec now passes from a cloud session, but the Upstash Redis spec cannot run there (the container reaches the internet only through an HTTP/HTTPS proxy, so TCP port 6379 is unreachable), so the gate counts as **open** until `throttle-redis` is run on the owner's machine (see `docs/handoff.md` section 2). Never run two e2e runs at once: they fight over the same interviewer slots and fail with 409. Since then: the audit trail v2 replaced the activity log (events plus a row-level trail written by triggers in the same transaction, see Backend rules), HR and department managers record their own interviews, recruiters pick people through `GET /users/options`, and candidates can be anonymised on request or after `CANDIDATE_RETENTION_MONTHS`; the suite is now 344 unit and 638 e2e tests, and migrations plus seeds were proven again from an empty database.

**Next, in order:**

1. Web infrastructure, ported per `docs/port-manifest.md`: theme tokens, ui primitives, API client and core libs, session and layout shell, shared components (nothing feature-specific until this is done). A dependency is added in the same commit as its first importer. **Status (2026-11-06):** all of it is written and unit-tested, including the sample Catalogs page, and B5 is closed: the page ran against a real API in the browser (Playwright, 19 tests) on a dedicated Neon branch, with the three pending migrations applied there (see `docs/handoff-local-web-3.md`). The main database has not had those migrations yet.
2. Web modules, one by one, in dependency order.

## Known gaps

- Swagger documents request bodies but not responses (views are interfaces). The response types live in `packages/shared-types/src/views/` (API mappers in `*-view.ts` build them; the web app imports them wrapped in `Jsonified<T>`, which turns `Date` into the ISO string the browser gets). `test/view-contract.e2e-spec.ts` checks real responses against them, so adding a field means editing the shared type, the mapper and that spec's key list.
- Rate limiting (`common/throttle`, opt in with `@RateLimit(policy)`): login per IP and per account, public reads per IP, application form per IP. Values that only exist after the body is parsed (the email on the form) go through `AttemptLimiter`, which shares the same storage and raises a 429 with `Retry-After`. Counters live in Redis when `REDIS_URL` is set and fall back to per-process memory if Redis is down; e2e always counts in memory (`THROTTLE_STORAGE=memory`).
- Everything anonymous lives in `modules/public/`: `GET /public/jobs[/:id]` (only open jobs, only the fields of `PublicJobView`, salary included, a draft or closed job answers the same 404 as an unknown id) and `POST /public/jobs/:id/applications` (multipart form). The form always answers the same 202 body whatever happened (new, repeat, email on file), never edits an existing candidate, keeps the CV on the application, credits the system user, is skipped by the audit log, and is protected by Turnstile, per-IP and per-email limits. Job descriptions are staff-written rich text: the web app must sanitise them.
- **Mail** (`modules/mail`): `MAIL_DRIVER=outbox` (default; keeps messages in memory, tests read `app.get(MailService).sent`) or `resend` (required in production). Templates are plain text only. **Turnstile**: `TURNSTILE_SECRET` unset means not checked (dev/tests); production requires it. Cloudflare's test secrets (`1x0000000000000000000000000000000AA` always passes, `2x...AA` always fails) need no account and the captcha e2e specs call the real siteverify endpoint.
- `MulterExceptionFilter` turns any multer error into 400 (413 for size): multer 2 rewords messages that Nest matches by text, so an unexpected file field would otherwise answer 500.
- `CacheService` still uses an in-memory store (interface `CacheStore` is ready for a Redis one); only the throttler talks to Redis.
- CVs are private: the column holds a storage key (`cv/<uuid>.pdf`), views only expose `hasCv`, and the file is reached through `GET /candidates/:id/cv`. `STORAGE_DRIVER=local` (default; dev and tests) streams from disk; `STORAGE_DRIVER=supabase` redirects to a 60 s signed URL of a private bucket and is required in production. The Supabase adapter is unit-tested with a fake bucket; its real-service test (`test/supabase-storage.e2e-spec.ts`) is skipped until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Use `@supabase/storage-js`, not `supabase-js`: `createClient` needs a native WebSocket and throws at boot on Node 20. Only PDF and DOCX are accepted, checked by content with `file-type@16` (v17+ is ESM-only and needs Node 22). `npm audit` flags `file-type@16` (GHSA-5v7r-6r5c-r473, ASF parser loop): the validator only calls it after a `%PDF` or `PK` header, so that parser is unreachable; upgrade with Node 22.
- **`npm audit` (2026-11-03).** The API's high-severity advisories are fixed (`multer` 2.5, `body-parser` 2.4, `qs` 6.17, `@nestjs/platform-express` 11.2.8; the root `overrides` pins `multer`). What is left for the API is moderate and needs a major upgrade: `@nestjs/swagger` 12 (needs Nest 12, which this project pins away from), `typeorm` 1.x, and `file-type` 22 (needs Node 22). None is reachable from a caller: Swagger only calls `js-yaml`'s `dump`, not the `load` that is affected; `glob` and `minimatch` only expand the entity and migration paths in the config; `file-type` is covered above. The remaining high and critical advisories (`next`, `sharp`, `source-map-js`) are in `apps/web` and are for the web phase. Re-run `npm audit --omit=dev` before each deployment.
- Only the candidate confirmation email exists; no other notification (email or in-app). Resend delivers to arbitrary addresses only after a sending domain is verified.
- `test/supabase-storage.e2e-spec.ts` and `test/throttle-redis.e2e-spec.ts` use the real services when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (must be the `service_role` key: the `anon` key is refused by the private bucket) and `REDIS_URL` are set, and skip otherwise. Nothing has run against a real Resend account yet.
- **Candidate data retention** (`docs/business-flow.md` section 6b): `POST /candidates/:id/anonymize` (HR, Admin) and the `retention:run` command erase a candidate's personal data and CVs but keep the row for the reports. The command must be run by an external scheduler; nothing in the repo schedules it. Anonymising changes the candidate's email, so an e2e test that anonymises must clean up by ids and job tag, not by the `e2e-` email prefix (see `candidate-anonymize.e2e-spec.ts`). Staff-written free text (status history notes, interview feedback, offer notes) is not erased yet. The retention figures are project policy, not checked against the text of Decree 356/2025.
- **Audit trail in tests.** The app e2e runs as `hiflow_app` with `AUDIT_ORIGIN=e2e`; a test that builds or removes data by hand uses `ctx.maintenance` (owner, capture off), never `ctx.dataSource`. A global teardown deletes the audit rows tagged `e2e`. Read events with `test/helpers/audit.ts`. Anonymising a candidate changes their email, so such a test cleans up by ids, not by the `e2e-` prefix.
- **Audit retention.** `retention:run` also runs as the owner: it deletes the row-level copies of an erased candidate and blanks the IP address and user agent of events older than `AUDIT_IP_RETENTION_MONTHS` (12). Decision A stores real values in `audit_row_changes`, so these copies exist until that command runs; staff-written free text (status history notes, interview feedback, offer notes) is also stored there and is not erased.
- `E2E_LOGS=1` prints the server's error log during an e2e run, for finding why a request answered 500.
