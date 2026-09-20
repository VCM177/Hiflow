---
name: tl-review
description: Tech-lead review gate for Hiflow. `plan "<feature>"` validates a plan and runs the doubt checklist before any code is written; with no argument it reviews the working changes and returns PASS or BLOCK before a commit. Use before planning a feature and before every commit that adds or changes behavior.
---

# Tech-lead review

Two modes. Both end with a verdict the author must act on. A **BLOCK** means every listed item is fixed before committing; do not argue a rule away, fix it or record a deliberate, written exception in the review output.

```
/tl-review plan "<feature>"    before writing code (description required, ask if missing)
/tl-review                     after coding, before committing
```

## Mode 1: plan

1. Read `docs/business-flow.md` and `CLAUDE.md`. If the feature touches more than one entity, state which state machines and roles it touches.
2. List what already exists that can be reused or extended: services, DTOs, helpers in `common/`, shared components (web). Extend before adding; a new file needs a reason.
3. **Doubt checklist.** Every unknown is a question for the user, never an assumption:
   - What exact response shape is expected (which fields, which are optional)? For the web: which `*-view.ts` file defines it?
   - Which permissions guard each action, and which roles see which rows (scope)?
   - What is the expected screen or output, in Vietnamese wording?
   - Which existing rule or transition does this change, and what must keep working?
   - Does it open a public (unauthenticated) surface? If yes, the protections in section 6 of `docs/business-flow.md` are part of the scope, not follow-ups.
4. Blast radius: if the `code-review-graph` MCP tools are available, use `get_impact_radius` or `query_graph(callers_of)` on the files you will change. Do not use `detect_changes` on a large graph; use `git diff` plus the specific queries.
5. Output a plan in layer order, each layer one commit that builds:
   - **api:** shared-types (enums, transitions, permissions) → entity + migration → DTOs → service → controller (+ Swagger) → tests → docs
   - **web:** types → constants (permissions) → schemas → mappers → api calls → query hooks → components
6. State how it will be verified (which unit and e2e cases, including the negative ones) and which docs change.

## Mode 2: commit

Run `git diff` and `git status`, read every changed file, then check each standard. Report as a table: standard, verdict, file:line for each violation.

### Universal (BLOCK)

| #    | Standard                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | No dead code: unused functions, exports, imports, state, handlers, parameters.                                                                                  |
| R-02 | No unused files or components (check that a new file has at least one importer).                                                                                |
| R-03 | No unused types or constants.                                                                                                                                   |
| R-04 | Enums, statuses, transition maps, roles and permission strings are declared only in `packages/shared-types`; no literal permission or status strings elsewhere. |
| R-05 | No secrets, connection strings or `.env` values in code, docs, logs or output; leak scan clean.                                                                 |
| R-06 | CI passes in order: `npm run format`, `npm run lint`, `npm run build`, `npm test`. Run the e2e suite (background) before anything that will be merged.          |
| R-07 | Docs in sync: `docs/business-flow.md` when a rule changed, `CLAUDE.md` current state and known gaps when they moved.                                            |
| R-08 | The change has tests, including the failing path (wrong role, wrong state, out of scope, duplicate, race). A bug fix has a test that fails without the fix.     |

### API (BLOCK)

| #    | Standard                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Every route is behind the global guard; `@Public()` only when deliberate and justified. Restricted routes use `@RequirePermissions(PERMISSIONS.x.y)`.                                               |
| A-02 | Scope is enforced in the query, not after: out-of-scope rows answer 404. Interviewer and department-manager paths are checked.                                                                      |
| A-03 | Status changes are conditional updates (`WHERE id AND status = <read>`); zero rows means 409. Application status changes only through `ApplicationWorkflowService.moveTo`.                          |
| A-04 | Multi-row writes that must succeed together run in one transaction.                                                                                                                                 |
| A-05 | Database constraint errors go through `rethrowDbError` (23505, 23503, 23001 become 409); no raw 500 from a predictable conflict.                                                                    |
| A-06 | Every input is a validated DTO (whitelisted, no `any`). List endpoints extend `PaginationQueryDto`, whitelist `sortBy`, escape user text with `containsPattern`.                                    |
| A-07 | Writes are audited; any new secret-like field is added to redaction; the path parameter is named `:id`.                                                                                             |
| A-08 | Migrations are generated and then read by hand (duplicate `CREATE TYPE` for shared enums); both `up` and `down` proven.                                                                             |
| A-09 | Public endpoints: rate limited, minimal response fields, identical answer whether or not a record exists, uploads validated by extension, magic bytes and size, and never downloadable anonymously. |
| A-10 | e2e tests touch only data they created (tag `E2E-`/`e2e-`), clean it up, and leave seeded data intact.                                                                                              |

### Web (BLOCK, once `apps/web` has features)

| #    | Standard                                                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-01 | Reuse `components/shared` before writing anything; a second variant of an existing component is extended by a prop, not copied.                                                                                                                          |
| W-02 | `<Link>` not `<a>`; shared `DataTable`, `EmptyState`, `StatusBadge` instead of raw `<table>` or hand-made badges.                                                                                                                                        |
| W-03 | No `useEffect` that only mirrors state derivable at render time.                                                                                                                                                                                         |
| W-04 | Row keys are unique and stable, never the index.                                                                                                                                                                                                         |
| W-05 | Permissions come from `PERMISSIONS` in shared-types; never inline strings.                                                                                                                                                                               |
| W-06 | Every `mutateAsync` sits in `try/catch`. Full-page forms and row quick-actions report errors with a toast (plus `setError` and focus when tied to one field); dialogs show the error inline near the confirm button; page-level load errors stay inline. |
| W-07 | Every async view has loading, empty and error states.                                                                                                                                                                                                    |
| W-08 | At most 8 props per component (group value/onChange pairs); at most 5 `useState` per concern, otherwise `useReducer`. Context is never a shortcut around prop drilling.                                                                                  |
| W-09 | Forms use React Hook Form + Zod and the shared field components. A form fed by a query is created only after the data is ready, with `defaultValues` (not `reset()` or `values`, which sync after commit and leave selects empty).                       |
| W-10 | Design tokens only (see the `admin-design-guide` skill): no hex in components, radius by role, Vietnamese text, formatters for dates and money.                                                                                                          |

### Advisory (WARN, mention but do not block)

- A component or service over ~400 lines: a god object, decompose it.
- A mapper doing more than mapping; a badge or table restyled per domain; business constants hardcoded in a component.
- Ten or more independent `useState` calls in one component.

### Before deleting anything

Deleting or renaming an export can silently break tests and other packages. Grep the whole repo, `apps/api/test/` and `packages/` included, for every symbol removed, before deleting it.

## Verdict

```
VERDICT: PASS | BLOCK
Violations: <standard, file:line, what to change>
Warnings:   <optional>
Verified:   <commands run and their result>
```

PASS only when every BLOCK standard holds and the CI commands were actually run and passed. If a command could not be run, say so; that is not a PASS.
