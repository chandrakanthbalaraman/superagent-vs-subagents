import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { listen } from "./http.js";

async function postRecipe(
  baseUrl: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/recipes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json };
}

describe("Recipe Box baseline", () => {
  it("reports health", async () => {
    const app = createApp();
    const server = await listen(app);
    try {
      const response = await fetch(`${server.baseUrl}/health`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });

  it("creates a recipe and lists it", async () => {
    const app = createApp();
    const server = await listen(app);
    try {
      const created = await postRecipe(server.baseUrl, {
        title: "  Tomato Soup  ",
        ingredients: ["tomatoes", "salt"],
        steps: ["Simmer"],
      });
      expect(created.status).toBe(201);
      expect(created.json).toMatchObject({
        id: "1",
        title: "Tomato Soup",
        ingredients: ["tomatoes", "salt"],
        steps: ["Simmer"],
      });
      expect(created.json.createdAt).toEqual(expect.any(String));

      const listed = await fetch(`${server.baseUrl}/recipes`);
      expect(listed.status).toBe(200);
      const body = (await listed.json()) as { recipes: Array<{ id: string; title: string }> };
      expect(body.recipes.map((recipe) => recipe.title)).toEqual(["Tomato Soup"]);
    } finally {
      await server.close();
    }
  });

  it("lists recipes in creation order", async () => {
    const app = createApp();
    const server = await listen(app);
    try {
      await postRecipe(server.baseUrl, {
        title: "First",
        ingredients: ["a"],
        steps: ["one"],
      });
      await postRecipe(server.baseUrl, {
        title: "Second",
        ingredients: ["b"],
        steps: ["two"],
      });
      const listed = await fetch(`${server.baseUrl}/recipes`);
      const body = (await listed.json()) as { recipes: Array<{ id: string }> };
      expect(body.recipes.map((recipe) => recipe.id)).toEqual(["1", "2"]);
    } finally {
      await server.close();
    }
  });

  it("rejects a missing or blank title", async () => {
    const app = createApp();
    const server = await listen(app);
    try {
      const missing = await postRecipe(server.baseUrl, {
        ingredients: ["a"],
        steps: ["one"],
      });
      expect(missing.status).toBe(400);

      const blank = await postRecipe(server.baseUrl, {
        title: "   ",
        ingredients: ["a"],
        steps: ["one"],
      });
      expect(blank.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("rejects ingredients or steps that are not arrays", async () => {
    const app = createApp();
    const server = await listen(app);
    try {
      const response = await postRecipe(server.baseUrl, {
        title: "Soup",
        ingredients: "tomatoes",
        steps: ["Simmer"],
      });
      expect(response.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("rejects invalid JSON", async () => {
    const app = createApp();
    const server = await listen(app);
    try {
      const response = await fetch(`${server.baseUrl}/recipes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      });
      expect(response.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("gives each app its own memory", async () => {
    const first = createApp();
    const second = createApp();
    const firstServer = await listen(first);
    const secondServer = await listen(second);
    try {
      await postRecipe(firstServer.baseUrl, {
        title: "Only here",
        ingredients: ["a"],
        steps: ["one"],
      });
      const listed = await fetch(`${secondServer.baseUrl}/recipes`);
      const body = (await listed.json()) as { recipes: unknown[] };
      expect(body.recipes).toEqual([]);
    } finally {
      await firstServer.close();
      await secondServer.close();
    }
  });
});
