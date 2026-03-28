import { Router } from "express";
import { z } from "zod";
import { getAllListings, getListingCount } from "../db/database.js";
import { recommendListings } from "../services/recommendationAgent.js";
import { refreshListings } from "../services/scraper.js";
import { scoreListings } from "../services/scoring.js";

const searchSchema = z.object({
  postalCode: z.string().length(6),
  subject: z.string().optional(),
  maxMonthlyFee: z.number().positive().optional(),
  weights: z
    .object({
      affordability: z.number().positive().optional(),
      distance: z.number().positive().optional(),
      reviews: z.number().positive().optional(),
      classSize: z.number().positive().optional(),
      relevance: z.number().positive().optional()
    })
    .optional()
});

export const listingsRouter = Router();

listingsRouter.get("/stats", (_request, response) => {
  response.json({
    listings: getListingCount()
  });
});

listingsRouter.post("/search", async (request, response) => {
  const parsed = searchSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: "Invalid search request.",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const { userLocation, weights, scoredListings } = scoreListings(getAllListings(), parsed.data);
    const recommendation = await recommendListings(scoredListings);

    response.json({
      query: {
        ...parsed.data,
        resolvedArea: userLocation.area,
        weights
      },
      recommendation,
      listings: scoredListings.slice(0, 8)
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to score listings."
    });
  }
});

listingsRouter.post("/scrape/refresh", async (_request, response) => {
  try {
    const result = await refreshListings();
    response.json(result);
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Unable to refresh live listings."
    });
  }
});
