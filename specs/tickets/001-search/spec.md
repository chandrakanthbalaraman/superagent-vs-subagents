# 001 Search recipes

## What to build

`GET /recipes?q=` filters the list. Matching is a case-insensitive substring of the title or any ingredient. Trim the query. A missing or blank `q` returns every recipe, in creation order. Do not search steps.

`recipeMatchesQuery` in `src/search.ts` is the function to change. Keep the response shape `{ "recipes": [...] }`.

## Files to touch

- `src/search.ts`
- `tests/search.test.ts` (create it)
- `src/app.ts` only if `q` is not already passed to `recipeMatchesQuery`

## Files NOT to touch

- `src/store.ts`
- `src/server.ts`
- `tests/recipes.test.ts`
- `src/favorites.ts`, `src/tags.ts`, `src/pagination.ts`, `src/validate.ts` (do not create these)

## Decisions

- Substring match, not fuzzy match.
- Case-insensitive.
- Title and ingredients only.
- Leave every query parameter other than `q` alone.
- No authentication.
