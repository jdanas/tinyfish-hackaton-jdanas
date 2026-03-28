/**
 * TinyFish enrichment layer. Scrapes school websites for qualitative data and writes enrichment rows only.
 */
import { BrowserProfile, TinyFish } from "@tiny-fish/sdk";
import { config } from "../config.js";
import { upsertEnrichedSchools } from "../data/schoolStore.js";
import type { BaseSchool, EnrichedSchool } from "../types/school.js";

export type EnrichmentStreamEvent =
  | { type: "status"; message: string }
  | { type: "progress"; message: string }
  | { type: "preview"; message: string; streamingUrl: string }
  | { type: "complete"; message: string; enriched: number };

type ScrapedEnrichment = {
  curriculum_style?: string;
  enrichment_programmes?: string[] | string;
  open_house_dates?: string[] | string;
  ethos_summary?: string;
};

export function normalizeWebsiteUrl(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

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
  const websiteUrl = normalizeWebsiteUrl(school.websiteUrl);

  if (!websiteUrl) {
    onEvent?.({
      type: "progress",
      message: `${school.name}: skipped because website URL is invalid`
    });
    return null;
  }

  onEvent?.({
    type: "status",
    message: `Opening ${school.name} website`
  });

  console.log("[TINYFISH] Opening website.", {
    school: school.name,
    websiteUrl
  });

  const stream = await client.agent.stream(
    {
      url: websiteUrl,
      browser_profile: BrowserProfile.STEALTH,
      goal: `Extract structured preschool enrichment details from this school website.
      Return strict JSON with:
      - curriculum_style
      - enrichment_programmes
      - open_house_dates
      - ethos_summary

      Keep ethos_summary to 1 or 2 sentences.`
    },
    {
      onStarted: (event) => {
        console.log("[TINYFISH] Run started.", {
          school: school.name,
          runId: event.run_id
        });
      },
      onStreamingUrl: (event) => {
        console.log("[TINYFISH] Live browser URL.", {
          school: school.name,
          streamingUrl: event.streaming_url
        });
        onEvent?.({
          type: "preview",
          message: `${school.name}: live browser preview ready`,
          streamingUrl: event.streaming_url
        });
      },
      onProgress: (event) => {
        console.log("[TINYFISH] Progress callback.", {
          school: school.name,
          purpose: event.purpose
        });
      },
      onComplete: (event) => {
        console.log("[TINYFISH] Run complete callback.", {
          school: school.name,
          status: event.status
        });
      }
    }
  );

  let resultPayload: ScrapedEnrichment | null = null;

  for await (const event of stream) {
    console.log("[TINYFISH] Stream event.", {
      school: school.name,
      type: event.type
    });

    if (event.type === "PROGRESS" && "purpose" in event) {
      console.log("[TINYFISH] Progress event.", {
        school: school.name,
        purpose: event.purpose
      });
      onEvent?.({
        type: "progress",
        message: `${school.name}: ${event.purpose}`
      });
    }

    if (event.type === "COMPLETE") {
      if (event.status === "COMPLETED" && event.result) {
        console.log("[TINYFISH] Completed with result.", {
          school: school.name
        });
        resultPayload = event.result as ScrapedEnrichment;
      } else if (event.status === "FAILED") {
        console.log("[TINYFISH] Completed with failure.", {
          school: school.name
        });
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
    sourceWebsite: websiteUrl,
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
    apiKey: config.tinyfishApiKey,
    timeout: 600_000
  });

  const enrichedRows: EnrichedSchool[] = [];
  const schoolsWithWebsites = schools.filter((school) => school.websiteUrl);

  console.log("[TINYFISH] Enrichment batch started.", {
    requested: schools.length,
    withWebsites: schoolsWithWebsites.length
  });

  onEvent?.({
    type: "status",
    message: `Starting TinyFish enrichment for ${schoolsWithWebsites.length} schools.`
  });

  for (const school of schoolsWithWebsites) {
    console.log("[TINYFISH] Enriching school.", {
      name: school.name,
      websiteUrl: school.websiteUrl
    });
    const enriched = await scrapeSingleSchool(client, school, onEvent);
    if (enriched) {
      enrichedRows.push(enriched);
      console.log("[TINYFISH] Enriched school.", {
        name: school.name
      });
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

  console.log("[TINYFISH] Enrichment batch completed.", {
    enriched: enrichedRows.length
  });
}
