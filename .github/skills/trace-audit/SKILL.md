---
name: trace-audit
description: >-
  Analyze distributed traces to find blocking queries, N+1 patterns, and missing
  tRPC encapsulation, then produce prioritized fixes
---
# TRACE AUDIT Task

**Persona:** Execute this task as the `@architect` subagent (Archer, Principal Architect).
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

**Required Context:** Review these rules before proceeding:

- `.rulesync/rules/performance.md` - Performance optimization criteria
- `.rulesync/rules/database.md` - Prisma query patterns and anti-patterns
- `.rulesync/rules/architecture.md` - tRPC architecture and boundaries
- `.rulesync/rules/code-quality.md` - Quality and risk prioritization

---

## Task Objective

Analyze a full distributed trace (JSON) plus Jaeger endpoint metadata to uncover low-hanging performance wins, especially blocking Prisma queries and missing tRPC encapsulation, then produce actionable, code-aligned fixes for this repository.

---

## Task Instructions

1. **Collect required inputs (do not proceed without them):**
   1. "Provide the full trace JSON export (single request trace)."
   2. "Provide the Jaeger endpoint and trace URL for this trace."
   3. "What environment is this from (local/staging/prod) and what user action generated it?"
   4. "What response-time target should this flow hit (if known)?"
   5. "What code scope should I prioritize in this repo (optional path)?"

2. **Run mandatory analysis protocol (concise and empirical):**
   - Define terminal objective for this trace in one line.
   - List load-bearing assumptions only.
   - Build a minimal atomic plan (parse -> measure -> map to code -> recommend -> verify).
   - Use evidence tiers:
     - `T0`: Direct measurement from trace JSON / executed checks
     - `T1`: Primary source from this codebase
     - `T2`: High-quality external guidance
     - `T3`: Inference (label clearly)
   - Any claim without `T0-T2` must be marked `[UNVERIFIED]` or omitted.

3. **Validate trace completeness before interpretation:**
   - Confirm root span exists.
   - Confirm span hierarchy and timestamps are valid.
   - Confirm Prisma/database spans are present.
   - If critical span data is missing, request one replacement trace export and stop.

4. **Compute performance evidence from the trace:**
   - Build the critical path and top contributors by total duration and self time.
   - Group DB spans by query shape/model/operation where possible.
   - Identify blocking patterns:
     - Serial Prisma calls on the critical path
     - N+1/repeated query signatures per request
     - Slow queries lacking pagination/limits/select narrowing
     - Long synchronous chains that could be parallelized
     - Database work not clearly encapsulated in tRPC boundaries

5. **Map findings to code in this repository:**
   - Locate implicated routers/procedures and Prisma call sites.
   - Prefer fixes that keep business logic behind tRPC procedures.
   - For each candidate fix, show exact file paths to inspect/change.

6. **Generate remediation plan aligned to tRPC + Prisma:**
   - Prioritize quick wins first (high impact, low effort).
   - For each recommendation include:
     - Evidence (span name/id, duration, count, critical-path impact)
     - Root cause hypothesis
     - Proposed code change (tRPC and/or Prisma)
     - Expected latency impact (bounded estimate)
     - Risk and validation steps
   - Typical accepted fix classes:
     - Encapsulate page-level blocking Prisma calls behind a single tRPC procedure
     - Collapse N+1 queries into include/select or batched operations
     - Add `take`, cursor pagination, and narrow `select`
     - Parallelize independent reads with `Promise.all`
     - Add/adjust indexes where supported by evidence

7. **Output format is mandatory:**
   - Start with compact JSON:

   ```json
   {
       "_audit": {
           "obj": "Trace-specific optimization objective",
           "inputs": ["trace_json", "jaeger_endpoint"],
           "assumptions": ["load-bearing assumptions only"],
           "plan": ["parse", "measure", "map", "recommend", "verify"],
           "checks": ["coverage", "correctness", "counterexamples", "constraints", "evidence"],
           "evidence": "T0|T1|T2|T3",
           "risk": "weakest point",
           "mitigation": "how risk was reduced",
           "len": "target brevity"
       }
   }
   ```

   - Then provide:
     - `Critical Path Findings`
     - `Blocking Prisma Findings`
     - `tRPC Encapsulation Opportunities`
     - `Prioritized Fix Plan`
     - `Verification Plan` (what new traces should prove)

8. **Counterexample pass before finalizing:**
   - Attempt to invalidate each top recommendation.
   - Downgrade/remove weak recommendations that do not hold.
   - Keep only evidence-backed actions.

9. **Optional implementation handoff:**
   - Ask whether to implement the top `N` fixes directly in this repository.
   - If approved, implement incrementally and verify with tests/checks.

---

## Notes

- Focus on measurable wins, not broad rewrites.
- Keep recommendations inside this repository only.
- Do not suggest bypassing tRPC for application-facing data access.
- Prefer concrete file-level guidance over abstract advice.
