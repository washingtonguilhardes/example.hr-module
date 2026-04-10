---
name: spec-drift
description: Detect drift between code implementations and specification documents
targets:
  - "*"
---

# SPEC-DRIFT Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Detect drift between code implementations and their specification documents. Identify misalignments, stale specs, and orphaned artifacts. Save report to `docs/audits/{yyyy-mm-dd}-spec-drift.md`.

## Instructions

1. **Initiate:** - Greet as Archer - Explain: "I'll analyze alignment between your code and specs to detect drift." - Ask: "Scope? (Entire codebase / Specific feature / Specific spec file)"

2. **Discovery:** - Locate spec documents in `docs/specs/` (established convention from `/spec` skill) - Locate briefs in `docs/briefs/` for cross-reference - Find code-to-spec references (look for `@spec`, `Spec:`, `@implements` comments per `rules/spec-traceability.md`) - Build mapping of specs ↔ implementation files - Note specs without code references and code without spec references

3. **Drift Analysis:** Detect three drift types:

   **Code-to-Spec Drift:**
   - Code behavior differs from spec requirements
   - New code paths not documented in spec
   - Edge cases handled differently than specified
   - API signatures don't match spec definitions

   **Spec Staleness:**
   - Spec not updated in 6+ months while code changed
   - Spec status still "draft" but code is in production
   - Referenced files in spec no longer exist
   - Spec mentions deprecated patterns or APIs

   **Orphaned Artifacts:**
   - Code files without spec references (for complex business logic)
   - Spec documents with no implementing code
   - Broken file references in spec `implements` frontmatter

4. **Categorize Findings:** Use severity labels from `rules/severity-labels.md`:
   - `[blocking]`: Spec says X, code does Y (functional mismatch)
   - `[discuss]`: Spec ambiguous, code made assumptions
   - `[advisory]`: Minor documentation gaps, stale dates

5. **Coverage Confirmation:** Include coverage section per `rules/coverage-confirmation.md`:
   - Files evaluated
   - Specs analyzed
   - Areas not evaluated (missing access, out of scope)
   - Confidence levels by area

6. **Generate Report:**
   ```markdown
   # Spec Drift Report - {date}

   ## Summary
   - Specs analyzed: {count}
   - Code files mapped: {count}
   - Drift instances found: {count}
   - Verdict: {ALIGNED | MINOR_DRIFT | MAJOR_DRIFT}

   ## Findings

   ### [blocking] {title}
   - **Spec:** `docs/specs/feature.md`
   - **Code:** `src/services/feature.ts:45`
   - **Issue:** {description}
   - **Recommendation:** {action}

   ### [discuss] {title}
   ...

   ### [advisory] {title}
   ...

   ## Orphaned Artifacts

   ### Specs Without Implementation
   - `docs/specs/planned-feature.md` (status: draft)

   ### Code Without Specs
   - `src/services/complex-logic.ts` (recommendation: add spec)

   ## Coverage Confirmation
   {include standard coverage section}
   ```

   Save to `docs/audits/{yyyy-mm-dd}-spec-drift.md`

7. **Summary:** - Verdict: ALIGNED / MINOR_DRIFT / MAJOR_DRIFT - Top drift issues requiring attention - Recommended actions - Offer: "Create/update specs for drifted areas? (`/spec`)"

## TODO Composition

Create todos at task start:

1. `spec-drift-initiate` - "Greet and determine analysis scope"
2. `spec-drift-discovery` - "Locate specs and build code-to-spec mapping"
3. `spec-drift-analysis` - "Analyze for code-to-spec drift, staleness, orphans"
4. `spec-drift-categorize` - "Categorize findings by severity"
5. `spec-drift-coverage` - "Document coverage confirmation"
6. `spec-drift-report` - "Generate drift report"
7. `spec-drift-summary` - "Summarize findings and recommend actions"

Update status: Mark `in_progress` when starting each, `completed` when done.
