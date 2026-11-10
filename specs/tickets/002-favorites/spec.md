# 002 Favorite a recipe

## What to build

- Add `favorite: boolean` to a recipe. New recipes start as `false`.
- `POST /recipes/:id/favorite` with `{ "favorite": true }` or `{ "favorite": false }`.
- `GET /recipes/:id` returns one recipe, or 404.
- `GET /recipes?favorite=true` returns only favorites. `favorite=false` returns the rest.
- A non-boolean `favorite` is 400. An unknown id is 404.

Keep `q` working. Call `recipeMatchesQuery` and do not edit `src/search.ts`. Apply the favorite filter after search.

## Files to touch

- `src/types.ts`
- `src/store.ts` (add a way to set favorite; do not change list order)
- `src/favorites.ts` (create it)
- `src/app.ts` (wire the route and the query)
- `tests/favorites.test.ts` (create it)

## Files NOT to touch

- `src/search.ts`
- `src/server.ts`
- `tests/recipes.test.ts`
- `src/tags.ts`, `src/pagination.ts`, `src/validate.ts`

## Decisions

- Favorite is a boolean, not a counter.
- No auth. Anyone who can call the API can favorite.
- Existing create/list tests use `toMatchObject`, so an extra `favorite` field is fine.
