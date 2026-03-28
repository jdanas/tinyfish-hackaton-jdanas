import type { ScoredListing, SearchInput, SearchWeights, TuitionCentre } from "../types/domain.js";
import { haversineDistanceKm, parseSingaporePostalCode } from "./postal.js";

const defaultWeights: SearchWeights = {
  affordability: 0.35,
  distance: 0.25,
  reviews: 0.2,
  classSize: 0.1,
  relevance: 0.1
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function mergeWeights(overrides?: Partial<SearchWeights>): SearchWeights {
  const merged = {
    ...defaultWeights,
    ...overrides
  };
  const total = Object.values(merged).reduce((sum, value) => sum + value, 0);

  return {
    affordability: merged.affordability / total,
    distance: merged.distance / total,
    reviews: merged.reviews / total,
    classSize: merged.classSize / total,
    relevance: merged.relevance / total
  };
}

function buildAffordabilityScore(monthlyFee: number, maxMonthlyFee?: number): number {
  const budgetCap = maxMonthlyFee && maxMonthlyFee > 0 ? maxMonthlyFee : 420;
  const baseline = budgetCap * 1.5;
  return clamp(1 - monthlyFee / baseline);
}

function buildReviewScore(rating: number, reviewCount: number): number {
  const ratingComponent = clamp((rating - 3.5) / 1.5);
  const volumeComponent = clamp(reviewCount / 120);
  return clamp(ratingComponent * 0.75 + volumeComponent * 0.25);
}

function buildClassSizeScore(classSize: number): number {
  return clamp(1 - (classSize - 4) / 12);
}

function buildRelevanceScore(listing: TuitionCentre, subject?: string): number {
  if (!subject) {
    return 0.7;
  }

  const requested = subject.trim().toLowerCase();
  const hasSubject = listing.subjects.some((item) => item.toLowerCase() === requested);
  const subjectLike = listing.subjects.some((item) => item.toLowerCase().includes(requested));

  if (hasSubject) {
    return 1;
  }

  if (subjectLike) {
    return 0.85;
  }

  return 0.25;
}

export function scoreListings(listings: TuitionCentre[], input: SearchInput) {
  const userLocation = parseSingaporePostalCode(input.postalCode);
  const weights = mergeWeights(input.weights);

  const scoredListings: ScoredListing[] = listings
    .map((listing) => {
      const distanceKm = haversineDistanceKm(userLocation, listing);
      const affordability = buildAffordabilityScore(listing.monthlyFee, input.maxMonthlyFee);
      const distance = clamp(1 - distanceKm / 15);
      const reviews = buildReviewScore(listing.rating, listing.reviewCount);
      const classSize = buildClassSizeScore(listing.classSize);
      const relevance = buildRelevanceScore(listing, input.subject);

      const valueScore =
        affordability * weights.affordability +
        distance * weights.distance +
        reviews * weights.reviews +
        classSize * weights.classSize +
        relevance * weights.relevance;

      return {
        ...listing,
        distanceKm: Number(distanceKm.toFixed(1)),
        valueScore: Number((valueScore * 100).toFixed(1)),
        scoreBreakdown: {
          affordability: Number((affordability * 100).toFixed(1)),
          distance: Number((distance * 100).toFixed(1)),
          reviews: Number((reviews * 100).toFixed(1)),
          classSize: Number((classSize * 100).toFixed(1)),
          relevance: Number((relevance * 100).toFixed(1))
        }
      };
    })
    .filter((listing) => {
      if (!input.maxMonthlyFee) {
        return true;
      }

      return listing.monthlyFee <= input.maxMonthlyFee * 1.25;
    })
    .sort((left, right) => right.valueScore - left.valueScore);

  return {
    userLocation,
    weights,
    scoredListings
  };
}

