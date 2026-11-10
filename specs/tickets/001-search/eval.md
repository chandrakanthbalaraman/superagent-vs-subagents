# Eval 001 Search

## Checks

- `GET /recipes?q=soup` returns a recipe titled `Tomato Soup`.
- `GET /recipes?q=TOMATO` matches an ingredient `tomatoes`.
- `GET /recipes?q=nomatch` returns `{ "recipes": [] }`.
- `GET /recipes` with no `q` still lists every recipe in creation order.
- A query that matches only a step does not match.

## Edge cases

- `q` with leading and trailing spaces.
- Mixed-case title and mixed-case query.
- Empty string `q` behaves like a missing `q`.

## Definition of done

- The checks above are encoded as tests in `tests/search.test.ts`.
- `npm test` passes.
- No files outside the spec's list were edited.

## Exact test commands

```bash
npm test
npx vitest run tests/search.test.ts
```
