/**
 * SQLite cache layer for Kiaskool. Owns schema creation, upserts, and read queries.
 */
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { config } from "../config.js";
import type { BaseSchool, EnrichedSchool, School, SchoolFilters } from "../types/school.js";

type SchoolRow = {
  centre_code: string;
  name: string;
  address: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  operator: string | null;
  service_model: string | null;
  programme_levels_json: string;
  vacancy_status: string | null;
  contact_number: string | null;
  email: string | null;
  website_url: string | null;
  languages_offered_json: string;
  monthly_fee: number | null;
  curriculum_style: string | null;
  enrichment_programmes_json: string | null;
  open_house_dates_json: string | null;
  ethos_summary: string | null;
  enrichment_source_website: string | null;
  last_enriched_at: string | null;
};

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const database = new Database(config.databasePath);

function toNormalizedText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toBaseSchool(row: SchoolRow): BaseSchool {
  return {
    centreCode: row.centre_code,
    name: row.name,
    address: row.address,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    operator: row.operator,
    serviceModel: row.service_model,
    programmeLevels: JSON.parse(row.programme_levels_json) as string[],
    vacancyStatus: row.vacancy_status,
    contactNumber: row.contact_number,
    email: row.email,
    websiteUrl: row.website_url,
    languagesOffered: JSON.parse(row.languages_offered_json) as string[],
    monthlyFee: row.monthly_fee
  };
}

function toSchool(row: SchoolRow): School {
  return {
    ...toBaseSchool(row),
    curriculumStyle: row.curriculum_style,
    enrichmentProgrammes: row.enrichment_programmes_json
      ? (JSON.parse(row.enrichment_programmes_json) as string[])
      : [],
    openHouseDates: row.open_house_dates_json
      ? (JSON.parse(row.open_house_dates_json) as string[])
      : [],
    ethosSummary: row.ethos_summary,
    enrichmentSourceWebsite: row.enrichment_source_website,
    lastEnrichedAt: row.last_enriched_at
  };
}

