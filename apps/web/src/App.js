import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ResultCard } from "./components/ResultCard";
import { SearchForm } from "./components/SearchForm";
import { refreshListings, searchListings } from "./lib/api";
export default function App() {
    const [results, setResults] = useState(null);
    const [refreshResult, setRefreshResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    async function runSearch(payload) {
        setLoading(true);
        setError(null);
        try {
            const response = await searchListings(payload);
            setResults(response);
        }
        catch (searchError) {
            setError(searchError instanceof Error ? searchError.message : "Unable to search listings.");
        }
        finally {
            setLoading(false);
        }
    }
    async function handleRefresh() {
        setRefreshing(true);
        setError(null);
        try {
            const response = await refreshListings();
            setRefreshResult(response);
            await runSearch({
                postalCode: "529508",
                subject: "Math",
                maxMonthlyFee: 320
            });
        }
        catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh listings.");
        }
        finally {
            setRefreshing(false);
        }
    }
    useEffect(() => {
        void runSearch({
            postalCode: "529508",
            subject: "Math",
            maxMonthlyFee: 320
        });
    }, []);
    return (_jsxs("main", { className: "page-shell", children: [_jsxs("section", { className: "hero-card", children: [_jsx("p", { className: "eyebrow", children: "Singapore tuition discovery" }), _jsx("h1", { children: "Find the best-value tuition centre near your home postal code." }), _jsx("p", { className: "hero-copy", children: "This prototype ranks centres by commute, cost, reviews, class size, and subject match, then adds an AI recommendation layer for busy parents." }), _jsx(SearchForm, { loading: loading, onSubmit: runSearch }), _jsxs("div", { className: "action-row", children: [_jsx("button", { className: "secondary-button", disabled: refreshing, onClick: handleRefresh, type: "button", children: refreshing ? "Refreshing..." : "Refresh scraped listings" }), results ? (_jsxs("p", { className: "status-line", children: ["Searching around ", _jsx("strong", { children: results.query.resolvedArea }), " for ", results.query.subject ?? "all subjects"] })) : null] }), refreshResult ? _jsx("p", { className: "notice", children: refreshResult.message }) : null, error ? _jsx("p", { className: "error-text", children: error }) : null] }), results ? (_jsxs("section", { className: "content-grid", children: [_jsxs("aside", { className: "insight-card", children: [_jsx("p", { className: "eyebrow", children: results.recommendation.generatedByAI ? "AI recommendation" : "Heuristic summary" }), _jsx("h2", { children: results.recommendation.summary }), _jsx("ul", { children: results.recommendation.highlights.map((highlight) => (_jsx("li", { children: highlight }, highlight))) }), _jsxs("p", { className: "meta-line", children: ["Model: ", results.recommendation.model] })] }), _jsx("section", { className: "results-column", children: results.listings.map((listing) => (_jsx(ResultCard, { listing: listing }, listing.id))) })] })) : null] }));
}
