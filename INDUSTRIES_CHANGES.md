# Industries section — current state

An **Industries** area built entirely from the existing design system
(FT-salmon paper, Newsreader + Instrument Sans, claret/teal/gold, the `§`
section labels, the tenets `doc`, the 7:01 seal). Shared section styles
(hero, press strip, ledger, doc, tenets, founder note) live in
`src/styles/global.css` so every page renders identically.

Verified with a clean `npm run build` — 24 pages, no errors. New routes are
picked up automatically by `@astrojs/sitemap`.

## Industry pages (src/pages/industries/)

- `index.astro`            — the hub (cards for all seven verticals)
- `healthcare.astro`       — Providers · staffing · payers · health-tech (incl. a buyer-segment block)
- `higher-education.astro` — Colleges · EdTech · enrolment partners (buyer-segment block)
- `b2b.astro`              — Arrive in the room already credible
- `startup.astro`          — Out-story the incumbents you can't outspend
- `ai.astro`               — Be the AI company the press takes seriously
- `consumer-services.astro`— Home · fitness · finance · wellness
- `fashion-brands.astro`   — The editorial credibility ads can't buy

Note: the earlier `nursing.astro` was rebuilt into `healthcare.astro`
(staffing is now one of the healthcare buyer segments). The old
`/industries/nursing` route no longer exists.

Each page: hero → press strip (real trade outlets for that beat) → § 01 the
first truth (dropcap + aphorism) → optional buyer-segment block → § 02 ledger
→ § 03 the method (the two articles) → § 04 three engagements → founder note
→ from the field → CtaBanner.

## Modified files

- `src/components/Topbar.astro` — Industries dropdown now lists all seven
  verticals (desktop + mobile drawer). Added a `--tall` menu modifier that
  caps height and scrolls. Dropdown behaviour unchanged.
- `src/pages/industries/index.astro` — hub now shows all seven cards.
- `src/pages/sitemap.astro` — "The industries" section lists all seven.

## Content notes (placeholders to swap)

- All ledger figures and testimonials are written as **illustrative and
  labelled as such**. Replace with real numbers and named placements.

## To run

```bash
npm install
npm run build      # 24 pages
npm run dev        # local preview at http://localhost:4321
```
