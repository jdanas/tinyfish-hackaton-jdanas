import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { config } from "../config.js";
import type { TuitionCentre } from "../types/domain.js";

type ListingRow = {
  id: string;
  name: string;
  source: string;
  address: string;
  postal_code: string;
  area: string;
  lat: number;
  lng: number;
  monthly_fee: number;
  rating: number;
  review_count: number;
  class_size: number;
  trial_fee: number | null;
  subjects_json: string;
  tags_json: string;
  parent_blurb: string;
  website_url: string | null;
  google_maps_url: string | null;
};

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const database = new Database(config.databasePath);

database.exec(`
  CREATE TABLE IF NOT EXISTS tuition_centres (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    address TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    area TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    monthly_fee REAL NOT NULL,
    rating REAL NOT NULL,
    review_count INTEGER NOT NULL,
    class_size INTEGER NOT NULL,
    trial_fee REAL,
    subjects_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    parent_blurb TEXT NOT NULL,
    website_url TEXT,
    google_maps_url TEXT
  );
`);

function mapRowToListing(row: ListingRow): TuitionCentre {
  return {
    id: row.id,
    name: row.name,
    source: row.source as TuitionCentre["source"],
    address: row.address,
    postalCode: row.postal_code,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    monthlyFee: row.monthly_fee,
    rating: row.rating,
    reviewCount: row.review_count,
    classSize: row.class_size,
    trialFee: row.trial_fee,
    subjects: JSON.parse(row.subjects_json) as string[],
    tags: JSON.parse(row.tags_json) as string[],
    parentBlurb: row.parent_blurb,
    websiteUrl: row.website_url ?? undefined,
    googleMapsUrl: row.google_maps_url ?? undefined
  };
}

function listingToParams(listing: TuitionCentre) {
  return [
    listing.id,
    listing.name,
    listing.source,
    listing.address,
    listing.postalCode,
    listing.area,
    listing.lat,
    listing.lng,
    listing.monthlyFee,
    listing.rating,
    listing.reviewCount,
    listing.classSize,
    listing.trialFee,
    JSON.stringify(listing.subjects),
    JSON.stringify(listing.tags),
    listing.parentBlurb,
    listing.websiteUrl ?? null,
    listing.googleMapsUrl ?? null
  ] as const;
}

export function saveListings(listings: TuitionCentre[]): void {
  const insert = database.prepare(`
    INSERT INTO tuition_centres (
      id,
      name,
      source,
      address,
      postal_code,
      area,
      lat,
      lng,
      monthly_fee,
      rating,
      review_count,
      class_size,
      trial_fee,
      subjects_json,
      tags_json,
      parent_blurb,
      website_url,
      google_maps_url
    ) VALUES (
      ?1,
      ?2,
      ?3,
      ?4,
      ?5,
      ?6,
      ?7,
      ?8,
      ?9,
      ?10,
      ?11,
      ?12,
      ?13,
      ?14,
      ?15,
      ?16,
      ?17,
      ?18
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      source = excluded.source,
      address = excluded.address,
      postal_code = excluded.postal_code,
      area = excluded.area,
      lat = excluded.lat,
      lng = excluded.lng,
      monthly_fee = excluded.monthly_fee,
      rating = excluded.rating,
      review_count = excluded.review_count,
      class_size = excluded.class_size,
      trial_fee = excluded.trial_fee,
      subjects_json = excluded.subjects_json,
      tags_json = excluded.tags_json,
      parent_blurb = excluded.parent_blurb,
      website_url = excluded.website_url,
      google_maps_url = excluded.google_maps_url
  `);

  const transaction = database.transaction((rows: TuitionCentre[]) => {
    for (const listing of rows) {
      insert.run(...listingToParams(listing));
    }
  });

  transaction(listings);
}

export function replaceAllListings(listings: TuitionCentre[]): void {
  const clear = database.prepare("DELETE FROM tuition_centres");
  const insert = database.prepare(`
    INSERT INTO tuition_centres (
      id,
      name,
      source,
      address,
      postal_code,
      area,
      lat,
      lng,
      monthly_fee,
      rating,
      review_count,
      class_size,
      trial_fee,
      subjects_json,
      tags_json,
      parent_blurb,
      website_url,
      google_maps_url
    ) VALUES (
      ?1,
      ?2,
      ?3,
      ?4,
      ?5,
      ?6,
      ?7,
      ?8,
      ?9,
      ?10,
      ?11,
      ?12,
      ?13,
      ?14,
      ?15,
      ?16,
      ?17,
      ?18
    )
  `);

  const transaction = database.transaction((rows: TuitionCentre[]) => {
    clear.run();
    for (const listing of rows) {
      insert.run(...listingToParams(listing));
    }
  });

  transaction(listings);
}

export function getAllListings(): TuitionCentre[] {
  const rows = database
    .prepare("SELECT * FROM tuition_centres ORDER BY rating DESC, monthly_fee ASC")
    .all() as ListingRow[];
  return rows.map(mapRowToListing);
}

export function getListingCount(): number {
  const row = database.prepare("SELECT COUNT(*) as count FROM tuition_centres").get() as {
    count: number;
  };
  return row.count;
}
