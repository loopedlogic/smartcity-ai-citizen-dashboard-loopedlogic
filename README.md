# SmartCity AI Citizen Dashboard

Single-page dashboard with Netlify Functions as a backend-for-frontend. The browser loads live data through `/.netlify/functions/*` (or falls back to the public APIs when you open the site without Netlify, e.g. plain `file://` or a static server).

## What was wrong (fixed)

1. **Broken JavaScript in `index.html`** — Several lines used invalid escaped template literals (`\`...\`` and `\${...}`), so the script could not parse and none of the cards or refresh handlers worked reliably.
2. **Weather edge case** — Open-Meteo can return HTTP 200 with `{ "error": true, "reason": "..." }` (e.g. rate limits). The code treated that as success and then failed on missing `current_weather`; this is now detected and surfaced as a clear error.
3. **Globals vs assignment** — `weatherData`, `currencyData`, `citizenData`, and `factData` now hold the **full JSON** returned from each proxy (spread from the real APIs plus labels like `source` / `providerLabel` / `computed` where applicable), so the chatbot context matches the dashboard.
4. **Chat keys** — Configure **`HF_TOKEN`** and/or **`OPENROUTER_API_KEY`** in Netlify (never commit tokens). If both are set, **Hugging Face is used first**. Optional: **`OPENROUTER_MODEL`** (default `openai/gpt-4o-mini`).

## Run locally

From this folder:

```bash
npm run dev
```

The dev script runs Netlify Dev with **`publish` and `functions` pinned to this directory** (needed if a parent folder is also a Git repo, so Netlify does not treat your home directory as the site root).

This project has its **own `.git`** in this folder for that reason.

This runs `npx netlify-cli@17 dev`, serves `index.html`, and wires `/.netlify/functions/*` to the files under `netlify/functions/`.

Set secrets for chat in a `.env` file in the project root (Netlify Dev loads it):

```bash
# Pick one or both (Hugging Face is used first when both are set)
HF_TOKEN=your_huggingface_token
OPENROUTER_API_KEY=your_openrouter_key
# optional:
# OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Deploy on Netlify

1. Push this folder to a Git repository (or drag-and-drop the folder in the Netlify UI).
2. **Build command:** leave empty or use `npm run build` (no-op).
3. **Publish directory:** `.` (repository root).
4. Netlify reads **`netlify.toml`**: `publish = "."`, `functions = "netlify/functions"`, **Node 20**.
5. In **Site configuration → Environment variables**, add **`HF_TOKEN`** and/or **`OPENROUTER_API_KEY`**.
6. Deploy and open the live URL. Test all four refresh buttons and the chatbot.

## API sources (assignment)

| Card    | URL |
|--------|-----|
| Weather | `https://api.open-meteo.com/v1/forecast?latitude=18.52&longitude=73.86&current_weather=true` |
| Currency | `https://open.er-api.com/v6/latest/USD` |
| Citizen | `https://randomuser.me/api/` |
| Fact | `https://uselessfacts.jsph.pl/api/v2/facts/random?language=en` |

If Open-Meteo responds with a rate-limit message, wait and retry or deploy (egress IP changes).

## Project layout

- `index.html` — UI, globals, refresh handlers, optional direct API fallback when functions are not available.
- `netlify/functions/weather.js` — Open-Meteo proxy + structured fallback when `current_weather` is missing.
- `netlify/functions/currency.js` — ER-API proxy; INR → USD/EUR/GBP in `computed`.
- `netlify/functions/citizen.js` — RandomUser proxy; JSONPlaceholder only if RandomUser fails.
- `netlify/functions/fact.js` — UselessFacts proxy; AdviceSlip only if the primary fails.
- `netlify/functions/chat.js` — LLM call; strict dashboard-only instructions; token server-side only.
