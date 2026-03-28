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
  filters: {
    locationPreference?: string;
    programmeLevel?: string[];
    curriculumStyle?: string[];
    language?: string[];
    enrichment?: string[];
  };
  recommendations: ScoutRecommendation[];
}

export interface RefreshBaseResponse {
  message: string;
  schools: number;
}

export interface RefreshEnrichmentResponse {
  message: string;
}

export interface SchoolDebug {
  centreCode: string;
  name: string;
  address: string;
  postalCode: string;
  programmeLevels: string[];
  vacancyStatus: string | null;
  websiteUrl: string | null;
  curriculumStyle: string | null;
  enrichmentProgrammes: string[];
}

export interface EnrichmentLiveEvent {
  type: "status" | "progress" | "complete" | "failed";
  message: string;
  enriched?: number;
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

  if (!response.ok && data.error) {
    throw new Error(data.error);
  }

  return data;
}

export function scout(query: string) {
  return request<ScoutResult>("/api/scout", {
    method: "POST",
    body: JSON.stringify({ query })
  });
}

export function refreshBase() {
  return request<RefreshBaseResponse>("/api/refresh/base", {
    method: "POST"
  });
}

export function refreshEnrichment() {
  return request<RefreshEnrichmentResponse>("/api/refresh/enrichment", {
    method: "POST"
  });
}

export function getSchools() {
  return request<{ schools: SchoolDebug[] }>("/api/schools");
}

export function streamEnrichmentLive(
  handlers: {
    onEvent: (event: EnrichmentLiveEvent) => void;
    onError: (message: string) => void;
    onDone: () => void;
  }
) {
  const source = new EventSource("/api/refresh/enrichment/live");

  source.addEventListener("status", (event) => {
    handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as EnrichmentLiveEvent);
  });

  source.addEventListener("progress", (event) => {
    handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as EnrichmentLiveEvent);
  });

  source.addEventListener("complete", (event) => {
    handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as EnrichmentLiveEvent);
    source.close();
    handlers.onDone();
  });

  source.addEventListener("failed", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as EnrichmentLiveEvent;
    handlers.onEvent({
      ...payload,
      type: "failed"
    });
    source.close();
    handlers.onError(payload.message);
  });

  source.onerror = () => {
    source.close();
    handlers.onError("Live enrichment connection was interrupted.");
  };

  return () => source.close();
}

