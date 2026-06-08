# Tenn Renovation

A simple, mobile-first web app to replace your renovation-progress Excel file.
Your team signs in on their phones and sees every customer's job, live —
progress stage, who has the keys, photos, dates, and a running activity log
showing **who** updated **what** and **when**.

- 🔐 Email + password login (admin creates accounts; add as many staff as you like)
- 📊 Fixed renovation stages with a progress bar per job
- 🔑 Key-holder tracking with a logged handover history
- 📷 Progress photos straight from the phone camera
- 🗒️ Per-job activity timeline (stage changes, key handovers, notes — all stamped with the user)
- ⚡ Real-time: every change appears on everyone's phone within a second, no refresh

Built with React + Vite + TypeScript and [Supabase](https://supabase.com)
(database, login, real-time, photo storage — all on the free tier).

---

## One-time setup (about 15 minutes)

You'll do this once. After that, adding the app to a phone takes 10 seconds.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub or email.
2. **New project**. Pick a name (e.g. `reno-tracker`), set a strong database
   password (save it somewhere), choose the region closest to you, and create it.
3. Wait ~2 minutes for it to finish provisioning.

### 2. Create the database tables

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this repo,
   copy the **entire** contents, paste into the editor, and click **Run**.
3. You should see "Success". This creates all the tables, security rules,
   real-time, and the photo storage bucket. It's safe to re-run later.

### 3. Get your two keys

1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon public** key (the long one labelled
   `anon` `public`). These are safe to put in the app — they only allow what
   the security rules permit, and nothing for logged-out users.

### 4. Add your team's logins

1. Go to **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the staff member's email and a temporary password. Tick
   **Auto Confirm User** so they can log in immediately.
3. To set their **display name** (so updates show their name, not their email):
   when adding the user, expand **User Metadata** and add
   `{"full_name": "Ahmad"}`. _(If you skip this, the app falls back to the part
   of their email before the `@`.)_
4. Repeat for all 6 staff. Add more anytime — there's no code change needed.

> Tip: turn **off** public sign-ups so only you can add staff:
> **Authentication → Providers → Email →** disable "Enable sign ups" (or leave
> the default; either way, this app has no self-signup screen).

### 5. Connect the app to your Supabase project

1. In this project folder, copy `.env.example` to `.env`.
2. Paste your two values:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## Running it locally (to test)

```bash
npm install
npm run dev
```

Open the printed URL (e.g. `http://localhost:5173`) and sign in with one of the
users you created.

---

## Putting it online (so your team can use it on their phones)

Any static host works. The easiest free option is **Vercel**:

1. Push this repo to GitHub (this branch is already set up).
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel auto-detects Vite. Before deploying, add two **Environment Variables**
   (same names and values as your `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. You'll get a URL like `https://reno-tracker.vercel.app`.

(Netlify and Cloudflare Pages work identically — a `_redirects` and
`vercel.json` are included so deep links like `/job/123` load correctly.)

### Add it to a phone's home screen (feels like an app)

- **iPhone (Safari):** open the URL → Share → **Add to Home Screen**.
- **Android (Chrome):** open the URL → ⋮ menu → **Add to Home screen**.

---

## How the app works day-to-day

- **Jobs list** — every active customer, newest-updated first. Search by name,
  address, or key holder. Tap **+ New** to add a job.
- **Job page** — tap a job to:
  - **Update progress** — tap a stage; the bar moves and it's logged.
  - **Change key holder** — tap the 🔑 row, type who has them now; logged as a handover.
  - **Add photos** — opens the camera or gallery.
  - **Post a note** — free-text update for the timeline.
  - **Archive** — when a job is done, archive it (find it again via "View archived jobs").
- Everything you do is stamped with your name and time, and shows up on
  everyone else's screen instantly.

## Customising the renovation stages

The stages (Demolition → Plumbing & Electrical → … → Handover) and their
progress percentages live in one place: [`src/lib/stages.ts`](src/lib/stages.ts).
Edit the list to match your workflow, then redeploy. Add or reorder freely; just
avoid renaming an existing stage's `key` once you have live jobs.

## Cost

Supabase's free tier (database, 50,000 monthly active users, 1 GB file storage)
and Vercel's free tier comfortably cover a 6-person internal tool. No credit
card required to start.
