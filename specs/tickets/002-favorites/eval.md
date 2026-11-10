# Eval 002 Favorites

## Checks

- A created recipe has `favorite: false`.
- Posting `{ "favorite": true }` then `GET /recipes/:id` shows `favorite: true`.
- `GET /recipes?favorite=true` returns only favorites.
- Unknown id returns 404.
- `{ "favorite": "yes" }` returns 400.

## Edge cases

- Favorite, then unfavorite.
- `favorite=true` combined with a `q` that excludes the favorite. The result is empty.
- `favorite` query values other than `true` or `false` return 400.

## Definition of done

- `tests/favorites.test.ts` covers the checks.
- `npm test` passes, including the baseline suite.
- `src/search.ts` is unchanged.

## Exact test commands

```bash
npm test
npx vitest run tests/favorites.test.ts
```
