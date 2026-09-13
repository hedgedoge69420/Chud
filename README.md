# SiteSafe

SiteSafe is a deployable Next.js application for preliminary climate-exposure and adaptation screening before buying or building on Victorian land. It separates mapped evidence, ERA5-Land reanalysis, climate-model simulations, user-entered financial assumptions and deterministic recommendations.

> SiteSafe does not predict disasters and is not an engineering assessment, insurance quotation, property valuation or legal opinion.

## What works

- Official Vicmap Address candidate search, with explicit selection when several candidates match.
- Point intersection against the verified Vicmap Planning Bushfire Prone Areas layer 9.
- Historical Open-Meteo ERA5-Land heat indicators over the latest 20 complete calendar years.
- Seven supported Open-Meteo climate models, each compared against its own 1981–2010 baseline for 2021–2050.
- Typed partial-report behavior when an independent upstream source fails.
- Transparent illustrative damage/interruption scenarios and an editable action planner.
- Two-property saved comparison and a complete saved demo that makes no network requests.
- Print-friendly browser report.
- Responsive two-column report dashboard with dark mode, KPI summaries, projection range indicators, and an interactive ERA5-Land area chart.
- Five-minute SWR caching for address and report requests, with fixed-size loading skeletons to prevent layout shift.
- Device-local project saving and instant client-side impact scenario calculations with no server roundtrips.
- Debounced address autocomplete with abbreviation/unit normalization, a Vicmap-first lookup, and a Victoria-bounded OpenStreetMap Nominatim fallback. Nominatim results retain attribution and are cached to respect its public usage policy.
- An embedded SiteSafe AI Copilot with streamed Markdown answers, report-aware quick prompts, interactive Recharts widgets, and exact financial scenario tool calls.

Flood evidence remains visibly **not assessed** because this build did not verify a single consistent, legally usable parcel-level source for all Victorian locations. The product and its deterministic copilot fallback require no secrets.

## Architecture

Next.js App Router pages live in `app/`. External calls are confined to route handlers and server-only adapters in `lib/`. Zod validates requests, provider responses and domain objects. Pure heat, ensemble, financial and recommendation logic stays separate from network adapters. `data/adaptation-catalogue.ts` contains version-controlled prototype cost assumptions.

Live requests use an eight-second timeout, one safe retry, explicit result/field limits and `cache: no-store`. Climate output sent to the browser contains annual summaries and aggregates rather than daily arrays.

## Local setup

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No environment variables are required. The copilot streams a constrained local fallback and still renders financial and chart widgets without an API key.

To enable live assistant wording, copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. You may override the default model with `OPENAI_MODEL`. Keep values out of Git; the key is read only by the Edge route.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Automated tests use fixtures and make no live API calls. CI runs the same four quality gates without optional secrets.

## Data sources and attribution

- [Vicmap Address FeatureServer](https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/arcgis/rest/services/Vicmap_Address/FeatureServer/0)
- [Vicmap Planning — Bushfire Prone Areas, layer 9](https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Planning/FeatureServer/9)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api), ERA5-Land reanalysis
- [Open-Meteo Climate API](https://open-meteo.com/en/docs/climate-api), downscaled CMIP6 HighResMIP data licensed under CC BY 4.0. Attribute the CMIP6 program, model producers and Open-Meteo when publishing derived results.

Provider schemas and availability can change. Every report retains the provider, URL, retrieval time, period, unit, model, grid information and calculation method where applicable. Missing data stays unavailable; it never becomes a zero or a low-risk result.

## Saved demonstration data

`lib/demo-data.ts` contains conspicuously labelled illustrative records saved as of 30 June 2026. Values are shaped to exercise the product journey and are not presented as current facts. The demo and comparison pages do not call external services.

## Copilot data boundary

Each copilot request includes the selected address, validated ERA5-Land and CMIP6 summaries, Vicmap status, source status, approved adaptation catalogue entries, and current financial assumptions. Financial arithmetic runs in a deterministic server tool. Chart tools can only render validated report data or approved catalogue costs. Missing evidence remains not assessed.

## Deploy to Vercel

Push this directory to a GitHub repository chosen by its owner, import it in Vercel as a Next.js project, keep the default build command (`npm run build`), and deploy. Do not select static export because the application uses server route handlers. Configure `OPENAI_API_KEY` in Vercel project settings to enable live copilot wording; without it, the evidence-safe fallback remains available.

## Screenshots

Add verified desktop and mobile screenshots here after deployment.
