# Industries section — changes for this update

This adds an **Industries** area to 701am.com, built entirely from the existing
design system (FT-salmon paper, Newsreader + Instrument Sans, claret/teal/gold,
the `§` section labels, the tenets `doc`, the 7:01 seal). No new fonts, no new
global tokens, no separate-brand styling.

Verified with a clean `npm run build` — 19 pages, no errors. New routes are
picked up automatically by `@astrojs/sitemap`.

## New files

- `src/pages/industries/index.astro`
  The Industries hub. Lists each open vertical as a card. Reuses `.hero`,
  `.press`/section idioms, and the `<CtaBanner>` component.

- `src/pages/industries/nursing.astro`
  Earned Media for Nursing Staffing Agencies. Full landing page:
  hero → press strip (Becker's, Modern Healthcare, SIA, Fierce, HealthLeaders)
  → § 01 the first truth → § 02 ledger → § 03 the method (the two articles)
  → § 04 three engagements → founder note → from the field → CtaBanner.

- `src/pages/industries/higher-education.astro`
  Earned Media for Higher Education, targeting three buyers:
  Colleges & Universities, EdTech Companies, and Enrolment Partners (OPMs).
  Same spine as nursing, plus a "Who this is for / One cliff. Three rooms."
  three-buyer segment block. Press strip names the real higher-ed trades
  (The Chronicle, Inside Higher Ed, EdSurge, EdScoop, Higher Ed Dive).

## Modified files

- `src/components/Topbar.astro`
  Added an **Industries ▾** dropdown to the desktop nav (between About and
  Tools) and a matching section to the mobile drawer. The dropdown is cloned
  from the existing Tools dropdown — same panel, caret, hover-open,
  Escape/outside-click behaviour. The dropdown script was generalised to a
  `[data-mast-dropdown]` loop so Industries and Tools share one implementation
  and only one opens at a time. (Tools markup updated to the generic data hooks;
  behaviour unchanged.)

- `src/components/Footer.astro`
  Added an `Industries` link to the existing "The office" column. Grid
  proportions unchanged (no new column).

- `src/pages/sitemap.astro`
  Added a hand-curated "The industries" section (hub + both pages) and
  renumbered the following sections (field manual → 04, the work → 05).

## Content notes (placeholders to swap)

- Ledger figures (nursing 18/3/1, higher-ed 16/3/1) and all testimonials are
  written as **illustrative and labelled as such**. Replace with real numbers
  and named placements when available.
- Higher Education is now marked "Now open" on the hub and in the dropdown.

## To run

```bash
npm install
npm run build      # 19 pages
npm run dev        # local preview at http://localhost:4321
```
