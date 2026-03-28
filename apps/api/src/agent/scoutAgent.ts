/**
 * Cache-only scout layer. Uses OpenAI Agents to extract school search intent and summarize recommendations.
 */
import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { config } from "../config.js";
import { querySchools } from "../data/schoolStore.js";
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

  const parsedFiltersResult = await run(filtersAgent, query);
  const filters = cleanFilters(parsedFiltersResult.finalOutput ?? {});
  const matches = querySchools(filters);

  if (matches.length === 0) {
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

  const recommendationResult = await run(
    recommendationsAgent,
    [
      `Parent query: ${query}`,
      `Extracted filters: ${JSON.stringify(filters)}`,
      `Candidate schools: ${JSON.stringify(shortlist)}`
    ].join("\n")
  );

  const recommendationOutput = recommendationResult.finalOutput;
  const baseRecommendations = recommendationOutput?.recommendations?.length
    ? recommendationOutput.recommendations
    : fallbackRecommendations(matches);

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

  return {
    query,
    filters,
    recommendations
  };
}

