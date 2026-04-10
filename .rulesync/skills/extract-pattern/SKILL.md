---
name: extract-pattern
description: Find recurring patterns and document for standardization
targets:
  - "*"
---

# EXTRACT PATTERN Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Find recurring patterns, document comprehensively, suggest rule file placement for standardization.

## Instructions

1. **Discovery:** - Ask: Pattern to extract? (e.g., "tRPC procedure error handling"), Where to look? (directories/file types/entire codebase), Standardize or document?

2. **Search instances:** - Use codebase search for all occurrences - Examine different implementations - Note variations and inconsistencies

3. **Analyze:** - For each instance: Core structure, common elements, variations and differences, best implementation

4. **Categorize:** - **Consistent:** Same way everywhere - **Inconsistent:** Variations (needs standardization) - **Outdated:** Old pattern coexisting with new (needs migration) - **Anti-pattern:** Should be avoided

5. **Document:** - Pattern Name, Purpose (what/when), Context (where/why), Implementation (Recommended Approach with code, Common Variations with code, Anti-patterns with code), Examples from Codebase (Good examples with file:line, Examples needing improvement), Related Patterns, Testing (how to test), Migration Guide (if standardizing)

6. **Statistics:** - Total instances, Consistent/Inconsistent/Outdated counts/percentages, Files analyzed

7. **Rule file placement:** - Recommend: Target rule domain (e.g., "unit testing", "code quality", "architecture"), Reasoning, Section to add to, Alternative rule domains if applicable

8. **Refactoring recommendations (if needed):** - Priority (High/Medium/Low), Impact, Files to update, Refactoring steps, Breaking changes, Estimated effort

9. **Code examples:** - Provide ready-to-use examples: Recommended Pattern with code, Real examples with file:line

10. **Next steps:** - Add pattern to recommended rule file? - Create refactoring task for inconsistencies? - Generate tests for pattern?

## Example Prompts

- `/extract-pattern "tRPC error handling" --scope app/api/trpc/routers/` - Scans all routers, catalogs every TRPCError usage, reports consistency stats, identifies the dominant pattern, and recommends rule file placement.
- `/extract-pattern "Zod validation schemas" --scope app/lib/` - Finds all Zod schema definitions, compares naming conventions and composition patterns, flags inconsistencies with file:line references.

## Quality Criteria

- Every pattern instance includes a real `file:line` reference, not paraphrased descriptions
- Statistics (total instances, consistency percentages) are accurate counts from the codebase, not estimates
- Recommendations cite specific files that would need changes
- Code examples in the "Recommended Pattern" section are taken from actual best-in-class instances in the repo
- Categories (Consistent/Inconsistent/Outdated/Anti-pattern) are justified with concrete evidence

## Scope Boundaries

- Document and analyze patterns -- do NOT refactor code to match a recommended pattern
- Suggest rule file placement and content -- do NOT add rules without explicit approval
- Do NOT create tests or modify existing tests
- If a pattern spans multiple domains, document each domain separately rather than mixing concerns
