/**
 * ECDA/data.gov.sg ingestion layer. Fetches official preschool datasets and stores normalized base rows.
 */
import { upsertBaseSchools } from "./schoolStore.js";
import type { BaseSchool } from "../types/school.js";

const LISTING_OF_CENTRES_DATASET_ID = "d_696c994c50745b079b3684f0e90ffc53";
const LISTING_OF_CENTRE_SERVICES_DATASET_ID = "d_44cfe12f2858ae503a093dfc075a28be";
const PRESCHOOLS_LOCATION_DATASET_ID = "d_a72bcd23e208d995f3bd4eececeaca43";

type DatastoreResponse<T> = {
  success?: boolean;
  result?: {
    records?: T[];
    total?: number;
  };
};

type CentresRecord = {
  centre_code?: string;
  centre_name?: string;
  centre_address?: string;
  postal_code?: string;
  organisation_description?: string;
  service_model?: string;
  centre_contact_no?: string;
  centre_email_address?: string;
  centre_website?: string;
  second_languages_offered?: string;
  infant_vacancy_current_month?: string;
  pg_vacancy_current_month?: string;
  n1_vacancy_current_month?: string;
  n2_vacancy_current_month?: string;
  k1_vacancy_current_month?: string;
  k2_vacancy_current_month?: string;
};

type ServicesRecord = {
  centre_code?: string;
  levels_offered?: string;
  fees?: string;
};

type PollDownloadResponse = {
  code?: number;
  data?: {
    url?: string;
  };
};

type GeoJsonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: Record<string, string | number | null | undefined>;
};

type GeoJsonResponse = {
  features?: GeoJsonFeature[];
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSchoolKey(name: string, postalCode: string) {
  return `${normalizeText(name)}::${postalCode}`;
}

async function fetchAllDatastoreRecords<T>(datasetId: string): Promise<T[]> {
  const records: T[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await fetch(
      `https://data.gov.sg/api/action/datastore_search?resource_id=${datasetId}&limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error(`ECDA dataset fetch failed for ${datasetId}.`);
    }

    const payload = (await response.json()) as DatastoreResponse<T>;
    const batch = payload.result?.records ?? [];
    records.push(...batch);

    if (batch.length < limit) {
      break;
    }

    offset += limit;
  }

  return records;
}

async function fetchLocations(): Promise<Map<string, { latitude: number | null; longitude: number | null }>> {
  const pollResponse = await fetch(
    `https://api-open.data.gov.sg/v1/public/api/datasets/${PRESCHOOLS_LOCATION_DATASET_ID}/poll-download`
  );

  if (!pollResponse.ok) {
    throw new Error("ECDA preschool location poll-download failed.");
  }

  const pollPayload = (await pollResponse.json()) as PollDownloadResponse;
  const downloadUrl = pollPayload.data?.url;

  if (!downloadUrl) {
    throw new Error("ECDA preschool location download URL missing.");
  }

  const geoResponse = await fetch(downloadUrl);

  if (!geoResponse.ok) {
    throw new Error("ECDA preschool location download failed.");
  }

  const geoPayload = (await geoResponse.json()) as GeoJsonResponse;
  const locations = new Map<string, { latitude: number | null; longitude: number | null }>();

  for (const feature of geoPayload.features ?? []) {
    const props = feature.properties ?? {};
    const name = String(props.name ?? props.NAME ?? "").trim();
    const postalCode = String(
      props.addresspostalcode ??
        props.ADDRESSPOSTALCODE ??
        props.postal_code ??
        ""
    ).trim();

    if (!name || !postalCode) {
      continue;
    }

    const coordinates = feature.geometry?.coordinates;
    locations.set(buildSchoolKey(name, postalCode), {
      longitude: coordinates?.[0] ?? null,
      latitude: coordinates?.[1] ?? null
    });
  }

  return locations;
}

function deriveVacancyStatus(record: CentresRecord) {
  const values = [
    record.infant_vacancy_current_month,
    record.pg_vacancy_current_month,
    record.n1_vacancy_current_month,
    record.n2_vacancy_current_month,
    record.k1_vacancy_current_month,
    record.k2_vacancy_current_month
  ]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

  if (values.some((value) => /available/i.test(value))) {
    return "Available";
  }

  if (values.some((value) => /limited/i.test(value))) {
    return "Limited";
  }

  if (values.some((value) => /full/i.test(value))) {
    return "Full";
  }

  return null;
}

export async function fetchAndStoreEcdaData(): Promise<void> {
  const [centres, services, locations] = await Promise.all([
    fetchAllDatastoreRecords<CentresRecord>(LISTING_OF_CENTRES_DATASET_ID),
    fetchAllDatastoreRecords<ServicesRecord>(LISTING_OF_CENTRE_SERVICES_DATASET_ID),
    fetchLocations()
  ]);

  const servicesByCentreCode = new Map<string, ServicesRecord[]>();

  for (const record of services) {
    const centreCode = record.centre_code?.trim();
    if (!centreCode) {
      continue;
    }
    const bucket = servicesByCentreCode.get(centreCode) ?? [];
    bucket.push(record);
    servicesByCentreCode.set(centreCode, bucket);
  }

  const schools: BaseSchool[] = centres
    .filter((record) => record.centre_code && record.centre_name && record.postal_code)
    .map((record) => {
      const centreCode = record.centre_code!.trim();
      const name = record.centre_name!.trim();
      const postalCode = record.postal_code!.trim();
      const centreServices = servicesByCentreCode.get(centreCode) ?? [];
      const programmeLevels = Array.from(
        new Set(
          centreServices
            .map((item) => item.levels_offered?.trim())
            .filter(Boolean) as string[]
        )
      );
      const feeValues = centreServices
        .map((item) => Number.parseFloat(String(item.fees ?? "").replace(/[^\d.]/g, "")))
        .filter((value) => Number.isFinite(value));
      const location = locations.get(buildSchoolKey(name, postalCode));

      return {
        centreCode,
        name,
        address: record.centre_address?.trim() ?? "",
        postalCode,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        operator: record.organisation_description?.trim() ?? null,
        serviceModel: record.service_model?.trim() ?? null,
        programmeLevels,
        vacancyStatus: deriveVacancyStatus(record),
        contactNumber: record.centre_contact_no?.trim() ?? null,
        email: record.centre_email_address?.trim() ?? null,
        websiteUrl: record.centre_website?.trim() || null,
        languagesOffered: (record.second_languages_offered ?? "")
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean),
        monthlyFee: feeValues.length > 0 ? Math.min(...feeValues) : null
      };
    });

  upsertBaseSchools(schools);
}

