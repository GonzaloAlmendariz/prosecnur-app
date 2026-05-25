import { describe, expect, test } from "vitest";
import {
  coerceNumber,
  evaluateNumberDraft,
  formatNumberInput,
  inferNumberStep,
  isPartialNumberInput,
  parseNumberInput,
} from "./argFieldNumberUtils";
import { ArgMetadata } from "../../api/client";

describe("argFieldNumberUtils", () => {
  const baseMeta = (override: Partial<ArgMetadata> = {}): ArgMetadata => ({
    name: "test_field",
    label: "Campo prueba",
    tipo_input: "number",
    grupo: "estilo",
    ...override,
  });

  test("parsea comas decimales y devuelve null en basura", () => {
    expect(parseNumberInput("1,5")).toBe(1.5);
    expect(parseNumberInput("  3,1416 ")).toBeCloseTo(3.1416);
    expect(parseNumberInput("abc")).toBeNull();
    expect(parseNumberInput("")).toBeNull();
  });

  test("coerceNumber conserva números válidos y convierte textos numéricos", () => {
    expect(coerceNumber(2.5)).toBe(2.5);
    expect(coerceNumber("2,5")).toBe(2.5);
    expect(coerceNumber(null)).toBeNull();
  });

  test("identifica entradas parciales", () => {
    expect(isPartialNumberInput("")).toBe(true);
    expect(isPartialNumberInput("+")).toBe(true);
    expect(isPartialNumberInput("-")).toBe(true);
    expect(isPartialNumberInput(".")).toBe(true);
    expect(isPartialNumberInput("12.3")).toBe(false);
    expect(isPartialNumberInput("12.")).toBe(false);
    expect(isPartialNumberInput("12x")).toBe(false);
  });

  test("formatea con escala para preview de input", () => {
    expect(formatNumberInput(1.5, 100)).toBe("150");
    expect(formatNumberInput("1,5", 1)).toBe("1.5");
    expect(formatNumberInput("", 1)).toBe("");
  });

  test("elige step por heurística de proporciones", () => {
    expect(inferNumberStep(baseMeta({ name: "umbral_prueba" }), 0.12)).toBe(0.0001);
    expect(inferNumberStep(baseMeta({ unidad: "proporción" }), 0.12)).toBe(0.01);
    expect(inferNumberStep(baseMeta({ unidad: "px" }), 2.3)).toBe(0.1);
    expect(inferNumberStep(baseMeta({ unidad: "px", min: 0, max: 2 }), 1)).toBe(0.01);
  });

  test("evalúa texto y rechaza out of range como error", () => {
    const meta = baseMeta({ min: 0, max: 1, name: "factor" });

    const ok = evaluateNumberDraft("0,75", {
      min: 0,
      max: 1,
      meta,
      displayScale: 1,
      step: 0.01,
    });
    expect(ok.state).toBe("default");
    expect(ok.parsedInternal).toBeCloseTo(0.75);
    expect(ok.message).toBe("");

    const high = evaluateNumberDraft("10", {
      min: 0,
      max: 1,
      meta,
      displayScale: 1,
      step: 0.01,
    });
    expect(high.state).toBe("error");
    expect(high.parsedInternal).toBeNull();
    expect(high.message).toContain("Máximo permitido");
  });

  test("rechaza decimales fuera de rango sin devolver valor parseado", () => {
    const meta = baseMeta({ name: "decimales", min: 0, max: 4, step: 1 });

    for (const raw of ["-1", "-5", "5"]) {
      const result = evaluateNumberDraft(raw, {
        min: 0,
        max: 4,
        meta,
        displayScale: 1,
        step: 1,
      });
      expect(result.state).toBe("error");
      expect(result.parsedInternal).toBeNull();
    }

    for (const raw of ["0", "2", "4"]) {
      const result = evaluateNumberDraft(raw, {
        min: 0,
        max: 4,
        meta,
        displayScale: 1,
        step: 1,
      });
      expect(result.state).toBe("default");
      expect(result.parsedInternal).toBe(Number(raw));
    }
  });

  test("rechaza decimales de promedio por encima de 2", () => {
    const meta = baseMeta({ name: "decimales_promedio", min: 0, max: 2, step: 1 });
    const result = evaluateNumberDraft("3", {
      min: 0,
      max: 2,
      meta,
      displayScale: 1,
      step: 1,
    });

    expect(result.state).toBe("error");
    expect(result.parsedInternal).toBeNull();
  });

  test("evalúa vacíos/parciales como estado por defecto", () => {
    const meta = baseMeta();
    expect(
      evaluateNumberDraft("", {
        min: 0,
        max: 10,
        meta,
        displayScale: 1,
        step: 1,
      }).state,
    ).toBe("default");

    expect(
      evaluateNumberDraft(".", {
        min: 0,
        max: 10,
        meta,
        displayScale: 1,
        step: 1,
      }).state,
    ).toBe("default");
  });
});
