# Eval 003 Tags

## Checks

- A new recipe has `tags: []`.
- `PUT /recipes/:id/tags` with mixed case and extra spaces stores trimmed lowercase tags.
- `GET /recipes?tag=Dinner` matches a stored `dinner` tag.
- A second PUT replaces the previous tags.
- Unknown id returns 404.
- `{ "tags": "dinner" }` returns 400.

## Edge cases

- Empty array clears tags.
- `["soup", "soup"]` is stored once.
- `tag` combined with `q` uses both filters.

## Definition of done

- `tests/tags.test.ts` covers the checks.
- `npm test` passes.
- `src/search.ts` is unchanged.

## Exact test commands

```bash
npm test
npx vitest run tests/tags.test.ts
```
