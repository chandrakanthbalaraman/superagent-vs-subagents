import express, { type ErrorRequestHandler } from "express";
import { recipeMatchesQuery } from "./search.js";
import { createStore, type RecipeStore } from "./store.js";

export function createApp(store: RecipeStore = createStore()) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/recipes", (req, res) => {
    const body: unknown = req.body;
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "Expected a JSON object." });
      return;
    }
    const record = body as Record<string, unknown>;
    if (typeof record.title !== "string" || record.title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (!Array.isArray(record.ingredients) || !Array.isArray(record.steps)) {
      res.status(400).json({ error: "ingredients and steps must be arrays" });
      return;
    }
    if (!record.ingredients.every(isString) || !record.steps.every(isString)) {
      res.status(400).json({ error: "ingredients and steps must be arrays of strings" });
      return;
    }
    const recipe = store.create({
      title: record.title.trim(),
      ingredients: record.ingredients,
      steps: record.steps,
    });
    res.status(201).json(recipe);
  });

  app.get("/recipes", (req, res) => {
    let recipes = store.list();
    const query = req.query.q;
    if (typeof query === "string" && query.trim() !== "") {
      recipes = recipes.filter((recipe) => recipeMatchesQuery(recipe, query));
    }
    res.json({ recipes });
  });

  const invalidJson: ErrorRequestHandler = (error, _req, res, next) => {
    if (!isJsonParseError(error)) {
      next(error);
      return;
    }
    res.status(400).json({ error: "invalid JSON" });
  };
  app.use(invalidJson);

  return app;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isJsonParseError(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) {
    return false;
  }
  if (!("status" in error)) {
    return false;
  }
  return error.status === 400;
}
