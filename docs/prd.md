# Recipe Box v1

## Problem

People lose recipes in screenshots and notes. Recipe Box is a small API that stores recipes and lets you find them again.

## User

One person, on their own machine. No accounts in v1.

## Goals

- Save a recipe with a title, ingredients, and steps.
- Search recipes by title or ingredient, case-insensitively.
- Mark a recipe as a favorite, and list favorites.
- Attach tags, and list recipes by tag.
- Page through a long list.
- Reject empty or oversized input with a clear 400.

## Non-goals

- No authentication, accounts, or sharing.
- No photos, ratings, or meal plans.
- No public deployment story. `npm start` on localhost is enough.

## Baseline already in the repo

The sample app can create a recipe and list recipes in creation order. `npm test` covers that path. v1 is the baseline plus the tickets on `specs/board.md`.

## API sketch

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /health | `{ "ok": true }` |
| POST | /recipes | Create. JSON body: `title`, `ingredients`, `steps`. |
| GET | /recipes | List in creation order. Optional `q`, `favorite`, `tag`, and pagination. |
| GET | /recipes/:id | One recipe. |
| POST | /recipes/:id/favorite | Body `{ "favorite": true \| false }`. |
| PUT | /recipes/:id/tags | Body `{ "tags": ["dinner"] }`. |

Search (`q`) matches a substring of the title or any ingredient. Matching is case-insensitive. Leading and trailing spaces on the query are ignored. Steps are not searched.

Favorites and tags default to "not a favorite" and no tags. Tag matching is case-insensitive. A recipe may have many tags.

Pagination uses a 1-based `page` and a `pageSize` (default 20, maximum 50). When `page` is present the response includes `page`, `pageSize`, and `total`. When `page` is absent the list response stays `{ "recipes": [...] }` so existing clients keep working.

## Data

A recipe has an id, title, ingredients, steps, createdAt, favorite, and tags. The sample stores recipes in memory. Restarting the process clears them. SQLite is out of scope for this lab; the behavior above is what matters.

## Done for v1

A person can save a recipe, search it without worrying about capitalization, favorite it, tag it, and page through the list. Invalid input returns 400. `npm test` passes. There is still no auth.
