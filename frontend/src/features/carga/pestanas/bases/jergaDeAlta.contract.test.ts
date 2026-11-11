import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Lo que se lee en "Agregar base" (Varias bases desde archivos, Monitoreo) y en
 * la relación entre las bases va en castellano del oficio: se carga una base,
 * no se "materializa" un "carril"; se revisa el corte de campo, no un
 * "snapshot". Revisión de fidelidad de Bases, 2026-11-11.
 *
 * Mira solo los textos entre comillas y el texto JSX, no los comentarios ni los
 * identificadores del código (`materializeLane`, `is-materialized`).
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const carga = path.resolve(aqui, "../..");
const ARCHIVOS = [
  "CargaManualBaseLanes.tsx",
  "CargaBaseFilePicker.tsx",
  "CargaTopologyModel.ts",
  "CargaMonitoringDiscovery.tsx",
];
const JERGA = /materializ|carril|snapshot|sin explorar|…/i;

/** Textos visibles: literales de cadena y texto JSX, sin comentarios. */
export function textosVisibles(fuente: string): string[] {
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const literales = Array.from(sinComentarios.matchAll(/"([^"\n]*)"|`([^`]*)`/g), (m) => m[1] ?? m[2] ?? "");
  const jsx = Array.from(sinComentarios.matchAll(/>([^<>{}=]*[A-Za-zÁÉÍÓÚáéíóúñ][^<>{}=]*)</g), (m) => m[1].replace(/\s+/g, " ").trim());
  // Clases, rutas, tipos de archivo y claves no son texto que se lea.
  return [...literales, ...jsx]
    .filter((t) => !/\bpulso-/.test(t))
    .filter((t) => /\s/.test(t.trim()) || /…/.test(t));
}

describe("jerga a la vista en Agregar base y la relación entre las bases", () => {
  it("el detector ve la jerga en un texto y no en un comentario ni en una clase", () => {
    expect(textosVisibles('// Base materializada\nconst a = "Cada carril se materializa";').filter((t) => JERGA.test(t))).toEqual(["Cada carril se materializa"]);
    expect(textosVisibles('<span className="pulso-x is-materialized">Base cargada</span>').filter((t) => JERGA.test(t))).toEqual([]);
  });

  it.each(ARCHIVOS)("%s no muestra carril, materializar, snapshot, sin explorar ni puntos suspensivos", (archivo) => {
    const fuente = readFileSync(path.join(carga, archivo), "utf8");
    expect(textosVisibles(fuente).filter((t) => JERGA.test(t))).toEqual([]);
  });
});
