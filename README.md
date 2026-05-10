<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Project Amber

**Project Amber** — also known as *Aware* — is a personal smoking awareness and habit-tracking application built on a single, powerful belief:

> *"Judgment-free awareness as a vehicle for change."*

Most habit-breaking apps guilt you into quitting. **Aware** doesn't. Instead of warnings and countdown timers, it gives you a mirror — a calm, precise, real-time view of your own behavior. The insight is yours to act on.

---

## The Problem

Millions of people want to reduce or quit smoking, but the tools available either shame users into compliance or drown them in generic medical advice. The result? Resistance, abandonment, and relapse.

Aware takes a radically different approach: **no judgment, just data**. By logging each cigarette with the *reason* behind it, users begin to see the emotional and situational triggers that drive the habit — stress, boredom, social pressure, morning routines. That awareness itself becomes the catalyst for change.

---

## What It Does

### 🚬 Real-Time Session Logging
Log each cigarette in seconds. Select a reason from a curated list — *Stress management, Social, Anxiety, After meal, Driving* — or search for your own. Optionally track the cost. Every entry is timestamped and stored live.

### 📊 Daily Dashboard
See today's count at a glance, including a progress bar against your personal daily allowance goal. Your session history updates in real-time via Supabase live subscriptions.

### 📅 Full History
Browse your complete smoking history, organized by day. Expand any date to see every individual log with its reason, time, and expense.

### 📈 Trend Analysis (Stats)
A 7-day bar chart visualizes your weekly volume, so you can see patterns over time. Key statistics — weekly average, total weekly spend, and consistency streak — surface at a glance.

### 🤖 AI-Powered Pattern Insights (Gemini)
The Insights tab connects directly to the **Google Gemini AI** using your personal API key. It analyzes your last 7 days of entries and returns:
- **A synthesis** — a high-level narrative of your behavior patterns.
- **Telemetry rhythm** — a breakdown of how your mood and timing correlate with smoking.
- **Mindful interventions** — personalized, trigger-specific recommendations to interrupt the habit loop.

### 👤 Secure User Profiles
Users sign in with Google via Supabase Auth. Each profile stores a personal daily goal and a private Gemini API key — securely synced to the database, not exposed in the client bundle.

---

## Who It's For

Aware is for people who are **curious about their own behavior** — those who want to understand their habit before trying to change it. It is not a quitting app. It is an awareness app, and awareness is where all change begins.

---

**Live Deployment:** [https://prj-amber.vercel.app](https://prj-amber.vercel.app)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, Framer Motion |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (Google OAuth) |
| AI | Google Gemini API (`@google/genai`) |
| Charts | Recharts |
| Deployment | Vercel |

## Features

- **Supabase Authentication**: Secure session management and non-blocking profile synchronization.
- **Gemini AI Integration**: Securely synchronizes user-specific Gemini API keys via the Supabase database.
- **Dashboard Analytics**: Core UI layouts for displaying data.
- **Modern UI/UX**: Custom SVG favicon and responsive core layouts.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your environment variables in `.env`:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key.
3. Run the app:
   ```bash
   npm run dev
   ```
