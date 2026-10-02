---
name: gate-audit
description: Build-quality tracker for Hiflow's acceptance gates. Runs the Gate A checklist (security and infrastructure, RBAC and business logic, seed data, Swagger contract) against the real code, tests and database, and records PASS, FAIL, SKIPPED or DEVIATION per item with evidence in docs/gate-a-audit.md. Use before declaring a gate closed, after hardening work, or to see what is still open.
---

# Gate audit

`/tl-review` judges a diff. This skill judges the **whole build against a gate**: it never trusts memory, docs or a previous run, only evidence produced now.

```
/gate-audit            all four sections, then write the report
/gate-audit 1|2|3|4    one section only (report is updated for that section)
/gate-audit status     read docs/gate-a-audit.md and summarise; run nothing
```

## Rules

- **Evidence or it is not a PASS.** Each verdict cites a command and its real exit code, or `file:line` of the assertion that proves it. A test that exists but was not run this session is not evidence.
- **Verdicts:**
  - `PASS`: verified now, evidence cited.
  - `FAIL`: broken, or the requirement is not proven by any test (name the missing test).
  - `SKIPPED`: cannot run here, usually a missing key (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`). A skipped test is reported as skipped, never as passed. The gate cannot close while any item is SKIPPED.
  - `DEVIATION`: the code follows a project rule that differs from the gate wording. Never resolve it yourself: list it for the user, and once they decide, write the decision into `docs/business-flow.md` section 7.
- **Read the tail of the log and the real exit code.** No `head`/`tail`/`grep` to hide failures.
- **Never read or print `.env`.** Whether a key exists is proven by the e2e spec reporting "skipped" or not.
- e2e takes ~12 minutes: run it in the **background**, one file at a time when only one section is asked (`npm run test:e2e -w @hiflow/api -- <name>`). Touch only data the tests created.
- Ambiguous gate wording is an assumption: state it in the report and ask, do not pick silently.

## Preflight (every run)

1. `git branch --show-current` and `git status`: record the branch and short commit hash in the report. An audit of a dirty tree says so.
2. `npm run format`, `npm run lint`, `npm run build`, `npm test` from the repo root. Any failure is a FAIL under 2.1 and stops sections 1-4 from claiming PASS until fixed.

## Section 1. Security and infrastructure

| ID  | Requirement                                                                                                | How to verify                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | A CV uploads to a **private** Supabase bucket and the download route hands out a valid **60 s** signed URL | `supabase.storage.spec.ts` (fake bucket) and `SIGNED_URL_SECONDS` in `storage/supabase.storage.ts`. Real proof: `test:e2e -- supabase-storage` must run, not skip (upload, signed download, public URL refused).                                                     |
| 1.2 | A file renamed to `.pdf` whose content is not a PDF (an `.exe`, "MZ" header) is refused                    | `npm test -w @hiflow/api -- cv-file.validator`. The spec must contain the renamed-executable case for `.pdf` and `.docx`, and the guard spec must show a 400, not a 500.                                                                                             |
| 1.3 | Rate-limit counters live in **Redis** (Upstash) and count requests exactly                                 | `test:e2e -- throttle-redis` must run against a real `REDIS_URL` (shared counter across two connections, and the app picks the Redis store). Unit specs in `common/throttle/` are not a substitute. Note: the package in use is `@nest-lab/throttler-storage-redis`. |
| 1.4 | CORS never uses `origin: '*'`                                                                              | Read `app.setup.ts` and `common/security/cors.ts`; `cors.spec.ts` must show `*` is rejected. Grep `apps/api/src` for `origin: '*'` and `origin: true`.                                                                                                               |
| 1.5 | The session cookie carries `Secure`, `HttpOnly`, `SameSite=Strict`                                         | `session-cookie.spec.ts` and `auth-cookie.e2e-spec.ts` (assert the actual `Set-Cookie` header on login, and that logout clears it).                                                                                                                                  |

## Section 2. RBAC and business logic

| ID  | Requirement                                                                                                                                                                  | How to verify                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Every unit test and every e2e test passes, including the full candidate lifecycle                                                                                            | `npm test` and `npm run test:e2e` (background). Report the counts of passed, failed and skipped. "100%" means all green; state coverage (`npm run test:cov -w @hiflow/api`) as information only.                                                                                        |
| 2.2 | `DEPT_MANAGER` reads only requisitions and candidates of their own department; cross-department is refused                                                                   | `common/scope.spec.ts` plus the requisition and candidate e2e specs. **DEVIATION to report:** the gate says 403, the project rule (`CLAUDE.md`, `business-flow.md` section 4) answers **404** so existence is not revealed. Ask the user which one wins.                                |
| 2.3 | `INTERVIEWER` is refused (403) on every CRUD route it may not use; only "record interview result" (`POST /interviews/:id/result`) succeeds, and only on their own interviews | `rbac-matrix.e2e-spec.ts` (every route by every role) and `interviews.e2e-spec.ts` (own interview passes; someone else's answers 404; other roles 403). Confirm the matrix lists the interviewer's allowed routes and that they are only that route plus the login-only profile routes. |
| 2.4 | A route cannot be added without a permission decision                                                                                                                        | The matrix spec's "cannot silently shrink" and "no route open to every signed-in user" cases pass; the Swagger 401 walk passes.                                                                                                                                                         |

## Section 3. Seed data

Run against a scratch state that the seeds own; never delete data the seeds did not create. `seed:demo -- --reset` only after checking what it will remove.

| ID  | Requirement                                                                                                   | How to verify                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `seed:base` and `seed:demo` both exit 0, and a second run changes nothing                                     | Run both, record exit codes. `test:e2e -- seed-demo` covers idempotency.                                                                                        |
| 3.2 | Fictional data only                                                                                           | `seed-demo` spec asserts `example.com` addresses; read `demo-seed.data.ts` and `base-seed.data.ts` for real-looking names, phone numbers or domains.            |
| 3.3 | 5 demo users (5 roles), 3 departments, 8 positions                                                            | Count from the seed data files and from the database after `seed:base` (`psql` with `sslmode=require`, no connection string in output).                         |
| 3.4 | Every funnel status (NEW, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED) has demo rows                         | `spreads the applications over the funnel` in `seed-demo.e2e-spec.ts`.                                                                                          |
| 3.5 | `application_status_histories` timestamps run in strict chronological order per application, **no two equal** | The spec must assert strictly increasing `changed_at`. An assertion of `>=` allows duplicates: that is a FAIL (unproven), fix the test or the seed.             |
| 3.6 | `appliedAt` is spread across the last 30 days                                                                 | A test or query must show the min and max of demo `applied_at` and that they cover the window (no cluster on one day). No such assertion means FAIL (unproven). |

## Section 4. Swagger contract

| ID  | Requirement                                                                                | How to verify                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | `/docs` lists every endpoint                                                               | `swagger.e2e-spec.ts`, and compare the documented paths with the routes collected by the matrix spec: same set.                             |
| 4.2 | Servers: localhost, relative `/api`, and production (`PUBLIC_API_URL`, e.g. Cloud Run)     | The spec "lists where the API lives" passes, and the production server appears only when `PUBLIC_API_URL` is set.                           |
| 4.3 | 401, 403 and 429 (with `Retry-After`) are documented where they can happen, and only there | The `401`, `403` and `429` describe blocks in `swagger.e2e-spec.ts`. Note the known gap: responses (views) are not documented, only errors. |

## Report

Write `docs/gate-a-audit.md` in Vietnamese, overwriting the previous one (git keeps history). Do not commit it unless asked; use `/commit-summary` when they do.

```
# Kiểm định Cổng A
Ngày: <date>  Nhánh: <branch>  Commit: <hash>  Cây làm việc: sạch | có thay đổi chưa commit

## Kết luận
<CỔNG MỞ | CỔNG CHƯA ĐÓNG> : <n> PASS, <n> FAIL, <n> SKIPPED, <n> DEVIATION

| ID | Hạng mục | Kết quả | Bằng chứng (lệnh + exit code, hoặc file:line) |

## Cần quyết định (DEVIATION và giả định)
## Việc còn mở (mỗi FAIL và SKIPPED: cần gì để đóng, ví dụ khóa nào, test nào còn thiếu)
```

The gate is closed only when every item is PASS and no DEVIATION is open. Anything else says "chưa đóng" and lists what is missing. Finish the chat reply with that verdict, the per-status counts, and the open list; never call the gate passed to be encouraging.
