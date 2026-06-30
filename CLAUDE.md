# CLAUDE.md

Guidance for AI assistants and developers working in this repo. Read
[docs/DIRECTION.md](docs/DIRECTION.md) for the product north star and
[docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

## What this app is

**Tenn's renovation business operating system** — a mobile-first, real-time web
app that runs a renovation job from quote to completion to collection. It started
as an Excel-replacement for job progress and has grown into operations + sales +
scheduling + money. The spine: `Project → Unit (job) → Work cards → Quote/SO →
Collection → Costing`, with a quote→SO→auto-unit pipeline tying it together.

## Architecture

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + React Router v6.
- **Backend:** Supabase — Postgres, auth, realtime, and edge functions (e.g.
  `send-reminders` for push). No custom server.
- **PWA:** installable; `public/sw.js` is **push-only and caches nothing on
  purpose** (so the app is never stale — do not add asset caching). iOS
  standalone viewport fix lives in `src/main.tsx` (`--app-h`).
- **Quote tool:** `public/quotation.html` is a **standalone static file with no
  bundler**, embedded via an iframe in `src/pages/Quotation.tsx` (cache-busted
  per visit). It has its own CSS/JS and its own copy of the field editor. Treat
  it as a separate mini-app.

## Build & verify

```bash
npm run build        # = tsc && vite build  (TS errors fail the build)
npx tsc --noEmit     # typecheck only
npm run dev          # local dev server
```

`public/quotation.html` is static (not type-checked). Syntax-check its inline
script before committing:

```bash
node -e 'const fs=require("fs");const s=fs.readFileSync("public/quotation.html","utf8");
const m=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(s);
new (require("vm").Script)(m[1],{filename:"q.js"});console.log("OK")'
```

There are no automated tests; verify changes by building and exercising the
affected screen on a phone-sized viewport.

## Patterns to reuse (don't reinvent)

- **Roles:** `useAuth()` from `src/contexts/AuthContext.tsx` →
  `isBoss` / `isAdmin` / `isGuest` (boss inherits admin). Guests only get the
  quote tool.
- **Navigation:** `src/components/navItems.tsx` — `baseTabs`, the optional
  `match` list, and `isTabActive()` keep a merged tab highlighted on its
  sub-routes. Both `BottomNav` and `Sidebar` consume it. Five tabs:
  Dashboard · Units · Schedule · Quotes (covers `/quote`) · Money (covers
  `/costing`, boss-only via `FinanceToggle`).
- **Page data:** a page-local `load()` + a Supabase realtime channel +
  `useAutoRefresh(load)` (see `src/pages/Claims.tsx` for the canonical shape).
- **Shared UI/helpers:** `Layout` wrapper; `FinanceToggle` (Collection/Costing);
  money formatting in `src/lib/claims.ts` and `src/lib/costing.ts`; stages in
  `src/lib/stages.ts`; categories in `src/lib/categories.ts`.
- **Mobile editing:** the app-wide pinned field editor is
  `src/components/FieldEditor.tsx` (mounted once in `src/main.tsx`); the quote
  tool has its own copy inside `public/quotation.html`. **Do not reintroduce
  keyboard scroll-into-view hacks** — editing goes through these boxes.

## quotation.html gotchas

- **Prices are DB-driven (source of truth).** The complete price set lives in
  Supabase `app_settings` key `pricing`, applied for everyone on load; admins edit
  it via the in-page "Edit Prices" (which saves the whole set back). The coded
  values in `quotation.html` are only a **fall-back** for keys the DB row is
  missing (a brand-new product) or when the row can't load (empty/offline). Change
  routine prices in Edit Prices, **not** in code — a code price edit is masked by
  the DB row. (Adding a *new* product in code still works: keys absent from the
  row fall back to code, so it shows until an admin edits it.)
- **Save serialization reads inputs straight from the DOM.** Never remove inputs
  to hide them — hide with `display`/`hidden`, or saving silently drops data.
- **Documents:** created/updated via the `create_document` / `update_document`
  RPCs (auto-numbered `QT-YYMM-XXX` / `SO-YYMM-XXX`). Inserting a sales order
  fires a trigger that auto-creates/links a Unit and its work cards
  (`supabase/so_auto_unit.sql`); the in-app `WORK_MAP` decides which work cards.
- **Mobile share** builds a PDF on the fly via lazily-loaded CDN
  jsPDF + html2canvas, then uses the Web Share API.

## Supabase

- Migrations are **hand-run SQL** in `supabase/*.sql` (paste into the SQL
  Editor). `setup.sql` is the consolidated fresh-install file; the rest are the
  historical step migrations. New schema work = a new idempotent `*.sql` file
  the user runs manually.
- **RLS highlights:** authenticated users read/write jobs/work/events/appointments;
  **admin-only** deletes; **boss-only** access to `costings`; guests are blocked
  from the DB (quote tool only).

## Conventions & do-nots

- Tailwind, mobile-first; keep tables `table-fixed` and never horizontally
  scrolling on a phone (compact figures instead).
- **Don't casually rename DB tables or routes.** UI labels can change without the
  route: e.g. the tab reads "Collection"/"Money" but the route stays `/claims`
  and the table stays `claims`.
- Don't add caching to `public/sw.js`.
- Commit only when asked; keep changes scoped to the task.
