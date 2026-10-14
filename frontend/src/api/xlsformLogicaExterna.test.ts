import { describe, expect, test } from "vitest";
import { normalizeXlsformFormSource } from "./xlsformEditor";
import {
  LOGICA_EXTERNA_STATUS,
  leerLogicaExterna,
  normalizeLogicaExternaSource,
} from "./xlsformLogicaExterna";

const DECLARADA = {
  kind: "surveymonkey",
  original_name: "Docentes",
  logic_status: "external_declared",
  logic_confirmation_method: "external_declared",
  logic_confirmed_at: "2026-10-14T10:00:00Z",
  logic_external: { herramienta: "SPSS", nota: "Sintaxis v3", declarada_en: "2026-10-14T10:00:00Z" },
};

describe("normalizeLogicaExternaSource", () => {
  test("lee el objeto del backend, también con escalares encajonados", () => {
    expect(normalizeLogicaExternaSource({ herramienta: ["SPSS"], nota: "", declarada_en: "x" }))
      .toEqual({ herramienta: "SPSS", nota: "", declarada_en: "x" });
  });

  test("el retiro deja list(): [] o {} es «sin declaración»", () => {
    expect(normalizeLogicaExternaSource([])).toBeUndefined();
    expect(normalizeLogicaExternaSource({})).toBeUndefined();
    expect(normalizeLogicaExternaSource(null)).toBeUndefined();
    expect(normalizeLogicaExternaSource({ herramienta: "  ", nota: "" })).toBeUndefined();
  });
});

describe("normalizeXlsformFormSource conserva la declaración", () => {
  test("logic_external sobrevive a la allowlist (el autosave lo reenvía)", () => {
    const source = normalizeXlsformFormSource(DECLARADA);
    expect(source?.logic_status).toBe(LOGICA_EXTERNA_STATUS);
    expect(source?.logic_confirmation_method).toBe("external_declared");
    expect(source?.logic_external).toEqual(DECLARADA.logic_external);
  });

  test("tras retirar, no arrastra un objeto vacío", () => {
    const source = normalizeXlsformFormSource({
      ...DECLARADA,
      logic_status: "pending_manual_confirmation",
      logic_confirmation_method: "",
      logic_confirmed_at: "",
      logic_external: [],
    });
    expect(source?.logic_status).toBe("pending_manual_confirmation");
    expect(source && "logic_external" in source).toBe(false);
  });
});

describe("leerLogicaExterna", () => {
  test("sólo cuenta con logic_status external_declared", () => {
    const source = normalizeXlsformFormSource(DECLARADA);
    expect(leerLogicaExterna(source)).toEqual({
      herramienta: "SPSS",
      nota: "Sintaxis v3",
      declaradaEn: "2026-10-14T10:00:00Z",
    });
    expect(leerLogicaExterna({ ...source!, logic_status: "pending_manual_confirmation" })).toBeNull();
    expect(leerLogicaExterna(null)).toBeNull();
  });

  test("«otro programa» (sin nombre) se lee como programa vacío", () => {
    const source = normalizeXlsformFormSource({
      ...DECLARADA,
      logic_external: { herramienta: "otro programa", nota: "", declarada_en: "x" },
    });
    expect(leerLogicaExterna(source)?.herramienta).toBe("");
  });
});
