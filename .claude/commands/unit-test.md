---
description: Write focused unit tests for a file or module (Jest, no database)
argument-hint: <path to the file or module under test>
---

Write unit tests for `$ARGUMENTS`.

## Approach

1. Read the target and its collaborators first. Identify the **decisions** in it: branches, state transitions, validation, mapping, scope rules, error mapping. Those are what get tested. Do not test getters, setters, framework wiring or a constant's value.
2. Find the existing tests next to similar code (`*.spec.ts` beside the source, e2e in `apps/api/test/`) and follow their style and helpers.
3. For each decision write at least one passing case and one failing case (wrong state, wrong role, out of scope, duplicate, bad input, boundary values such as the 60-minute interview gap or a deadline exactly on the limit).
4. Mock only what crosses a boundary (repository, clock, storage). Pure functions get no mocks. Build fixtures with small factories, not copied literals.
5. Name tests by behavior: `rejects a transition from DRAFT straight to APPROVED`, not `test 3`.

## Rules

- Unit tests never touch the database or the network. Anything that needs Postgres is an e2e test and follows the e2e rules in `CLAUDE.md`.
- Enums, transition maps and permissions are imported from `@hiflow/shared-types`; never redeclare them in a test.
- One assertion target per test; a failing test must point at one cause.
- Never weaken a business rule to make a test pass. If a test fails, find out whether the code or the test assumption is wrong, then fix that.
- Do not leave `.only`, `.skip`, `console.log` or commented-out tests.

## Run and report

```
npm test -w @hiflow/api -- <pattern>
```

Then `npm run lint`. Report: what decisions are covered, what is deliberately not covered and why, and the real test output (do not truncate it or hide the exit code).
