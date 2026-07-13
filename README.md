# The Gen Academy — Certificates

Cohort-based certificate issuance. A cohort's roster is built automatically
from two uploaded CSVs — a student is on the roster once they appear in
*both* — and generates credentials; an admin generates certificates and
shares each student's personal `/verify/:credentialId` link directly (no
self-serve lookup). Certificates follow the brand system in
[`gen_academy_certificate_brand_compressed.md`](./gen_academy_certificate_brand_compressed.md)
(with a calmer, more print-like typography pass on top).

## Examples

- [`examples/example-certificate.png`](./examples/example-certificate.png) — a
  sample of what a generated certificate looks like.

## How it works

- **Homepage** (`/`, public): just a static notice pointing students at the
  personal link they were sent — there's no self-serve name/email lookup.
- **Admin** (hidden behind `ADMIN_PATH`, not `/admin` — see below):
  - Create a cohort (course name + cohort label, e.g. "Mastering Agentic AI" / "Cohort 3").
  - Upload the "Week 2 Project" and "Week 3 Project" submission CSVs (raw
    exports work — the parser just needs an email column and a name/full-name
    column, ignores everything else). The roster is built automatically as
    the intersection of the two by email; re-uploading either one rebuilds it
    to match the current lists exactly, including removing anyone who's no
    longer in both (even if they already have a certificate — see the code
    comment on `recomputeRoster` in `lib/store.ts` before relying on this).
  - **Final assessment scores** (fallback for cohorts not using the Google
    Forms integration below): upload a CSV of email + score. Only a score
    above 80 counts as eligible — same "not enforced until uploaded"
    convention as the Week 2/3 lists.
  - "Add student" adds someone by hand for cases the two lists missed — a
    manually-added student is exempt from the Week 2/3 (and assessment)
    check and is never removed by a re-upload.
  - Click "Generate certificates" to mint a credential ID, render the
    certificate image, and store it — for everyone in the cohort who's
    eligible and doesn't have one yet.
  - "Export CSV" downloads every student's name, email, credential ID, and
    `/verify/:credentialId` link — the file you'd actually send out or hand
    off to whoever emails students.
- **Verification** (`/verify/:credentialId`, public): shows the certificate
  image, confirms it's a real credential, and lets whoever holds the link
  pick a light/dark certificate style (re-rendering on the spot). This is
  also where the QR code on the certificate itself points, and where
  "Add to LinkedIn" lives.
- **Google Forms quiz integration** (optional, separate project): a
  quiz-graded Google Form can generate an already-rostered student's
  certificate the moment they pass, matched by **email only** (no name
  field needed on the form). Lives in its own repo/folder at
  `../google-forms-certificate-addon` (not part of this app) since it's
  headed toward being a standalone Google Workspace Marketplace listing
  eventually. It talks to this app only via the `AUTOMATION_API_KEY`-gated
  endpoint below.

### The admin area is hidden

There's no visible link to it anywhere in the public UI, and it isn't at the
guessable `/admin` path. Instead it lives at whatever path you set
`ADMIN_PATH` to (e.g. `https://your-app.vercel.app/staff-portal-7g2k`) — bookmark
that URL yourself and share it directly with other admins. Hitting the literal
`/admin` returns a plain 404, same as any page that doesn't exist. If you
don't set `ADMIN_PATH` at all, it falls back to plain `/admin` (no hiding) —
so make sure to set it in production.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- **Postgres** (Neon in production, any Postgres locally) stores cohorts,
  students, and the weekly-submission rosters (`lib/store.ts` /
  `lib/db-client.ts`, schema in `db/schema.sql`). Plain `pg` driver — works
  identically against Neon and a local/Docker Postgres, since Neon is
  wire-protocol compatible.
- Puppeteer (Chromium) renders the certificate HTML/CSS to a PNG.
- Certificate PNGs are stored as bytes in Postgres (`students.certificate_png`)
  and served from `/api/certificates/[credentialId]` — no separate file/blob
  storage to provision.
- `qrcode` generates the verification QR embedded on each certificate.

Reads/writes that touch more than one row (rebuilding a roster from a fresh
CSV upload, deleting a student) run inside a real transaction — see
`recomputeRoster` and `deleteStudent` in `lib/store.ts`.

