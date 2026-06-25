# Patch Notes

User-facing changes, newest first. Covers the quotation-tool package rollout,
the work-category restructure, and the bottom-menu fix.

---

## June 2026 — Quotation packages, category cleanup & layout fix

### Quotation tool — new "PG" packages

The quote builder now has ready-made packages you pick from instead of entering
every line by hand. Each package has its own **2 Room / 3 Room** toggle that
re-prices everything, and all names, sizes and prices are editable in **Edit
Prices**.

- **PG Iron Work Package** — pick a product (balcony door, main door, yard
  grills, etc.), set the powder-coat colour and an optional exhaust-fan opening
  (tap the grid to mark where the hole goes), then add it. Repeat for each
  piece. Sits under the **Iron Work** card.
  - Window Grill add-ons included: Master Room, Room 2, plus **Room 3 (4'×4')**
    and **Master Room Toilet (2'×4')** — the last two are **3-Room only** and
    stay hidden when 2 Room is selected.
- **PG Invisible Grills Package** — pick the floor (Ground/1st/2nd/3rd) and
  balcony size (Half / Full); price fills in automatically. Also under the
  **Iron Work** card.
- **PG Yard Package (Aluminium / Polycarbonate / Acrylic)** — pick the floor and
  material; Moru Acrylic adds a White/Transparent colour choice, and there's an
  optional exhaust-fan opening. Under the **Aluminium Work** card.
- **PG Painting Package** — Wall Painting with a **Colour Package** selector
  (Option 01–05). 2 Room = 688 sqft, 3 Room = 1088 sqft. Add-ons: **Ceiling**,
  and **Door & Frame** / **Frame** priced **per set** with a quantity field.
  Under the **Painting** card.

Each of these cards now has a **Type** selector at the top, so one card holds
both the measured/manual option and its matching package (e.g. Painting →
"Painting (measure & price)" or "PG Painting Package").

### Work categories — aligned everywhere

The categories in the quote tool, the job/unit cards, and Edit Prices are now
one consistent set, in the same order across every screen:

- **Iron Work** and **Aluminium Work** are separate categories. Iron Work holds
  the iron grill plus the two iron packages; Aluminium Work holds the Yard
  package and aluminium products.
- **Aluminium Cabinet** is its own category, split out from Aluminium Work.
- Aluminium grills were removed (a single Aluminium Work entry sits below Iron
  Work instead).
- When a Sales Order is created, the unit opens exactly the work cards implied by
  what was quoted — no more mismatches between the quote and the job.

### Other Services

- New **Other Services** category in the quote builder for ad-hoc lines — type a
  custom product name and price for anything that doesn't fit the standard
  catalogue.

### Edit Prices — easier to manage

- Tabs are reorganised by **work category** (Cabinet, Aluminium Cabinet, Iron
  Work, Aluminium Work, Paint, the product categories, Discounts).
- The old single "Items" tab is split into **one chip per category**.
- You can now **rename any product** anywhere.
- Package **2-Room and 3-Room sizes are edited separately** (the sizes differ,
  not just the price). Leave a 3-Room price blank to keep it unset.

### Layout

- Fixed the **dead space below the bottom menu** — the tab bar is now pinned to
  the true bottom edge of the screen, with the labels sitting just above the
  home indicator.

---

*Quote-tool changes go live after the app redeploys; reload the Quotes page to
pick up the latest version.*
