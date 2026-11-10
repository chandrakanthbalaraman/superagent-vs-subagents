import type { Recipe } from "./types.js";

export function recipeMatchesQuery(recipe: Recipe, query: string): boolean {
  const needle = query.trim();
  const haystack = [recipe.title, ...recipe.ingredients].join("\n");
  return haystack.includes(needle);
}
