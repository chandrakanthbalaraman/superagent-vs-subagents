# 005 Validate recipe input

## What to build

Tighten `POST /recipes`.

- `title`: required, trimmed, 1 to 80 characters.
- `ingredients`: an array of 1 to 30 strings. Each item is trimmed and must be 1 to 120 characters.
- `steps`: an array of 1 to 30 strings. Each item is trimmed and must be 1 to 500 characters.
- Anything else in the body is ignored.
- Failures return 400 and a short `error` string. They do not create a recipe.

Put the rules in `src/validate.ts` and call them from `src/app.ts`. Do not change search matching.

## Files to touch

- `src/validate.ts` (create it)
- `src/app.ts`
- `tests/validation.test.ts` (create it)

## Files NOT to touch

- `src/search.ts`
- `src/store.ts`
- `src/server.ts`
- `tests/recipes.test.ts` (the baseline fixtures already use a short title, one ingredient, and one step)

## Decisions

- Trim before measuring length.
- Empty arrays are invalid.
- No auth, and no maximum on the whole JSON body beyond Express's default.
