/**
 * ECDA/data.gov.sg ingestion layer. Fetches official preschool datasets and stores normalized base rows.
 */
import { upsertBaseSchools } from "./schoolStore.js";
import { config } from "../config.js";
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

type DatasetRowsResponse<T> = {
  code?: number;
  errorMsg?: string;
  data?: {
    rows?: T[];
    links?: {
      next?: string;
    };
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

const MAX_RETRIES = 4;

function buildRequestInit(init?: RequestInit): RequestInit | undefined {
  const headers = new Headers(init?.headers);

  if (config.dataGovApiKey) {
    headers.set("x-api-key", config.dataGovApiKey);
  }

  return {
    ...init,
    headers
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonResponse<T>(response: Response, context: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `${context} returned non-JSON content (${contentType || "unknown"}): ${raw.slice(0, 200)}`
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `${context} returned invalid JSON: ${error instanceof Error ? error.message : "parse failure"}`
    );
  }
}

async function fetchWithRetry(url: string, context: string, init?: RequestInit): Promise<Response> {
  let attempt = 0;
  const requestInit = buildRequestInit(init);

  while (true) {
    const response = await fetch(url, requestInit);

    if (response.status !== 429) {
      return response;
    }

    attempt += 1;

    if (attempt > MAX_RETRIES) {
      throw new Error(`${context} hit rate limits after ${MAX_RETRIES} retries.`);
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    const backoffMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000 * 2 ** (attempt - 1);

    console.warn(`[ECDA] 429 rate limit on ${context}. Retrying in ${backoffMs}ms (attempt ${attempt}/${MAX_RETRIES}).`);
    await delay(backoffMs);
  }
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSchoolKey(name: string, postalCode: string) {
  return `${normalizeText(name)}::${postalCode}`;
}

async function fetchAllDatastoreRecords<T>(datasetId: string): Promise<T[]> {
  try {
    return await fetchViaDatastoreSearch<T>(datasetId);
  } catch (primaryError) {
    console.warn(
      `[ECDA] datastore_search failed for ${datasetId}, falling back to list-rows:`,
      primaryError
    );
    return fetchViaListRows<T>(datasetId);
  }
}

async function fetchViaDatastoreSearch<T>(datasetId: string): Promise<T[]> {
  const records: T[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${datasetId}&limit=${limit}&offset=${offset}`;
    const response = await fetchWithRetry(
      url,
      `ECDA datastore_search ${datasetId}`
    );

    if (!response.ok) {
      throw new Error(
        `ECDA datastore_search failed for ${datasetId} with ${response.status} ${response.statusText}.`
      );
    }

    const payload = await parseJsonResponse<DatastoreResponse<T>>(
      response,
      `ECDA datastore_search ${datasetId}`
    );
    const batch = payload.result?.records ?? [];
    records.push(...batch);

    if (batch.length < limit) {
      break;
    }

    offset += limit;
  }

  return records;
}

async function fetchViaListRows<T>(datasetId: string): Promise<T[]> {
  const records: T[] = [];
  let nextUrl:
    | string
    | null = `https://api-production.data.gov.sg/v2/public/api/datasets/${encodeURIComponent(datasetId)}/list-rows`;

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, `ECDA list-rows ${datasetId}`, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `ECDA list-rows failed for ${datasetId} with ${response.status} ${response.statusText}.`
      );
    }

    const payload = await parseJsonResponse<DatasetRowsResponse<T>>(
      response,
      `ECDA list-rows ${datasetId}`
    );

    if (payload.code && payload.code !== 1) {
      throw new Error(
        payload.errorMsg || `ECDA list-rows returned error code ${payload.code} for ${datasetId}.`
      );
    }

    records.push(...(payload.data?.rows ?? []));

    const next = payload.data?.links?.next;
    nextUrl = next
      ? next.startsWith("http")
        ? next
        : `https://api-production.data.gov.sg${next}`
      : null;
  }

  return records;
}

async function fetchLocations(): Promise<Map<string, { latitude: number | null; longitude: number | null }>> {
  const pollResponse = await fetchWithRetry(
    `https://api-open.data.gov.sg/v1/public/api/datasets/${PRESCHOOLS_LOCATION_DATASET_ID}/poll-download`,
    `ECDA poll-download ${PRESCHOOLS_LOCATION_DATASET_ID}`
  );

  if (!pollResponse.ok) {
    throw new Error("ECDA preschool location poll-download failed.");
  }

  const pollPayload = await parseJsonResponse<PollDownloadResponse>(
    pollResponse,
    `ECDA poll-download ${PRESCHOOLS_LOCATION_DATASET_ID}`
  );
  const downloadUrl = pollPayload.data?.url;

  if (!downloadUrl) {
    throw new Error("ECDA preschool location download URL missing.");
  }

  const geoResponse = await fetchWithRetry(
    downloadUrl,
    `ECDA location download ${PRESCHOOLS_LOCATION_DATASET_ID}`
  );

  if (!geoResponse.ok) {
    throw new Error("ECDA preschool location download failed.");
  }

  const geoPayload = await parseJsonResponse<GeoJsonResponse>(
    geoResponse,
    `ECDA location download ${PRESCHOOLS_LOCATION_DATASET_ID}`
  );
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
  const centres = await fetchAllDatastoreRecords<CentresRecord>(LISTING_OF_CENTRES_DATASET_ID);
  const services = await fetchAllDatastoreRecords<ServicesRecord>(LISTING_OF_CENTRE_SERVICES_DATASET_ID);
  const locations = await fetchLocations();

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
