async function request(path, init) {
    const response = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {})
        }
    });
    const data = (await response.json());
    if (!response.ok && "error" in data && data.error) {
        throw new Error(data.error);
    }
    return data;
}
export function searchListings(payload) {
    return request("/api/search", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}
export function refreshListings() {
    return request("/api/scrape/refresh", {
        method: "POST"
    });
}
