# LERNEX — Free cloud setup (no credit card, no surprise charges)

Three free services put LERNEX online so the app works anywhere, on any network.
None of them asks for a card, so nothing can ever be charged: when a free limit
is reached the service pauses or slows down — it does **not** bill you.

| What | Service | Free plan (roughly — see each site for current limits) |
|---|---|---|
| Database (PostgreSQL) | **Neon** — neon.tech | 0.5 GB storage, sleeps when idle, monthly compute-hour allowance |
| Photos, videos, audio | **Cloudinary** — cloudinary.com | ~25 credits/month (1 credit ≈ 1 GB storage *or* 1 GB delivery), videos up to 100 MB |
| Backend server (API, chat, calls) | **Render** — render.com | 1 free web service, sleeps after 15 min without traffic |
| Keep the server awake | **cron-job.org** | Free scheduled pings |

> 🔒 Secrets (database URL, Cloudinary URL) go **only** into the Render dashboard
> and your local `backend/.env`. Never paste them into chat or commit them.

---

## Step 1 — GitHub (free, private repo)

Render deploys from GitHub.

1. Create a free account at <https://github.com>.
2. Create a **private** repository named `lernex-app` (no README).
3. Tell Claude the repo URL — it will commit the code and push it for you
   (`.env` files, uploads and node_modules are already excluded).

## Step 2 — Neon (database)

1. Sign up at <https://neon.tech> (use "Continue with GitHub").
2. **Create project** → name `lernex` → region **AWS Asia Pacific (Singapore)** → Create.
3. On the dashboard click **Connect** → turn **Connection pooling OFF** →
   copy the connection string. It looks like
   `postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
4. Keep it for Step 4 (don't share it).

## Step 3 — Cloudinary (media)

1. Sign up at <https://cloudinary.com/users/register_free>.
2. Open **Dashboard** (or Settings → **API Keys**) and copy the
   **API environment variable**: `cloudinary://<api_key>:<api_secret>@<cloud_name>`
   (remove the `CLOUDINARY_URL=` prefix if it's included).
3. Keep it for Step 4.

## Step 4 — Render (backend server)

1. Sign up at <https://render.com> with **GitHub** (no card needed for the free plan).
2. **New → Blueprint** → choose your `lernex-app` repo. Render reads `render.yaml`.
3. Fill in the values it asks for:
   - `DATABASE_URL` → the Neon string from Step 2
   - `CLOUDINARY_URL` → from Step 3
   - `ADMIN_EMAILS` → `anshumansarkar600@gmail.com` (owner/admin login emails, comma-separated)
   - `TURN_*` → leave empty (optional, for calls on strict mobile networks)
4. **Apply**. The first deploy takes a few minutes. It creates the database
   tables automatically. When it says **Live**, open
   `https://lernex-api.onrender.com/api/v1/health` — you should see `"database":"up"`.
5. If Render gave your service a different address, tell Claude (the app
   build must point to it — `eas.json` → `EXPO_PUBLIC_API_URL`).

## Step 5 — Keep it awake (cron-job.org)

Render's free server sleeps after 15 minutes without traffic (the first visit
then takes ~1 minute, and live chat/calls/scheduled notifications pause).

1. Sign up at <https://cron-job.org> (free).
2. **Create cronjob** → URL `https://lernex-api.onrender.com/api/v1/health/live`
   → every **10 minutes** → Save.

This endpoint never touches the database, so Neon can still sleep when nobody
is using the app (that keeps you inside Neon's free compute hours).

## Step 6 — Build the real app

Follow `docs/DEV_BUILD_SETUP.md` Steps 1–2 once (Expo + Firebase for phone
notifications), then build an installable app that talks to the cloud:

```bash
eas build --profile preview --platform android
```

Install the APK from the link on any phone — it works on Wi-Fi and mobile data,
anywhere. Share the same APK with testers.

---

## What's already prepared in the code

- **Media:** set `CLOUDINARY_URL` and uploads go to Cloudinary over HTTPS
  automatically (local disk is used only in development). Uploads are signed on
  the server; the secret never reaches the app. Production refuses to start
  without it, so media can't silently land on Render's wiped-on-restart disk.
- **Database:** Prisma runs pending migrations + the catalog seed on every start.
- **Low-cost design:** the health check used by Render/pings doesn't query the
  database, and background jobs (scheduled notifications, events) wake only
  when something is due — the database can sleep when the app is idle.
- **App:** `preview` / `production` builds use `https://lernex-api.onrender.com`;
  `development` builds keep talking to your computer on Wi-Fi.

## Your local development keeps working

Nothing changes locally: your computer's PostgreSQL and `uploads/` folder are
still used by `npm run start:dev`. To try Cloudinary locally, add the same
`CLOUDINARY_URL=...` line to `backend/.env`.
