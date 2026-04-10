---
name: explain
description: 'Explain how a file, folder, or feature works'
---
# EXPLAIN Task

**Persona:** Execute this task as the `@developer` subagent.
Load the persona characteristics from `.rulesync/subagents/developer.md` before proceeding.

## Objective

Explain how file/folder/feature works. Break down logic, explain decisions, trace flows, optionally suggest improvements.

## Instructions

1. **Discovery:** - Ask: "What to explain? (file/folder/feature)" - Examine code and context

2. **Scope:** - Ask: detail level (`high-level`/`detailed`/`deep-dive`), suggest improvements?, specific aspects? (data flow, error handling, performance, security)

3. **Analyze:** - Read target files - Understand purpose, functionality - Trace execution flow, data transformations - Identify dependencies, integrations - Note error handling, edge cases - Recognize architectural patterns - Check related files (README, tests, types)

4. **Structured explanation:** - **Files:** Purpose/context, imports/dependencies, main logic step-by-step, edge cases/error handling/security, non-obvious code/debt - **Folders/Modules:** Purpose/responsibility, structure/organization, entry points/public API, usage patterns - **Features:** User perspective, implementation across files (frontend→backend→database), data flow, integration points/business logic

5. **Language:** - High-level → details - Analogies/examples when helpful - Define technical terms - Break complex logic into chunks - Mermaid diagrams for complex flows - Highlight "why" behind decisions

6. **Improvements (if requested):** - Analyze using project standards: code quality, performance, security, architecture - Format: Priority (High/Medium/Low), Category, Current vs Suggested, Benefits/trade-offs, Effort estimate

7. **Summary:** - Recap main points - Highlight takeaways - Top priority suggestions if provided - Offer deeper dive - Ask: "Explain specific part in detail or help implement improvements?"

## Example Prompts

- `/explain app/api/trpc/routers/channels.ts` - Produces a breakdown of the router: purpose, each procedure's logic, input validation, error handling, and database interactions.
- `/explain app/lib/auth --detail deep-dive --aspects security,data-flow` - Produces a deep-dive covering the auth module's data flow from request to session, security boundaries, token handling, and dependency graph.
- `/explain "How does message sending work end-to-end?"` - Traces the full flow from UI input through tRPC mutation to database write and real-time update, with a Mermaid sequence diagram.

## Quality Criteria

- Explanation covers purpose, data flow, error handling, dependencies, and architectural decisions
- "Why" behind non-obvious design choices is surfaced, not just "what" the code does
- Complex flows include a Mermaid diagram for visual clarity
- All referenced files and functions use actual paths and names from the codebase
- Technical terms are defined on first use
- Detail level matches the requested scope (high-level stays concise, deep-dive is exhaustive)

## Scope Boundaries

- Do NOT refactor or modify any code during an explain task
- Do NOT implement suggested improvements -- only describe them
- Do NOT create or update tests
- Do NOT produce spec documents or PRDs

## Cross-References

- `/diagram` - Generate visual flow diagrams discovered during explanation
- `/document` - Persist explanations as inline comments, JSDoc, or README content
- `/audit` - Run a deeper structural or quality analysis on the explained code
