import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function SearchForm({ loading, onSubmit }) {
    const [postalCode, setPostalCode] = useState("529508");
    const [subject, setSubject] = useState("Math");
    const [maxMonthlyFee, setMaxMonthlyFee] = useState("320");
    async function handleSubmit(event) {
        event.preventDefault();
        await onSubmit({
            postalCode,
            subject: subject.trim() || undefined,
            maxMonthlyFee: maxMonthlyFee ? Number(maxMonthlyFee) : undefined
        });
    }
    return (_jsxs("form", { className: "search-panel", onSubmit: handleSubmit, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "postalCode", children: "Postal code" }), _jsx("input", { id: "postalCode", inputMode: "numeric", maxLength: 6, minLength: 6, pattern: "\\d{6}", placeholder: "529508", value: postalCode, onChange: (event) => setPostalCode(event.target.value.replace(/\D/g, "")) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "subject", children: "Subject" }), _jsx("input", { id: "subject", placeholder: "Math", value: subject, onChange: (event) => setSubject(event.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "maxMonthlyFee", children: "Budget cap (S$/month)" }), _jsx("input", { id: "maxMonthlyFee", inputMode: "numeric", placeholder: "320", value: maxMonthlyFee, onChange: (event) => setMaxMonthlyFee(event.target.value.replace(/[^\d]/g, "")) })] }), _jsx("button", { className: "primary-button", disabled: loading, type: "submit", children: loading ? "Ranking..." : "Find best value" })] }));
}
