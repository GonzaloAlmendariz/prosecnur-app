import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../../api/estudio";
import { basesVisibles, esNombreDeArchivo, ordenarBasesDelEstudio, origenDeBase } from "./BasesDelEstudio";
import { errorNombreBase } from "./NuevaBaseArchivos";

const base = (nombre: string, extra: Partial<EstudioBase> = {}) => ({ nombre, ...extra }) as EstudioBase;

describe("Fuentes como lista de bases (propuesta F)", () => {
  it("dice de dónde viene cada base en palabras", () => {
    expect(origenDeBase(base("docentes", { source_kind: "surveymonkey" }))).toBe("SurveyMonkey");
    expect(origenDeBase(base("hogares", { source_kind: "kobo_repeat" }))).toBe("KoboToolbox");
    expect(origenDeBase(base("egresados", { source_kind: "manual" }))).toBe("Archivos");
    expect(origenDeBase(base("x"))).toBe("Archivos");
  });

  it("las hijas de un grupo repetido no son tarjetas propias: viven en su madre", () => {
    const e = { bases: { hogares: base("hogares"), miembros: base("miembros", { parent_base: "hogares" }), docentes: base("docentes") } };
    expect(basesVisibles(e).map((b) => b.nombre)).toEqual(["hogares", "docentes"]);
  });

  it("el nombre de una base nueva: sin espacios ni $, y sin repetir otra", () => {
    expect(errorNombreBase("", ["docentes"])).toBeNull();
    expect(errorNombreBase("egresados", ["docentes"])).toBeNull();
    expect(errorNombreBase("personal admin", [])).toMatch(/espacios/);
    expect(errorNombreBase("a$b", [])).toMatch(/espacios/);
    expect(errorNombreBase("docentes", ["docentes"])).toMatch(/Ya hay/);
  });
});

describe("Fuentes sigue el orden de la serie (M6)", () => {
  it("ordena las tarjetas como la serie declarada y deja al final las que no nombra", () => {
    const altas = [base("b2026"), base("b2024"), base("extra"), base("b2025")];
    expect(ordenarBasesDelEstudio(altas, ["b2024", "b2025", "b2026"]).map((b) => b.nombre))
      .toEqual(["b2024", "b2025", "b2026", "extra"]);
  });

  it("sin serie declarada: cronológico si todas nombran un año (F6), si no el orden de alta", () => {
    const altas = [base("b2026"), base("b2024")];
    expect(ordenarBasesDelEstudio(altas, []).map((b) => b.nombre)).toEqual(["b2024", "b2026"]);
    expect(ordenarBasesDelEstudio(altas, ["otra"]).map((b) => b.nombre)).toEqual(["b2024", "b2026"]);
    const mixtas = [base("b2026"), base("docentes"), base("b2024")];
    expect(ordenarBasesDelEstudio(mixtas, []).map((b) => b.nombre)).toEqual(["b2026", "docentes", "b2024"]);
  });
});

describe("C2 en Fuentes › Bases del estudio: cada tarjeta mide lo que contiene", () => {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(path.join(aqui, "basesDelEstudio.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const tsx = readFileSync(path.join(aqui, "BasesDelEstudio.tsx"), "utf8");
  /** Cuerpos de todas las reglas cuyo selector nombra `clase`. */
  const reglas = (clase: string) =>
    Array.from(css.matchAll(/([^{}]+)\{([^}]*)\}/g)).filter((m) => m[1].includes(clase)).map((m) => ({ selector: m[1].trim(), cuerpo: m[2] }));

  it("la rejilla declara `intrinsic` y no estira a las hermanas (la fila de descarga de una las crecía 24 o 42 px)", () => {
    expect(tsx).toMatch(/className="pulso-bde-grilla" data-qa-geometry-group="carga\/bases-del-estudio" data-qa-geometry-contract="intrinsic"/);
    const grilla = reglas(".pulso-bde-grilla").map((r) => r.cuerpo).join("");
    const tarjeta = reglas(".pulso-bde-tarjeta").filter((r) => r.selector === ".pulso-bde-tarjeta").map((r) => r.cuerpo).join("");
    // `stretch` es el valor por defecto de una rejilla: sin `start` en la rejilla o en la tarjeta, estira.
    expect(/align-items:\s*(?:start|flex-start|self-start)/.test(grilla) || /align-self:\s*(?:start|flex-start|self-start)/.test(tarjeta)).toBe(true);
    expect(grilla).not.toMatch(/align-items:\s*stretch|grid-auto-rows:\s*1fr/);
  });

  it("nada dentro de la tarjeta empuja las acciones al fondo (el hueco de 8 px pasaba a 32 o 50 px)", () => {
    for (const clase of [".pulso-bde-acciones", ".pulso-bde-confirmar", ".pulso-bde-cifras"]) {
      for (const r of reglas(clase)) expect(r.cuerpo, r.selector).not.toMatch(/margin-top:\s*auto|flex(?:-grow)?:\s*1\b/);
    }
  });
});

describe("el archivo de la base parte como nombre de archivo", () => {
  it("reconoce el archivo y deja el título de una encuesta como texto", () => {
    expect(esNombreDeArchivo("Conta_03_08_data_adaptada_03_08_26.xlsx")).toBe(true);
    expect(esNombreDeArchivo("base_docentes.sav")).toBe(true);
    expect(esNombreDeArchivo("Encuesta de satisfacción docente 2026")).toBe(false);
  });
});
