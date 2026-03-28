import { Router } from "express";
import { z } from "zod";
import { enrichTopMatch, scout } from "../agent/scoutAgent.js";
import { fetchAndStoreEcdaData } from "../data/ecdaFetcher.js";
import { getBaseSchools, getCachedSchools, getSchoolCount } from "../data/schoolStore.js";
import { enrichSchools, type EnrichmentStreamEvent } from "../scraper/tinyfishScraper.js";

const scoutSchema = z.object({
  query: z.string().trim().min(1)
});

export const listingsRouter = Router();

listingsRouter.get("/stats", (_request, response) => {
  response.json({
    listings: getSchoolCount()
  });
});

listingsRouter.post("/scout", async (request, response) => {
  const parsed = scoutSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: "Invalid scout request.",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    console.log("[API] /api/scout request received.");
    if (getSchoolCount() === 0) {
      response.status(409).json({
        error: "No cached schools yet. Refresh base data first."
      });
      return;
    }

    const result = await scout(parsed.data.query);
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to scout schools."
    });
  }
});

listingsRouter.post("/scout/enrich-top", async (request, response) => {
  const parsed = scoutSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: "Invalid enrich-top request.",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    console.log("[API] /api/scout/enrich-top request received.");
    if (getSchoolCount() === 0) {
      response.status(409).json({
        error: "No cached schools yet. Refresh base data first."
      });
      return;
    }

    const result = await enrichTopMatch(parsed.data.query);
    response.json({
      message: "Top match enriched and recommendations refreshed.",
      result
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to enrich top match."
    });
  }
});

listingsRouter.post("/refresh/base", async (_request, response) => {
  try {
    console.log("[API] /api/refresh/base started.");
    await fetchAndStoreEcdaData();
    console.log("[API] /api/refresh/base completed.", {
      schools: getSchoolCount()
    });
    response.json({
      message: "ECDA base data refreshed.",
      schools: getSchoolCount()
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unable to refresh base data."
    });
  }
});

listingsRouter.post("/refresh/enrichment", async (_request, response) => {
  try {
    console.log("[API] /api/refresh/enrichment started.");
    await enrichSchools(getBaseSchools());
    console.log("[API] /api/refresh/enrichment completed.");
    response.json({
      message: "Enrichment refresh completed."
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unable to refresh enrichment data."
    });
  }
});

listingsRouter.get("/refresh/enrichment/live", async (_request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();

  const send = (eventName: string, payload: object) => {
    response.write(`event: ${eventName}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    console.log("[API] /api/refresh/enrichment/live started.");
    const baseSchools = getBaseSchools();

    if (baseSchools.length === 0) {
      send("failed", {
        message: "Refresh base data first before enrichment."
      });
      response.end();
      return;
    }

    await enrichSchools(baseSchools, (event: EnrichmentStreamEvent) => {
      console.log(`[TINYFISH] ${event.type}: ${event.message}`);
      send(event.type, event);
    });
    console.log("[API] /api/refresh/enrichment/live completed.");
    response.end();
  } catch (error) {
    send("failed", {
      message:
        error instanceof Error ? error.message : "Unable to refresh enrichment data."
    });
    response.end();
  }
});

listingsRouter.get("/schools", (_request, response) => {
  response.json({
    schools: getCachedSchools()
  });
});
