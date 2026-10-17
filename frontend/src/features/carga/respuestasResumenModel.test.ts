import { describe, expect, it } from "vitest";
import { partesPreparacion, textoCompatibilidad } from "./respuestasResumenModel";

describe("resumen de Respuestas", () => {
  it("escribe los plurales y omite lo que vale cero", () => {
    expect(partesPreparacion({ applied: true, aliases: 0, select_multiple: 10, extra_columns: 18 })).toEqual([
      "10 selecciones múltiples reconstruidas",
      "18 columnas auxiliares al final",
    ]);
    expect(partesPreparacion({ applied: true, aliases: 1, select_multiple: 1 })).toEqual([
      "1 nombre ajustado",
      "1 selección múltiple reconstruida",
    ]);
    expect(partesPreparacion({ applied: false, aliases: 3, select_multiple: 2 })).toEqual([]);
  });

  it("dice cómo calza con el formulario sin «(s)»", () => {
    expect(textoCompatibilidad({
      applied: true, ok: true, expected_columns: 118, matched_columns: 118,
      missing_columns: [], extra_columns: [], n_extra: 20,
    })).toEqual({ ok: true, texto: "Calza con el formulario · 118 de 118 preguntas · 20 columnas que no son del formulario" });
    expect(textoCompatibilidad({
      applied: true, ok: false, expected_columns: 10, matched_columns: 9,
      missing_columns: ["q4"], extra_columns: ["x"],
    })?.texto).toBe("No calza con el formulario · 9 de 10 preguntas · faltan q4 · 1 columna que no es del formulario");
  });
});
