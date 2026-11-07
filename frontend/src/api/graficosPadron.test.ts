// Normalizador de la propuesta de padrón (GET /api/graficos/resumenes/padron, ADR 0135 §6): un NA llega como null y queda
// sin dato; una meta sin unidad no se escribe; jsonlite puede mandar vectores de uno como arreglos.
import { describe, expect, it } from "vitest";
import { normalizarPadronPropuesto } from "./graficosPadron";

describe("normalizarPadronPropuesto", () => {
  it("lee las filas del motor y deja sin dato lo que llega en null", () => {
    expect(normalizarPadronPropuesto({
      ok: true,
      bases: [
        { base: "docentes", padron: 123, padron_origen: "Cálculo de muestra: marco validado (Docentes)", meta: 60,
          meta_unidad: "porcentaje", meta_origen: "Cálculo de muestra: meta (Docentes)", motivo: "" },
        { base: ["estudiantes"], padron: null, padron_origen: "", meta: null, meta_unidad: null, meta_origen: "",
          motivo: "Sin padrón declarado." },
      ],
    })).toEqual([
      { base: "docentes", padron: 123, padron_origen: "Cálculo de muestra: marco validado (Docentes)", meta: 60,
        meta_unidad: "porcentaje", meta_origen: "Cálculo de muestra: meta (Docentes)", motivo: "" },
      { base: "estudiantes", padron: null, padron_origen: "", meta: null, meta_unidad: null, meta_origen: "",
        motivo: "Sin padrón declarado." },
    ]);
  });

  it("una meta sin unidad conocida, un padrón no positivo o una base repetida no pasan", () => {
    const [f, ...resto] = normalizarPadronPropuesto({ bases: [
      { base: "a", padron: 0, meta: 60, meta_unidad: "rara" }, { base: "a", padron: 9 },
    ] });
    expect(f).toMatchObject({ base: "a", padron: null, meta: null, meta_unidad: null });
    expect(resto).toEqual([]);
    expect(normalizarPadronPropuesto(null)).toEqual([]);
  });
});
