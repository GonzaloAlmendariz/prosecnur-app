import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas route-jump mode contrast contract", () => {
  test("keeps the active hint legible on the soft module-accent surface", () => {
    const css = fs.readFileSync(path.join(__dirname, "hojasRuta.css"), "utf8");

    // Canon de selección v3: el seleccionado usa tinte suave del acento
    // (--module-accent-soft), no relleno sólido. Sobre esa superficie peach el
    // descriptor es tinta oscurecida hacia --pulso-text para librar AA (~6.7:1);
    // blanco sería invisible y --pulso-text-soft a secas cae bajo 4.5:1.
    expect(css).toMatch(
      /\.hojas-ruta-route-jump-options button\.is-active\s*\)\s*small\s*\{\s*color:\s*color-mix\(in srgb,\s*var\(--pulso-text\)[^}]*var\(--pulso-text-soft\)\);/,
    );
    expect(css).not.toMatch(
      /\.hojas-ruta-route-jump-options button\.is-active\s*\)?\s*small\s*\{\s*color:\s*white;/,
    );
  });
});
