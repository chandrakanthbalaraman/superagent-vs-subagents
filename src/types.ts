export type Recipe = {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  createdAt: string;
};

export type NewRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
};
