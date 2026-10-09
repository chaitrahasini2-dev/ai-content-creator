# CreatorSphere AI

> Where AI Creativity Meets Brands.

A full-stack marketplace that connects **AI content creators** with **brands and creative agencies**. Creators publish portfolios, declare their AI tool stack and workflow, and get matched to briefs. Brands post structured briefs, discover talent through real database search, run projects, message creators, review deliverables and leave reviews.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn-style UI + Supabase (Postgres/Auth/Storage) + Google Gemini**.

---

## Table of contents

- [Feature overview](#feature-overview)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Seeding demo data](#seeding-demo-data)
- [Demo accounts](#demo-accounts)
- [AI features](#ai-features)
- [Matching engine](#matching-engine)
- [Company verification](#company-verification)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Deployment (Vercel)](#deployment-vercel)
- [Security & privacy notes](#security--privacy-notes)
- [Known limitations](#known-limitations)

---

## Feature overview

**Creator**
- Email OTP signup/login, role selection, profile + onboarding
- Portfolio manager with AI-assisted analysis (assistive, never authorship proof)
- Experience, skills, AI tool stack, workflow and licensing
- AI-ranked brief recommendations with transparent reasons **and gaps**
- Applications tracking, projects, delivered files, messaging, reviews

**Brand**
- Brand profile and company verification workflow
- Structured brief builder with an optional **AI brief draft** (copy only)
- Discover creators via DB-driven search (skills, tools, specialization, content type, rating, budget, availability, commercial use)
- Per-brief candidate scoring + applicant shortlist/accept/decline
- Projects workroom: deliverables, revision rounds, approvals, messaging, reviews

**Platform**
- Row-Level Security on every table
- Server Actions for all writes (ownership derived from the session)
- Storage buckets with per-bucket policies
- Graceful degradation everywhere: no AI key → deterministic fallbacks; no Supabase env → empty/configuration states instead of crashes

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, custom design tokens, Radix primitives |
| Auth / DB / Storage | Supabase (`@supabase/ssr`) |
| AI | Google Gemini (`@google/generative-ai`) |
| Validation | Zod |
| Icons | lucide-react |

---

## Getting started

```bash
# 1. install
npm install

# 2. configure env
cp .env.example .env.local   # Windows: Copy-Item .env.example .env.local
#   then fill in Supabase + Gemini values

# 3. apply the SQL migrations to your Supabase project
#    (Supabase CLI or Dashboard SQL editor) — see supabase/migrations/*.sql

# 4. seed demo data (optional but recommended)
npm run seed

# 5. run
npm run dev
```

Open http://localhost:3000.

> The app is designed to boot **without** credentials: pages render empty/configuration states. To exercise real flows you must connect Supabase (and optionally Gemini).

---

## Environment variables

See [`.env.example`](.env.example). All variables are optional at build time; the app checks for them at runtime.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Privileged ops: seed, notifications insert, denormalized stat recompute, reference upserts |
| `GEMINI_API_KEY` | server | AI routes (`/api/ai/*`) |
| `GEMINI_MODEL` | server | Model id (default `gemini-flash-latest`) |
| `NEXT_PUBLIC_ALLOW_GMAIL_ONLY` | public | Restrict registration to Gmail addresses |
| `COMPANY_VERIFY_PROVIDER` | server | Verification provider id (default `rdap`) |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical site URL for auth redirects |

---

## Database

Migrations live in [`supabase/migrations`](supabase/migrations):

| File | Contents |
| --- | --- |
| `0001_init.sql` | 18 tables, enums, indexes, `handle_new_user()` trigger, `set_updated_at()` |
| `0002_rls.sql` | Row-Level Security policies + helper functions (`is_admin`, `my_creator_profile_id`, `owns_brand`, `is_project_participant`, …) and the `app_admins` table |
| `0003_storage.sql` | Storage buckets (avatars, brand-logos, portfolio, verification-docs, deliverables) and their policies |
| `0004_profile_privacy.sql` | Column-level GRANT hiding `profiles.email`, plus a SECURITY DEFINER RPC `email_for_username()` |

Apply them in order with the Supabase CLI (`supabase db push`) or by pasting each file into the dashboard SQL editor.

---

## Seeding demo data

```bash
# random passwords (logs in via email OTP)
npm run seed

# fixed password for every demo account (useful for local login testing)
SEED_DEMO_PASSWORD=Password123 npm run seed   # PowerShell: $env:SEED_DEMO_PASSWORD="Password123"; npm run seed
```

The seed is idempotent and creates:

- **50 creators** (`creator1@creatorsphere.demo` …) with profiles, skills, tools, portfolios
- **50 brands** (`brand1@brandspheredemo.com` …) with logos, industries, verification records
- Reference data (skills, AI tools), briefs + brief_skills, applications, projects, deliverables, messages, reviews, notifications

All seeded rows are flagged `is_demo = true` and clearly labelled in the UI. Requires `SUPABASE_SERVICE_ROLE_KEY`.

---

## Demo accounts

- Creators: `creator1@creatorsphere.demo` … `creator50@creatorsphere.demo`
- Brands: `brand1@brandspheredemo.com` … `brand50@brandspheredemo.com`

Log in with either the **username** (`creator1`, `brand1`) or the full email. Seeded accounts are **email-confirmed**. Log in with the `SEED_DEMO_PASSWORD` you provided. In the local environment this seed was run with `SEED_DEMO_PASSWORD=CreatorSphere123!`, so for example **`creator1` / `brand1`** with password **`CreatorSphere123!`**.

> Demo data is fictional and labelled as such. Reviews testifying to results are sample content, not real endorsements.

---

## AI features

All AI calls funnel through [`src/lib/gemini.ts`](src/lib/gemini.ts) so the API key stays server-side, rate limits are handled, and every feature has a deterministic fallback.

| Route | Purpose |
| --- | --- |
| `POST /api/ai/brief` | Draft brief copy from a one-line idea (structured JSON) |
| `POST /api/ai/recommend` | Return ranked creators for a brief (deterministic scores) |
| `POST /api/ai/portfolio-analysis` | Assistive analysis of a portfolio item |

If `GEMINI_API_KEY` is missing, these routes return sensible fallbacks and the UI labels the result accordingly. **AI never invents match scores** — scores come from the deterministic engine; AI only helps write copy or summarise.

---

## Matching engine

[`src/lib/matching.ts`](src/lib/matching.ts) computes a transparent, weighted **0–100 fit score** for creator↔brief. Weights sum to 100 across: skills, specialization, tools, portfolio relevance, experience, budget, availability, format, commercial-use and rating. The engine also emits human-readable **reasons** and **gaps** so results are explainable.

---

## Company verification

[`src/lib/verification`](src/lib/verification) runs best-effort automated checks (website reachability, business-email domain match, RDAP registration lookup). Automated checks can **at most** reach `partially_verified`; the `verified` badge is admin-only and never granted automatically or faked.

---

## Project structure

```
src/
  app/
    (auth)/            login, signup, verify-email, password reset
    actions/           server actions (auth, briefs, projects, messages, reviews, portfolio, creator, brand, notifications)
    api/               ai/*, upload, verify-company
    brand/             brand dashboard, briefs, campaigns, projects, verification, settings…
    creator/           creator dashboard, portfolio, experience, projects, recommendations…
    creators/ briefs/  public directory + brief pages
    about/ contact/ privacy/ terms/
  components/
    ui/                design-system primitives
    layout/            navbar, footer, dashboard shell/sidebar
    creators/ briefs/ portfolio/ dashboard/ forms/
  lib/
    supabase/          client, server, admin, middleware helpers
    auth, queries, matching, gemini, validation, form, notify, refs, stats, rate-limit, verification, constants, utils
  types/               domain types
supabase/
  migrations/          SQL schema, RLS, storage, privacy
  seed/seed.mjs        idempotent demo seed
legacy-prototype/      original Vite prototype (kept for reference)
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Seed demo data |

---

## Deployment (Vercel)

1. Push the repo to GitHub and import it into Vercel.
2. Add all environment variables from `.env.example` (project settings).
3. Set `NEXT_PUBLIC_SITE_URL` to your production URL.
4. Apply migrations and (optionally) run the seed against your production database.
5. Deploy.

---

## Security & privacy notes

- RLS is enabled on every table; all writes go through Server Actions that derive ownership from the session (`auth.uid()`), never from client-supplied ids.
- `profiles.email` is not publicly readable (column-level GRANT); lookups use a SECURITY DEFINER RPC.
- The service-role key is used **server-only** for privileged operations (seeding, cross-user stat recompute, notification inserts, reference upserts). Never expose it to the client.
- Uploads are validated by MIME type and size per kind before hitting Storage.

---

## Known limitations

- The rate limiter is in-memory and per instance — on serverless it is best-effort only. Back it with Upstash/Redis for production.
- AI quality depends on the configured Gemini model and free-tier quotas; failures degrade to deterministic fallbacks.
- Company verification is best-effort and automated checks cap at `partially_verified`; full verification requires an administrator.
