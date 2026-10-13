import { describe, expect, test } from "vitest";
import type { VariableInstrumento } from "../../../api/client";
import { columnasCandidatasAPeso } from "./PesoPorColumna";

const v = (name: string, extra: Partial<VariableInstrumento>): VariableInstrumento => ({
  name, label: name, tipo: "decimal", list_name: "", ...extra,
});

describe("columnasCandidatasAPeso", () => {
  test("sólo numéricas no categóricas, con las que nombran un peso primero", () => {
    const out = columnasCandidatasAPeso([
      v("edad", { numerica: true }),
      v("sexo", { numerica: true, categorica: true }),
      v("factor_ponderacion", { numerica: true }),
      v("nombre", {}),
    ]);
    expect(out.map((x) => x.name)).toEqual(["factor_ponderacion", "edad"]);
  });
});
