import { useState } from "react";
import { ResultCard } from "./components/ResultCard";
import { SearchForm, type SearchDraft } from "./components/SearchForm";
import { refreshListings, searchListings, type RefreshResponse, type SearchResponse } from "./lib/api";
import { parseSearchDraft } from "./lib/intent";

const defaultDraft: SearchDraft = {
  brief: "My P6 child needs affordable math tuition near Tampines with good reviews and a monthly budget below $320.",
  postalCode: "529508",
  subject: "Math",
  maxMonthlyFee: "320"
};

export default function App() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [refreshResult, setRefreshResult] = useState<RefreshResponse | null>(null);
  const [intentSummary, setIntentSummary] = useState(defaultDraft.brief);
  const [intentTags, setIntentTags] = useState<string[]>([]);
  const [lastDraft, setLastDraft] = useState<SearchDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compactIntent =
    intentSummary.length > 88 ? `${intentSummary.slice(0, 85).trimEnd()}...` : intentSummary;

  async function runSearch(draft: SearchDraft) {
    setLoading(true);
    setError(null);

    try {
      const parsed = parseSearchDraft(draft);
      const response = await searchListings(parsed.payload);
      setResults(response);
      setIntentSummary(parsed.summary);
      setIntentTags(parsed.tags);
      setLastDraft(draft);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to search listings.");
    } finally {
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
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh listings.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="brand-banner">
        <div>
          <p className="brand-mark">Kiaskool</p>
          <p className="brand-subtitle">For the parent who wants every tuition dollar to work harder.</p>
        </div>
        <div className="brand-badges">
          <span>Singapore-first</span>
          <span>Kiasu but rational</span>
          <span>AI shortlist scout</span>
        </div>
      </section>

      <section className="hero-card">
        <p className="eyebrow">Singapore tuition discovery, sharpened</p>
        <h1>Kiaskool scouts the right tuition centre before parents start stress-scrolling.</h1>
        <p className="hero-copy">
          Start with a natural-language brief on what the child needs. Kiaskool interprets the intent first, then lets
          parents open up postal code, budget, and subject filters only if they want more control.
        </p>

        <SearchForm initialValues={defaultDraft} loading={loading} onSubmit={runSearch} />

        <div className="action-row">
          <button className="secondary-button" disabled={refreshing} onClick={handleRefresh} type="button">
            {refreshing ? "Refreshing..." : "Refresh scraped listings"}
          </button>
          {results ? (
            <p className="status-line">
              Scouting around <strong>{results.query.resolvedArea}</strong> for {results.query.subject ?? "all subjects"}
            </p>
          ) : (
            <p className="status-line">Start with the student brief. Fine-grain filters are optional.</p>
          )}
        </div>

        {refreshResult ? <p className="notice">{refreshResult.message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {results ? (
        <section className="content-grid">
          <aside className="insight-card">
            <p className="eyebrow">{results.recommendation.generatedByAI ? "Kiaskool decision" : "Kiaskool quick pick"}</p>
            <div className="decision-badge">1 clear winner</div>
            <h2>{results.recommendation.headline}</h2>
            <p className="decision-subheadline">{results.recommendation.subheadline}</p>
            <p className="intent-summary">You asked for: {compactIntent}</p>
            <div className="intent-tag-row">
              {intentTags.map((tag) => (
                <span className="intent-tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="fit-pill">{results.recommendation.whyThisFits}</div>
            <ul className="proof-list">
              {results.recommendation.proofPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="backup-card">
              <p className="backup-label">Backup option</p>
              <p>{results.recommendation.backupOption}</p>
            </div>
            <p className="action-note">{results.recommendation.primaryActionNote}</p>
            <p className="meta-line">Model: {results.recommendation.model}</p>
          </aside>

          <section className="results-column">
            {results.listings.map((listing) => (
              <ResultCard key={listing.id} listing={listing} />
            ))}
          </section>
        </section>
      ) : (
        <section className="empty-state-card">
          <p className="eyebrow">How it works</p>
          <h2>Describe the student's needs first. Kiaskool turns that into the search direction.</h2>
          <p>
            The current app infers subject, area, and budget from the brief, then ranks tuition centres. The next
            backend step is to pass the same intent into the TinyFish scrape planner so data collection follows the
            parent's actual wording.
          </p>
        </section>
      )}
    </main>
  );
}
