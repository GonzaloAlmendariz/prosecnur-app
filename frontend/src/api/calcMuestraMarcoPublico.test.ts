import { describe, expect, it } from "vitest";

import { normalizarCruce, normalizarEmbudo, normalizarLectura } from "./calcMuestraMarcoPublico";

describe("normalizadores del marco de un público", () => {
  it("un cruce con arreglos de uno desempacados por jsonlite conserva sus filas y columnas", () => {
    const c = normalizarCruce({
      fila_variable: "CAT", columna_variable: "", filas: "Contratado", columnas: "Total",
      conteos: { categoria: "Contratado", valores: 1861 }, total: 1861,
    });
    expect(c).toEqual({ filaVariable: "CAT", columnaVariable: "", filas: ["Contratado"], columnas: ["Total"], conteos: [[1861]], total: 1861 });
  });

  it("una lectura sin archivo no tiene forma; una columna con uso desconocido vale No se usa", () => {
    expect(normalizarLectura({ hoja: "x" })).toBeNull();
    const l = normalizarLectura({
      archivo: { formato: "xlsx", hojas: { nombre: "datos", tipo: "datos", filas: 3, columnas: 1, encabezado_fila: 1 }, sugerida: "datos" },
      hoja: "datos", filas: 3, columnas: [{ nombre: "ID", tipo: "codigo", uso_sugerido: "otro", valores: 3 }],
    });
    expect(l?.hojas).toHaveLength(1);
    expect(l?.columnas[0]).toMatchObject({ nombre: "ID", tipo: "codigo", usoSugerido: "no", distribucion: [] });
  });

  it("el embudo sin base no tiene forma y sus pasos conservan la resta", () => {
    expect(normalizarEmbudo({})).toBeNull();
    const e = normalizarEmbudo({ base: 10, invitados: 8, pasos: { tipo: "excluir_valores", etiqueta: "x", columna: "C", valores: "A", quitadas: 2, quedan: 8 } });
    expect(e?.pasos[0]).toMatchObject({ valores: ["A"], quitadas: 2, quedan: 8 });
  });
});
