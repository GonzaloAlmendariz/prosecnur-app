import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { clasePublico, paletaDePublicos, TONOS_DE_PUBLICO, tonoPreferido } from "./paletaPublicos";

const NUEVE = [
  "Estudiantes de pregrado", "Estudiantes de posgrado", "Docentes Campus", "Docentes contratados",
  "Administrativos", "Egresados", "Empleadores", "Autoridades", "Grupos de interés",
];

describe("paleta de públicos", () => {
  it("es determinista: mismo nombre, mismo tono, sin importar el orden de llegada", () => {
    const a = paletaDePublicos(NUEVE);
    const b = paletaDePublicos([...NUEVE].reverse());
    for (const n of NUEVE) expect(a.get(n)).toBe(b.get(n));
    expect(tonoPreferido("Docentes Campus")).toBe(tonoPreferido("  docentes   campus "));
  });

  it("nueve públicos del mismo estudio no repiten tono", () => {
    const tonos = [...paletaDePublicos(NUEVE).values()];
    expect(new Set(tonos).size).toBe(NUEVE.length);
    for (const t of tonos) expect(t).not.toBeNull();
  });

  it("fuera del universo y sin público van en neutro", () => {
    const p = paletaDePublicos(["Fuera del universo", "Sin público", "Docentes Campus"]);
    expect(clasePublico(p, "Fuera del universo")).toBe("es-publico-neutro");
    expect(clasePublico(p, "")).toBe("es-publico-neutro");
    expect(clasePublico(p, "Docentes Campus")).toMatch(/^es-publico-\d$/);
  });

  it("la hoja declara una clase por tono", () => {
    const css = readFileSync(path.join(__dirname, "paletaPublicos.css"), "utf8");
    for (let i = 0; i < TONOS_DE_PUBLICO; i += 1) expect(css).toContain(`.es-publico-${i} {`);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
