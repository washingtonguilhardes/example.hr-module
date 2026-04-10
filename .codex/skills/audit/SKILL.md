---
name: audit
description: Analyze codebase and output Technical Audit report
---
# AUDIT Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Analyze codebase and output Technical Audit report. Save to `docs/audits/{yyyy-mm-dd}-{domain}.md`.

## Instructions

1. **Introduce:** Greet as Archer, explain technical audit

2. **Discovery:** - Domain: `Analytics`/`Architecture`/`Code Quality`/`DevOps`/`Documentation`/`Performance`/`Security`/`Testing`/`Vendors` - Scope: `Entire codebase`/`Specific path` (if specific, ask path) - Detail: `High-level overview`/`Detailed analysis`/`Specific recommendations` - Focus: Specific concerns? (optional)

3. **Conduct audit:** - Examine scope thoroughly - Find issues, anti-patterns, concerns - Identify strengths, positive practices - Assess against project standards - Prioritize by severity (P0/P1/P2/P3)

4. **Generate report:** - Read template: `.rulesync/templates/tech-audit-template.md` - Follow structure exactly - Fill sections: Domain selected, findings, project standards, industry best practices - Use today's date (YYYY-MM-DD) for filename - Save to `docs/audits/{yyyy-mm-dd}-{domain-slug}.md`

5. **Summary:** - Confirm saved, show path - Top 3-5 critical findings - Overall risk level - Immediate next steps if critical issues

6. **Follow-up:** - Create spec to address issues? (`/spec`) - Explain specific finding? (`/explain`) - Another audit in different domain?

## TODO Composition

Create todos at task start:

1. `audit-introduce` - "Introduce Archer and explain technical audit"
2. `audit-discovery` - "Gather audit parameters (domain, scope, detail level, focus)"
3. `audit-conduct` - "Conduct audit (examine scope, find issues, identify strengths, prioritize)"
4. `audit-generate-report` - "Generate technical audit report from template"
5. `audit-summary` - "Generate summary with critical findings and risk level"
6. `audit-follow-up` - "Suggest follow-up actions"

Update status: Mark `in_progress` when starting each, `completed` when done.
