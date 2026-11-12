import { describe, expect, it } from "vitest";
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import {
  actoresDePropuesta,
  agregarPropuesta,
  escalaDeRespuesta,
  fijarMeta,
  lecturaMeta,
  margenReferencia,
  payloadPropuesta,
  propuestasIniciales,
  propuestaVigente,
  quitarUltimaPropuesta,
  totalPropuesta,
} from "./modeloPropuesta";

const comp = (id: string, cat: string, N: number, meta?: number, n_objetivo?: number, tasa?: number) =>
  ({ id, actor: id, actor_id: id, actor_categoria: cat, marco: { marco_validado: N }, meta: { valor: meta ?? 0 },
     parametros: { tasa_respuesta: tasa ?? 0 },
     resultado: n_objetivo == null ? undefined : { n_objetivo } } as unknown as CalcMuestraComponente);

describe("propuestas de muestra de un barrido", () => {
  const comps = [comp("doc", "docentes", 2599, 900, undefined, 0.221), comp("egr", "egresados", 11246, 0, 600, 0.073),
    comp("emp", "empleadores", 30), comp("adm", "administrativos", 0)];

  it("entran sólo los actores cuantitativos con N, con su respuesta esperada", () => {
    const filas = actoresDePropuesta(comps);
    expect(filas.map((f) => f.id)).toEqual(["doc", "egr"]);
    expect(filas[0]?.respuestaEsperada).toBe(0.221);
  });

  it("sin nada guardado parte de tres propuestas: la meta, dos tercios y la mitad", () => {
    const [A, B, C] = propuestasIniciales(comps);
    expect([A?.nombre, B?.nombre, C?.nombre]).toEqual(["Propuesta A", "Propuesta B", "Propuesta C"]);
    expect(A?.metas).toEqual({ doc: 900, egr: 600 });
    expect(B?.metas).toEqual({ doc: 600, egr: 400 });
    expect(C?.metas).toEqual({ doc: 450, egr: 300 });
    expect(totalPropuesta(A?.metas ?? {}, actoresDePropuesta(comps))).toBe(1500);
  });

  it("lo guardado en el estudio manda; un actor agregado después toma su meta de partida", () => {
    const v = propuestaVigente({ escenarios: [{ nombre: "Propuesta A", metas: { doc: 550 } }], solicitante: "DCI", incluir_portada: false, incluir_diseno: true }, comps);
    expect(v.escenarios).toHaveLength(1);
    expect(v.escenarios[0]?.metas).toEqual({ doc: 550, egr: 600 });
    expect(v.incluir_portada).toBe(false);
    // Un `metas` vacío llega de R como [] y no rompe.
    const vacio = propuestaVigente({ escenarios: [{ nombre: "", metas: [] as unknown as Record<string, number> }], solicitante: "", incluir_portada: true, incluir_diseno: true }, comps);
    expect(vacio.escenarios[0]).toEqual({ nombre: "Propuesta A", metas: { doc: 900, egr: 600 } });
  });

  it("se agrega al final hasta cuatro y se quita la última, dejando siempre una", () => {
    let e = propuestaVigente(null, comps);
    e = agregarPropuesta(e);
    expect(e.escenarios.map((x) => x.nombre)).toEqual(["Propuesta A", "Propuesta B", "Propuesta C", "Propuesta D"]);
    expect(e.escenarios[3]?.metas).toEqual({ doc: 338, egr: 225 });
    expect(agregarPropuesta(e).escenarios).toHaveLength(4);
    e = quitarUltimaPropuesta(quitarUltimaPropuesta(quitarUltimaPropuesta(e)));
    expect(quitarUltimaPropuesta(e).escenarios).toHaveLength(1);
    expect(fijarMeta(e, 0, "doc", 549.6).escenarios[0]?.metas.doc).toBe(550);
  });

  it("el margen es el del PPT y la meta se marca cuando exige más respuesta que la esperada", () => {
    // DCI 2026, pregrado 2,200 de 22,820: ± 2.0 % (el PPT publica ± 2.0 %).
    expect((margenReferencia(2200, 22820) ?? 0) * 100).toBeCloseTo(1.99, 2);
    expect(margenReferencia(0, 100)).toBeNull();
    expect(margenReferencia(100, 100)).toBe(0);
    const [doc] = actoresDePropuesta(comps);
    if (!doc) throw new Error("falta docentes");
    expect(lecturaMeta(550, doc)).toMatchObject({ excede: false });
    expect(lecturaMeta(550, doc).respuestaNecesaria).toBeCloseTo(0.2116, 4);
    expect(lecturaMeta(600, doc).excede).toBe(true);
    expect(lecturaMeta(600, { ...doc, respuestaEsperada: null }).excede).toBe(false);
  });

  it("el cuerpo lleva las propuestas en orden, las opciones y el solicitante rotulado", () => {
    const filas = actoresDePropuesta(comps);
    const estado = propuestaVigente({ escenarios: [
      { nombre: "Propuesta A", metas: { doc: 550, egr: 450, emp: 5 } },
      { nombre: "Propuesta B", metas: { doc: 450, egr: 380 } },
      { nombre: "Propuesta C", metas: { doc: 350, egr: 300 } },
    ], solicitante: " DCI ", incluir_portada: false, incluir_diseno: true }, comps);
    const p = payloadPropuesta("pptx", estado, filas);
    expect(p.escenarios).toEqual([
      { nombre: "Propuesta A", metas: { doc: 550, egr: 450 } },
      { nombre: "Propuesta B", metas: { doc: 450, egr: 380 } },
      { nombre: "Propuesta C", metas: { doc: 350, egr: 300 } },
    ]);
    expect(p.incluir_portada).toBe(false);
    expect(p.solicitante).toBe("Solicitante: DCI");
    expect(payloadPropuesta("xlsx", { ...estado, solicitante: "" }, filas).solicitante).toBeUndefined();
  });

  it("las barras de respuesta comparten escala entre propuestas: la mayor exigida o esperada, con holgura", () => {
    const filas = actoresDePropuesta(comps);
    const estado = propuestaVigente({ escenarios: [
      { nombre: "Propuesta A", metas: { doc: 650, egr: 450 } },
      { nombre: "Propuesta B", metas: { doc: 450, egr: 380 } },
    ], solicitante: "", incluir_portada: true, incluir_diseno: true }, comps);
    // Docentes A exige 650 / 2,599 = 25.0 %, más que su esperada (22.1 %): manda la escala.
    expect(escalaDeRespuesta(estado, filas)).toBeCloseTo((650 / 2599) * 1.1, 6);
    expect(escalaDeRespuesta({ ...estado, escenarios: [{ nombre: "A", metas: {} }] }, [])).toBe(1);
  });
});
