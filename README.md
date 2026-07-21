# 🪴 Garden

A personal AI-powered vegetable-garden planner for 16 raised beds. Claude plans each season
(rotation-aware, companion-aware), generates the week-by-week task schedule, and logs everything
you tell it in plain English. Built to be dead simple on a phone or iPad.

## One-time setup (~15 minutes)

### 1. Supabase (free database)

1. Go to [supabase.com](https://supabase.com) → create a free account → **New project** (any name, e.g. `garden`).
2. In the project: **SQL Editor** → paste the whole contents of `scripts/schema.sql` → **Run**. This creates the tables and your 16 beds.
3. **Project Settings → API**: copy the **Project URL** and the **`service_role` secret key**.

### 2. Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com) → API Keys. A season plan costs a few cents; chat messages are fractions of a cent.

### 3. Local config

Copy `.env.example` to `.env.local` and fill in all five values (pick your own `APP_PASSWORD` and any long random `SESSION_SECRET`).

### 4. Run locally

```
npm install
node scripts/seed.mjs        # verifies the database connection
npm run dev                  # open http://localhost:3000
```

Sign in with your `APP_PASSWORD`, then the setup wizard walks you through zip code → bed names → "what's planted now".

### 5. Deploy to Vercel (so it's on your phone)

1. Push this folder to a GitHub repo.
2. [vercel.com](https://vercel.com) → **Add New Project** → import the repo (defaults are fine).
3. In the project's **Settings → Environment Variables**, add the same five variables from `.env.local`.
4. Deploy. Open the URL on your iPhone/iPad → Share → **Add to Home Screen**. It now looks and feels like an app, and both devices share the same data.

## Daily use

- **Today** — your check-off list: what to plant, fertilize, harvest this week.
- **Beds** — tap any bed for what's growing, its history, and notes.
- **Plan** — start a season ("Plan my season"), review the AI's bed-by-bed proposal, approve it. Once active, this tab is a chat: "just planted carrots in bed 9", "what goes well next to peppers?"
- **Settings** — zip/zone/frost dates, bed names, end a season, sign out.

## Handy scripts

- `node scripts/seed.mjs` — check DB connectivity
- `node scripts/seed.mjs --demo` — add two prior seasons of sample plantings (makes rotation advice testable immediately)
- `node scripts/make-icons.mjs` — regenerate PWA icons

## Stack

Next.js 16 (App Router) · Tailwind v4 · Supabase Postgres · Claude (`claude-sonnet-5`) via `@anthropic-ai/sdk` · deployed on Vercel. Single shared password auth (`proxy.ts` gate + httpOnly cookie); API keys never reach the browser.
