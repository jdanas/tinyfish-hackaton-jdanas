import { sampleListings } from "../data/sampleListings.js";
import { saveListings } from "../db/database.js";
import { config } from "../config.js";
import type { ScrapeRefreshResult, TuitionCentre } from "../types/domain.js";
import { TinyFish } from "@tiny-fish/sdk";

async function attemptTinyfishScrape(): Promise<TuitionCentre[]> {
  if (!config.enableLiveScrape || !config.tinyfishApiKey) {
    return [];
  }

  try {
    const client = new TinyFish({
      apiKey: config.tinyfishApiKey,
    });

    // Use Tinyfish Web Agent to scrape tuition centers
    const stream = await client.agent.stream({
      url: "https://www.kiasuparents.com/kiasu/",
      goal: `Extract information about tuition centers in Singapore. 
      For each center found, get:
      - name (center name)
      - address (full address)
      - monthly_fee (monthly tuition fee in dollars)
      - subjects (subjects offered)
      
      Return the data as a JSON array with property "centres" containing all centers found.`,
    });

    let finalResult: any = null;

    // Process the SSE stream
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

    // Parse the result - it should contain centres array
    const centres = finalResult.centres ?? [];

    return centres
      .filter((centre: any) => centre.name && centre.address)
      .map((centre: any, index: number) => ({
        id: `live-${index}-${centre.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: centre.name,
        source: "kiasuparents" as const,
        address: centre.address,
        postalCode: "529508", // Default, could be enhanced with geocoding
        area: "Singapore",
        lat: 1.3521,
        lng: 103.8198,
        monthlyFee: Number.parseInt(String(centre.monthly_fee ?? "260").replace(/[^\d]/g, ""), 10) || 260,
        rating: 4.2, // Default rating
        reviewCount: 12, // Default review count
        classSize: 8, // Default class size
        trialFee: null,
        subjects: Array.isArray(centre.subjects)
          ? centre.subjects.filter(Boolean)
          : String(centre.subjects ?? "Math").split(",").map((s: string) => s.trim()),
        tags: ["tinyfish-scrape"],
        parentBlurb: "Imported via Tinyfish Web Agent. Review and enrich before production use."
      }));
  } catch (error) {
    console.error("[Tinyfish] Scraping error:", error);
    return [];
  }
}

export async function refreshListings(): Promise<ScrapeRefreshResult> {
  try {
    const liveListings = await attemptTinyfishScrape();

    if (liveListings.length > 0) {
      saveListings(liveListings);
      return {
        imported: liveListings.length,
        usedFallback: false,
        message: "Imported live listings with Tinyfish Web Agent.",
        sourcesAttempted: ["kiasuparents"]
      };
    }
  } catch (error) {
    console.error("Live scrape failed:", error);
  }

  saveListings(sampleListings);

  return {
    imported: sampleListings.length,
    usedFallback: true,
    message:
      "Seeded fallback listings were loaded. Set ENABLE_LIVE_SCRAPE=true and TINYFISH_API_KEY to attempt live scraping.",
    sourcesAttempted: ["kiasuparents", "google_maps"]
  };
}

