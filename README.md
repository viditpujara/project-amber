# Project Amber — Aware

> *"Judgment-free awareness as a vehicle for change."*

**Aware** is a private, personal tobacco habit tracker built on the philosophy that awareness — not pressure — is the first step toward change. It logs every cigarette you smoke, tracks your spending, visualises your patterns over time, and uses Google's Gemini AI to surface meaningful behavioural insights — all tied to your personal Google account with no data shared anywhere.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [Authentication Flow](#authentication-flow)
- [Tab-by-Tab Breakdown](#tab-by-tab-breakdown)
  - [Logs (Dashboard)](#logs-dashboard)
  - [History](#history)
  - [Patterns (AI Insights)](#patterns-ai-insights)
  - [Trends (Stats)](#trends-stats)
  - [Me (Profile)](#me-profile)
- [AI Integration](#ai-integration)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)

---

## What It Does

Aware lets you:

- **Log a cigarette** in under 2 seconds, tagging a reason and optional cost
- **See today's intake** with a live count and daily goal progress bar
- **Review your full history** day by day, with every individual log drill-downable
- **View weekly or monthly trend charts** with navigation back through past periods
- **Generate AI pattern analysis** using your own Gemini API key — insights on peak times, financial impact, mood triggers, and personalised recommendations
- **Track spending** with per-cigarette pricing and cumulative totals

All data is private to your account, synced in real time, and never shared.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS v4 (JIT, custom design tokens) |
| **Routing** | React Router v7 |
| **Animations** | Motion (Framer Motion successor) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Date Logic** | date-fns v4 |
| **Backend / Database** | Supabase (PostgreSQL + Realtime + Auth) |
| **AI** | Google Gemini API via `@google/genai` SDK |
| **Authentication** | Supabase Auth — Google OAuth 2.0 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                     │
│                                                         │
│  AuthProvider (context)                                 │
│  ├── user: Supabase Auth User                           │
│  ├── profile: profiles table row (display_name, key)   │
│  └── refreshProfile(): re-fetches profile from DB       │
│                                                         │
│  Routes (react-router-dom)                              │
│  ├── /           → Dashboard (Logs tab)                 │
│  ├── /history    → History                             │
│  ├── /insights   → Patterns (AI)                       │
│  ├── /stats      → Trends (charts)                     │
│  └── /profile    → Me (settings)                       │
│                                                         │
│  Layout (persistent bottom nav)                         │
└─────────────────┬───────────────────────────────────────┘
                  │ Supabase JS Client
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase (Backend)                    │
│                                                         │
│  PostgreSQL Tables                                      │
│  ├── profiles         (user settings, Gemini API key)  │
│  ├── entries          (individual cigarette logs)       │
│  └── daily_summaries  (pre-aggregated daily totals)     │
│                                                         │
│  Realtime Subscriptions                                 │
│  └── entries + daily_summaries → live Dashboard update  │
│                                                         │
│  Auth                                                   │
│  └── Google OAuth 2.0 → Supabase session tokens        │
└─────────────────────────────────────────────────────────┘
                  │ User's own Gemini API key
                  ▼
┌─────────────────────────────────────────────────────────┐
│           Google Gemini API (generativelanguage)        │
│  Called only on manual user request. Never auto-fired.  │
│  Model: user-selectable (2.5 Flash / Lite / Pro)       │
└─────────────────────────────────────────────────────────┘
```

**Key design principle:** The app has no custom server. Every read/write goes directly from the browser to Supabase over their REST API. The Gemini API is called directly from the browser using the key stored in the user's profile row — this means the user is responsible for their own API quota.

---

## Database Schema

### `profiles`
Automatically created on first login. One row per user.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Matches `auth.users.id` (primary key) |
| `email` | `text` | User's Google email |
| `display_name` | `text` | Full name from Google |
| `photo_url` | `text` | Google profile picture URL |
| `daily_goal` | `int` | Target cigarettes per day (default: 10) |
| `gemini_api_key` | `text` | User's personal Gemini API key (encrypted at rest by Supabase) |
| `onboarding_complete` | `bool` | Reserved for future onboarding flow |

### `entries`
One row per logged cigarette.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Auto-generated primary key |
| `user_id` | `uuid` | FK → `profiles.id` |
| `type` | `text` | Always `'cigarette'` (extensible) |
| `price` | `numeric` | Cost of this cigarette in ₹ |
| `reason` | `text` | Selected reason from preset list |
| `mood` | `text` | Stored as `'neutral'` (reserved for future use) |
| `timestamp` | `timestamptz` | Exact date/time of the log (server default: `now()`) |

### `daily_summaries`
Pre-aggregated daily totals. Updated via upsert on every log/delete. **Never calculated on the fly** — the app writes to this table simultaneously with every entry insert or delete to keep it always in sync.

| Column | Type | Description |
|---|---|---|
| `user_id` | `uuid` | FK → `profiles.id` |
| `date` | `date` | Calendar date (e.g. `2026-05-12`) |
| `count` | `int` | Total cigarettes logged on this date |
| `total_spent` | `numeric` | Sum of all prices on this date |
| `last_updated` | `timestamptz` | Last modification timestamp |

The primary key on `daily_summaries` is `(user_id, date)`, which is also the `onConflict` key used in the upsert. This guarantees there is exactly one row per user per day, updated atomically with every log action.

---

## Authentication Flow

1. **Unauthenticated** — User lands on `/` and sees the Landing page. All other routes redirect to `/`.
2. **Sign In** — Clicking "Begin Session" calls `signInWithGoogle()` which initiates Supabase's Google OAuth flow (redirect-based). The redirect URL is `window.location.origin`.
3. **Callback** — Supabase handles the OAuth callback, sets a session cookie (stored under `localStorage` key `aware_auth_v4`), and fires an `onAuthStateChange` event.
4. **AuthProvider** — The `AuthProvider` component listens to `onAuthStateChange`. On `SIGNED_IN`, it immediately sets the user and removes the loading gate (non-blocking). It then fetches or creates the profile row in the background.
5. **Profile Sync** — `fetchOrCreateProfile()` checks if a `profiles` row exists. If not, it inserts one using data from `user_metadata` (name, photo from Google). If it exists, it silently updates `display_name` and `photo_url` if they changed (e.g. the user updated their Google profile picture).
6. **Authenticated routes** — All five tabs become accessible via the bottom navigation bar. Unauthenticated users are always redirected to `/`.
7. **Sign Out** — Calls `supabase.auth.signOut()`, which clears the session and redirects back to Landing.

---

## Tab-by-Tab Breakdown

### Logs (Dashboard)

**Route:** `/`  
**File:** `src/views/Dashboard.tsx`

The primary screen. Shows today's intake at a glance.

**What it does:**
- Fetches all `entries` for the current calendar day (from midnight `startOfDay` to now) ordered newest-first
- Fetches today's `daily_summaries` row for the count and total spend header card
- Sets up **two Supabase Realtime subscriptions** — one on `entries`, one on `daily_summaries` — both filtered by `user_id`. Any change from any device updates the UI instantly without polling
- Displays a progress bar against `profile.daily_goal` if a goal is set

**Logging a cigarette:**
1. User taps the gold `+` FAB button — a bottom sheet slides up using `AnimatePresence`
2. User picks a **reason** from a searchable custom dropdown (12 preset reasons: Socially, Stress management, Boredom, After meal, etc.)
3. User optionally enters a **price** in ₹ (numeric input, validated to numbers only)
4. User taps "Confirm Cigarette"
5. **Two writes happen in sequence:**
   - `INSERT` into `entries` with `user_id`, `type`, `price`, `reason`, `mood`, `timestamp`
   - `UPSERT` into `daily_summaries` with the updated cumulative `count` and `total_spent`, keyed on `(user_id, date)` — the count is `current + 1`, the spend is `current + price`

**Deleting a log:**
- Each entry in the Today list has a `Trash2` icon, visible on hover (always visible on mobile)
- Delete runs the reverse: `UPSERT` to decrement count/spend, then `DELETE` the entry row
- UI updates optimistically by filtering the entry out of local state while Realtime confirms

---

### History

**Route:** `/history`  
**File:** `src/views/History.tsx`

An accordion-style chronological log of every day you have ever logged a cigarette.

**What it does:**
- On mount, fetches **all rows** from `daily_summaries` for the current user, ordered by date descending (most recent first)
- Renders each day as a collapsed card showing the date, cigarette count, and total spend
- **Lazy-loads individual entries on demand** — clicking a day accordion fires a query to `entries` filtered by that day's local midnight-to-midnight range (using `new Date('YYYY-MM-DDT00:00:00')` for correct local timezone handling)
- Fetched day entries are cached in a `dayEntries` record (keyed by date string), so re-expanding a day doesn't re-fetch
- Each individual entry shows: reason, timestamp (formatted as `h:mm a`), and price

**Why lazy loading?** A user could have hundreds or thousands of individual log entries across months. Loading all entries upfront would be slow. The accordion pattern means only the entries for days you actually inspect get fetched.

---

### Patterns (AI Insights)

**Route:** `/insights`  
**File:** `src/views/Insights.tsx`  
**Service:** `src/services/geminiService.ts`

The AI-powered behavioural analysis screen. Called **"Pattern Cloud"** in the UI.

---

#### Design Philosophy

The core philosophy of this feature is **judgment-free awareness**. The AI prompt is explicitly instructed to:

> *"Provide mindful, judgment-free insights. The goal is awareness of patterns (behavioral and financial) — not quitting pressure."*

This means Gemini is instructed to never suggest quitting, never frame the data as something to be ashamed of, and never produce recommendations that feel like an intervention. Every piece of output — the summary, the trend badge, the interventions — is framed as a mirror, not a verdict.

---

#### What Data Gets Sent to Gemini

The app fetches up to **200 most recent `entries`** (ordered newest-first) within the chosen time window and sends the entire raw row array as a JSON string inside the prompt. Each entry object sent looks like:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "cigarette",
  "price": 12.50,
  "reason": "Stress management",
  "mood": "neutral",
  "timestamp": "2026-05-12T08:14:32.000Z"
}
```

From this, Gemini has access to:
- **Exact timestamps** → used to derive peak time windows, circadian patterns, weekday vs weekend behaviour
- **Reason tags** (free-text from user selection) → used to cluster triggers and identify dominant behavioural drivers
- **Price per cigarette** → used to calculate actual spend and project monthly/annual financial impact
- **Frequency over time** → the array is ordered, so Gemini can compare earlier entries to later ones to determine directional trend

Notably, `mood` is always `"neutral"` in the current version (reserved for a future mood-tagging feature), so Gemini derives emotional context from the `reason` field instead.

---

#### Time Window Context Injection

Before handing the data to Gemini, the app injects a **window-specific analysis directive** into the prompt. This changes how the model frames its analysis depending on how far back the data goes:

| Window | Directive injected into the prompt |
|---|---|
| **7D** | *"Focus on this week's immediate patterns and short-term triggers."* |
| **30D** | *"Look for monthly patterns, weekly rhythms, and financial trends."* |
| **3M** | *"Identify seasonal or multi-month behavioural shifts and financial impact over 3 months."* |
| **All** | *"Look for long-term behavioural trends, milestones, and overall lifestyle patterns."* |

This means a 7-day analysis produces tight, near-term observations ("you smoke most heavily on Tuesday evenings"), while an all-time analysis produces broader arc observations ("your frequency has dropped 30% since March").

---

#### The Six Output Fields — How Each is Derived

Gemini is instructed to produce exactly six structured fields. Here is what logic each field draws on:

**1. `summary` — The Synthesis**  
A single empathetic paragraph synthesising the entire period. Gemini constructs this from the overall shape of the data: total volume, distribution across the week, dominant reasons, and any notable anomalies (like a day with unusually high counts). The prompt asks for it to be warm and non-judgmental in tone.

**2. `trend` — Direction Badge**  
One of three enum values: `improving`, `worsening`, or `stable`.  
Gemini determines this by comparing the *frequency rate in the first half* of the time window to the *frequency rate in the second half*. If the second half shows a clearly lower rate than the first, it returns `improving` (meaning fewer cigarettes over time). If the second half is clearly higher, it returns `worsening`. If there is no clear directional shift, it returns `stable`.  
The UI renders this as a coloured badge: green TrendingDown arrow for improving, red TrendingUp arrow for worsening, grey minus for stable.

**3. `peakTime` — Peak Hours**  
Derived purely from the `timestamp` field of every entry. Gemini clusters the timestamps by hour of day and identifies the window with the highest density. It is asked to be specific — not just "evening" but "9–11 PM on weekdays" or "between 2–4 PM". If there is also a strong weekday vs. weekend pattern, it includes that context.

**4. `moodPattern` — Telemetry Rhythm**  
The contextual and behavioural pattern layer. Gemini looks across both the `reason` field (e.g. "Stress management", "After meal", "Work break") and the time-of-day distribution to detect correlations. Example outputs: "You tend to smoke more frequently during work hours (10am–6pm), with a spike after lunch, suggesting post-meal habituation is a key driver." This is the most open-ended field — Gemini is not constrained to specific values here.

**5. `financialInsight` — Spend Forecast**  
Calculated from the `price` column across all entries in the window. Gemini computes the average daily spend rate and projects it forward to produce a monthly and/or annual figure. Example: "At your current rate of ₹85/day, you are spending approximately ₹2,550/month (₹30,600/year) on cigarettes."

**6. `habits` — Mindful Interventions**  
An array of 2 to 4 personalised recommendations. Each intervention has two sub-fields:
- `tag` — the single dominant trigger being addressed (must be from the fixed taxonomy)
- `recommendation` — the actionable, empathetic suggestion

Gemini must assign exactly one tag per intervention from this fixed list:

| Tag | Colour in UI | What it represents |
|---|---|---|
| `stress` | Red | Smoking as a stress relief mechanism |
| `boredom` | Indigo/Blue | Smoking to fill idle time |
| `social` | Teal | Smoking in social contexts or with others |
| `post-meal` | Amber | Habitual smoking after eating |
| `habit` | Steel blue/grey | Automatic, unconscious smoking with no clear trigger |
| `anxiety` | Purple | Smoking as an anxiety management tool |
| `reward` | Gold | Smoking as a self-reward or treat |

The constraint to this fixed taxonomy is enforced at both the prompt level (*"assign the single most relevant trigger tag from this fixed list only"*) and at the SDK schema level (an `enum` constraint in the response schema). This prevents Gemini from inventing new tags, which would break the colour-coded chip UI.

---

#### How Structured Output is Enforced

Rather than asking Gemini to "return JSON", the app uses the `@google/genai` SDK's `responseSchema` configuration to declare the exact shape of the expected output using JSON Schema-style type definitions:

```typescript
config: {
  responseMimeType: 'application/json',
  responseSchema: {
    type: Type.OBJECT,
    required: ['summary', 'trend', 'moodPattern', 'peakTime', 'financialInsight', 'habits'],
    properties: {
      trend: { type: Type.STRING, enum: ['improving', 'worsening', 'stable'] },
      habits: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ['tag', 'recommendation'],
          properties: {
            tag: { type: Type.STRING, enum: ['stress', 'boredom', 'social', 'post-meal', 'habit', 'anxiety', 'reward'] },
            recommendation: { type: Type.STRING },
          },
        },
      },
      // ... all other fields as Type.STRING
    },
  },
}
```

This instructs Gemini at the model level (not just the prompt level) to output a valid JSON object matching this schema. The effect:
- **No hallucinated formatting** — Gemini cannot wrap the response in markdown code fences or extra prose
- **No enum violations** — `trend` can only ever be one of the three allowed values; `tag` can only ever be one of the seven allowed tags
- **No missing fields** — all six `required` fields must be present or Gemini will retry internally
- **Reliable parsing** — the app simply does `JSON.parse(response.text.trim())` with no defensive stripping needed

---

#### UI Rendering Logic

Once the `InsightsResponse` object is returned:

- **The Synthesis card** renders `summary` in a large serif italic typeface, with the `trend` badge (`TrendBadge` component) in the top-right corner. The badge uses the `TREND_CONFIG` map to select the correct icon and colour.
- **Peak Hours + Spend Forecast** render side-by-side in a 2-column grid as smaller cards
- **Telemetry Rhythm** renders `moodPattern` as a full-width prose card
- **Mindful Interventions** renders each `habits` item as a card, with the `tag` rendered as a `TagChip` (coloured pill from `TAG_STYLES`) and the `recommendation` as serif italic text

All cards animate in sequentially using `motion.div` with staggered `delay` values (0ms, 80ms, 120ms, 160ms, 220ms+) to create a cascade reveal effect.

---

#### Smart Refresh Behaviour

- **On mount:** Nothing fires. The user sees an empty state with a "Generate Insights" button.
- **Switching time window** while insights are showing: automatically re-generates with the new window.
- **Switching model** while insights are showing: automatically re-generates with the new model.
- **Switching time window or model with no existing insights:** just updates the selector state, does not trigger a call.
- **The ✦ sparkle button** in the header always re-generates regardless of state.

---

#### API Key Freshness Strategy

A subtle but critical implementation detail: the Gemini API key is **never read from React context** inside `fetchInsights`. Instead, every call does a fresh Supabase `SELECT gemini_api_key FROM profiles WHERE id = user.id` milliseconds before calling the API. This solves a React closure problem where the `profile` state captured when the component first rendered could hold a stale API key even after the user saved a new one in the Profile tab — without a page reload, the context would remain outdated. The fresh DB read guarantees the call always uses whatever key is currently in the database.

---

**Error handling:**
- `429 RESOURCE_EXHAUSTED` — Regex-parsed from the error JSON to extract the exact retry wait in seconds. Shown as a human-readable message explaining that quotas are project-level (not per-key). A debug badge showing the last 4 characters of the API key that was sent helps confirm which key actually fired.
- `404 NOT_FOUND` — The requested model ID does not exist or has been deprecated for new projects.
- Missing API key — Clear prompt to visit Profile tab.
- Supabase fetch error — The entries query itself failed; thrown and caught the same way.

---

### Trends (Stats)

**Route:** `/stats`  
**File:** `src/views/Stats.tsx`

A time-series chart view with weekly and monthly modes and historical navigation.

**What it does:**
- User can toggle between **Weekly** (Mon–Sun) and **Monthly** (full calendar month) views
- Navigation arrows allow browsing back (and forward, up to the current period) through past weeks/months
- Fetches `daily_summaries` rows within the current period's date range from Supabase
- All date math is handled by `date-fns`: `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `addWeeks`, `addMonths`, `eachDayOfInterval`, `eachWeekOfInterval`

**Chart data building:**
- **Weekly mode** (`buildWeeklyData`): Maps each of the 7 days (Mon–Sun) of the anchor week to a bar. Days with no entries get a count of 0. Today's bar is highlighted in full gold (`#D4AF37`); past days with logs use a dimmed gold (`rgba(212,175,55,0.3)`); empty days use near-transparent white.
- **Monthly mode** (`buildMonthlyData`): Groups days into week buckets (W1, W2, W3, W4, W5), clamped to the month's boundaries. Each bar represents the sum of all cigarettes in that week-of-month.

**Summary cards below the chart:**
- Period total (count and spend)
- Daily average (total ÷ number of days in period)
- Consistency (active days ÷ total days in period)

The forward navigation button is disabled when you are already on the current period, preventing navigation into the future.

---

### Me (Profile)

**Route:** `/profile`  
**File:** `src/views/Profile.tsx`

Account settings and API key configuration.

**What it does:**
- Displays the user's Google profile picture, display name, and email (read from `AuthProvider` context)
- Provides a **password-masked input** for the user's Gemini API key
- On "Save": updates the `gemini_api_key` column in the `profiles` table with `.select('gemini_api_key').single()` to confirm the write succeeded, then calls `refreshProfile()` to update the context
- The "Terminate Session" button calls `supabase.auth.signOut()` and returns the user to the Landing page

**API key security note:** The key is stored in the `profiles` table in Supabase, which is protected by Row Level Security (RLS) — only the authenticated user can read or modify their own row. The key is transmitted only over HTTPS and is never logged or exposed in analytics.

---

## AI Integration

**File:** `src/services/geminiService.ts`

The entire Gemini integration is a single exported async function:

```typescript
getHabitInsights(
  data: Entry[],        // up to 200 log entries, full row objects including timestamp, reason, price
  apiKey: string,       // user's Gemini API key — always freshly fetched from Supabase, never from React state
  windowLabel: string,  // '7D' | '30D' | '3M' | 'all' — controls both data cutoff and prompt framing
  model: string,        // e.g. 'gemini-2.5-flash' — user-selectable at call time
): Promise<InsightsResponse>
```

The function:
1. Validates the API key is present (throws before making any network call if not)
2. Instantiates `GoogleGenAI` with the user's key
3. Builds the prompt string, injecting the serialised entry data and the window-specific analysis directive
4. Calls `ai.models.generateContent()` with `responseMimeType: 'application/json'` and the full `responseSchema`
5. Parses and returns `JSON.parse(response.text.trim())` as `InsightsResponse`

**Available models** (all free-tier eligible once billing is verified in Google Cloud):

| Model ID | Label | Best for |
|---|---|---|
| `gemini-2.5-flash` | 2.5 Flash | Balanced analysis, default choice |
| `gemini-2.5-flash-lite` | 2.5 Flash Lite | Fastest response, lowest token cost, lighter analysis |
| `gemini-2.5-pro` | 2.5 Pro | Most thorough analysis, best for "All Time" window with many entries |

**Important note on Gemini free tier:** Google's free tier quotas are enforced at the **Google Cloud Project** level, not per API key. Generating a new API key within the same project does not reset quotas. If you see a `limit: 0` error immediately on first use, you must link a billing account at [console.cloud.google.com](https://console.cloud.google.com) — you will not be charged as long as you stay under 1,500 requests/day.

| `gemini-2.5-pro` | 2.5 Pro | Most thorough analysis |

**Important note on Gemini free tier:** Google's free tier quotas are enforced at the **Google Cloud Project** level, not per API key. Generating a new API key within the same project does not reset quotas. If you see a `limit: 0` error, you must link a billing account to your Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com) — you will not be charged as long as you stay under 1,500 requests per day.

---

## Environment Setup

Create a `.env` file in the project root (use `.env.example` as a template):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The Gemini API key is **not** an environment variable — it is stored per-user in the Supabase `profiles` table and configured inside the app via the Profile tab. This means each user brings their own key, and the app never holds a shared key.

**Supabase setup requirements:**
1. Create a Supabase project
2. Enable **Google OAuth** under Authentication → Providers
3. Create the three tables (`profiles`, `entries`, `daily_summaries`) with the schema described above
4. Enable **Row Level Security** on all tables with policies that restrict access to `auth.uid() = user_id`
5. Add your app's URL to the **Redirect URLs** allowlist under Authentication → URL Configuration

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Type-check without building
npm run lint
```

The dev server binds to `0.0.0.0:3000` so it is accessible on your local network (useful for testing on a phone).

---

*Ember v1.0.4 — Built with intentionality. Data stays yours.*
