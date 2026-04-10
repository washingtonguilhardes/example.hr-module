---
name: learn
description: Extract patterns from codebase and generate or update rule files
---
# LEARN Task

**Persona:** Execute this task as the `@architect` subagent.
Load the persona characteristics from `.rulesync/subagents/architect.md` before proceeding.

## Objective

Extract actual patterns/conventions/styles from YOUR codebase (not generic best practices), generate/update rule files to match reality.

## Instructions

1. **Discovery:** - Aspect: `Architecture`/`Testing`/`Components`/`Database`/`Integrations`/`tRPC Routers`/`Everything` - Scope: Entire codebase or specific directories? - Goal: Document current patterns/Identify inconsistencies/Generate new rules/Update existing rules?

2. **Scan:** - Architecture: `app/**/page.tsx`, `app/**/layout.tsx`, `app/**/components/*.tsx`, `app/lib/*/queries.ts` - Testing: `**/*.test.ts`, `**/*.test.tsx`, `**/e2e/**/*.ts` - Components: `app/**/components/**/*.tsx`, `components/components/**/*.tsx` - Database: `app/lib/*/queries.ts`, `prisma/schema.prisma` - tRPC Routers: `app/api/trpc/routers/**/*.ts`, `app/lib/*/actions.ts`

3. **Extract patterns:** - File Organization: Naming conventions, file structure, directory hierarchy - Code Patterns: Function structure, error handling, logging, validation, types - Conventions: Import order, export patterns, comment styles, variable naming

4. **Analyze consistency:** - Measure pattern usage: Dominant pattern (percentage, count), Alternative patterns, Outliers, Recommendation

5. **Codebase fingerprint:** - Overview: Files analyzed, directories - Key Patterns: Pattern name, Usage percentage, Example from codebase, Files using pattern - Naming Conventions: Functions, Variables, Types, Files - Import Style: Standard import order - Testing Patterns: Test file location, Mock strategy, Assertion style - Inconsistencies Found: List with file counts

6. **Rule recommendations:** - Target rule domain (e.g., "unit testing", "code quality", "architecture"), Section, Content to add (Pattern name, Usage percentage, Standard approach with code, Real examples with file:line, When to use, Common mistakes)

7. **Refactoring opportunities:** - High Priority: Pattern name, Files affected, Impact, Effort, Files list - Medium/Low Priority: Same structure

8. **Compare with existing rules:** - Rules Matching Codebase: List with compliance percentages - Rules Needing Updates: What should be documented - Missing Rules: Patterns found but not documented

9. **Update/create rules:** - Ask: Update existing/Create new sections/Generate refactoring tasks/All? - If updating: Show diffs before applying - If creating: Ask which rule file

10. **Summary:** - Codebase analysis: Files scanned, patterns identified, consistency score - Findings: Well-established patterns, variations (standardization opportunity), anti-patterns (refactoring needed) - Rule updates: Updated sections, new sections, flagged for manual review - Files modified: List with changes - Next steps: Run `/extract-pattern` for deep-dives, create refactoring tasks, share rules

## Example Prompts

- `/learn --aspect Testing --scope app/api/trpc/routers/` - Scans all router test files, extracts the dominant test structure, mock strategy, and assertion style, then compares against existing testing rules.
- `/learn --aspect Everything --goal "Identify inconsistencies"` - Full codebase scan across all aspects, produces a fingerprint with consistency scores per pattern, and flags rules that are out of sync with reality.

## Quality Criteria

- Rules must reflect actual codebase patterns backed by real file references, not generic best practices
- Consistency scores are based on real counts (e.g., "42/47 files use this pattern, 89%"), not subjective assessments
- Diffs are shown before applying any rule file changes -- never auto-write without confirmation
- Patterns marked as "dominant" must appear in the majority of relevant files
- Missing rules are only flagged when a clear, consistent pattern exists but has no corresponding rule documentation

## Scope Boundaries

- Extract and document patterns -- do NOT refactor code to fix inconsistencies
- Suggest rule updates with diffs -- do NOT apply changes without explicit confirmation
- Do NOT create new rule files without asking which file and section to target
- Do NOT generate tests or modify source code

## Cross-References

- `/extract-pattern` - Deep-dive on a specific pattern identified during learning
- `/audit` - Identifies code quality patterns that may need attention
