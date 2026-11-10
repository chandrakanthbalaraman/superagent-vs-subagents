import type { NewRecipe, Recipe } from "./types.js";

export type RecipeStore = {
  create(input: NewRecipe): Recipe;
  list(): Recipe[];
};

export function createStore(): RecipeStore {
  const recipes: Recipe[] = [];
  let nextId = 1;

  return {
    create(input) {
      const recipe: Recipe = {
        id: String(nextId),
        title: input.title,
        ingredients: [...input.ingredients],
        steps: [...input.steps],
        createdAt: new Date().toISOString(),
      };
      nextId += 1;
      recipes.push(recipe);
      return copyRecipe(recipe);
    },
    list() {
      return recipes.map(copyRecipe);
    },
  };
}

function copyRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: [...recipe.ingredients],
    steps: [...recipe.steps],
  };
}
