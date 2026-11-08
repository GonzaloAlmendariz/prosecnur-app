import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/**
 * Los tokens de controles (app/tokens-controles.css) existen, se cargan con la
 * app y resuelven a algo: cada `var()` que usan está definido en tokens.css.
 * Un token nuevo que nadie importa, o que apunta a un nombre inexistente, se lee
 * perfecto en la hoja y en pantalla no hace nada.
 */
const appDir = path.dirname(fileURLToPath(import.meta.url));
const leer = (archivo: string) => fs.readFileSync(path.join(appDir, archivo), "utf8");

const NUEVOS = [
  "--pulso-control-radius",
  "--pulso-icon-size-sm",
  "--pulso-icon-size-md",
  "--pulso-close-size",
  "--pulso-close-hit",
  "--pulso-panel-head-h",
] as const;

describe("tokens de controles", () => {
  const hoja = leer("tokens-controles.css");

  test("cada token nuevo se define una vez en tokens-controles.css", () => {
    for (const token of NUEVOS) {
      const definiciones = hoja.match(new RegExp(`${token}\\s*:`, "g")) ?? [];
      expect(definiciones, token).toHaveLength(1);
    }
  });

  test("la hoja se importa junto a tipografia.css", () => {
    const suite = leer("AppSuite.tsx");
    expect(suite).toMatch(/import "\.\/tipografia\.css";\nimport "\.\/tokens-controles\.css";/);
  });

  test("los var() que usan resuelven en tokens.css", () => {
    const base = leer("tokens.css");
    const usados = [...hoja.matchAll(/var\(\s*(--pulso-[A-Za-z0-9_-]+)/g)].map(([, nombre]) => nombre);
    expect(usados.length).toBeGreaterThan(0);
    for (const nombre of usados) {
      expect(base, nombre).toMatch(new RegExp(`${nombre}\\s*:`));
    }
  });

  test("la X mide 28 a la vista y 32 al puntero; los íconos 14 y 16", () => {
    expect(hoja).toContain("--pulso-close-size: 28px;");
    expect(hoja).toContain("--pulso-close-hit: 32px;");
    expect(hoja).toContain("--pulso-icon-size-sm: 14px;");
    expect(hoja).toContain("--pulso-icon-size-md: 16px;");
    expect(hoja).toContain("--pulso-control-radius: 8px;");
  });
});
