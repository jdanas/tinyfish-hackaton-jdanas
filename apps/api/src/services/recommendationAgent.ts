import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { config } from "../config.js";
import type { RecommendationResult, ScoredListing } from "../types/domain.js";

const recommendationOutput = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).max(4),
});
const recommendationAgent = new Agent({
  name: "Tuition Value Recommender",
  model: config.geminiModel,
  instructions:
    "You help parents in Singapore compare tuition centres. Prioritize value for money, commute convenience, subject fit, and review quality. Keep recommendations concrete and practical.",
  outputType: recommendationOutput,
});

function buildFallbackRecommendation(
  listings: ScoredListing[],
): RecommendationResult {
  const [first, second] = listings;

  if (!first) {
    return {
      summary: "No listings matched the current filters yet.",
      highlights: ["Try a nearby postal code or remove the budget cap."],
      generatedByAI: false,
      model: "heuristic-fallback",
    };
  }

  const tradeoff = second
    ? `${second.name} is the backup pick if you want a different balance of price and travel time.`
    : "The current shortlist is narrow, so refreshing the scraper may surface more nearby centres.";

  return {
    summary: `${first.name} currently leads on overall value with a score of ${first.valueScore}, about ${first.distanceKm} km away at S$${first.monthlyFee}/month.`,
    highlights: [
      `${first.name} has the strongest combined affordability and commute profile in this shortlist.`,
      `It is rated ${first.rating}/5 from ${first.reviewCount} reviews with a class size of ${first.classSize}.`,
      tradeoff,
    ],
    generatedByAI: false,
    model: "heuristic-fallback",
  };
}

export async function recommendListings(
  listings: ScoredListing[],
): Promise<RecommendationResult> {
  if (!config.geminiApiKey || listings.length === 0) {
    return buildFallbackRecommendation(listings);
  }

  try {
    // Configure environment variables for OpenAI SDK to use Gemini
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalBaseUrl = process.env.OPENAI_BASE_URL;
    
    process.env.OPENAI_API_KEY = config.geminiApiKey;
    process.env.OPENAI_BASE_URL = config.geminiBaseUrl;
    // Disable tracing to avoid authentication errors
    process.env.OPENAI_TRACING_ENABLED = "false";

    const shortlist = listings.slice(0, 5).map((listing) => ({
      name: listing.name,
      area: listing.area,
      monthlyFee: listing.monthlyFee,
      distanceKm: listing.distanceKm,
      rating: listing.rating,
      reviewCount: listing.reviewCount,
      classSize: listing.classSize,
      subjects: listing.subjects,
      valueScore: listing.valueScore,
      parentBlurb: listing.parentBlurb,
    }));

    const result = await run(
      recommendationAgent,
      `Recommend the best tuition option from this shortlist and mention one realistic fallback.\n${JSON.stringify(
        shortlist,
        null,
        2,
      )}`,
    );

    // Restore original environment variables
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalBaseUrl) process.env.OPENAI_BASE_URL = originalBaseUrl;
    else delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_TRACING_ENABLED;

    const output = result.finalOutput;

    if (!output) {
      return buildFallbackRecommendation(listings);
    }

    return {
      summary: output.summary,
      highlights: output.highlights,
      generatedByAI: true,
      model: config.geminiModel,
    };
  } catch (error) {
    console.error("Recommendation agent failed:", error);
    return buildFallbackRecommendation(listings);
  }
}
