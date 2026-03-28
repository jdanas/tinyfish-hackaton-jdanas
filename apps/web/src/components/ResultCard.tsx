import type { ScoutRecommendation } from "../lib/api";

interface ResultCardProps {
  listing: ScoutRecommendation;
}

export function ResultCard({ listing }: ResultCardProps) {
  return (
    <article className="result-card">
      <div className="result-header">
        <div>
          <p className="eyebrow">{listing.vacancyStatus ?? "Preschool match"}</p>
          <h3>{listing.name}</h3>
        </div>
        <div className="score-pill">
          <span>match</span>
          <strong>{listing.highlights.length}</strong>
        </div>
      </div>

      <p className="blurb">{listing.reason}</p>

      <div className="metric-grid">
        <div>
          <span>Monthly fee</span>
          <strong>{listing.monthlyFee ? `S$${listing.monthlyFee}` : "Check school"}</strong>
        </div>
        <div>
          <span>Programme levels</span>
          <strong>{listing.programmeLevels.slice(0, 2).join(", ") || "See details"}</strong>
        </div>
        <div>
          <span>Vacancy</span>
          <strong>{listing.vacancyStatus ?? "Check directly"}</strong>
        </div>
      </div>

      <div className="tag-row">
        {listing.highlights.map((highlight) => (
          <span className="tag" key={highlight}>
            {highlight}
          </span>
        ))}
      </div>

      <p className="address-line">{listing.address}</p>
    </article>
  );
}
