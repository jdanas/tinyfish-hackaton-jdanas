import { replaceAllListings } from "../db/database.js";
import { config } from "../config.js";
import type { ScrapeRefreshResult, TuitionCentre } from "../types/domain.js";
import { TinyFish } from "@tiny-fish/sdk";

type LifeGovCentre = {
  name?: string;
  centre_name?: string;
  address?: string;
  postal_code?: string;
  monthly_fee?: string | number;
  fee?: string | number;
  fees?: string | number;
  subjects?: string[] | string;
  programmes?: string[] | string;
  website?: string;
  vacancy?: string;
  vacancy_status?: string;
};

function normalizeList(value: string[] | string | undefined, fallback: string[]) {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => item.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  return fallback;
}

function extractPostalCode(address: string, fallback?: string) {
  const explicit = address.match(/\b\d{6}\b/);

  if (explicit) {
    return explicit[0];
  }

  if (fallback && /^\d{6}$/.test(fallback)) {
    return fallback;
  }

  return "529508";
}

async function attemptTinyfishScrape(): Promise<TuitionCentre[]> {
  if (!config.enableLiveScrape || !config.tinyfishApiKey) {
    return [];
  }

  try {
    const client = new TinyFish({
      apiKey: config.tinyfishApiKey
    });

    const stream = await client.agent.stream({
      url: "https://www.life.gov.sg/services-tools/preschool-search",
      goal: `Extract preschool listings from this Singapore LifeSG preschool search service.
      Focus on actual result cards and centre details, not help text or general articles.
      For each centre found, return:
      - name
      - address
      - postal_code
      - monthly_fee (or fee if that is the only pricing shown)
      - programmes
      - vacancy_status
      - website

      Return strict JSON with a top-level property named "centres".`
    });

    let finalResult: any = null;

    for await (const event of stream) {
      console.log(`[Tinyfish] Event type: ${event.type}`);

      if (event.type === "PROGRESS" && "purpose" in event) {
        console.log(`[Tinyfish] Progress: ${event.purpose}`);
      }

      if (event.type === "COMPLETE") {
        if (event.status === "COMPLETED" && event.result) {
          finalResult = event.result;
          console.log("[Tinyfish] Scraping completed successfully");
        } else if (event.status === "FAILED") {
          console.error(`[Tinyfish] Scraping failed: ${event.error}`);
        }
      }
    }

    if (!finalResult) {
      console.warn("[Tinyfish] No result returned from scraping");
      return [];
    }

    const centres = (finalResult.centres ?? []) as LifeGovCentre[];

    return centres
      .filter((centre) => (centre.name ?? centre.centre_name) && centre.address)
      .map((centre, index) => {
        const name = centre.name ?? centre.centre_name ?? `Preschool ${index + 1}`;
        const address = centre.address ?? "Singapore";
        const postalCode = extractPostalCode(address, centre.postal_code);
        const feeSource = centre.monthly_fee ?? centre.fee ?? centre.fees ?? "0";
        const monthlyFee =
          Number.parseInt(String(feeSource).replace(/[^\d]/g, ""), 10) || 0;
        const programmes = normalizeList(centre.programmes ?? centre.subjects, [
          "Preschool"
        ]);
        const vacancy = centre.vacancy_status ?? centre.vacancy ?? "vacancy-info";

        return {
          id: `live-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name,
          source: "life_gov" as const,
          address,
          postalCode,
          area: "Singapore",
          lat: 1.3521,
          lng: 103.8198,
          monthlyFee,
          rating: 4.2,
          reviewCount: 12,
          classSize: 8,
          trialFee: null,
          subjects: programmes,
          tags: ["tinyfish-scrape", "life-gov", vacancy],
          parentBlurb: "Imported from LifeSG preschool search via TinyFish Web Agent.",
          websiteUrl: centre.website
        };
      });
  } catch (error) {
    console.error("[Tinyfish] Scraping error:", error);
    return [];
  }
}

export async function refreshListings(): Promise<ScrapeRefreshResult> {
  const liveListings = await attemptTinyfishScrape();

  if (liveListings.length === 0) {
    throw new Error(
      "TinyFish returned no live listings. No mock data was loaded."
    );
  }

  replaceAllListings(liveListings);

  return {
    imported: liveListings.length,
    usedFallback: false,
    message: "Imported live preschool listings with TinyFish Web Agent.",
    sourcesAttempted: ["life_gov_preschool_search"]
  };
}
