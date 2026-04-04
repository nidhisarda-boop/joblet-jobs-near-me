# Jobs Near Me — Joblet.ai MVP

ZIP-code-first geospatial job search for Joblet.ai. Enter a US ZIP code, pick a radius (5–100 miles), and see jobs sorted by distance.

## Features
- **ZIP code search** — 5-digit input, instant lookup from 33K US ZIP centroids
- **GPS fallback** — browser geolocation with permission prompt
- **Radius selector** — 5 / 10 / 25 / 50 / 100 mile options
- **Distance badges** — color-coded by proximity (green ≤5mi, yellow ≤15mi, orange >15mi)
- **Remote jobs** — always included, sorted after local results
- **Quick Apply** — one-tap application with toast confirmation

## Tech Stack
- Next.js 15 + TypeScript + Tailwind CSS
- Supabase (PostGIS) for production backend
- Mock data for demo (swap for `supabase.rpc('nearby_jobs')`)

## Production Setup
1. Run `01-supabase-migration.sql` in Supabase SQL Editor
2. Run `node scripts/02-import-zipcodes.mjs` to load 33K ZIP codes
3. Run `node scripts/03-geocode-jobs.mjs` to geocode existing jobs
4. Replace mock data in `page.tsx` with Supabase RPC calls

## Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo)

Built for [Joblet.ai](https://joblet.ai)
