---
name: spec
description: Transform Product Brief into Technical Specification
---
# SPEC Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Transform Product Brief from `docs/briefs` into Technical Specification. Save to `docs/specs/{project-name-slug}.md`.

## Instructions

1. **Introduce:** Greet as Archer, explain brief → spec transformation

2. **Read brief:** - Ask: "Path to Product Brief?" (e.g., `docs/briefs/magic-link-login.md`) - Extract: Goal, Target User, Constraints, Success Metrics

3. **Discovery questions:** 1. Architectural approach? (monolithic, microservices, serverless) 2. Technical constraints? (10k concurrent users, etc.) 3. Authorization? (only if applicable to project) 4. Third-party services/APIs? 5. Database schema changes? Entities/relationships? 6. Security considerations? (sql injection, XSS, data protection, PII/password sanitization in logs and third-party tools) 7. Performance budgets? (response time, bundle size) 8. Rollout/deployment considerations? (feature flags, phased rollout) 9. Other technical concerns?

4. **Generate spec:** - Read template: `.rulesync/templates/tech-spec-template.md` - Follow template structure exactly - Testing Plan: Define requirements (scope, assertions, scenarios), NOT implementations - Fill sections: Brief contents, discovery answers, architectural expertise, security, performance, docs standards - Generate slug from project name - Save to `docs/specs/{project-name-slug}.md`

5. **Update brief:** - Status: "Draft" → "Completed"

6. **Summary:** - Confirm spec saved, brief updated - Show both paths - Highlight key technical decisions

7. **Next steps:** - "Ready for Developer. Begin implementation? Run `/code` with spec path."

## TODO Composition

Create todos at task start:

1. `spec-introduce` - "Introduce Archer and explain brief → spec transformation"
2. `spec-read-brief` - "Read and extract information from Product Brief"
3. `spec-discovery` - "Gather technical discovery information (architecture, constraints, security, performance, etc.)"
4. `spec-generate` - "Generate technical specification document from template"
5. `spec-update-brief` - "Update brief status to Completed"
6. `spec-summary` - "Confirm spec saved and highlight key decisions"

Update status: Mark `in_progress` when starting each, `completed` when done.
