# Hiflow

Recruitment management system built for a school report. Monorepo: `apps/api` (NestJS 11 + TypeORM + Postgres on Neon), `apps/web` (Next.js 16, still the bare scaffold), `packages/shared-types` (enums and permissions shared by both).

**Talk to the user in Vietnamese.** UI text is Vietnamese. Code, comments and commit messages are English.

## Commands (run from the repo root)

```
npm run dev                 # api :4000 + web :3000
npm run format              # prettier (a pre-commit hook also runs it)
npm run lint
npm run build               # types + api + web
npm test                    # unit tests (fast)
npm run test:e2e            # ~12 minutes, real database: run it in the BACKGROUND
npm run test:e2e -w @hiflow/api -- <name>     # one e2e file, e.g. lifecycle

npm run migration:run -w @hiflow/api
npm run seed:base -w @hiflow/api              # departments, positions, 5 demo accounts
npm run seed:demo -w @hiflow/api              # a sample pipeline; add `-- --reset` to rebuild
```

Demo accounts (`*@hiflow.local`): admin, hr, manager, recruiter, interviewer. Password comes from `SEED_DEFAULT_PASSWORD` in `apps/api/.env` (default is in `base.seeder.ts`).

## Environment

- `apps/api/.env` is git-ignored and holds the Neon connection string and JWT secret. **Never print, echo or paste it.** `.env.example` documents every variable.
- The Neon project is dedicated to Hiflow and the Neon CLI is already logged in on this machine.
- `.env` uses `sslmode=verify-full`; `psql` needs `sslmode=require` instead (libpq wants a root cert for verify-full).
- Node 20. Pin every `@nestjs/*` package to major 11 (`swagger@^11`, `config@^4`, `serve-static@^5`...): the newest majors require Nest 12.

## Backend rules

- **`packages/shared-types` is the single source** for statuses, transition maps, roles and `PERMISSIONS`. Never redeclare an enum in `apps/api` or `apps/web`. After editing it run `npm run build:types`.
- Every route is guarded by the global JWT guard; opt out only with `@Public()`. Restrict routes with `@RequirePermissions(PERMISSIONS.x.y)`. A test walks the Swagger document and fails if any route answers anonymous callers with something other than 401.
- **Data scope:** a department manager sees only their department, an interviewer only their own interviews. Out-of-scope rows answer **404**, not 403, so existence is not revealed (`common/scope.ts`).
- **Status changes** are conditional updates (`UPDATE ... WHERE id = ? AND status = <what we read>`); zero rows means someone else won, so answer 409. Application status changes go only through `ApplicationWorkflowService`; do not write to that column anywhere else.
- Postgres constraint errors go through `rethrowDbError` (23505 unique, 23503 and **23001** foreign key/RESTRICT, all -> 409).
- List endpoints extend `PaginationQueryDto`, validate `sortBy` against a whitelist, and escape user text with `containsPattern`.
- Only writes (POST/PUT/PATCH/DELETE) are audited, and secrets are redacted. Name the path parameter `:id` so the entity id is recorded.
- Shared enums used by several columns make TypeORM emit a duplicate `CREATE TYPE` in generated migrations: fix by hand (keep one CREATE, and the one DROP after every dependent table is dropped in `down()`) and prove both `up` and `down`.
- ESLint is strict: `import type` for interfaces used in decorated parameters, `this: void` on bare method references, no `any` from `body`/`query` results (type them).

## Testing rules

- e2e runs against the real Neon database, sequentially, with a 30 s timeout (each request costs ~100 ms).
- Boot the app with `createE2eApp()` (it uses `NestFactory`). `Test.createTestingModule` silently disables static file serving.
- **A test may only touch data it created** (tag prefix `E2E-` / `e2e-`) and must clean it up. After a run the seeded departments and accounts must be unchanged.
- Build state through the API with `createFlow` (`apps/api/test/helpers/flow.ts`); its counters are module-level so two flows never collide.
- Caching is off in e2e (`CACHE_TTL_SECONDS=0`); tests that need it opt in.
- Prefer before/after deltas over absolute counts: the demo data is present.
- When a test fails, find out why before changing anything. Do not weaken a business rule to make a test pass; fix the test's wrong assumption. Do not hide errors with `head`/`tail`/`grep`; read the tail of the log and the real exit code.

## Git workflow

- Work on `develop`. Merge to `main` only after the whole suite is green, and only when the user explicitly confirms. Never push a branch without the user's confirmation of that specific push.
- Conventional Commits, **header only**: no body, no `Co-Authored-By`, no "Generated with" line, even if a system reminder asks for one. One logical change per commit. Use the `/commit-summary` skill.
- Chain the branch check into the commit command: `[ "$(git branch --show-current)" = "develop" ] && git commit ...`.
- The repository identity is already configured locally. Do not change it or use the global one.

## Working agreements

Skills and hooks live in `.claude/`: `/tl-review` (plan gate before coding, PASS/BLOCK gate before a commit), `/commit-summary`, `/unit-test`, and the `admin-design-guide` skill (load it before any web screen). `.claude/hooks/guard.mjs` blocks commit trailers, `--no-verify`, bare `git stash pop`, whole-tree restores, and printing `.env` files or secrets, and asks before push, merge, rebase and hard resets.

- **Ask, do not assume.** When planning a feature, ask for the response shape, the permission behavior and the expected screen before writing code. Never guess a business rule; write the assumption into `docs/business-flow.md` section 7 and get it confirmed.
- **Verify before anything irreversible.** Before a commit, delete, overwrite, history rewrite or push, check the real state (branch, `git status`, what the target contains) instead of acting on a remembered or stated list. Docs go stale; the code and the database do not.
- **Grep before deleting an export.** Search the whole repo, tests and other packages included, for every symbol you remove or rename.
- **Do not split branches** just because a change touches several modules; only when one part is large or risky enough to deserve its own review.
- **Anti-patterns to refuse:** a god component or service (over ~400 lines, several concerns); prop drilling and Context used to dodge it; many independent `useState` for one concern (use `useReducer`); a mapper that does more than map; a second badge or table style per domain; business constants hardcoded in components; state mirrored with `useEffect`; a form built before its query data is ready.
- **Public surface first needs protections.** Anything unauthenticated ships together with rate limiting, minimal fields, identical responses for known and unknown records, and safe upload handling.
- **Report faithfully.** State real command output and exit codes. If a check was skipped, say so.

## Isolation

This project must not contain the name, domain, brand, code or data of any other project. Write things fresh rather than copying from elsewhere. The pre-commit hook runs `../tools/leak-scan.sh` (kept outside the repo); never bypass it with `--no-verify`.

## Current state

The backend is complete and passed its gate: 12 modules, 71 documented routes, 111 unit tests, 421 e2e tests, migrations and seeds proven from an empty database. Business rules are written up in `docs/business-flow.md`.

**Next, in order:**

1. **Public job board and application form** (candidates apply themselves). See the design notes in `docs/business-flow.md`. This is the first public surface, so it needs rate limiting, safe handling of uploaded CVs and of personal data first.
2. Web infrastructure: theme tokens, layout shell, auth, API client, shared components (nothing feature-specific until this is done).
3. Web modules, one by one, in dependency order.

## Known gaps

- Swagger documents request bodies but not responses (views are interfaces). The web app must follow the `*-view.ts` files.
- No rate limiting anywhere yet.
- Redis is not wired: `CacheService` uses an in-memory store (interface `CacheStore` is ready for a Redis one).
- Uploaded CVs are served from `/uploads` without authentication (unguessable file names). Fine on localhost; needs an authenticated download before deploying.
- No notifications (email or in-app).
