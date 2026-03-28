/**
 * TinyFish enrichment layer. Scrapes school websites for qualitative data and writes enrichment rows only.
 */
import { TinyFish } from "@tiny-fish/sdk";
import { config } from "../config.js";
import { upsertEnrichedSchools } from "../data/schoolStore.js";
import type { BaseSchool, EnrichedSchool } from "../types/school.js";

export type EnrichmentStreamEvent =
  | { type: "status"; message: string }
  | { type: "progress"; message: string }
  | { type: "complete"; message: string; enriched: number };

type ScrapedEnrichment = {
  curriculum_style?: string;
  enrichment_programmes?: string[] | string;
  open_house_dates?: string[] | string;
  ethos_summary?: string;
};

function toList(value: string[] | string | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function scrapeSingleSchool(
  client: TinyFish,
  school: BaseSchool,
  onEvent?: (event: EnrichmentStreamEvent) => void
): Promise<EnrichedSchool | null> {
  if (!school.websiteUrl) {
    return null;
  }

  onEvent?.({
    type: "status",
    message: `Opening ${school.name} website`
  });

  const stream = await client.agent.stream({
    url: school.websiteUrl,
    goal: `Extract structured preschool enrichment details from this school website.
    Return strict JSON with:
    - curriculum_style
    - enrichment_programmes
    - open_house_dates
    - ethos_summary

    Keep ethos_summary to 1 or 2 sentences.`
  });

  let resultPayload: ScrapedEnrichment | null = null;

  for await (const event of stream) {
    if (event.type === "PROGRESS" && "purpose" in event) {
      onEvent?.({
        type: "progress",
        message: `${school.name}: ${event.purpose}`
      });
    }

    if (event.type === "COMPLETE") {
      if (event.status === "COMPLETED" && event.result) {
        resultPayload = event.result as ScrapedEnrichment;
      } else if (event.status === "FAILED") {
        onEvent?.({
          type: "progress",
          message: `${school.name}: skipped due to scrape failure`
        });
      }
    }
  }

  if (!resultPayload) {
    return null;
  }

  return {
    schoolName: school.name,
    postalCode: school.postalCode,
    curriculumStyle: resultPayload.curriculum_style?.trim() ?? null,
    enrichmentProgrammes: toList(resultPayload.enrichment_programmes),
    openHouseDates: toList(resultPayload.open_house_dates),
    ethosSummary: resultPayload.ethos_summary?.trim() ?? null,
    sourceWebsite: school.websiteUrl,
    lastEnrichedAt: new Date().toISOString()
  };
}

export async function enrichSchools(
  schools: BaseSchool[],
  onEvent?: (event: EnrichmentStreamEvent) => void
): Promise<void> {
  if (!config.tinyfishApiKey) {
    throw new Error("TINYFISH_API_KEY is required for enrichment refresh.");
  }

  const client = new TinyFish({
    apiKey: config.tinyfishApiKey
  });

  const enrichedRows: EnrichedSchool[] = [];
  const schoolsWithWebsites = schools.filter((school) => school.websiteUrl);

  onEvent?.({
    type: "status",
    message: `Starting TinyFish enrichment for ${schoolsWithWebsites.length} schools.`
  });

  for (const school of schoolsWithWebsites) {
    const enriched = await scrapeSingleSchool(client, school, onEvent);
    if (enriched) {
      enrichedRows.push(enriched);
    }
  }

  if (enrichedRows.length > 0) {
    upsertEnrichedSchools(enrichedRows);
  }

  onEvent?.({
    type: "complete",
    message: `Enriched ${enrichedRows.length} schools.`,
    enriched: enrichedRows.length
  });
}

