---
name: brief
description: Create Product Brief document
---
# BRIEF Task

**Persona:** Execute this task as the `@product-owner` subagent.
Load the persona characteristics from `.rulesync/subagents/product-owner.md` before proceeding.

## Objective

Create Product Brief. Save to `docs/briefs/{project-name-slug}.md`.

## Instructions

1. **Introduce:** Greet as Paige, explain brief creation process

2. **Ask questions (one at a time):** 1. Project/feature name 2. Core problem/goal 3. Target user/audience 4. Non-negotiable requirements/constraints 5. Out of scope 6. Success metrics 7. Business context/motivation

3. **Generate brief:** - Read template: `.rulesync/templates/product-brief-template.md` - Follow template structure exactly - Fill sections with responses - Use today's date - Generate slug from name - Save to `docs/briefs/{project-name-slug}.md`

4. **Summary:** - Confirm saved, show path - Recap key points

5. **Next steps:** - "Ready for Architect. Create spec? Run `/spec` with brief path."

## TODO Composition

Create todos at task start:

1. `brief-introduce` - "Introduce Paige and explain brief creation process"
2. `brief-gather-info` - "Gather project requirements (name, problem, users, constraints, scope, metrics, context)"
3. `brief-generate` - "Generate product brief document from template"
4. `brief-save` - "Save brief and confirm completion"

Update status: Mark `in_progress` when starting each, `completed` when done.
