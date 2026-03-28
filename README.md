# KiaSkool
<img width="974" height="686" alt="image" src="https://github.com/user-attachments/assets/a6194603-df86-44b1-9bb9-743e801bcfbe" />

Kiaskool scouts the right preschool before parents start stress-scrolling.

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

`DATA_GOV_API_KEY` is recommended for higher ECDA/data.gov.sg limits. `ECDA_PROTOTYPE_LIMIT=100` keeps base ingestion small for prototype runs. `ENABLE_SCOUT_ENRICHMENT=false` keeps TinyFish out of the main search path by default. `SCOUT_ENRICHMENT_LIMIT=5` only applies if scout enrichment is explicitly enabled. `OPENAI_API_KEY` is needed for scout queries. `TINYFISH_API_KEY` is required for live enrichment scraping.

```bash
DATA_GOV_API_KEY=
ECDA_PROTOTYPE_LIMIT=100
ENABLE_SCOUT_ENRICHMENT=false
SCOUT_ENRICHMENT_LIMIT=5
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
AGENTQL_API_KEY=
TINYFISH_API_KEY=
PORT=8787
ENABLE_LIVE_SCRAPE=false
```

## What works now

- Search Singapore preschools from a local ECDA-backed cache
- Rank centres with a weighted score across affordability, distance, reviews, class size, and subject relevance
- Persist listings in a local SQLite database file
- Generate recommendation summaries with OpenAI Agents SDK when an API key is configured
- Refresh data with a live TinyFish scraper pipeline against LifeSG preschool search

## Live scraping notes

The scraper service is now live-data only and currently targets LifeSG preschool search:

1. `ENABLE_LIVE_SCRAPE=true`
2. `TINYFISH_API_KEY` is set

If TinyFish returns no data, the refresh endpoint fails and no mock listings are loaded.
