import type { SearchPayload } from "./api";
import type { SearchDraft } from "../components/SearchForm";

export interface ParsedIntent {
  payload: SearchPayload;
  tags: string[];
  summary: string;
}

const subjectMatchers = [
  { pattern: /\bmath|mathematics|a[- ]?math|e[- ]?math\b/i, value: "Math" },
  { pattern: /\benglish|composition|writing\b/i, value: "English" },
  { pattern: /\bscience|physics|chemistry|biology\b/i, value: "Science" },
  { pattern: /\bchinese|mandarin\b/i, value: "Chinese" },
  { pattern: /\bcoding|programming|stem\b/i, value: "Coding" }
];

const areaHints = [
  { pattern: /\btampines|east\b/i, postalCode: "529508", label: "east side" },
  { pattern: /\bbishan|central\b/i, postalCode: "579837", label: "central area" },
  { pattern: /\bjurong|west\b/i, postalCode: "600135", label: "west side" },
  { pattern: /\bwoodlands|north\b/i, postalCode: "730888", label: "north side" },
  { pattern: /\bpunggol|northeast|north-east\b/i, postalCode: "828761", label: "north-east" }
];

function inferSubject(brief: string, fallback: string): string | undefined {
  const match = subjectMatchers.find((item) => item.pattern.test(brief));
  return match?.value ?? (fallback.trim() || undefined);
}

function inferPostalCode(brief: string, fallback: string): string {
  const explicitPostal = brief.match(/\b\d{6}\b/);

  if (explicitPostal) {
    return explicitPostal[0];
  }

  const areaMatch = areaHints.find((item) => item.pattern.test(brief));

  if (areaMatch) {
    return areaMatch.postalCode;
  }

  if (fallback.trim().length === 6) {
    return fallback.trim();
  }

  return "529508";
}

function inferBudget(brief: string, fallback: string): number | undefined {
  const moneyMatch = brief.match(/\$?\s?(\d{2,4})/);

  if (fallback.trim()) {
    return Number(fallback);
  }

  if (!moneyMatch) {
    return undefined;
  }

  return Number(moneyMatch[1]);
}

export function parseSearchDraft(draft: SearchDraft): ParsedIntent {
  const brief = draft.brief.trim();
  const postalCode = inferPostalCode(brief, draft.postalCode);
  const subject = inferSubject(brief, draft.subject);
  const maxMonthlyFee = inferBudget(brief, draft.maxMonthlyFee);
  const areaTag = areaHints.find((item) => item.pattern.test(brief))?.label;

  const tags = [
    subject ? `Subject: ${subject}` : null,
    postalCode ? `Near: ${postalCode}` : null,
    maxMonthlyFee ? `Budget: <= S$${maxMonthlyFee}` : null,
    /\bsmall|small-group|small group\b/i.test(brief) ? "Small groups" : null,
    /\breviews?|top-rated|strong reviews\b/i.test(brief) ? "Review-led" : null,
    areaTag ? `Area hint: ${areaTag}` : null
  ].filter(Boolean) as string[];

  return {
    payload: {
      postalCode,
      subject,
      maxMonthlyFee
    },
    tags,
    summary:
      brief ||
      "Looking for strong-value tuition centres in Singapore, balanced on commute, fees, and proven teaching quality."
  };
}
