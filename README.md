# KiaSkool

Kiaskool scouts the right tuition centre before parents start stress-scrolling.

- `Vite + React + TypeScript` for the frontend
- `Express + TypeScript` for the API
- `bun:sqlite` for local persistence
- `@openai/agents` for recommendation summaries
- `AgentQL` by TinyFish for optional live scraping workflows

## Structure

```text
apps/
  api/   Express API, SQLite setup, scoring, scraper and recommendation services
  web/   React app for postal-code search and value comparison
```

## Quick start

```bash
bun install
cp .env.example .env
bun run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:8787`.

## Environment

Only `OPENAI_API_KEY` is needed for AI-generated recommendations. `AGENTQL_API_KEY` and Playwright are only required if you want to attempt live scraping instead of using the seeded fallback dataset.

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
AGENTQL_API_KEY=
PORT=8787
ENABLE_LIVE_SCRAPE=false
```

## What works now

- Search nearby tuition centres by Singapore postal code
- Rank centres with a weighted score across affordability, distance, reviews, class size, and subject relevance
- Persist listings in a local SQLite database file
- Generate recommendation summaries with OpenAI Agents SDK when an API key is configured
- Refresh data with a scraper pipeline that falls back to seeded listings until live scraping credentials are enabled

## Live scraping notes

The scraper service is wired for `AgentQL + Playwright`, but it intentionally falls back to local sample data unless:

1. `ENABLE_LIVE_SCRAPE=true`
2. `AGENTQL_API_KEY` is set
3. Playwright browser dependencies are installed with `bunx playwright install chromium`

That keeps the hackathon repo runnable on first install while leaving a clean path to add real KiasuParents and Google Maps ingestion.
