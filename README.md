# 701am — Astro + Decap CMS

The marketing site and Founder Notes blog for 701am, the earned-media engine for higher education.
Built with **Astro v5** (content collections), **Decap CMS** (git-based editing), deployed on **Netlify**.

## Stack

- **Astro** — static site, content collections for the blog
- **Decap CMS** — `/admin/` git-backed editor (git-gateway)
- **Netlify** — hosting + Identity/Git Gateway for CMS auth

## Local development

```bash
npm install
npm run dev            # site at http://localhost:4321
```

To run the CMS locally against your filesystem (no auth needed):

```bash
# uncomment `local_backend: true` in public/admin/config.yml, then:
npx decap-server       # in one terminal
npm run dev            # in another; open http://localhost:4321/admin/
```

## Content

- Blog posts live in `src/content/blog/*.md` with frontmatter:
  `title`, `dek`, `date`, `collection`, `tags`, `author`, `draft`.
- The schema is in `src/content.config.ts`; the CMS fields mirror it in `public/admin/config.yml`.
  **Keep those two in sync** when you add a field.

## Lead capture (Netlify Forms)

Two forms are wired and work the moment you deploy — no backend:

- **`early-access`** — the "Request early access" modal (every page). Captures `email` + `source` (which page the lead came from, e.g. `universities`, `home`, `blog`).
- **`newsletter`** — the blog subscribe box. Captures `email` + `source: blog`.

Both submit via AJAX so the in-page thanks-state UX is preserved (no reload), and both
have a honeypot (`bot-field`) for basic spam protection.

**How it works:** hidden static detection forms live in `src/layouts/Layout.astro` so
Netlify's build bot registers the form names; the visible UI posts to them with `fetch`.
Do not remove the hidden forms — without them, submissions 404.

**After deploy:**
1. Netlify → **Forms** shows `early-access` and `newsletter` with submissions.
2. Set up notifications: Forms → **Form notifications** → add an email (or Slack/webhook)
   so new leads ping you.
3. Spam: the honeypot handles most; enable reCAPTCHA in form settings if needed.

> Local `npm run dev` won't capture submissions (the form backend only exists on Netlify).
> Test on a deploy preview.

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **New site from Git** → pick the repo. Build command `npm run build`, publish dir `dist` (already in `netlify.toml`).
3. Enable **Identity** on the site, set registration to **Invite only**.
4. Enable **Git Gateway** under Identity → Services.
5. Invite yourself as a user; accept the email; set a password.
6. Visit `https://<your-site>/admin/` and log in. Edits commit to the repo and trigger a rebuild.

> Note: Decap's git-gateway relies on Netlify Identity. If you prefer GitHub OAuth directly,
> swap the backend in `config.yml` to `name: github` and configure an OAuth app.

## Structure

```
src/
  config.ts              # nav, segments, brand strings
  content.config.ts      # blog collection schema
  layouts/Layout.astro   # head/SEO, nav, footer, modal
  components/             # Mark, GradDefs, Nav, Footer, Modal
  pages/
    index.astro          # homepage (Higher-Ed umbrella)
    universities.astro    edtech.astro    agencies.astro   # segment front doors
    blog/index.astro      blog/[...slug].astro             # blog
    blog/c/[collection].astro                              # collection filters
    rss.xml.js
  content/blog/*.md       # posts
public/
  admin/                 # Decap CMS (config.yml + index.html)
  assets/                # logo, uploads
```
