---
name: pr-description
description: >-
  Generate a PR description from current branch changes, output as copyable
  markdown
---
# PR-DESCRIPTION Task

**Persona:** Execute this task as the `@developer` subagent.
Load the persona characteristics from `.rulesync/subagents/developer.md` before proceeding.

## Objective

Generate a standalone PR description for the current branch changes. Output as raw inline markdown in a code fence, ready to copy-paste. Does NOT commit, push, or create a PR.

## Instructions

1. **Analyze changes:** - Run `git diff dev...HEAD` to see all changes on current branch (default base: `dev`) - Run `git log dev...HEAD --oneline` to see all commits - If no changes detected: report "No changes found relative to dev" and stop - Identify: files modified, files added, files deleted

2. **Determine context:** - Read commit messages for intent and scope - Check for Linear issue IDs in branch name or commits (e.g., `ARC-123`) - Check for referenced specs or briefs - Determine commit type (feat/fix/docs/refactor/perf/test/chore)

3. **Generate description:** - Read template: `.rulesync/templates/pr-description-template.md` - Follow template structure - Fill sections from git diff and commit history: - **Title** from primary commit or branch name - **Summary** (2-3 sentences) - **Changes** (files with descriptions) - **Testing** (tests added/modified) - **Related** (Linear issues, specs) - **Checklist** (mark based on diff analysis) - Omit entirely empty sections

4. **Output:** - Output the completed description as raw inline markdown inside a single code fence (` ```markdown ... ``` `) - This allows easy copy-paste

5. **Clipboard (best-effort):** - Attempt to copy raw markdown to clipboard: `pbcopy` (macOS) or `xclip` (Linux) - Report success or "Copy the description above manually"

6. **Summary:** - Report: PR title, files changed count, commit type, clipboard status - Suggest: "Ready to create a draft PR? Run `/draft-pr`"

## TODO Composition

Create todos at task start:

1. `pr-desc-analyze` - "Analyze branch changes"
2. `pr-desc-context` - "Determine context from commits and branch name"
3. `pr-desc-generate` - "Generate PR description from template"
4. `pr-desc-output` - "Output description as markdown code fence"
5. `pr-desc-clipboard` - "Copy description to clipboard"
6. `pr-desc-summary` - "Show summary and next steps"

Update status: Mark `in_progress` when starting each, `completed` when done.
