---
name: adr
description: Create Architecture Decision Records documenting technical decisions
targets:
  - "*"
---

# ADR Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Create Architecture Decision Records documenting technical decisions, context, alternatives, consequences. Build searchable history.

## Instructions

1. **Discovery:** - Ask: Decision to document?, What prompted? (business requirement, constraint, incident)

2. **Gather context:** - Ask: Problem solving?, Constraints?, Goals/non-goals?, Stakeholders?

3. **Explore alternatives:** - For each option: Approach?, Pros?, Cons?, Estimated effort?, Risks?

4. **Document:** - Check existing ADRs in `docs/decisions/` - Create: `docs/decisions/DRAFT-{slug}.md` (number assigned automatically on merge) - Template sections: Title, Author, Stakeholders, Superseded/Supersedes links, Context and Problem Statement, Decision Drivers, Considered Options (Description/Pros/Cons/Effort), Decision Outcome (Chosen Option, Justification), Consequences (Positive/Negative/Neutral), Implementation (approach, components, migration path, rollback plan), Validation (success metrics, review date), References, Related Decisions - **Note:** Date and number are auto-assigned by GitHub Action when the PR is merged - Do not specify estimated implementation time - **Note:** A GitHub Action will automatically assign the next sequential number when the PR is merged

5. **Update index:** - Create/update: `docs/decisions/README.md` - Sections: Active Decisions table, Deprecated Decisions table, By Category (Architecture, Database, Infrastructure)

6. **Link artifacts:** - Ask: Related specs, briefs, PRs, issues, discussions, external research/articles? - Add links to ADR

7. **Generate diagram (optional):** - Offer: Architecture diagram, flow diagram, comparison diagram

8. **Set review:** - For major decisions: Review checkpoint dates, success metrics

9. **Summary (Added to the top):** - ADR number, title, file path - Decision summary, key points, alternatives considered, impact, links, index updated
