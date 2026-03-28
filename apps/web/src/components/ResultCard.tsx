import type { SearchResponse } from "../lib/api";

interface ResultCardProps {
  listing: SearchResponse["listings"][number];
}

export function ResultCard({ listing }: ResultCardProps) {
  return (
    <article className="result-card">
      <div className="result-header">
        <div>
          <p className="eyebrow">{listing.area}</p>
          <h3>{listing.name}</h3>
        </div>
        <div className="score-pill">
          <span>kiascore</span>
          <strong>{listing.valueScore}</strong>
        </div>
      </div>

      <p className="blurb">{listing.parentBlurb}</p>

      <div className="metric-grid">
        <div>
          <span>Monthly fee</span>
          <strong>S${listing.monthlyFee}</strong>
        </div>
        <div>
          <span>Distance</span>
          <strong>{listing.distanceKm} km</strong>
        </div>
        <div>
          <span>Rating</span>
          <strong>
            {listing.rating}/5 ({listing.reviewCount})
          </strong>
        </div>
        <div>
          <span>Class size</span>
          <strong>{listing.classSize} students</strong>
        </div>
      </div>

      <div className="tag-row">
        {listing.subjects.map((subject) => (
          <span className="tag" key={subject}>
            {subject}
          </span>
        ))}
        {listing.tags.map((tag) => (
          <span className="tag tag-muted" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <p className="address-line">{listing.address}</p>

      <dl className="breakdown">
        <div>
          <dt>Affordability</dt>
          <dd>{listing.scoreBreakdown.affordability}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{listing.scoreBreakdown.distance}</dd>
        </div>
        <div>
          <dt>Reviews</dt>
          <dd>{listing.scoreBreakdown.reviews}</dd>
        </div>
        <div>
          <dt>Class size</dt>
          <dd>{listing.scoreBreakdown.classSize}</dd>
        </div>
        <div>
          <dt>Subject fit</dt>
          <dd>{listing.scoreBreakdown.relevance}</dd>
        </div>
      </dl>
    </article>
  );
}
