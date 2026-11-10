# Eval 004 Pagination

## Checks

- Create 3 recipes. `GET /recipes?page=1&pageSize=2` returns 2 recipes, `page` 1, `pageSize` 2, and `total` 3.
- `GET /recipes?page=2&pageSize=2` returns the last recipe and `total` 3.
- `GET /recipes` with no `page` still returns `{ "recipes": [...] }` and the baseline tests pass.
- `page=0`, `pageSize=0`, and `pageSize=51` return 400.

## Edge cases

- `page` past the end returns `{ "recipes": [], "total": <n> }` with 200.
- Pagination applies after `q`. A query that matches 1 recipe has `total` 1.
- Missing `pageSize` uses 20.

## Definition of done

- `tests/pagination.test.ts` covers the checks.
- `npm test` passes.
- `src/search.ts` is unchanged.

## Exact test commands

```bash
npm test
npx vitest run tests/pagination.test.ts
```
