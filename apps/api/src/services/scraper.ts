import { sampleListings } from "../data/sampleListings.js";
import { saveListings } from "../db/database.js";
import { config } from "../config.js";
import type { ScrapeRefreshResult, TuitionCentre } from "../types/domain.js";

async function attemptAgentQlScrape(): Promise<TuitionCentre[]> {
  if (!config.enableLiveScrape || !config.agentQlApiKey) {
    return [];
  }

  const [{ chromium }, agentqlModule] = await Promise.all([
    import("playwright"),
    import("agentql")
  ]);

  const { configure, wrap } = agentqlModule;

  configure({ apiKey: config.agentQlApiKey });

  const browser = await chromium.launch({ headless: true });

  try {
    const rawPage = await browser.newPage();
    const page = await wrap(rawPage);
    await page.goto("https://www.kiasuparents.com/kiasu/", {
      waitUntil: "domcontentloaded"
    });
    await page.waitForTimeout(1500);

    const data = (await page.queryData(`
      {
        centres[] {
          name
          address
          monthly_fee
          subjects
        }
      }
    `)) as {
      centres?: Array<{
        name?: string;
        address?: string;
        monthly_fee?: string;
        subjects?: string[] | string;
      }>;
    };

    const centres = data.centres ?? [];

    return centres
      .filter((centre) => centre.name && centre.address)
      .map((centre, index) => ({
        id: `live-${index}-${centre.name!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: centre.name!,
        source: "kiasuparents" as const,
        address: centre.address!,
        postalCode: "529508",
        area: "Singapore",
        lat: 1.3521,
        lng: 103.8198,
        monthlyFee: Number.parseInt(String(centre.monthly_fee ?? "260").replace(/[^\d]/g, ""), 10) || 260,
        rating: 4.2,
        reviewCount: 12,
        classSize: 8,
        trialFee: null,
        subjects: Array.isArray(centre.subjects)
          ? centre.subjects.filter(Boolean)
          : String(centre.subjects ?? "Math").split(",").map((subject) => subject.trim()),
        tags: ["live-scrape"],
        parentBlurb: "Imported via AgentQL live scrape. Review and enrich before production use."
      }));
  } finally {
    await browser.close();
  }
}

export async function refreshListings(): Promise<ScrapeRefreshResult> {
  try {
    const liveListings = await attemptAgentQlScrape();

    if (liveListings.length > 0) {
      saveListings(liveListings);
      return {
        imported: liveListings.length,
        usedFallback: false,
        message: "Imported live listings with AgentQL.",
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
      "Seeded fallback listings were loaded. Set ENABLE_LIVE_SCRAPE=true and AGENTQL_API_KEY to attempt live scraping.",
    sourcesAttempted: ["kiasuparents", "google_maps"]
  };
}

