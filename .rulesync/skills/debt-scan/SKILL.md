---
name: debt-scan
description: Scan codebase for technical debt and generate prioritized report
targets:
  - "*"
---

# DEBT SCAN Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Scan codebase for technical debt. Categorize by type/severity, analyze impact, generate prioritized report focused on actual problems.

## Instructions

1. **Discovery:** - Scope: `Entire codebase`/`Specific directory/module`/`Specific concern` - Debt types: `All types`/`Code quality`/`Testing`/`Security`/`Performance`/`Documentation`/`Dependencies` - Priority trigger: `P0 only`/`P0 and P1`/`All priorities`

2. **Scan indicators:** - **Code Quality:** TODO/FIXME, duplication, high complexity, long functions (>100 lines), large files (>500 lines), inconsistent patterns, dead code, console.log, commented code - **Testing:** No coverage, skipped tests, low coverage (<80%), missing E2E, brittle tests, no assertions - **Security:** Hardcoded secrets, SQL injection, missing validation, unsafe deps, missing auth (if applicable to project), unencrypted data, missing rate limiting, deprecated patterns - **Performance:** N+1 queries, missing indexes, large bundles, unoptimized images, missing pagination, unnecessary re-renders, memory leaks, blocking ops - **Documentation:** Missing READMEs, missing JSDoc, outdated docs, undocumented APIs, missing env var docs, no inline comments - **Dependencies:** Outdated packages, deprecated deps, security vulns, unused deps, duplicate deps

3. **Categorize severity:** - **P0 - Critical:** Security vulns in production, data integrity issues, compliance violations, production blockers - **P1 - High:** Performance degradation, missing tests for critical paths, security concerns (non-exploitable), code blocking development - **P2 - Medium:** Code quality issues, missing docs, minor performance issues, maintainability concerns - **P3 - Low:** Code style inconsistencies, minor duplication, non-critical TODOs, optimization opportunities

4. **Analyze impact:** - For each item: Type, Severity, Location (file:line), Description, Impact (Business/Technical/Risk), Proposed Solution, Benefits

5. **Aggregate:** - Summary by severity (P0/P1/P2/P3 counts/percentages) - Summary by type (Code Quality/Testing/Security/Performance/Documentation/Dependencies) - Debt hotspots (top areas with most debt)

6. **Prioritization matrix:** - High Impact (DO FIRST) - Medium Impact (PLAN CAREFULLY) - Low Impact (FILL GAPS)

7. **Actionable tasks:** - Generate specific tasks for top priorities: Title, File, Solution, Assignee (suggest from git blame) - Group by priority: Critical (P0), High (P1), Medium (P2), Low (P3)

8. **Track trends:** - If previous scans exist: Compare resolved/new debt, net change, debt velocity, improving/worsening areas

9. **Generate report:** - Save to: `docs/audits/{date}-tech-debt.md` - Include: Executive summary, detailed findings by category, prioritization matrix, recommended actions, trend analysis (if applicable), appendix with all items

10. **Next steps:** - Review P0 items immediately, schedule fixes, assign - Create tasks for P1 items, add to backlog - Plan debt reduction (allocate capacity, prioritize by impact) - Schedule next scan (recommended: monthly) - Share with team, discuss priorities

## TODO Composition

Create todos at task start:

1. `debt-scan-discovery` - "Gather scan parameters (scope, debt types, priority trigger)"
2. `debt-scan-indicators` - "Scan for debt indicators (code quality, testing, security, performance, docs, dependencies)"
3. `debt-scan-categorize` - "Categorize findings by severity (P0/P1/P2/P3)"
4. `debt-scan-analyze-impact` - "Analyze impact for each finding"
5. `debt-scan-aggregate` - "Aggregate findings by severity and type, identify hotspots"
6. `debt-scan-prioritization` - "Create prioritization matrix"
7. `debt-scan-actionable-tasks` - "Generate actionable tasks for top priorities"
8. `debt-scan-track-trends` - "Track trends if previous scans exist"
9. `debt-scan-generate-report` - "Generate technical debt report"
10. `debt-scan-next-steps` - "Suggest next steps and follow-up actions"

Update status: Mark `in_progress` when starting each, `completed` when done.
