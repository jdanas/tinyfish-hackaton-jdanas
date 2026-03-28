import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ResultCard } from "./components/ResultCard";
import { SearchForm } from "./components/SearchForm";
import { refreshListings, searchListings } from "./lib/api";
import { parseSearchDraft } from "./lib/intent";
const defaultDraft = {
    brief: "My P6 child needs affordable math tuition near Tampines with good reviews and a monthly budget below $320.",
    postalCode: "",
    subject: "",
    maxMonthlyFee: ""
};
export default function App() {
    const [results, setResults] = useState(null);
    const [refreshResult, setRefreshResult] = useState(null);
    const [intentSummary, setIntentSummary] = useState(defaultDraft.brief);
    const [intentTags, setIntentTags] = useState([]);
    const [lastDraft, setLastDraft] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const compactIntent = intentSummary.length > 88 ? `${intentSummary.slice(0, 85).trimEnd()}...` : intentSummary;
    async function runSearch(draft) {
        setLoading(true);
        setError(null);
        try {
            const parsed = parseSearchDraft(draft);
            const response = await searchListings(parsed.payload);
            setResults(response);
            setIntentSummary(parsed.summary);
            setIntentTags(parsed.tags);
            setLastDraft(draft);
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
            if (lastDraft) {
                await runSearch(lastDraft);
            }
        }
        catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh listings.");
        }
        finally {
            setRefreshing(false);
        }
    }
    return (_jsxs("main", { className: "page-shell", children: [_jsxs("section", { className: "brand-banner", children: [_jsxs("div", { children: [_jsx("p", { className: "brand-mark", children: "Kiaskool" }), _jsx("p", { className: "brand-subtitle", children: "For the parent who wants every tuition dollar to work harder." })] }), _jsxs("div", { className: "brand-badges", children: [_jsx("span", { children: "Singapore-first" }), _jsx("span", { children: "Kiasu but rational" }), _jsx("span", { children: "AI shortlist scout" })] })] }), _jsxs("section", { className: "hero-card", children: [_jsx("p", { className: "eyebrow", children: "Singapore tuition discovery, sharpened" }), _jsx("h1", { children: "Kiaskool scouts the right tuition centre before parents start stress-scrolling." }), _jsx("p", { className: "hero-copy", children: "Start with a natural-language brief on what the child needs. Kiaskool interprets the intent first, then lets parents open up postal code, budget, and subject filters only if they want more control." }), _jsx(SearchForm, { initialValues: defaultDraft, loading: loading, onSubmit: runSearch }), _jsxs("div", { className: "action-row", children: [_jsx("button", { className: "secondary-button", disabled: refreshing, onClick: handleRefresh, type: "button", children: refreshing ? "Refreshing..." : "Refresh scraped listings" }), results ? (_jsxs("p", { className: "status-line", children: ["Scouting around ", _jsx("strong", { children: results.query.resolvedArea }), " for ", results.query.subject ?? "all subjects"] })) : (_jsx("p", { className: "status-line", children: "Start with the student brief. Fine-grain filters are optional." }))] }), refreshResult ? _jsx("p", { className: "notice", children: refreshResult.message }) : null, error ? _jsx("p", { className: "error-text", children: error }) : null] }), results ? (_jsxs("section", { className: "content-grid", children: [_jsxs("aside", { className: "insight-card", children: [_jsx("p", { className: "eyebrow", children: results.recommendation.generatedByAI ? "Kiaskool decision" : "Kiaskool quick pick" }), _jsx("div", { className: "decision-badge", children: "1 clear winner" }), _jsx("h2", { children: results.recommendation.headline }), _jsx("p", { className: "decision-subheadline", children: results.recommendation.subheadline }), _jsxs("p", { className: "intent-summary", children: ["You asked for: ", compactIntent] }), _jsx("div", { className: "intent-tag-row", children: intentTags.map((tag) => (_jsx("span", { className: "intent-tag", children: tag }, tag))) }), _jsx("div", { className: "fit-pill", children: results.recommendation.whyThisFits }), _jsx("ul", { className: "proof-list", children: results.recommendation.proofPoints.map((point) => (_jsx("li", { children: point }, point))) }), _jsxs("div", { className: "backup-card", children: [_jsx("p", { className: "backup-label", children: "Backup option" }), _jsx("p", { children: results.recommendation.backupOption })] }), _jsx("p", { className: "action-note", children: results.recommendation.primaryActionNote }), _jsxs("p", { className: "meta-line", children: ["Model: ", results.recommendation.model] })] }), _jsx("section", { className: "results-column", children: results.listings.map((listing) => (_jsx(ResultCard, { listing: listing }, listing.id))) })] })) : (_jsxs("section", { className: "empty-state-card", children: [_jsx("p", { className: "eyebrow", children: "How it works" }), _jsx("h2", { children: "Describe the student's needs first. Kiaskool turns that into the search direction." }), _jsx("p", { children: "The current app infers subject, area, and budget from the brief, then ranks tuition centres. The next backend step is to pass the same intent into the TinyFish scrape planner so data collection follows the parent's actual wording." })] }))] }));
}
