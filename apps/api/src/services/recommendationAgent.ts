import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { config } from "../config.js";
import type { RecommendationResult, ScoredListing } from "../types/domain.js";

const recommendationOutput = z.object({
  headline: z.string().trim().min(1).max(80),
  subheadline: z.string().trim().min(1).max(110),
  whyThisFits: z.string().trim().min(1).max(70),
  proofPoints: z.array(z.string().trim().min(1).max(90)).min(2).max(3),
  backupOption: z.string().trim().min(1).max(100),
  primaryActionNote: z.string().trim().min(1).max(90)
});

const recommendationAgent = new Agent({
  name: "Tuition Value Recommender",
  model: config.openAiModel,
  instructions:
    [
      "You help stressed parents in Singapore choose tuition centres fast.",
      "Pick one clear winner only.",
      "Use plain, direct language with short sentences.",
      "Do not hedge, ramble, or write analyst-style comparisons.",
      "Focus only on the deciding factors: price, distance, subject fit, and reviews.",
      "Do not repeat details that are already obvious from the listing card unless they are the deciding reason.",
      "Always include one short backup option in one line.",
      "Write for scanability. Parents should understand the answer in under 5 seconds."
    ].join(" "),
  outputType: recommendationOutput
});

function buildFallbackRecommendation(
  listings: ScoredListing[]
): RecommendationResult {
  const [first, second] = listings;

  if (!first) {
    return {
      headline: "No clear match yet",
      subheadline: "Nothing matched this search closely enough.",
      whyThisFits: "Needs a broader search",
      proofPoints: [
        "Try a nearby postal code.",
        "Raise the budget cap a little.",
        "Refresh listings to pull in more centres."
      ],
      backupOption: "Backup: widen the search before deciding.",
      primaryActionNote: "Broaden the filters and scout again.",
      generatedByAI: false,
      model: "heuristic-fallback"
    };
  }

  const reasonParts = [
    first.monthlyFee <= 240 ? "lower fee" : null,
    first.distanceKm <= 3 ? "short commute" : null,
    first.rating >= 4.6 ? "strong reviews" : null,
    first.classSize <= 6 ? "small classes" : null
  ].filter(Boolean);

  const proofPoints = [
    `Best current value score in this shortlist.`,
    `${first.area} option with ${first.rating}/5 reviews.`,
    first.classSize <= 7
      ? `Smaller class size helps if your child needs more attention.`
      : `Monthly fee stays reasonable for this area.`
  ].slice(0, 3);

  return {
    headline: `Best pick: ${first.name}`,
    subheadline: `Strong overall value for parents who want ${reasonParts.slice(0, 2).join(" and ") || "a practical nearby option"}.`,
    whyThisFits: "Good fit for a fast, low-stress shortlist",
    proofPoints,
    backupOption: second
      ? `Backup: ${second.name} if you want a different price-distance balance.`
      : "Backup: refresh listings if you want more nearby options.",
    primaryActionNote: `Start with ${first.name}, then compare one backup only.`,
    generatedByAI: false,
    model: "heuristic-fallback"
  };
}

export async function recommendListings(
  listings: ScoredListing[]
): Promise<RecommendationResult> {
  if (!config.openAiApiKey || listings.length === 0) {
    return buildFallbackRecommendation(listings);
  }

  try {
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
      affordabilityScore: listing.scoreBreakdown.affordability,
      reviewScore: listing.scoreBreakdown.reviews,
      relevanceScore: listing.scoreBreakdown.relevance
    }));

    const result = await run(
      recommendationAgent,
      [
        "Choose the best tuition option from this shortlist.",
        "Return one winner, one short reason, 2-3 short proof points, one backup, and one next-step line.",
        "Keep every field brief and easy for stressed parents to scan.",
        JSON.stringify(shortlist, null, 2)
      ].join("\n")
    );

    const output = result.finalOutput;

    if (!output) {
      return buildFallbackRecommendation(listings);
    }

    return {
      headline: output.headline,
      subheadline: output.subheadline,
      whyThisFits: output.whyThisFits,
      proofPoints: output.proofPoints,
      backupOption: output.backupOption,
      primaryActionNote: output.primaryActionNote,
      generatedByAI: true,
      model: config.openAiModel
    };
  } catch (error) {
    console.error("Recommendation agent failed:", error);
    return buildFallbackRecommendation(listings);
  }
}
