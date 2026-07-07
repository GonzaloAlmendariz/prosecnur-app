// =============================================================================
// canvas/previewInputs.test.tsx — cobertura del switch por tipo de pregunta
// =============================================================================
// El proyecto no usa @testing-library (tests puros de vitest en entorno node),
// así que en vez de renderizar DOM testeamos `previewKindForType`, la función
// PURA que es la fuente de verdad del switch de `PreviewInputForType`: si un
// tipo conocido no cae en "fallback", su rama visual existe y se renderiza.
// =============================================================================

import { describe, expect, test } from "vitest";
import { parseType } from "../parsing/parseType";
import {
  appearanceTokens,
  filterChoices,
  previewKindForType,
  rangeParamsForNode,
} from "./previewInputs";

/** Nodo mínimo para clasificar: tipo crudo + appearance. */
function nodeFor(rawType: string, appearance = "") {
  return { typeInfo: parseType(rawType), appearance };
}

// -----------------------------------------------------------------------------
// Tipos conocidos: ninguno cae en el fallback "No hay vista previa"
// -----------------------------------------------------------------------------

const KNOWN_TYPES = [
  "select_one sexo",
  "select_multiple servicios",
  "select_one_from_file regiones.csv",
  "select_multiple_from_file distritos.csv",
  "integer",
  "decimal",
  "text",
  "date",
  "time",
  "datetime",
  "range",
  "rank prioridades",
  "calculate",
  "note",
  "acknowledge",
  "hidden",
  "start",
  "end",
  "today",
  "deviceid",
  "username",
  "image",
  "audio",
  "video",
  "file",
  "barcode",
  "geopoint",
  "geotrace",
  "geoshape",
  "begin_group",
  "begin_repeat",
];

describe("previewKindForType", () => {
  test.each(KNOWN_TYPES)("«%s» tiene rama visual propia (no fallback)", (rawType) => {
    expect(previewKindForType(nodeFor(rawType))).not.toBe("fallback");
  });

  test("un tipo desconocido sí cae en fallback", () => {
    expect(previewKindForType(nodeFor("xyz-inventado"))).toBe("fallback");
    expect(previewKindForType(nodeFor(""))).toBe("fallback");
  });

  test("select_one con appearance likert → escala horizontal", () => {
    expect(previewKindForType(nodeFor("select_one escala", "likert"))).toBe("select-likert");
  });

  test("select_one con minimal/autocomplete/dropdown → campo desplegable", () => {
    expect(previewKindForType(nodeFor("select_one region", "minimal"))).toBe("select-dropdown");
    expect(previewKindForType(nodeFor("select_one region", "autocomplete"))).toBe("select-dropdown");
    expect(previewKindForType(nodeFor("select_one region", "dropdown"))).toBe("select-dropdown");
  });

  test("columns / columns-pack / columns-N → grid de columnas (ambos selects)", () => {
    expect(previewKindForType(nodeFor("select_one region", "columns"))).toBe("select-columns");
    expect(previewKindForType(nodeFor("select_multiple servicios", "columns-pack"))).toBe(
      "select-columns",
    );
    expect(previewKindForType(nodeFor("select_multiple servicios", "columns-4"))).toBe(
      "select-columns",
    );
  });

  test("appearance xml-external → opciones desde archivo externo", () => {
    expect(previewKindForType(nodeFor("select_one region", "xml-external"))).toBe(
      "select-external",
    );
  });

  test("likert en select_multiple NO aplica (solo select_one)", () => {
    expect(previewKindForType(nodeFor("select_multiple servicios", "likert"))).toBe("select-list");
  });

  test("appearance desconocido no rompe la rama por defecto", () => {
    expect(previewKindForType(nodeFor("select_one sexo", "quick w-2"))).toBe("select-list");
    expect(previewKindForType(nodeFor("text", "multiline"))).toBe("text");
  });
});

// -----------------------------------------------------------------------------
// Helpers puros
// -----------------------------------------------------------------------------

describe("rangeParamsForNode", () => {
  test("lee start/end/step de parameters (space-separated)", () => {
    expect(rangeParamsForNode({ parameters: "start=1 end=5 step=1" })).toEqual({
      start: 1,
      end: 5,
      step: 1,
    });
  });

  test("acepta separador ; y valores decimales", () => {
    expect(rangeParamsForNode({ parameters: "start=0;end=1;step=0.1" })).toEqual({
      start: 0,
      end: 1,
      step: 0.1,
    });
  });

  test("fallback 0–10 sin parameters, e ignora basura", () => {
    expect(rangeParamsForNode({ parameters: "" })).toEqual({ start: 0, end: 10, step: 1 });
    expect(rangeParamsForNode({ parameters: undefined })).toEqual({ start: 0, end: 10, step: 1 });
    expect(rangeParamsForNode({ parameters: "start=abc end=xyz" })).toEqual({
      start: 0,
      end: 10,
      step: 1,
    });
  });

  test("end nunca queda por debajo de start", () => {
    expect(rangeParamsForNode({ parameters: "start=10 end=2" })).toEqual({
      start: 10,
      end: 10,
      step: 1,
    });
  });
});

describe("appearanceTokens", () => {
  test("separa por espacios y normaliza a minúsculas", () => {
    expect(appearanceTokens({ appearance: "  Minimal  columns-pack " })).toEqual([
      "minimal",
      "columns-pack",
    ]);
    expect(appearanceTokens({ appearance: "" })).toEqual([]);
  });
});

describe("filterChoices (búsqueda inline de listas largas)", () => {
  const items = [
    { rowIndex: 0, name: "lima", label: "Lima" },
    { rowIndex: 1, name: "junin", label: "Junín" },
    { rowIndex: 2, name: "ancash", label: "Áncash" },
  ];

  test("filtra por label sin distinguir tildes ni mayúsculas", () => {
    expect(filterChoices(items, "junin").map((it) => it.name)).toEqual(["junin"]);
    expect(filterChoices(items, "ÁNCASH").map((it) => it.name)).toEqual(["ancash"]);
  });

  test("también matchea por name (código interno)", () => {
    expect(filterChoices(items, "anca").map((it) => it.name)).toEqual(["ancash"]);
  });

  test("query vacío devuelve todo", () => {
    expect(filterChoices(items, "  ")).toHaveLength(3);
  });
});
