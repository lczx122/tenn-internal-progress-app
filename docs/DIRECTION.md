# Tenn — Purpose & Direction

> The north star for this app. Read this before adding features. If a change
> doesn't serve the purpose below, it probably belongs in a later phase (or not
> at all). Roadmap lives in [ROADMAP.md](./ROADMAP.md); build conventions live in
> [../CLAUDE.md](../CLAUDE.md).

## Purpose

**Tenn's renovation business operating system — one place to run a job from
quote to completion to collection, live on everyone's phone.**

## What it replaces

Scattered Excel sheets, WhatsApp threads, and hand-typed Word quotations. Before
this app, the state of a job lived in someone's head or a spreadsheet that was
always out of date. Now there is one shared, real-time source of truth.

## Who it's for

- **On-site team (PICs / coordinators)** — update progress and notes from their phones.
- **Admin** — manage staff, projects, prices, and clean-up.
- **Boss** — money and oversight: costing, margins, collections.
- **Sales / guests** — build and send quotations.

**Primary user for the current phase: _Sales / quoting._** The quote→sales-order
path is where we invest first (see the roadmap), because that's the front door
of every job.

## North star

An **all-in-one Renovation Business OS** where **operations, sales, scheduling,
and money are equally first-class**. Mobile-first, real-time, and the single
source of truth for every job. "Best in class" for us means: a salesperson can
quote a customer in minutes, that quote becomes a sales order with one tap, the
job and its work then appear for the on-site team automatically, and the boss can
see what's collected and what it's worth — all without leaving the app.

## The spine

Everything hangs off one chain. Keep this intact when designing features:

```
Project → Unit (job) → Work cards (per category, each with its own stage)
                          ↑
   Quote (QT) → Sales Order (SO) → [auto-creates the Unit + its work]
                          ↓
                     Collection → Costing
```

The **quote → SO → auto-unit** pipeline (`supabase/so_auto_unit.sql`) is the
connective tissue that ties sales to operations to money. A single Unit links its
quote/SO, its work progress, its collections, and (for the boss) its costing.

## Principles

1. **Mobile-first, one-handed.** Most use happens on a phone on a job site. Tables
   never scroll sideways; editing happens through the pinned field-editor box.
2. **Real-time & shared.** Changes appear on everyone's screen within a second
   (Supabase realtime + `useAutoRefresh`). No "refresh to see updates."
3. **Single source of truth.** One Unit ties together quote, work, collection, and
   costing. Don't create parallel records that can drift.
4. **Audit trail.** Who changed what, when — captured in `job_events`. Money and
   status changes are traceable.
5. **Role-based, progressive disclosure.** Staff see operations; boss sees money;
   guests see only the quote tool. Show people what they need, not everything.
6. **Low-friction entry.** Adding data must be effortless on a phone — that's why
   the app-wide editor box exists.
7. **Reliability over features.** The service worker is push-only (no asset
   caching) so the app is never stale. A boring, correct app beats a clever,
   flaky one.

## Scope

**In scope (what the OS owns):** managing jobs/units and their work, quoting and
sales orders, collections, costing, and the schedule — for the internal team.

**Not yet (explicitly deferred — say no for now):**

- Full accounting / payroll / tax.
- Inventory & procurement.
- A native iOS/Android app (the PWA covers it).
- Third-party CRM/ERP integrations beyond the existing costing-sheet sync.

These aren't "never" — they're "not until the core OS is solid."

## Success signals

We're winning when:

- Every active job lives in the app, not in Excel.
- Every quotation and sales order is created in the app.
- Collections are tracked per project, and outstanding balances are obvious.
- The boss can see live margin/profitability without asking anyone.

## Direction (summary)

Next we invest in **sales & customer-facing** first (invoicing, a shareable
customer status link, quote analytics), then **money & analytics**, then
**deepening operations**, with **polish & reliability** as a constant. Full
sequencing and the code to extend for each item is in
[ROADMAP.md](./ROADMAP.md).
