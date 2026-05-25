import { describe, expect, test } from "vitest";
import { ArgMetadata } from "../../api/client";
import { validateNumericArgValue } from "./numericArgValidation";

describe("validateNumericArgValue", () => {
  const meta = (override: Partial<ArgMetadata>): ArgMetadata => ({
    name: "decimales",
    label: "Decimales",
    tipo_input: "number",
    grupo: "filtro",
    min: 0,
    max: 4,
    step: 1,
    ...override,
  });

  test("bloquea decimales persistidos fuera de rango", () => {
    expect(validateNumericArgValue(-1, meta({})).ok).toBe(false);
    expect(validateNumericArgValue("-5", meta({})).ok).toBe(false);
    expect(validateNumericArgValue(5, meta({})).ok).toBe(false);
  });

  test("acepta decimales dentro del rango", () => {
    expect(validateNumericArgValue(0, meta({})).ok).toBe(true);
    expect(validateNumericArgValue("2", meta({})).ok).toBe(true);
    expect(validateNumericArgValue(4, meta({})).ok).toBe(true);
  });

  test("respeta el rango más estricto de decimales del promedio", () => {
    const avgMeta = meta({ name: "decimales_promedio", max: 2 });
    expect(validateNumericArgValue(2, avgMeta).ok).toBe(true);
    expect(validateNumericArgValue(3, avgMeta).ok).toBe(false);
  });
});
