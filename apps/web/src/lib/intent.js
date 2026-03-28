export function parseSearchDraft(draft) {
    const brief = draft.brief.trim();
    const overrides = [
        draft.postalCode.trim() ? `postal code override ${draft.postalCode.trim()}` : null,
        draft.subject.trim() ? `subject override ${draft.subject.trim()}` : null,
        draft.maxMonthlyFee.trim() ? `budget override S$${draft.maxMonthlyFee.trim()}` : null
    ].filter(Boolean);
    if (!brief) {
        throw new Error("Add a natural-language brief first.");
    }
    const query = overrides.length > 0
        ? `${brief}. Apply these optional filters after intent matching: ${overrides.join(", ")}.`
        : brief;
    return {
        query,
        summary: brief,
        hasOverrides: overrides.length > 0
    };
}
