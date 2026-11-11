import { describe, expect, it } from "vitest";
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { actoresDePropuesta, escenariosIniciales, payloadPropuesta, totalEscenario } from "./modeloPropuesta";

const comp = (id: string, cat: string, N: number, meta?: number, n_objetivo?: number) =>
  ({ id, actor: id, actor_id: id, actor_categoria: cat, marco: { marco_validado: N }, meta: { valor: meta ?? 0 },
     resultado: n_objetivo == null ? undefined : { n_objetivo } } as unknown as CalcMuestraComponente);

describe("propuesta de escenarios", () => {
  const comps = [comp("doc", "docentes", 2599, 900), comp("egr", "egresados", 11246, 0, 600), comp("emp", "empleadores", 30), comp("adm", "administrativos", 0)];

  it("entran sólo los actores cuantitativos con N", () => {
    expect(actoresDePropuesta(comps).map((f) => f.id)).toEqual(["doc", "egr"]);
  });

  it("la A parte de la meta fijada (o la del motor) y la B es dos tercios", () => {
    const { A, B } = escenariosIniciales(comps);
    expect(A).toEqual({ doc: 900, egr: 600 });
    expect(B).toEqual({ doc: 600, egr: 400 });
    expect(totalEscenario(A, actoresDePropuesta(comps))).toBe(1500);
  });

  it("el cuerpo lleva los dos escenarios, las opciones y el solicitante rotulado", () => {
    const filas = actoresDePropuesta(comps);
    const p = payloadPropuesta("pptx", { A: { doc: 900, egr: 600, emp: 5 }, B: { doc: 600, egr: 400 } }, filas,
      { portada: false, diseno: true, solicitante: " DCI " });
    expect(p.escenarios).toEqual([
      { nombre: "Propuesta A", metas: { doc: 900, egr: 600 } },
      { nombre: "Propuesta B", metas: { doc: 600, egr: 400 } },
    ]);
    expect(p.incluir_portada).toBe(false);
    expect(p.solicitante).toBe("Solicitante: DCI");
    expect(payloadPropuesta("xlsx", { A: {}, B: {} }, filas, { portada: true, diseno: true, solicitante: "" }).solicitante).toBeUndefined();
  });
});