## Local setup

1. Get a Postgres instance — either a free [Neon](https://neon.tech)
   database or a local one (e.g. `docker run -e POSTGRES_PASSWORD=devpassword -p 5432:5432 postgres:16`).
2. Run the schema against it once:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
3. Copy `.env.example` to `.env` and fill in the values (see below) —
   `DATABASE_URL` is required.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the app:
   ```bash
   npm run dev
   ```
6. Sign in at `http://localhost:3000/<your ADMIN_PATH>/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Locally, certificate rendering uses the full `puppeteer` package (bundled
Chromium) automatically — no extra setup needed.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon, or any Postgres). Run `db/schema.sql` against it once before first use. |
| `ADMIN_EMAIL` | Email for the single admin account. |
| `ADMIN_PASSWORD` | Password for the single admin account. |
| `ADMIN_PATH` | The secret path the admin area lives at instead of `/admin` (e.g. `staff-portal-7g2k`). Falls back to plain `/admin` if unset. |
| `SESSION_SECRET` | Random string used to sign the admin session cookie (`openssl rand -base64 32`). |
| `NEXT_PUBLIC_BASE_URL` | Public URL of the deployment (no trailing slash) — used to build the QR code and shareable verify links baked into each certificate. |
| `AUTOMATION_API_KEY` | Optional. Bearer token that authorizes the separate Google Forms integration (`../google-forms-certificate-addon`) to mark an *already-rostered* student as completed and generate their certificate — it only matches existing roster entries (built from the Week 2/3 CSVs, or added manually), it never enrolls someone new. Scoped to that one action only, separate from the admin login. Leave unset if you're not using that integration. |

## Deploying to Vercel

You need a [Vercel](https://vercel.com) account. Two ways to ship this repo:

**Option A — Vercel CLI (fastest, no GitHub needed)**

```bash
npm install -g vercel   # or use `npx vercel` each time instead of installing globally
vercel                  # links/creates the project, deploys a preview
```
The first run asks you to log in (opens a browser) and asks a few setup
questions — accept the defaults. This deploys a *preview* URL first; once
env vars are set (below) run `vercel --prod` to deploy to your production URL.

**Option B — GitHub + Vercel dashboard (better for ongoing changes)**

1. Push this repo to a GitHub repo you own.
2. In the Vercel dashboard: **Add New → Project → Import** your GitHub repo.
3. Vercel auto-detects Next.js — no build config changes needed.

**Either way, before (or right after) the first deploy:**

1. Create a [Neon](https://neon.tech) Postgres database (Vercel's dashboard
   has a **Storage → Create Database → Neon Postgres** shortcut that does
   this and sets `DATABASE_URL` for you automatically — or create one
   directly on neon.tech and add the env var yourself). Either way, run the
   schema against it once: `psql "$DATABASE_URL" -f db/schema.sql`.
2. Project → **Settings → Environment Variables**, add:
   - `DATABASE_URL` — the Neon connection string (skip if step 1's Vercel integration already set it).
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the one admin account's sign-in credentials.
   - `ADMIN_PATH` — a private, hard-to-guess path segment for the admin area (e.g. `staff-portal-7g2k`). Without this, admin is reachable at plain `/admin`.
   - `SESSION_SECRET` — a random string (`openssl rand -base64 32`, or any long random value).
   - `NEXT_PUBLIC_BASE_URL` — your Vercel URL, e.g. `https://your-project.vercel.app` (no trailing slash). This gets baked into every certificate's QR code and verify link, so set it *before* generating any real certificates, and redeploy if it changes.
3. Redeploy (Vercel does this automatically after an env var change if you use the dashboard; with the CLI run `vercel --prod` again).

On Vercel, certificate rendering automatically switches to `puppeteer-core` +
`@sparticuz/chromium` (serverless-friendly Chromium) — detected via the
`VERCEL` environment variable Vercel sets automatically, no config needed on
your end.

The certificate-generation endpoint (`/api/admin/cohorts/[id]/generate`)
processes a small batch of pending students per request and reports how many
remain; the admin UI calls it in a loop so arbitrarily large cohorts work
within serverless function time limits.
#   c e r t i f i c a t e - g e n e r a t o r  
 