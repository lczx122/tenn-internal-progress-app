# Tenn — Roadmap

> Phased direction toward the [north star](./DIRECTION.md). Sequenced to current
> priorities: **sales first; polish is constant.** Each item names the existing
> code to extend so it's actionable, not aspirational. This is a living document —
> reorder freely; don't treat phases as rigid gates.

## Now / cross-cutting — Polish & reliability

Always-on hygiene that ships alongside everything else:

- **Finish half-built / inconsistent areas:**
  - `jobs.address` vs `jobs.unit_code` — overlapping fields from the unit revamp;
    settle on one identifier and clean references (`src/pages/NewJob.tsx`,
    `src/lib/units.ts`, `supabase/unit_revamp.sql`).
  - Single `jobs.pic` vs. appointments' multi-assignee (`assignee_ids`) — decide
    whether a job can have multiple PICs.
- **Mobile correctness:** keep all tables `table-fixed` / no horizontal scroll;
  the field-editor box (`src/components/FieldEditor.tsx`) stays the editing path.
- **Form feedback:** clearer success/error states on the create/edit forms
  (`NewJob.tsx`, `CostingForm.tsx`, `AppointmentForm.tsx`).
- **No stale data:** keep the service worker push-only (`public/sw.js`); never add
  asset caching.

## Phase 1 — Sales & customer-facing (primary)

The front door of every job. Extend `public/quotation.html`,
`src/pages/QuotesRegister.tsx`, and the `quotations` table.

- **Invoicing & payment terms** — generate an invoice from a saved SO + its
  collections; surface deposit/balance terms on the printed document.
- **Shareable customer link** — a read-only status/quote page a customer can open
  (no login) to see their quote or job status.
- **Quote analytics** — QT→SO conversion rate and win rate by salesperson, shown
  on the Dashboard or the Orders register.
- **Quoting-flow smoothing** — product bundles / templates so common quotes are a
  few taps (builds on the existing catalog + `Cabinet Package` pattern).

## Phase 2 — Money & analytics

Give the boss live numbers. Extend `src/pages/CostingList.tsx`,
`src/pages/Claims.tsx`, `src/pages/Dashboard.tsx`.

- **Profitability dashboard** — margin per project and per unit, roll-ups across
  the business (leans on `costings` + linked unit progress).
- **Collections aging** — outstanding by project / over time, beyond the current
  per-project Collection table.
- **Auto-seed costing from an SO** — when a sales order creates a unit, optionally
  draft a linked `costings` row so money tracking starts on day one (mirror the
  existing `supabase/so_auto_unit.sql` trigger pattern).

## Phase 3 — Deepen operations

Make the on-site team's day richer. Extend `src/pages/JobDetail.tsx`, the
`job_works` table, and `appointments`.

- **Photos / file attachments** on units and work cards (site progress evidence).
- **Richer notes / checklists** per work category.
- **Multi-PIC per job** (resolve the single-`pic` inconsistency above).
- **Scheduling upgrades** — recurring appointments and in-app reminders.

## Phase 4 — Stretch / customer-facing automation

- **Customer portal** — live job status for customers (extends the Phase 1
  shareable link into something persistent).
- **Automated collection reminders** — nudge on outstanding balances via the
  existing push pipeline (Supabase `send-reminders` edge function +
  `push_subscriptions`).

---

### How to use this roadmap

- Pick the **smallest valuable slice** of the current phase; ship it; verify on a
  phone. Polish items ride along with feature work.
- Anything that doesn't map to a phase here should be checked against
  [DIRECTION.md](./DIRECTION.md) before building.
