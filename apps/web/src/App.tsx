import { useEffect, useState } from "react";
import { ResultCard } from "./components/ResultCard";
import { SearchForm } from "./components/SearchForm";
import { refreshListings, searchListings, type RefreshResponse, type SearchPayload, type SearchResponse } from "./lib/api";

export default function App() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [refreshResult, setRefreshResult] = useState<RefreshResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(payload: SearchPayload) {
    setLoading(true);
    setError(null);

    try {
      const response = await searchListings(payload);
      setResults(response);
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
      await runSearch({
        postalCode: "529508",
        subject: "Math",
        maxMonthlyFee: 320
      });
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh listings.");
    } finally {
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

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Singapore tuition discovery</p>
        <h1>Find the best-value tuition centre near your home postal code.</h1>
        <p className="hero-copy">
          This prototype ranks centres by commute, cost, reviews, class size, and subject match, then adds an AI
          recommendation layer for busy parents.
        </p>

        <SearchForm loading={loading} onSubmit={runSearch} />

        <div className="action-row">
          <button className="secondary-button" disabled={refreshing} onClick={handleRefresh} type="button">
            {refreshing ? "Refreshing..." : "Refresh scraped listings"}
          </button>
          {results ? (
            <p className="status-line">
              Searching around <strong>{results.query.resolvedArea}</strong> for {results.query.subject ?? "all subjects"}
            </p>
          ) : null}
        </div>

        {refreshResult ? <p className="notice">{refreshResult.message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {results ? (
        <section className="content-grid">
          <aside className="insight-card">
            <p className="eyebrow">{results.recommendation.generatedByAI ? "AI recommendation" : "Heuristic summary"}</p>
            <h2>{results.recommendation.summary}</h2>
            <ul>
              {results.recommendation.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
            <p className="meta-line">Model: {results.recommendation.model}</p>
          </aside>

          <section className="results-column">
            {results.listings.map((listing) => (
              <ResultCard key={listing.id} listing={listing} />
            ))}
          </section>
        </section>
      ) : null}
    </main>
  );
}

