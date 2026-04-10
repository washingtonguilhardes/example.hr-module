---
name: document
description: Create documentation including inline comments, JSDoc, and README files
targets:
  - "*"
---

# DOCUMENT Task

**Persona:** Execute this task as the `@developer` subagent.
Load the persona characteristics from `.rulesync/subagents/developer.md` before proceeding.

## Objective

Create documentation: inline comments, JSDoc, README files.

## Instructions

1. **Discovery:** - Ask: "What to document? (file/folder/feature)" - Examine: purpose, functionality, relationships

2. **Documentation type:** - Ask: type (`inline`/`jsdoc`/`readme`/`all`), specific sections, update existing or create new

3. **Analyze:** - Read target files - Understand purpose, functionality - Identify key functions/classes/components - Note dependencies, integrations - Check existing docs - Identify architectural decisions/patterns

4. **Write docs:** - **Inline:** Explain "why" not "what", comment edge cases/assumptions - **JSDoc:** All exported functions with `@param`, `@returns`, `@throws`, `@example` - **README:** Read template `.rulesync/templates/readme-template.md`, follow structure exactly

5. **Verify quality:** - Valid TypeScript examples - Correct links/references - Test documented commands - Check completeness

6. **Summary:** - Files created/modified - What was documented - Gaps/areas needing more docs - Related READMEs to update - Recommendations for clarity

## Example Prompts

- `/document app/api/trpc/routers/channels.ts --type jsdoc` - Adds JSDoc blocks to all exported procedures with `@param`, `@returns`, `@throws`, and `@example` tags.
- `/document app/lib/auth --type all` - Adds inline comments explaining "why" for complex logic, JSDoc on exports, and creates/updates the module README from template.
- `/document prisma/schema.prisma --type inline` - Adds comments to models and fields explaining relationships, constraints, and business rules.

## Quality Criteria

- JSDoc includes all `@param`, `@returns`, `@throws`, and `@example` tags for every exported function
- Inline comments explain "why" (intent, trade-offs, constraints), not "what" (which the code already shows)
- README sections match the structure in `.rulesync/templates/readme-template.md` exactly
- Code examples in `@example` tags are valid TypeScript that would compile
- Links and cross-references point to real files that exist in the repo

## Scope Boundaries

- Do NOT refactor code while documenting -- preserve existing behavior exactly
- Do NOT add or modify tests
- Do NOT change function signatures, types, or runtime behavior
- If code is unclear enough that documenting it is difficult, note it as a gap rather than rewriting

## Cross-References

- `/explain` - Understand code thoroughly before documenting it
- `/review` - Documentation quality is checked during code review
