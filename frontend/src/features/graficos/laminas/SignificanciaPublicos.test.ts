import { describe, expect, it } from "vitest";
import type { EquivalenciaFila } from "../../../api/equivalencias";
import { temasComparables } from "./SignificanciaPublicos";

const fila = (extra: Partial<EquivalenciaFila>): EquivalenciaFila => ({
  seccion: "Apoyo",
  etiqueta_estandar: "Recurrió a alguna instancia",
  variables: { b2024: "P28_1", b2025: "P28_1" },
  cantidad: 2,
  ...extra,
} as EquivalenciaFila);

describe("temasComparables", () => {
  it("ofrece la pregunta simple en dos públicos", () => {
    expect(temasComparables([fila({})])).toHaveLength(1);
  });

  it("deja fuera el indicador compuesto: su columna no existe en los datos de Gráficos (ADR 0105)", () => {
    const compuesta = fila({
      variables: { b2024: "alguna(P28_1,P28_2)", b2025: "alguna(P28_1,P28_2)" },
      derivada: {
        regla: "alguna",
        por_base: {
          b2024: { variables: ["P28_1", "P28_2"], codigos: ["1"] },
          b2025: { variables: ["P28_1", "P28_2"], codigos: ["1"] },
        },
      },
    });
    expect(temasComparables([compuesta])).toHaveLength(0);
  });
});
