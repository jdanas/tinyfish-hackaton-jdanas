import { FormEvent, useState } from "react";

export interface SearchDraft {
  brief: string;
  postalCode: string;
  subject: string;
  maxMonthlyFee: string;
}

interface SearchFormProps {
  loading: boolean;
  initialValues: SearchDraft;
  onSubmit: (draft: SearchDraft) => Promise<void>;
}

const quickPrompts = [
  "My P6 kid needs affordable math tuition near Tampines under $300",
  "Looking for small-group English tuition near Woodlands",
  "Need a science-focused centre with strong reviews around Bishan"
];

export function SearchForm({ loading, initialValues, onSubmit }: SearchFormProps) {
  const [brief, setBrief] = useState(initialValues.brief);
  const [postalCode, setPostalCode] = useState(initialValues.postalCode);
  const [subject, setSubject] = useState(initialValues.subject);
  const [maxMonthlyFee, setMaxMonthlyFee] = useState(initialValues.maxMonthlyFee);
  const [showFineTune, setShowFineTune] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      brief,
      postalCode,
      subject,
      maxMonthlyFee
    });
  }

  function applyPrompt(prompt: string) {
    setBrief(prompt);
  }

  return (
    <form className="search-stack" onSubmit={handleSubmit}>
      <div className="intent-panel">
        <label htmlFor="brief">Tell Kiaskool what the student needs</label>
        <textarea
          id="brief"
          placeholder="My Sec 2 child needs budget-friendly math tuition near the east side with small classes."
          rows={4}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
        />
        <p className="intent-helper">
          Kiaskool will turn this into a search brief for recommendations now, and later for TinyFish scraping queries.
        </p>
        <div className="prompt-row">
          {quickPrompts.map((prompt) => (
            <button className="prompt-chip" key={prompt} onClick={() => applyPrompt(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
        <div className="intent-actions">
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Scouting..." : "Scout from this brief"}
          </button>
          <button
            className="ghost-button"
            onClick={() => setShowFineTune((value) => !value)}
            type="button"
          >
            {showFineTune ? "Hide fine-grain filters" : "Fine-tune this search"}
          </button>
        </div>
      </div>

      <div className={`finegrain-panel ${showFineTune ? "is-open" : "is-collapsed"}`}>
        <div className="finegrain-header">
          <div>
            <p className="section-kicker">Fine-grain filters</p>
            <h2>Tighten the shortlist</h2>
          </div>
          <p className="finegrain-copy">Start with intent first, then anchor by postal code, subject, and monthly budget.</p>
        </div>

        <div className="search-panel">
          <div>
            <label htmlFor="postalCode">Postal code override</label>
            <input
              id="postalCode"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              pattern="\d{6}"
              placeholder="529508"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label htmlFor="subject">Subject override</label>
            <input
              id="subject"
              placeholder="Math"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="maxMonthlyFee">Budget override (S$/month)</label>
            <input
              id="maxMonthlyFee"
              inputMode="numeric"
              placeholder="320"
              value={maxMonthlyFee}
              onChange={(event) => setMaxMonthlyFee(event.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <button className="secondary-button" disabled={loading} type="submit">
            {loading ? "Scouting..." : "Scout with fine-tuning"}
          </button>
        </div>
      </div>
    </form>
  );
}
