import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas route-jump mode contrast contract", () => {
  test("keeps the active hint legible on the module accent", () => {
    const css = fs.readFileSync(path.join(__dirname, "hojasRuta.css"), "utf8");

    expect(css).toMatch(
      /\.hojas-ruta-frame \.hojas-ruta-route-jump-options button\.is-active small\s*\{\s*color:\s*white;/,
    );
  });
});
