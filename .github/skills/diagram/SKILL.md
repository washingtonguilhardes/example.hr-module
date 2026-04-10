---
name: diagram
description: 'Generate Mermaid diagrams for structure, flow, and relationships'
---
# DIAGRAM Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Generate Mermaid diagrams: structure, flow, relationships.

## Instructions

1. **Discovery:** - Diagram type: `System Architecture`/`User Flow`/`Sequence`/`ERD`/`Component`/`State Machine`/`Data Flow` - Subject: Feature name, file path, system area - Detail: `High-level`/`Detailed`/`Specific aspect`

2. **Generate diagrams:** - **System Architecture:** Client Layer (UI, Server Components, Client Components) → API Layer (tRPC, OpenAPI, Auth) → Business Logic (Procedures, Validation, Rate Limit) → Data Layer (Prisma, SQLite/LibSQL) - **User Flow:** Start → Auth check → Sign in/Workspace → Channel → Messages → Type/Send → Process → Success/Error → End - **Sequence:** User → Browser → tRPC → Auth → Prisma → DB (show interactions) - **ERD:** Analyze Prisma schema, show entities, relationships, fields (PK/FK/UK) - **Component:** React hierarchy, parent → children relationships - **State Machine:** States, transitions, conditions - **Data Flow:** User Input → Validation → tRPC → Auth → Business Logic → DB → Result → UI

3. **Save:** - Create: `docs/diagrams/` if needed - Save to: `docs/diagrams/{name}.md` - Include: Title, Type, Created date, Scope, Diagram (mermaid code), Description, Key Components, Notes, Related Documentation

4. **Summary:** - Preview diagram, explain components, suggest usage (specs/docs/PRs), ask if updates needed

## Example Prompts

- `/diagram "message sending flow" --type sequence` - Generates a Mermaid sequence diagram showing User -> Browser -> tRPC -> Auth -> Prisma -> DB interactions for message creation.
- `/diagram prisma/schema.prisma --type erd` - Generates an entity-relationship diagram from the Prisma schema showing all models, fields, and relationships.
- `/diagram app/api/trpc/routers/ --type component --detail high-level` - Generates a component diagram showing how routers relate to each other and their shared dependencies.

## Quality Criteria

- Diagrams must be valid Mermaid syntax that renders without errors
- Every diagram includes a title and legend where multiple colors or line styles are used
- Node and edge labels use actual names from the codebase (function names, file names, model names)
- Diagrams reflect the current code, not aspirational or planned architecture
- Complexity is appropriate to the requested detail level -- high-level diagrams stay readable (under ~20 nodes)
- Saved diagrams include a description section explaining key components and relationships

## Scope Boundaries

- Do NOT implement any changes depicted in the diagrams
- Do NOT create specs or PRDs based on diagrams
- Do NOT modify source code -- this is a read-only analysis task
- If the diagram reveals architectural issues, note them but do not fix them

## Cross-References

- `/explain` - Understand code before diagramming it
- `/spec` - Diagrams may inform or accompany spec documents
- `/onboard` - Architecture diagrams are valuable onboarding material
