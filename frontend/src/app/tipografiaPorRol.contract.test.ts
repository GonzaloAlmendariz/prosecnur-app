import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L29 — ocho roles tipográficos con piso de 10 px.**
 *
 * La escala vive en app/tipografia.css (tokens.css está congelado). Este
 * contrato fija los ocho roles, que ninguno baje de 10 px y que la densidad
 * compacta tampoco los empuje bajo el piso.
 */

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "tipografia.css"), "utf8");

const ROLES = ["display", "kpi", "title", "subtitle", "body", "caption", "eyebrow", "micro"] as const;

function tamanos(texto: string): Array<[string, number]> {
  return [...texto.matchAll(/--pulso-type-([a-z]+)-size:\s*([\d.]+)px/g)].map(([, rol, px]) => [rol, Number(px)]);
}

describe("tipografía por rol · L29", () => {
  test("los ocho roles existen, con tamaño y peso", () => {
    for (const rol of ROLES) {
      expect(css, rol).toMatch(new RegExp(`--pulso-type-${rol}-size:`));
      expect(css, rol).toMatch(new RegExp(`--pulso-type-${rol}-weight:`));
    }
  });

  test("ningún rol baja del piso de 10 px, tampoco en compacta", () => {
    const bajoElPiso = tamanos(css).filter(([, px]) => px < 10);
    expect(bajoElPiso).toEqual([]);
    expect(tamanos(css).length).toBeGreaterThanOrEqual(ROLES.length);
  });

  test("la densidad compacta sigue a la presentación elegida, sin otro control", () => {
    expect(css).toContain(':root[data-pulso-layout-density="compact"]');
    expect(css).toContain(':root[data-pulso-layout-density="short"]');
    const preferencia = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "layoutPreference.ts"),
      "utf8",
    );
    expect(preferencia).toContain("root.dataset.pulsoLayoutDensity = meta.density");
  });

  test("la app importa la escala", () => {
    const suite = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "AppSuite.tsx"), "utf8");
    expect(suite).toContain('import "./tipografia.css";');
  });
});
