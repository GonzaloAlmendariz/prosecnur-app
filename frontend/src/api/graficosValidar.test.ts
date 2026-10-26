// La validación previa a exportar viene de R con auto_unbox: un solo aviso llega como texto, no como arreglo, y la
// página reventaba en `avisos.filter` («s.filter is not a function», Arte_v1-4, 2026-10-25).
import { describe, expect, it } from "vitest";
import { normalizeGraficosValidacion } from "./graficos";

describe("normalizeGraficosValidacion", () => {
  it("un solo aviso o un solo error en texto se vuelven arreglos", () => {
    const v = normalizeGraficosValidacion({ ok: false, errors: "falta el índice", warnings: "lámina 3: sin gráfico", n_slides: 4 });
    expect(v.warnings).toEqual(["lámina 3: sin gráfico"]);
    expect(v.errors).toEqual(["falta el índice"]);
    expect(v.ok).toBe(false);
    expect(v.n_slides).toBe(4);
  });

  it("vacíos de jsonlite (lista vacía u objeto vacío) quedan como arreglo vacío", () => {
    const v = normalizeGraficosValidacion({ ok: true, errors: [], warnings: {}, n_slides: 1 });
    expect(v.warnings).toEqual([]);
    expect(v.errors).toEqual([]);
  });

  it("los arreglos pasan iguales", () => {
    expect(normalizeGraficosValidacion({ ok: true, errors: [], warnings: ["a", "b"], n_slides: 2 }).warnings).toEqual(["a", "b"]);
  });
});
