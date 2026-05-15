# 701am

The office of earned media. Built on Astro, edited via Decap CMS, deployed to Netlify.

```
Stack: Astro 5 + MDX · Decap CMS · Netlify Identity + Git Gateway
Type:  Newsreader (display) + Instrument Sans (UI), Golden Ratio scale
Color: Navy → dawn → cream + gold accent
```

---

## Local development

```bash
npm install
npm run dev          # localhost:4321
npm run build        # output to dist/
npm run preview      # preview production build
```

Node 20+ required.

---

## Project structure

```
701am-site/
├── astro.config.mjs              Astro config + MDX + sitemap
├── netlify.toml                  Build + redirects + headers
├── tsconfig.json
├── public/
│   ├── admin/                    Decap CMS — accessible at /admin
│   │   ├── index.html
│   │   └── config.yml            Collection schema
│   ├── favicon.svg               The seal
│   ├── robots.txt
│   └── og-image.png              (add your own 1200×630 share image)
├── src/
│   ├── components/
│   │   ├── Seal.astro            Reusable seal SVG
│   │   ├── Topbar.astro          Sticky header + nav
│   │   └── Footer.astro
│   ├── content/
│   │   ├── config.ts             Typed collection schema
│   │   └── notes/                Markdown dispatches
│   │       ├── attention-is-rented.md
│   │       ├── the-un-ignorable-angle.md
│   │       └── how-to-write-a-pitch.md
│   ├── layouts/
│   │   └── BaseLayout.astro      HTML shell, fonts, meta, OG
│   ├── pages/
│   │   ├── index.astro           Landing page
│   │   ├── notes/
│   │   │   ├── index.astro       Dispatches archive
│   │   │   └── [slug].astro      Single dispatch
│   │   └── rss.xml.js            RSS feed
│   └── styles/
│       └── global.css            GRT system + design tokens
└── README.md
```

---

## Deploy to Netlify

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — 701am"
git branch -M main
git remote add origin https://github.com/your-org/701am.git
git push -u origin main
```

### 2. Connect on Netlify

1. Netlify dashboard → **Add new site** → **Import an existing project**
2. Pick your GitHub repo. Netlify reads `netlify.toml` automatically.
3. Click **Deploy**. First build takes about 90 seconds.

The site is live at `your-project.netlify.app`. To use 701am.com:

- Netlify → **Domain settings** → **Add custom domain** → enter `701am.com`
- Add the DNS records Netlify shows you (or transfer DNS to Netlify for one-click setup)
- HTTPS is automatic (Let's Encrypt)

### 3. Enable the CMS (Decap + Netlify Identity)

The CMS lives at `your-domain.com/admin/`. To make it work:

1. **Site configuration → Identity → Enable Identity**
2. Under **Registration preferences**, set to **Invite only** (otherwise anyone can sign up to edit your site)
3. Scroll down → **Services → Git Gateway → Enable Git Gateway**
4. Back to **Identity** → **Invite users** → invite yourself by email
5. Accept the invitation email and set a password
6. Go to `your-domain.com/admin/` → sign in with that account

You can now create, edit, and delete dispatches through the web UI. Each edit becomes a git commit on `main` (or a pull request if you uncomment `publish_mode: editorial_workflow` in `public/admin/config.yml`).

---

## Writing dispatches

Two ways:

### A. Through the CMS (recommended for non-developers)

Visit `/admin/`, sign in, click **Dispatches → New Dispatch**. The form has every field from the schema. Hit publish.

### B. Add a markdown file directly

Create a file in `src/content/notes/` with frontmatter:

```yaml
---
title: "Your dispatch title."
deck: "One-line subtitle that goes under the headline."
number: 4
date: 2026-04-01
topic: "The angle"              # The angle | The pitch | Authority | The trade | Field notes | The reading list
tags: ["tag-one", "tag-two"]
readingTime: "5 min"
draft: false                    # set true to hide from build
---

Your prose here. **Bold** and *italic* render with the gold accent.

## Section heading

The first paragraph automatically gets a drop cap.

> Pullquotes render as serif italic with a gold left border.
> <cite>— Attribution line</cite>

- Bullet lists use gold markers
- Inline `code` gets a gold-tinted background
```

Number them sequentially. The archive sorts by date, but the dispatch number appears as `№ 004` in the lockup.

---

## Typography notes (don't fight the system)

Everything sizes from one base: **17px body / 29px line-height / φ ratio**. The scale and spacing tokens live in `src/styles/global.css` as CSS custom properties. If you change `--f6-size` (the base), the whole page rescales proportionally.

- **Headings**: Newsreader 500 (display) and 400 italic for emphasis
- **Body**: Instrument Sans 400, base 17px, line-height 1.706
- **Measure**: capped at 38rem (~89 characters per line) — every prose block respects this
- **Drop cap**: first letter of the first paragraph of every dispatch, italic gold, 5.2× body size, spans three lines

---

## Customizing

- **Brand colors** → `src/styles/global.css` CSS custom properties
- **Topbar links** → `src/components/Topbar.astro`
- **CTA targets** → currently `mailto:hello@701am.com`. Swap for Cal.com / Tally / your form URL in:
  - `src/pages/index.astro` (offer cards, hero buttons)
  - `src/pages/notes/[slug].astro` (post CTA inset)
- **Author byline** → `src/pages/notes/[slug].astro` — the avatar initial and `— David, at sunrise` line
- **OG image** → drop a `1200×630` PNG at `public/og-image.png`

---

## What you get out of the box

- ✅ Landing page with revised CTA pattern (primary button + serif italic link)
- ✅ Dispatches archive (by topic + by date, Mark Manson-style ledger)
- ✅ Single dispatch template with drop cap, pullquotes, prev/next nav, embedded CTA
- ✅ RSS feed at `/rss.xml`
- ✅ Sitemap at `/sitemap-index.xml`
- ✅ Decap CMS at `/admin/` (git-backed, Netlify Identity)
- ✅ Open Graph + Twitter card meta
- ✅ Mobile responsive (16px base on narrow viewports)
- ✅ Scroll reveal animations
- ✅ Sticky topbar with bunting strip
- ✅ Custom 701am sunrise-and-columns seal (favicon + header + footer)
- ✅ Three seed dispatches (attention/authority, the angle, the pitch)

---

The record continues at sunrise. ★
