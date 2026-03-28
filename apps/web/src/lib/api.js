async function request(path, init) {
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
    const data = (isJson && raw ? JSON.parse(raw) : undefined);
    if (!response.ok) {
        if (data && "error" in data && data.error) {
            throw new Error(data.error);
        }
        throw new Error(raw || `Request failed with ${response.status} ${response.statusText}.`);
    }
    if (!data) {
        throw new Error(`Expected JSON response from ${path} but received ${contentType || "empty response"}.`);
    }
    return data;
}
export function scout(query) {
    return request("/api/scout", {
        method: "POST",
        body: JSON.stringify({ query })
    });
}
export function refreshBase() {
    return request("/api/refresh/base", {
        method: "POST"
    });
}
export function refreshEnrichment() {
    return request("/api/refresh/enrichment", {
        method: "POST"
    });
}
export function getSchools() {
    return request("/api/schools");
}
export function streamEnrichmentLive(handlers) {
    const source = new EventSource("/api/refresh/enrichment/live");
    source.addEventListener("status", (event) => {
        handlers.onEvent(JSON.parse(event.data));
    });
    source.addEventListener("progress", (event) => {
        handlers.onEvent(JSON.parse(event.data));
    });
    source.addEventListener("complete", (event) => {
        handlers.onEvent(JSON.parse(event.data));
        source.close();
        handlers.onDone();
    });
    source.addEventListener("failed", (event) => {
        const payload = JSON.parse(event.data);
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
