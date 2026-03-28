import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const quickPrompts = [
    "My P6 kid needs affordable math tuition near Tampines under $300",
    "Looking for small-group English tuition near Woodlands",
    "Need a science-focused centre with strong reviews around Bishan"
];
export function SearchForm({ loading, initialValues, onSubmit }) {
    const [brief, setBrief] = useState(initialValues.brief);
    const [postalCode, setPostalCode] = useState(initialValues.postalCode);
    const [subject, setSubject] = useState(initialValues.subject);
    const [maxMonthlyFee, setMaxMonthlyFee] = useState(initialValues.maxMonthlyFee);
    const [showFineTune, setShowFineTune] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        await onSubmit({
            brief,
            postalCode,
            subject,
            maxMonthlyFee
        });
    }
    async function applyPrompt(prompt) {
        setBrief(prompt);
        await onSubmit({
            brief: prompt,
            postalCode,
            subject,
            maxMonthlyFee
        });
    }
    return (_jsxs("form", { className: "search-stack", onSubmit: handleSubmit, children: [_jsxs("div", { className: "intent-panel", children: [_jsx("label", { htmlFor: "brief", children: "Tell Kiaskool what the student needs" }), _jsx("textarea", { id: "brief", placeholder: "My Sec 2 child needs budget-friendly math tuition near the east side with small classes.", rows: 4, value: brief, onChange: (event) => setBrief(event.target.value) }), _jsx("p", { className: "intent-helper", children: "Kiaskool will turn this into a search brief for recommendations now, and later for TinyFish scraping queries." }), _jsx("div", { className: "prompt-row", children: quickPrompts.map((prompt) => (_jsx("button", { className: "prompt-chip", disabled: loading, onClick: () => void applyPrompt(prompt), type: "button", children: prompt }, prompt))) }), _jsxs("div", { className: "intent-actions", children: [_jsx("button", { className: "primary-button", disabled: loading, type: "submit", children: loading ? "Scouting..." : "Scout from this brief" }), _jsx("button", { className: "ghost-button", onClick: () => setShowFineTune((value) => !value), type: "button", children: showFineTune ? "Hide fine-grain filters" : "Fine-tune this search" })] })] }), _jsxs("div", { className: `finegrain-panel ${showFineTune ? "is-open" : "is-collapsed"}`, children: [_jsxs("div", { className: "finegrain-header", children: [_jsxs("div", { children: [_jsx("p", { className: "section-kicker", children: "Fine-grain filters" }), _jsx("h2", { children: "Tighten the shortlist" })] }), _jsx("p", { className: "finegrain-copy", children: "Start with intent first, then anchor by postal code, subject, and monthly budget." })] }), _jsxs("div", { className: "search-panel", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "postalCode", children: "Postal code override" }), _jsx("input", { id: "postalCode", inputMode: "numeric", maxLength: 6, minLength: 6, pattern: "\\d{6}", placeholder: "529508", value: postalCode, onChange: (event) => setPostalCode(event.target.value.replace(/\D/g, "")) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "subject", children: "Subject override" }), _jsx("input", { id: "subject", placeholder: "Math", value: subject, onChange: (event) => setSubject(event.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "maxMonthlyFee", children: "Budget override (S$/month)" }), _jsx("input", { id: "maxMonthlyFee", inputMode: "numeric", placeholder: "320", value: maxMonthlyFee, onChange: (event) => setMaxMonthlyFee(event.target.value.replace(/[^\d]/g, "")) })] }), _jsx("button", { className: "secondary-button", disabled: loading, type: "submit", children: loading ? "Scouting..." : "Scout with fine-tuning" })] })] })] }));
}
