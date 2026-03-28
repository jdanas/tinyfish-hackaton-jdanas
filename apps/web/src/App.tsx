import { useState } from "react";
import { ResultCard } from "./components/ResultCard";
import { SearchForm, type SearchDraft } from "./components/SearchForm";
import {
  refreshBase,
  scout,
  streamEnrichmentLive,
  type EnrichmentLiveEvent,
  type RefreshBaseResponse,
  type ScoutResult,
} from "./lib/api";
import { parseSearchDraft } from "./lib/intent";

const defaultDraft: SearchDraft = {
  brief: "",
  postalCode: "",
  subject: "",
  maxMonthlyFee: "",
};

export default function App() {
  const [results, setResults] = useState<ScoutResult | null>(null);
  const [refreshResult, setRefreshResult] = useState<
    RefreshBaseResponse | { message: string } | null
  >(null);
  const [intentSummary, setIntentSummary] = useState("");
  const [lastDraft, setLastDraft] = useState<SearchDraft | null>(null);
  const [enrichmentEvents, setEnrichmentEvents] = useState<
    EnrichmentLiveEvent[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(draft: SearchDraft) {
    setLoading(true);
    setError(null);

    try {
      const parsed = parseSearchDraft(draft);
      const response = await scout(parsed.query);
      setResults(response);
      setIntentSummary(parsed.summary);
      setLastDraft(draft);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to scout schools.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runLiveEnrichmentRefresh() {
    setEnrichmentEvents([]);

    return await new Promise<{ message: string }>((resolve, reject) => {
      let completedPayload: EnrichmentLiveEvent | null = null;

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
            message:
              completedPayload?.message ?? "Enrichment refresh completed.",
          });
        },
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
        message: `${baseResult.message} ${enrichmentResult.message}`,
      });

      if (lastDraft) {
        await runSearch(lastDraft);
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh school data.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const leadRecommendation = results?.recommendations[0] ?? null;
  const backupRecommendation = results?.recommendations[1] ?? null;

  return (
    <main className="page-shell">
      <section className="brand-banner">
        <div>
          <p className="brand-mark">Kiaskool</p>
          <p className="brand-subtitle">
            For the parent who wants every preschool decision to feel simpler.
          </p>
        </div>
        <div className="brand-badges">
          <span>Singapore-first</span>
          <span>Intent-led</span>
          <span>Cache-backed scout</span>
        </div>
      </section>

      <section className="hero-card">
        <p className="eyebrow">Singapore preschool discovery</p>
        <h1>
          Kiaskool scouts the right tuition centre before parents start
          stress-scrolling..
        </h1>
        <p className="hero-copy">
          Search stays fast by querying the local school cache. Refresh pulls
          fresh ECDA base data first, then TinyFish enriches school websites in
          the background.
        </p>

        <SearchForm
          initialValues={defaultDraft}
          loading={loading}
          onSubmit={runSearch}
        />

        <div className="action-row">
          <button
            className="secondary-button"
            disabled={refreshing || loading}
            onClick={handleRefresh}
            type="button"
          >
            {refreshing ? "Refreshing..." : "Refresh scraped listings"}
          </button>
          {results ? (
            <p className="status-line">
              Scout completed from cached schools for:{" "}
              <strong>{intentSummary}</strong>
            </p>
          ) : (
            <p className="status-line">
              Start with the student brief. Refresh data when you want newer
              school coverage.
            </p>
          )}
        </div>

        {refreshResult ? (
          <p className="notice">{refreshResult.message}</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {enrichmentEvents.length > 0 ? (
        <section className="scrape-panel">
          <div className="scrape-header">
            <div>
              <p className="eyebrow">TinyFish enrichment refresh</p>
              <h2>Live website enrichment is running.</h2>
            </div>
            <p className="scrape-count">{enrichmentEvents.length} updates</p>
          </div>
          <div className="scrape-feed">
            {enrichmentEvents.map((event, index) => (
              <article
                className={`scrape-event scrape-${event.type}`}
                key={`${event.type}-${index}-${event.message}`}
              >
                <p className="scrape-type">{event.type}</p>
                <p className="scrape-message">{event.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {results ? (
        <section className="content-grid">
          <aside className="insight-card">
            <p className="eyebrow">Kiaskool decision</p>
            <div className="decision-badge">1 clear winner</div>
            <h2>
              {leadRecommendation
                ? `Best match: ${leadRecommendation.name}`
                : "No strong match yet"}
            </h2>
            <p className="decision-subheadline">
              {leadRecommendation?.reason ??
                "No preschool matched this brief closely enough."}
            </p>
            <p className="intent-summary">
              You asked for: {intentSummary || "No brief provided yet."}
            </p>
            <div className="intent-tag-row">
              {Object.entries(results.filters).map(([key, value]) => (
                <span className="intent-tag" key={key}>
                  {`${key}: ${Array.isArray(value) ? value.join(", ") : value}`}
                </span>
              ))}
            </div>
            <div className="fit-pill">
              {leadRecommendation?.programmeLevels.length
                ? `Programme fit: ${leadRecommendation.programmeLevels.slice(0, 2).join(", ")}`
                : "Programme fit derived from ECDA data"}
            </div>
            <ul className="proof-list">
              {(
                leadRecommendation?.highlights ?? [
                  "Refresh base and enrichment data for a fuller shortlist.",
                ]
              ).map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="backup-card">
              <p className="backup-label">Backup option</p>
              <p>
                {backupRecommendation
                  ? `${backupRecommendation.name}: ${backupRecommendation.reason}`
                  : "No backup recommendation yet."}
              </p>
            </div>
            <p className="action-note">
              {leadRecommendation
                ? "Review the top recommendation first, then compare one backup only."
                : "Try a more specific parent brief or refresh the data cache."}
            </p>
          </aside>

          <section className="results-column">
            {results.recommendations.map((listing) => (
              <ResultCard
                key={`${listing.name}-${listing.address}`}
                listing={listing}
              />
            ))}
          </section>
        </section>
      ) : (
        <section className="empty-state-card">
          <p className="eyebrow">How it works</p>
          <h2>
            Describe the child’s needs first. Kiaskool scouts the cache, not the
            live web.
          </h2>
          <p>
            ECDA base data fills the school cache. TinyFish adds website
            enrichment only during refresh. Search stays fast because the scout
            agent reads SQLite, not a live scrape.
          </p>
        </section>
      )}
    </main>
  );
}
