export type ListingSource = "seed" | "kiasuparents" | "google_maps";

export interface TuitionCentre {
  id: string;
  name: string;
  source: ListingSource;
  address: string;
  postalCode: string;
  area: string;
  lat: number;
  lng: number;
  monthlyFee: number;
  rating: number;
  reviewCount: number;
  classSize: number;
  trialFee: number | null;
  subjects: string[];
  tags: string[];
  parentBlurb: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
}

export interface SearchWeights {
  affordability: number;
  distance: number;
  reviews: number;
  classSize: number;
  relevance: number;
}

export interface SearchInput {
  postalCode: string;
  subject?: string;
  maxMonthlyFee?: number;
  weights?: Partial<SearchWeights>;
}

export interface ScoredListing extends TuitionCentre {
  distanceKm: number;
  valueScore: number;
  scoreBreakdown: {
    affordability: number;
    distance: number;
    reviews: number;
    classSize: number;
    relevance: number;
  };
}

export interface RecommendationResult {
  headline: string;
  subheadline: string;
  whyThisFits: string;
  proofPoints: string[];
  backupOption: string;
  primaryActionNote: string;
  generatedByAI: boolean;
  model: string;
}

export interface ScrapeRefreshResult {
  imported: number;
  usedFallback: boolean;
  message: string;
  sourcesAttempted: string[];
}
