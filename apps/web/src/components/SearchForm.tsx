import { FormEvent, useState } from "react";
import type { SearchPayload } from "../lib/api";

interface SearchFormProps {
  loading: boolean;
  onSubmit: (payload: SearchPayload) => Promise<void>;
}

export function SearchForm({ loading, onSubmit }: SearchFormProps) {
  const [postalCode, setPostalCode] = useState("529508");
  const [subject, setSubject] = useState("Math");
  const [maxMonthlyFee, setMaxMonthlyFee] = useState("320");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      postalCode,
      subject: subject.trim() || undefined,
      maxMonthlyFee: maxMonthlyFee ? Number(maxMonthlyFee) : undefined
    });
  }

  return (
    <form className="search-panel" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="postalCode">Postal code</label>
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
        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          placeholder="Math"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="maxMonthlyFee">Budget cap (S$/month)</label>
        <input
          id="maxMonthlyFee"
          inputMode="numeric"
          placeholder="320"
          value={maxMonthlyFee}
          onChange={(event) => setMaxMonthlyFee(event.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
      <button className="primary-button" disabled={loading} type="submit">
        {loading ? "Ranking..." : "Find best value"}
      </button>
    </form>
  );
}

