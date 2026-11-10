# Eval 005 Input validation

## Checks

- A normal recipe still returns 201, with title, ingredients, and steps trimmed.
- `title` of 81 characters returns 400 and does not show up in `GET /recipes`.
- `ingredients: []` returns 400.
- An ingredient of only spaces returns 400.
- A step longer than 500 characters returns 400.
- The baseline tests still pass.

## Edge cases

- Title of exactly 80 characters is accepted.
- 30 ingredients are accepted. 31 are rejected.
- A non-string ingredient is 400.

## Definition of done

- `tests/validation.test.ts` covers the checks.
- `npm test` passes.
- `src/search.ts` is unchanged.

## Exact test commands

```bash
npm test
npx vitest run tests/validation.test.ts
```
