/**
 * Shared school domain types for Kiaskool's fetch, cache, enrichment, and scout layers.
 */
export interface BaseSchool {
  centreCode: string;
  name: string;
  address: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  operator: string | null;
  serviceModel: string | null;
  programmeLevels: string[];
  vacancyStatus: string | null;
  contactNumber: string | null;
  email: string | null;
  websiteUrl: string | null;
  languagesOffered: string[];
  monthlyFee: number | null;
}

export interface EnrichedSchool {
  schoolName: string;
  postalCode: string;
  curriculumStyle: string | null;
  enrichmentProgrammes: string[];
  openHouseDates: string[];
  ethosSummary: string | null;
  sourceWebsite: string | null;
  lastEnrichedAt: string;
}

export interface School extends BaseSchool {
  curriculumStyle: string | null;
  enrichmentProgrammes: string[];
  openHouseDates: string[];
  ethosSummary: string | null;
  enrichmentSourceWebsite: string | null;
  lastEnrichedAt: string | null;
}

export interface SchoolFilters {
  locationPreference?: string;
  programmeLevel?: string[];
  curriculumStyle?: string[];
  language?: string[];
  enrichment?: string[];
}

export interface ScoutRecommendation {
  name: string;
  address: string;
  reason: string;
  highlights: string[];
  programmeLevels: string[];
  vacancyStatus: string | null;
  monthlyFee: number | null;
  websiteUrl: string | null;
}

export interface ScoutResult {
  query: string;
  filters: SchoolFilters;
  recommendations: ScoutRecommendation[];
}

