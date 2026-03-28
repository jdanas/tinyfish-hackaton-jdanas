import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ResultCard } from "./components/ResultCard";
import { SearchForm } from "./components/SearchForm";
import { refreshBase, scout, streamEnrichmentLive } from "./lib/api";
import { parseSearchDraft } from "./lib/intent";
const defaultDraft = {
    brief: "",
    postalCode: "",
    subject: "",
    maxMonthlyFee: ""
};
export default function App() {
    const [results, setResults] = useState(null);
    const [refreshResult, setRefreshResult] = useState(null);
    const [intentSummary, setIntentSummary] = useState("");
    const [lastDraft, setLastDraft] = useState(null);
    const [enrichmentEvents, setEnrichmentEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    async function runSearch(draft) {
        setLoading(true);
        setError(null);
        try {
            const parsed = parseSearchDraft(draft);
            const response = await scout(parsed.query);
            setResults(response);
            setIntentSummary(parsed.summary);
            setLastDraft(draft);
        }
        catch (searchError) {
            setError(searchError instanceof Error ? searchError.message : "Unable to scout schools.");
        }
        finally {
            setLoading(false);
        }
    }
    async function runLiveEnrichmentRefresh() {
        setEnrichmentEvents([]);
        return await new Promise((resolve, reject) => {
            let completedPayload = null;
            const close = streamEnrichmentLive({
                onEvent: (event) => {
                    setEnrichmentEvents((current) => [...current, event]);
                    if (event.type === "complete") {
                        completedPayload = event;
                    }
                },
                onError: (message) => {
                    close();
                    reject(new Error(message));
                },
                onDone: () => {
                    close();
                    resolve({
                        message: completedPayload?.message ?? "Enrichment refresh completed."
                    });
                }
            });
        });
    }
    async function handleRefresh() {
        setRefreshing(true);
        setError(null);
        try {
            const baseResult = await refreshBase();
            const enrichmentResult = await runLiveEnrichmentRefresh();
            setRefreshResult({
                message: `${baseResult.message} ${enrichmentResult.message}`
            });
            if (lastDraft) {
                await runSearch(lastDraft);
            }
        }
        catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh school data.");
        }
        finally {
            setRefreshing(false);
        }
    }
    const leadRecommendation = results?.recommendations[0] ?? null;
    const backupRecommendation = results?.recommendations[1] ?? null;
    return (_jsxs("main", { className: "page-shell", children: [_jsxs("section", { className: "brand-banner", children: [_jsxs("div", { children: [_jsx("p", { className: "brand-mark", children: "Kiaskool" }), _jsx("p", { className: "brand-subtitle", children: "For the parent who wants every preschool decision to feel simpler." })] }), _jsxs("div", { className: "brand-badges", children: [_jsx("span", { children: "Singapore-first" }), _jsx("span", { children: "Intent-led" }), _jsx("span", { children: "Cache-backed scout" })] })] }), _jsxs("section", { className: "hero-card", children: [_jsx("p", { className: "eyebrow", children: "Singapore preschool discovery" }), _jsx("h1", { children: "Kiaskool turns a parent brief into a shortlist from cached school data." }), _jsx("p", { className: "hero-copy", children: "Search stays fast by querying the local school cache. Refresh pulls fresh ECDA base data first, then TinyFish enriches school websites in the background." }), _jsx(SearchForm, { initialValues: defaultDraft, loading: loading, onSubmit: runSearch }), _jsxs("div", { className: "action-row", children: [_jsx("button", { className: "secondary-button", disabled: refreshing || loading, onClick: handleRefresh, type: "button", children: refreshing ? "Refreshing..." : "Refresh scraped listings" }), results ? (_jsxs("p", { className: "status-line", children: ["Scout completed from cached schools for: ", _jsx("strong", { children: intentSummary })] })) : (_jsx("p", { className: "status-line", children: "Start with the student brief. Refresh data when you want newer school coverage." }))] }), refreshResult ? _jsx("p", { className: "notice", children: refreshResult.message }) : null, error ? _jsx("p", { className: "error-text", children: error }) : null] }), enrichmentEvents.length > 0 ? (_jsxs("section", { className: "scrape-panel", children: [_jsxs("div", { className: "scrape-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "TinyFish enrichment refresh" }), _jsx("h2", { children: "Live website enrichment is running." })] }), _jsxs("p", { className: "scrape-count", children: [enrichmentEvents.length, " updates"] })] }), _jsx("div", { className: "scrape-feed", children: enrichmentEvents.map((event, index) => (_jsxs("article", { className: `scrape-event scrape-${event.type}`, children: [_jsx("p", { className: "scrape-type", children: event.type }), _jsx("p", { className: "scrape-message", children: event.message })] }, `${event.type}-${index}-${event.message}`))) })] })) : null, results ? (_jsxs("section", { className: "content-grid", children: [_jsxs("aside", { className: "insight-card", children: [_jsx("p", { className: "eyebrow", children: "Kiaskool decision" }), _jsx("div", { className: "decision-badge", children: "1 clear winner" }), _jsx("h2", { children: leadRecommendation ? `Best match: ${leadRecommendation.name}` : "No strong match yet" }), _jsx("p", { className: "decision-subheadline", children: leadRecommendation?.reason ?? "No preschool matched this brief closely enough." }), _jsxs("p", { className: "intent-summary", children: ["You asked for: ", intentSummary || "No brief provided yet."] }), _jsx("div", { className: "intent-tag-row", children: Object.entries(results.filters).map(([key, value]) => (_jsx("span", { className: "intent-tag", children: `${key}: ${Array.isArray(value) ? value.join(", ") : value}` }, key))) }), _jsx("div", { className: "fit-pill", children: leadRecommendation?.programmeLevels.length
                                    ? `Programme fit: ${leadRecommendation.programmeLevels.slice(0, 2).join(", ")}`
                                    : "Programme fit derived from ECDA data" }), _jsx("ul", { className: "proof-list", children: (leadRecommendation?.highlights ?? ["Refresh base and enrichment data for a fuller shortlist."]).map((point) => (_jsx("li", { children: point }, point))) }), _jsxs("div", { className: "backup-card", children: [_jsx("p", { className: "backup-label", children: "Backup option" }), _jsx("p", { children: backupRecommendation ? `${backupRecommendation.name}: ${backupRecommendation.reason}` : "No backup recommendation yet." })] }), _jsx("p", { className: "action-note", children: leadRecommendation ? "Review the top recommendation first, then compare one backup only." : "Try a more specific parent brief or refresh the data cache." })] }), _jsx("section", { className: "results-column", children: results.recommendations.map((listing) => (_jsx(ResultCard, { listing: listing }, `${listing.name}-${listing.address}`))) })] })) : (_jsxs("section", { className: "empty-state-card", children: [_jsx("p", { className: "eyebrow", children: "How it works" }), _jsx("h2", { children: "Describe the child\u2019s needs first. Kiaskool scouts the cache, not the live web." }), _jsx("p", { children: "ECDA base data fills the school cache. TinyFish adds website enrichment only during refresh. Search stays fast because the scout agent reads SQLite, not a live scrape." })] }))] }));
}