export function initDb(): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schools_base (
      centre_code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      operator TEXT,
      service_model TEXT,
      programme_levels_json TEXT NOT NULL,
      vacancy_status TEXT,
      contact_number TEXT,
      email TEXT,
      website_url TEXT,
      languages_offered_json TEXT NOT NULL,
      monthly_fee REAL
    );

    CREATE TABLE IF NOT EXISTS schools_enriched (
      school_name TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      curriculum_style TEXT,
      enrichment_programmes_json TEXT NOT NULL,
      open_house_dates_json TEXT NOT NULL,
      ethos_summary TEXT,
      source_website TEXT,
      last_enriched_at TEXT NOT NULL,
      PRIMARY KEY (school_name, postal_code)
    );
  `);

  database.exec(`
    CREATE VIEW IF NOT EXISTS schools AS
    SELECT
      base.centre_code,
      base.name,
      base.address,
      base.postal_code,
      base.latitude,
      base.longitude,
      base.operator,
      base.service_model,
      base.programme_levels_json,
      base.vacancy_status,
      base.contact_number,
      base.email,
      base.website_url,
      base.languages_offered_json,
      base.monthly_fee,
      enriched.curriculum_style,
      enriched.enrichment_programmes_json,
      enriched.open_house_dates_json,
      enriched.ethos_summary,
      enriched.source_website AS enrichment_source_website,
      enriched.last_enriched_at
    FROM schools_base base
    LEFT JOIN schools_enriched enriched
      ON lower(trim(base.name)) = lower(trim(enriched.school_name))
     AND base.postal_code = enriched.postal_code;
  `);
}

export function upsertBaseSchools(schools: BaseSchool[]): void {
  const statement = database.prepare(`
    INSERT INTO schools_base (
      centre_code,
      name,
      address,
      postal_code,
      latitude,
      longitude,
      operator,
      service_model,
      programme_levels_json,
      vacancy_status,
      contact_number,
      email,
      website_url,
      languages_offered_json,
      monthly_fee
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15
    )
    ON CONFLICT(centre_code) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      postal_code = excluded.postal_code,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      operator = excluded.operator,
      service_model = excluded.service_model,
      programme_levels_json = excluded.programme_levels_json,
      vacancy_status = excluded.vacancy_status,
      contact_number = excluded.contact_number,
      email = excluded.email,
      website_url = excluded.website_url,
      languages_offered_json = excluded.languages_offered_json,
      monthly_fee = excluded.monthly_fee
  `);

  const tx = database.transaction((rows: BaseSchool[]) => {
    for (const school of rows) {
      statement.run(
        school.centreCode,
        school.name,
        school.address,
        school.postalCode,
        school.latitude,
        school.longitude,
        school.operator,
        school.serviceModel,
        JSON.stringify(school.programmeLevels),
        school.vacancyStatus,
        school.contactNumber,
        school.email,
        school.websiteUrl,
        JSON.stringify(school.languagesOffered),
        school.monthlyFee
      );
    }
  });

  tx(schools);
}

export function upsertEnrichedSchools(enriched: EnrichedSchool[]): void {
  const statement = database.prepare(`
    INSERT INTO schools_enriched (
      school_name,
      postal_code,
      curriculum_style,
      enrichment_programmes_json,
      open_house_dates_json,
      ethos_summary,
      source_website,
      last_enriched_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
    )
    ON CONFLICT(school_name, postal_code) DO UPDATE SET
      curriculum_style = excluded.curriculum_style,
      enrichment_programmes_json = excluded.enrichment_programmes_json,
      open_house_dates_json = excluded.open_house_dates_json,
      ethos_summary = excluded.ethos_summary,
      source_website = excluded.source_website,
      last_enriched_at = excluded.last_enriched_at
  `);

  const tx = database.transaction((rows: EnrichedSchool[]) => {
    for (const school of rows) {
      statement.run(
        school.schoolName,
        school.postalCode,
        school.curriculumStyle,
        JSON.stringify(school.enrichmentProgrammes),
        JSON.stringify(school.openHouseDates),
        school.ethosSummary,
        school.sourceWebsite,
        school.lastEnrichedAt
      );
    }
  });

  tx(enriched);
}

export function getBaseSchools(): BaseSchool[] {
  const rows = database.prepare("SELECT * FROM schools_base ORDER BY name ASC").all() as SchoolRow[];
  return rows.map(toBaseSchool);
}

export function getCachedSchools(): School[] {
  const rows = database.prepare("SELECT * FROM schools ORDER BY name ASC").all() as SchoolRow[];
  return rows.map(toSchool);
}

export function getSchoolCount(): number {
  const row = database.prepare("SELECT COUNT(*) AS count FROM schools_base").get() as { count: number };
  return row.count;
}

export function querySchools(filters: SchoolFilters): School[] {
  const schools = getCachedSchools();
  const locationNeedle = filters.locationPreference ? toNormalizedText(filters.locationPreference) : null;
  const programmeLevels = filters.programmeLevel?.map(toNormalizedText) ?? [];
  const curriculumStyles = filters.curriculumStyle?.map(toNormalizedText) ?? [];
  const languages = filters.language?.map(toNormalizedText) ?? [];
  const enrichment = filters.enrichment?.map(toNormalizedText) ?? [];

  const scored = schools
    .map((school) => {
      let score = 0;

      if (locationNeedle) {
        const locationHaystack = [
          school.address,
          school.postalCode,
          school.name
        ]
          .join(" ")
          .toLowerCase();

        if (locationHaystack.includes(locationNeedle)) {
          score += 4;
        }
      }

      if (programmeLevels.length > 0) {
        const offered = school.programmeLevels.map(toNormalizedText);
        score += programmeLevels.filter((level) => offered.some((item) => item.includes(level))).length * 3;
      }

      if (curriculumStyles.length > 0 && school.curriculumStyle) {
        const curriculum = toNormalizedText(school.curriculumStyle);
        score += curriculumStyles.filter((style) => curriculum.includes(style)).length * 3;
      }

      if (languages.length > 0) {
        const offeredLanguages = school.languagesOffered.map(toNormalizedText);
        score += languages.filter((language) => offeredLanguages.some((item) => item.includes(language))).length * 2;
      }

      if (enrichment.length > 0) {
        const programmes = school.enrichmentProgrammes.map(toNormalizedText);
        score += enrichment.filter((item) => programmes.some((program) => program.includes(item))).length * 2;
      }

      if (school.vacancyStatus && /available|limited/i.test(school.vacancyStatus)) {
        score += 1;
      }

      return {
        school,
        score
      };
    })
    .filter(({ score }) => score > 0 || Object.keys(filters).length === 0)
    .sort((left, right) => right.score - left.score || left.school.name.localeCompare(right.school.name));

  return scored.map(({ school }) => school);
}
