---
name: write-tickets
description: Turn a product requirements document into Recipe Box tickets. Use when the user asks to write tickets, split a PRD, or fill specs/tickets from docs/prd.md. Interviews until the requirements, file boundaries, and done checks are clear, then writes spec.md, eval.md, and updates specs/board.md.
---

# Write tickets

Turn `docs/prd.md` (or a PRD the user points at) into tickets this repo can run. Do not implement the tickets.

## Interview until nothing important is unclear

Ask one batch of questions, then wait. Ask again if the answers open a new gap. Stop interviewing when you can fill every heading below without guessing.

Cover, for each candidate ticket:

- What the user can do when it is done, in one sentence.
- Inputs, outputs, and error codes.
- Edge cases you are tempted to invent. Ask instead.
- Which files to touch, and which files must not change.
- Whether it can run alongside another ticket or must wait.
- The exact test command that proves it.
- Anything that would be a product choice (auth, persistence, limits). v1 has no auth. Do not add it unless the user asks.

If the user says "use your judgment" on a product choice, write the assumption into the spec's Decisions section and mark the ticket `draft`.

## Write the files

For each ticket, create `specs/tickets/<nnn>-<slug>/spec.md` and `eval.md`.

`spec.md` headings:

- What to build
- Files to touch
- Files NOT to touch
- Decisions

`eval.md` headings:

- Checks
- Edge cases
- Definition of done
- Exact test commands

The test commands must include a fenced `npm test` and the narrowest vitest command for the new file.

Update `specs/board.md`. New tickets start as `draft` and `solo` unless the user asked for `team`. Set `waits for` only for a real dependency. Do not mark a ticket `ready` until the user says it is ready.

## Do not

- Do not edit `src/` or `tests/`.
- Do not open root-level dotfiles.
- Do not mark work done. Done means a later run implemented it.
