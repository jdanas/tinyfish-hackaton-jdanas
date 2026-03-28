export interface SearchPayload {
  postalCode: string;
  subject?: string;
  maxMonthlyFee?: number;
}

export interface SearchResponse {
  query: {
    postalCode: string;
    subject?: string;
    maxMonthlyFee?: number;
    resolvedArea: string;
  };
  recommendation: {
    headline: string;
    subheadline: string;
    whyThisFits: string;
    proofPoints: string[];
    backupOption: string;
    primaryActionNote: string;
    generatedByAI: boolean;
    model: string;
  };
  listings: Array<{
    id: string;
    name: string;
    area: string;
    address: string;
    monthlyFee: number;
    rating: number;
    reviewCount: number;
    classSize: number;
    distanceKm: number;
    valueScore: number;
    subjects: string[];
    tags: string[];
    parentBlurb: string;
    websiteUrl?: string;
    googleMapsUrl?: string;
    scoreBreakdown: {
      affordability: number;
      distance: number;
      reviews: number;
      classSize: number;
      relevance: number;
    };
  }>;
}

export interface RefreshResponse {
  imported: number;
  usedFallback: boolean;
  message: string;
  sourcesAttempted: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok && "error" in data && data.error) {
    throw new Error(data.error);
  }

  return data;
}

export function searchListings(payload: SearchPayload) {
  return request<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function refreshListings() {
  return request<RefreshResponse>("/api/scrape/refresh", {
    method: "POST"
  });
}
