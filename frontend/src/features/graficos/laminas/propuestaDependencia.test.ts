import { describe, expect, it } from "vitest";
import type { GraficadorRef, VarInfo } from "../../../api/graficos";
import { habilitadaPor, proponerDependencia } from "./propuestaDependencia";

const v = (name: string, extra: Partial<VarInfo> = {}): VarInfo & { source: string } =>
  ({ name, label: name, tipo: "select_one", seccion: "", source: "egresados", ...extra });
const variables = [
  v("situacion"),
  v("relacion", { habilitada_por: { var: "situacion", codigos: ["1", "2"], rotulos: ["Dependiente", "Independiente"] } }),
  v("otra", { habilitada_por: {} }),
];
const lamina = (izq: string, der: string) => {
  const g: Record<string, GraficadorRef> = {
    izquierda: { graficador: "p_barras_categoricas", args: { var: `egresados$${izq}` } },
    derecha: { graficador: "p_barras_categoricas", args: { var: `egresados$${der}` } },
  };
  return (slot: string) => g[slot];
};

describe("proponerDependencia (F3)", () => {
  it("propone que dependa el gráfico cuya pregunta habilita el otro, con los rótulos del formulario", () => {
    expect(proponerDependencia(["izquierda", "derecha"], lamina("situacion", "relacion"), variables))
      .toEqual({ de: "izquierda", habilita: ["Dependiente", "Independiente"] });
    expect(proponerDependencia(["izquierda", "derecha"], lamina("relacion", "situacion"), variables))
      .toEqual({ de: "derecha", habilita: ["Dependiente", "Independiente"] });
  });

  it("no propone nada si el formulario no une las dos preguntas", () => {
    expect(proponerDependencia(["izquierda", "derecha"], lamina("otra", "relacion"), variables)).toBeNull();
    expect(proponerDependencia(["izquierda", "derecha"], lamina("situacion", "otra"), variables)).toBeNull();
  });

  it("lee la batería del dependiente", () => {
    const g = (slot: string): GraficadorRef => slot === "izquierda"
      ? { graficador: "p_pie_dicotomico", args: { var: "egresados$situacion" } }
      : { graficador: "p_multi_apiladas", args: { vars: ["egresados$otra", "egresados$relacion"] } };
    expect(proponerDependencia(["izquierda", "derecha"], g, variables)?.de).toBe("izquierda");
  });

  it("un NULL de R ({}) no es una propuesta", () => {
    expect(habilitadaPor({ habilitada_por: {} })).toBeNull();
    expect(habilitadaPor({ habilitada_por: { var: "x", codigos: "1" } })).toEqual({ var: "x", codigos: ["1"], rotulos: ["1"] });
  });
});
