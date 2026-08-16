# Acco

Acco is a mobile-first guide to what is popular nearby now and what may be busy later. It combines live community votes with local historical patterns, while showing confidence and evidence rather than presenting forecasts as certainty.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Firebase client and Firebase Admin values.
3. Run `npm run dev`.

The Firebase Admin values are required by the live rankings, reports, and forecast API routes. Keep them server-only and never commit `.env.local`.

## Deploy

Set every variable in `.env.example` that your deployment needs, including a long random `CRON_SECRET`. The two cron routes in `vercel.json` pre-warm the food and nightlife forecast summaries each day; Vercel sends the cron secret in its authorization header. If a current-night summary is missing, the public forecast endpoint safely generates and saves it when the first visitor opens the forecast page.

Deploy the accompanying Firestore rules and indexes before accepting production votes. Public clients only receive aggregated popularity data; raw vote records remain server-side.

## Product scope

The current venue catalogue is curated and covers the listed towns and cities only. A user outside that catalogue sees an honest empty state instead of a fabricated local ranking. Expanding to new areas requires adding verified venues or connecting a suitable venue-data provider.
