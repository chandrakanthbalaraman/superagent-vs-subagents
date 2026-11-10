# 004 Paginate recipe lists

## What to build

When `page` is present on `GET /recipes`, paginate after the other filters and respond with:

```json
{ "recipes": [], "page": 1, "pageSize": 20, "total": 0 }
```

- `page` is 1-based.
- `pageSize` defaults to 20 and cannot be higher than 50.
- A non-integer, a `page` below 1, or a `pageSize` outside 1..50 returns 400.
- When `page` is absent, keep the current `{ "recipes": [...] }` shape so the baseline tests still pass.
- `total` counts the recipes after search, favorite, and tag filters, before slicing.

This ticket waits for 001 because both edit the list handler. Do not change how `q` matches. Do not edit `src/search.ts`.

## Files to touch

- `src/pagination.ts` (create it)
- `src/app.ts`
- `tests/pagination.test.ts` (create it)

## Files NOT to touch

- `src/search.ts`
- `src/store.ts`
- `src/server.ts`
- `tests/recipes.test.ts`

## Decisions

- Pagination is on the list route only.
- An empty page (page past the end) returns an empty `recipes` array and the real `total`, not 404.
- No auth.
