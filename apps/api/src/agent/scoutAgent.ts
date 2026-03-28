/**
 * Cache-only scout layer. Uses OpenAI Agents to extract school search intent and summarize recommendations.
 */
import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { config } from "../config.js";
import { querySchools } from "../data/schoolStore.js";
import { enrichSchools, normalizeWebsiteUrl } from "../scraper/tinyfishScraper.js";
import type { BaseSchool } from "../types/school.js";
import type { SchoolFilters, ScoutRecommendation, ScoutResult } from "../types/school.js";

const filtersSchema = z.object({
  locationPreference: z.string().trim().min(1).max(80).optional(),
  programmeLevel: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
  curriculumStyle: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
  language: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
  enrichment: z.array(z.string().trim().min(1).max(40)).max(5).optional()
});

const recommendationsSchema = z.object({
  recommendations: z.array(
    z.object({
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().min(1).max(180),
      reason: z.string().trim().min(1).max(140),
      highlights: z.array(z.string().trim().min(1).max(90)).min(2).max(3)
    })
  ).max(3)
});

type RecommendationDraft = z.infer<typeof recommendationsSchema>["recommendations"][number];

const filtersAgent = new Agent({
  name: "Kiaskool Scout Filters",
  model: config.openAiModel,
  instructions:
    "Extract preschool search intent for Singapore parents. Return only structured filter fields. Do not browse or invent facts.",
  outputType: filtersSchema
});

const recommendationsAgent = new Agent({
  name: "Kiaskool Recommendations",
  model: config.openAiModel,
  instructions:
    "You recommend Singapore preschools. Use direct, parent-friendly language. Return up to 3 recommendations only. Keep reasons short and practical.",
  outputType: recommendationsSchema
});

function cleanFilters(filters: SchoolFilters): SchoolFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return Boolean(value);
    })
  ) as SchoolFilters;
}

function logScout(message: string, details?: object) {
  if (details) {
    console.log(`[SCOUT] ${message}`, details);
    return;
  }

  console.log(`[SCOUT] ${message}`);
}

function toBaseSchool(school: ReturnType<typeof querySchools>[number]): BaseSchool {
  return {
    centreCode: school.centreCode,
    name: school.name,
    address: school.address,
    postalCode: school.postalCode,
    latitude: school.latitude,
    longitude: school.longitude,
    operator: school.operator,
    serviceModel: school.serviceModel,
    programmeLevels: school.programmeLevels,
    vacancyStatus: school.vacancyStatus,
    contactNumber: school.contactNumber,
    email: school.email,
    websiteUrl: school.websiteUrl,
    languagesOffered: school.languagesOffered,
    monthlyFee: school.monthlyFee
  };
}

async function resolveFilters(query: string): Promise<SchoolFilters> {
  try {
    logScout("Running OpenAI filters agent.");
    const parsedFiltersResult = await run(filtersAgent, query);
    return cleanFilters(parsedFiltersResult.finalOutput ?? {});
  } catch (error) {
    console.warn("[SCOUT] Filters agent failed. Falling back to broad cache query.", error);
    return {};
  }
}

function fallbackRecommendations(matches: ReturnType<typeof querySchools>): ScoutRecommendation[] {
  return matches.slice(0, 3).map((school) => ({
    name: school.name,
    address: school.address,
    reason: school.curriculumStyle
      ? `${school.curriculumStyle} approach with relevant programme fit.`
      : "Strong match for the requested school profile.",
    highlights: [
      school.programmeLevels.length > 0
        ? `Programme levels: ${school.programmeLevels.slice(0, 3).join(", ")}`
        : "Programme levels available from ECDA data.",
      school.vacancyStatus ? `Vacancy: ${school.vacancyStatus}` : "Vacancy status should be checked directly.",
      school.enrichmentProgrammes.length > 0
        ? `Enrichment: ${school.enrichmentProgrammes.slice(0, 3).join(", ")}`
        : "Website enrichment data is limited for this school."
    ],
    programmeLevels: school.programmeLevels,
    vacancyStatus: school.vacancyStatus,
    monthlyFee: school.monthlyFee,
    websiteUrl: school.websiteUrl
  }));
}

export async function scout(query: string): Promise<ScoutResult> {
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for scout queries.");
  }

  logScout("Received scout query.", { query });
  const filters = await resolveFilters(query);
  logScout("Filters extracted.", { filters });
  const matches = querySchools(filters);
  logScout("Cache query completed.", {
    matches: matches.length,
    scoutEnrichmentEnabled: false
  });

  if (matches.length === 0) {
    logScout("No cache matches found.");
    return {
      query,
      filters,
      recommendations: []
    };
  }

  const shortlist = matches.slice(0, 8).map((school) => ({
    name: school.name,
    address: school.address,
    programmeLevels: school.programmeLevels,
    vacancyStatus: school.vacancyStatus,
    curriculumStyle: school.curriculumStyle,
    languagesOffered: school.languagesOffered,
    enrichmentProgrammes: school.enrichmentProgrammes,
    monthlyFee: school.monthlyFee,
    ethosSummary: school.ethosSummary
  }));

  logScout("Running OpenAI recommendations agent.", {
    candidateCount: shortlist.length
  });
  let baseRecommendations: RecommendationDraft[] = fallbackRecommendations(matches).map((item) => ({
    name: item.name,
    address: item.address,
    reason: item.reason,
    highlights: item.highlights
  }));

  try {
    const recommendationResult = await run(
      recommendationsAgent,
      [
        `Parent query: ${query}`,
        `Extracted filters: ${JSON.stringify(filters)}`,
        `Candidate schools: ${JSON.stringify(shortlist)}`
      ].join("\n")
    );

    const recommendationOutput = recommendationResult.finalOutput;
    if (recommendationOutput?.recommendations?.length) {
      baseRecommendations = recommendationOutput.recommendations;
    }
  } catch (error) {
    console.warn("[SCOUT] Recommendations agent failed. Falling back to heuristic recommendations.", error);
  }

  const recommendations: ScoutRecommendation[] = baseRecommendations.map((item) => {
    const school = matches.find((match) => match.name === item.name && match.address === item.address);
    return {
      name: item.name,
      address: item.address,
      reason: item.reason,
      highlights: item.highlights,
      programmeLevels: school?.programmeLevels ?? [],
      vacancyStatus: school?.vacancyStatus ?? null,
      monthlyFee: school?.monthlyFee ?? null,
      websiteUrl: school?.websiteUrl ?? null
    };
  });

  logScout("Scout completed.", {
    recommendations: recommendations.map((item) => item.name)
  });

  return {
    query,
    filters,
    recommendations
  };
}

export async function enrichTopMatch(query: string): Promise<ScoutResult> {
  if (!config.tinyfishApiKey) {
    throw new Error("TINYFISH_API_KEY is required to enrich the top match.");
  }

  logScout("Enrich top match requested.", { query });
  const filters = await resolveFilters(query);
  const matches = querySchools(filters);
  const topMatch = matches[0];

  if (!topMatch) {
    logScout("No top match available for enrichment.");
    return {
      query,
      filters,
      recommendations: []
    };
  }

  const normalizedWebsite = normalizeWebsiteUrl(topMatch.websiteUrl);

  if (!normalizedWebsite) {
    throw new Error(`Top match ${topMatch.name} has no valid website to enrich.`);
  }

  logScout("Starting TinyFish enrichment for top match.", {
    school: topMatch.name,
    websiteUrl: normalizedWebsite
  });
  await enrichSchools([toBaseSchool(topMatch)]);
  logScout("TinyFish enrichment for top match completed.", {
    school: topMatch.name
  });

  return scout(query);
}
