<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Project Amber

This repository contains the source code for **Project Amber**, featuring secure authentication, API key syncing, and an analytics dashboard.

**Live Deployment:** [https://prj-amber.vercel.app](https://prj-amber.vercel.app)

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
