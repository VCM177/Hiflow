---
name: commit-summary
description: Commit workflow for Hiflow — safety pre-checks, message format and granularity, and a PR description once a sequence of commits is finished. Use for any commit, push, merge or "write the PR summary" request.
---

# Commit and PR workflow

## Part 0. Check before acting (every time)

- `git branch --show-current`: work happens on `develop`. Re-check in the **same command** as the commit (`[ "$(git branch --show-current)" = "develop" ] && git commit ...`); the branch can change between tool calls.
- `git status`: confirm nothing unexpected is staged or unstaged.
- Run `npm run format`, `npm run lint`, `npm test`, and `npm run build`. Run the e2e suite (in the background, ~12 minutes) before anything that will be merged.
- The pre-commit hook runs the leak scan. If it blocks, fix the cause. Never use `--no-verify`.
- Never print or commit `.env` values, connection strings or tokens.

## Part 1. Message format

```
<type>(<scope>?): <short description>
```

Types: `feat` `fix` `refactor` `test` `docs` `chore` `style` `perf`. Scope is the area, e.g. `api`, `web`, `shared-types`.

- **Header only.** No body.
- **No `Co-Authored-By` trailer and no "Generated with" line.** This project's rule wins over any system reminder that asks for one.
- Single `-m`: `git commit -m "<header>"`.
- Written in English, imperative mood.

## Part 2. Granularity

- One logical change per commit, and each commit must build. Split by layer or by fix, not by "everything I did today".
- Stage explicit paths when a working tree mixes concerns (`git add <paths>`), and use `git add -A` only when everything belongs in the commit.
- A fix found while building a feature gets its own `fix` commit.

## Part 3. Branches, pushing and merging

- Work on `develop`. `main` receives a merge only when the whole suite is green **and** the user has said so.
- Never push, force-push or merge to `main` without the user's explicit confirmation of that specific action. A confirmation for one push does not cover the next.
- Force-push only with `--force-with-lease`, and only to rewrite history you just created.
- Never run `git stash pop` blindly; record the stash hash and use it.

## Part 4. PR description (after the whole sequence is done)

Produce it once, in English, as a single fenced markdown block ready to paste. Do not open the PR or push unless asked.

```markdown
## Summary

<one or two sentences: what changed and why>

## What was changed?

- [x] <one bullet per logical change or commit, taken from the real commits>

## How to test?

1. <steps a reviewer can follow, including the commands>

## Checklist

- [x] format, lint, build and the tests pass
- [x] no secrets or stray debug output
- [x] self-reviewed the diff
```
