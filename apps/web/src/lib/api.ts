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

export interface EnrichTopMatchResponse {
  message: string;
  result: ScoutResult;
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
  type: "status" | "progress" | "preview" | "complete" | "failed";
  message: string;
  enriched?: number;
  streamingUrl?: string;
}

export interface EnrichTopLiveEvent {
  type: "status" | "progress" | "preview" | "complete" | "failed";
  message: string;
  streamingUrl?: string;
  result?: ScoutResult;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const data = (isJson && raw ? (JSON.parse(raw) as T & { error?: string }) : undefined);

  if (!response.ok) {
    if (data && "error" in data && data.error) {
      throw new Error(data.error);
    }

    throw new Error(
      raw || `Request failed with ${response.status} ${response.statusText}.`
    );
  }

  if (!data) {
    throw new Error(`Expected JSON response from ${path} but received ${contentType || "empty response"}.`);
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

export function enrichTopMatch(query: string) {
  return request<EnrichTopMatchResponse>("/api/scout/enrich-top", {
    method: "POST",
    body: JSON.stringify({ query })
  });
}

export function streamEnrichTopMatch(
  query: string,
  handlers: {
    onEvent: (event: EnrichTopLiveEvent) => void;
    onError: (message: string) => void;
    onDone: (result?: ScoutResult) => void;
  }
) {
  const source = new EventSource(`/api/scout/enrich-top/live?query=${encodeURIComponent(query)}`);

  source.addEventListener("status", (event) => {
    handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as EnrichTopLiveEvent);
  });

  source.addEventListener("progress", (event) => {
    handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as EnrichTopLiveEvent);
  });

  source.addEventListener("preview", (event) => {
    handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as EnrichTopLiveEvent);
  });

  source.addEventListener("complete", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as EnrichTopLiveEvent;
    handlers.onEvent(payload);
    source.close();
    handlers.onDone(payload.result);
  });

  source.addEventListener("failed", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as EnrichTopLiveEvent;
    handlers.onEvent({
      ...payload,
      type: "failed"
    });
    source.close();
    handlers.onError(payload.message);
  });

  source.onerror = () => {
    source.close();
    handlers.onError("Top match enrichment connection was interrupted.");
  };

  return () => source.close();
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

  source.addEventListener("preview", (event) => {
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
