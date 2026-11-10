# 003 Tag recipes

## What to build

- Add `tags: string[]` to a recipe. New recipes start with `[]`.
- `PUT /recipes/:id/tags` replaces the tags. Body: `{ "tags": ["Dinner", " soup "] }`.
- Store tags trimmed and lowercased, with blanks removed. The example becomes `["dinner", "soup"]`.
- `GET /recipes?tag=dinner` returns recipes that have that tag. The query is trimmed and lowercased.
- Unknown id returns 404. A body that is not `{ "tags": string[] }` returns 400.

Keep search and, if it is already in this checkout, favorites. Do not edit `src/search.ts`. Filter by tag after search and favorite.

## Files to touch

- `src/types.ts`
- `src/store.ts` (add a way to replace tags)
- `src/tags.ts` (create it)
- `src/app.ts`
- `tests/tags.test.ts` (create it)

## Files NOT to touch

- `src/search.ts`
- `src/server.ts`
- `tests/recipes.test.ts`
- `src/pagination.ts`, `src/validate.ts`

## Decisions

- Replace tags. Do not append.
- Duplicate tags collapse to one.
- No auth.
