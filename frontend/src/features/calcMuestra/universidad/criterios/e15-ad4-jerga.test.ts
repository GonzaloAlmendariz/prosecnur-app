import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { avisoEvidenciaCriterios } from "./evidenciaCriteriosTexto";

const UNIVERSIDAD = join(__dirname, "..");

describe("AD4 · aviso de evidencia de criterios en lenguaje del usuario", () => {
  it("nombra lo que no se ve sin ids internos", () => {
    const texto = avisoEvidenciaCriterios(["cascade"]);
    expect(texto).toContain("el recorte paso a paso");
    expect(texto).toContain("Reconstruye el marco");
    expect(texto).not.toMatch(/I18b|React|cascade/);
  });

  it("enumera varias piezas", () => {
    expect(avisoEvidenciaCriterios(["totals", "cascade", "anchors"])).toContain(
      "los totales por facultad, el recorte paso a paso y la comparación con el estudio anterior",
    );
  });
});

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : tsxFiles(path);
    return name.endsWith(".tsx") && !name.includes(".test.") ? [path] : [];
  });
}

/** Líneas de código (no comentario) con jerga de implementación dentro de texto. */
const JERGA = [
  /React no /,
  /Evidencia I18b/,
  /Adapter I\d+/,
  /engine R\b/,
  /\bpor R\b/,
  /desde R\b/,
  /R no pudo/,
  /El frontend no/,
  /contrato anterior/,
  /\(motor R\)/,
  /con el motor R/,
  /gates huérfanos/,
  /contrato de la tarjeta/,
];

describe("AD4 · sin jerga interna en texto visible de universidad/**", () => {
  it("ningún .tsx de producción la trae fuera de comentarios", () => {
    const hallazgos: string[] = [];
    const archivos = tsxFiles(UNIVERSIDAD);
    // Centinela: si el barrido deja de encontrar archivos, el guard no guarda.
    expect(archivos.length).toBeGreaterThan(150);
    for (const file of archivos) {
      const lines = readFileSync(file, "utf8").split("\n");
      let enBloque = false;
      lines.forEach((line, i) => {
        const t = line.trim();
        if (enBloque) {
          if (t.includes("*/")) enBloque = false;
          return;
        }
        if (t.startsWith("/*") || t.startsWith("{/*")) {
          if (!t.includes("*/")) enBloque = true;
          return;
        }
        if (t.startsWith("//") || t.startsWith("*")) return;
        if (JERGA.some((re) => re.test(line))) hallazgos.push(`${relative(UNIVERSIDAD, file)}:${i + 1}`);
      });
    }
    expect(hallazgos).toEqual([]);
  });
});
