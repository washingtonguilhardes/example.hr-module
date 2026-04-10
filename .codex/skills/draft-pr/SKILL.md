---
name: draft-pr
description: 'Commit changes, push to feature branch, and create draft PR'
---
# DRAFT-PR Task

**Persona:** Execute this task as the `@developer` subagent.
Load the persona characteristics from `.rulesync/subagents/developer.md` before proceeding.

## Objective

Commit changes (conventional commits), push to feature branch, create draft PR with description.

## Instructions

1. **Pre-commit:** - `git status` to see changes - List modified/added/deleted files - Ask: "Proceed with PR for these changes?"

2. **Quality checks:** - `pnpm lint && pnpm typecheck` - If fails: report errors, ask fix first - DO NOT proceed if checks fail unless explicitly instructed

3. **Commit details:** - Ask: type (`feat`/`fix`/`docs`/`refactor`/`perf`/`test`/`chore`), scope (e.g. messaging, ui), description, breaking changes? (add `!`)

4. **Commit message:** - Format: `<type>[scope][!]: <description>` - Examples: `feat(perf): rearchitect function for time complexity`, `feat(api)!: change API response format`

5. **Commit:** - `git add .` (or specific files) - Commit with message - Show hash and message

6. **Branch strategy:** - Check: `git branch --show-current` - If `main`/`dev`: suggest `feat/<short-desc>`, ask create? - Create/checkout if approved - If already feature branch: proceed

7. **Push:** - First: `git push -u origin <branch>` - Subsequent: `git push origin <branch>` - Show result - If fails: report error, ask how to proceed

8. **PR description:** - Read template: `.rulesync/templates/pr-description-template.md` - Follow structure exactly - Fill: changes (from git diff), commit message, test results, docs updates, related issues/specs - Include screenshots if UI changes

9. **Create draft PR:** - Detect base branch: `gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'` - Do NOT assume `main` - Ask: "Create draft PR on GitHub targeting `<detected-base>`?" - If yes + GitHub MCP: `mcp_github_create_pull_request`, `draft: true`, base = detected branch - If no MCP: Provide description for copy-paste, instructions: "Visit https://github.com/<org>/<repo>/compare/<base>...<branch>"

10. **Summary:** - Commit hash/message - Branch pushed - PR URL or creation instructions - Follow-up: Run `/review`, request reviews, link issues, mark ready when appropriate

## TODO Composition

Create todos at task start:

1. `draft-pr-pre-commit` - "Review changes and confirm proceeding with PR"
2. `draft-pr-quality-checks` - "Run quality checks (lint, typecheck)"
3. `draft-pr-commit-details` - "Gather commit details (type, scope, description, breaking changes)"
4. `draft-pr-commit` - "Create commit with conventional commit message"
5. `draft-pr-branch-strategy` - "Verify/create feature branch"
6. `draft-pr-push` - "Push branch to remote"
7. `draft-pr-description` - "Generate PR description from template"
8. `draft-pr-create` - "Create draft PR on GitHub"
9. `draft-pr-summary` - "Generate summary with commit, branch, and PR info"

Update status: Mark `in_progress` when starting each, `completed` when done.
