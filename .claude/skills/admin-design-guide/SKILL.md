---
name: admin-design-guide
description: Design rules for Hiflow's admin web app (apps/web) - tokens, palette, status colors, tables, filters, forms, dialogs, RBAC states, accessibility. Load before building or restyling any screen or shared component.
---

# Hiflow admin design guide

Hiflow is an operator tool: people scan lists, make decisions and move on. Optimize for speed and low error rate, not decoration. All UI text is Vietnamese.

## Decision rule

When several options work, pick the one that: (1) reuses an existing shared component, (2) stays consistent with the rest of the app, (3) lowers cognitive load, (4) speeds up the operator's workflow, (5) produces fewer user errors.

Before building anything: `Glob "apps/web/src/components/shared/**"`. Extend a component with a prop before making a variant; a new component used by two or more domains lives in `components/shared/`.

## Tokens

All values are tokens declared once (`apps/web/src/styles/tokens.css`) and prefixed `--hf-`. No hex, rgb or px literal in a component.

| Role                               | Value                 |
| ---------------------------------- | --------------------- |
| page background                    | `#F8FAFC`             |
| surface (sidebar, secondary areas) | `#F1F5F9`             |
| card (raised on the gray page)     | `#FFFFFF`             |
| heading, numbers                   | `#0F172A`             |
| body text                          | `#334155`             |
| border                             | `#E2E8F0`             |
| primary / hover                    | `#1D4ED8` / `#1E40AF` |
| warning (waiting, in review)       | `#F59E0B`             |
| success (passed, hired)            | `#10B981`             |
| destructive (rejected)             | `#E11D48`             |
| neutral status (on hold, closed)   | `#94A3B8`             |

Chart series in order: primary, success, warning, destructive, neutral.

Radius by role, never by taste: 4px badge/chip, 6px control (input, button), 8px container (card, table), 12px overlay (dialog, popover). No pill shapes on buttons or badges. Micro text uses a named size token, never `text-[Npx]`. Elevation is two small neutral shadows (card, overlay); no colored glows. Motion: one standard easing token, 150 to 200 ms, and a global reduced-motion override.

## Status display

Every status renders through the shared `StatusBadge` with a `status -> { label, variant }` map kept in that domain's `constants.ts`, keyed by the enum from `shared-types`. Never hand-roll a pill, dot or ad-hoc color. Color is never the only signal: the label is always shown.

| Meaning                             | Variant     |
| ----------------------------------- | ----------- |
| waiting, screening, pending         | warning     |
| approved, passed, hired, accepted   | success     |
| rejected, failed                    | destructive |
| closed, withdrawn, cancelled, draft | neutral     |
| in progress (new, interview, offer) | primary     |

## Layout

- App shell: fixed sidebar (collapsible, state in `localStorage`), top bar with the avatar menu (profile, sign out), page container with a `PageHeader`.
- Page actions (create, export, approve) live in `PageHeader`, never scattered in the body.
- Navigation has two groups: main (dashboard, requisitions, jobs, candidates, applications, interviews, reports) and settings (users, catalogs, activity log). Items the role cannot use are hidden, not disabled.
- Detail pages group content in `SectionCard`, history in `VerticalTimeline`, notes in `NotesSection`, tabs via Radix Tabs. The application detail has an Offer tab that only opens at the Offer stage.

## Lists

Every list is `DataTable` + `FilterToolbar` + `ListPagination` + `PageSizeSelector`; no raw `<table>`.

- Search: 300 ms debounce, required. A reset control appears only while a filter is active.
- Simple filters inline; complex ones (date range, advanced) in a dialog.
- Three states are mandatory: loading (skeleton rows), empty (`EmptyState` with the reason and the next action), error (inline message with retry).
- Numbers right-aligned with tabular numerals; money through `formatCurrency`, dates through `formatDate`/`formatDateTime` (vi-VN), never ad hoc.
- Icon-only row actions: `<Button variant="ghost" size="icon-sm">` with a tooltip and an accessible name.
- Rows link to the detail page with `<Link>`; keys are entity ids.
- Sort and page state live in the URL query so a list can be shared and survives reload.

## Forms

- React Hook Form + Zod + the shared field components (`RHFTextField`, `RHFSelectField`, `RHFDateField`, ...). No custom regex in a component; reusable rules go in `lib/validations.ts`.
- Labels above inputs; a placeholder is never the label.
- Validate as the user goes; an error shows a border, an icon and helper text.
- While submitting: disable the submit button and show a spinner.
- A form fed by a query is mounted only after the data is ready and initialized through `defaultValues`.
- Full-page create/edit forms use `UnsavedChangesGuard` and report errors with a toast (plus a focused field error when it maps to one field). Dialogs report errors inline next to the confirm button. Success is a toast.

## Actions and dialogs

- Destructive or irreversible actions (delete, reject, close, cancel) always go through `ConfirmDialog`; reject and fail actions ask for the reason the API requires.
- Dialog width comes from a size prop (`sm`, `md`, `lg`), not ad hoc classes.
- Buttons state the action ("Duyệt yêu cầu"), not "OK".

## Permissions in the UI

Permission strings come only from `PERMISSIONS` in `shared-types`. A control can be visible, hidden, disabled (with a reason in its tooltip) or read-only; pick one per case and keep it consistent. The UI hides what a role cannot use, but the API is the real gate.

## Accessibility (WCAG AA)

Keyboard reachable everywhere, visible focus ring, labels for screen readers on icon controls, sufficient contrast (the neutral status color on white needs a darker text token), color never the only indicator, dialogs trap and return focus.

## Performance

Aim for under 100 ms perceived latency: optimistic updates for simple toggles, lazy load heavy widgets (charts, rich text editor), skeletons instead of spinners for page-level loads, no layout shift when data arrives.

## Pre-merge design checklist

- [ ] Reused shared components; no duplicate badge, table or dialog.
- [ ] Only tokens; no hex or px literals; radius matches the role.
- [ ] Loading, empty and error states exist.
- [ ] Destructive actions confirm; errors reported per the form rules.
- [ ] Vietnamese text, formatters for dates and money.
- [ ] Keyboard and focus checked; color is not the only signal.
