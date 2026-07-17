import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraAulasParticularidades,
  type CalcMuestraParticularidadDecision,
} from "../../../../../api/client";
import {
  normalizeParticularidadesDecisiones,
  resumenDecisiones,
  setDecisionParticularidad,
  setNotaParticularidad,
} from "../particularidadesModel";

describe("setDecisionParticularidad / setNotaParticularidad — reducción inmutable", () => {
  it("fija una decisión nueva sin mutar el record anterior", () => {
    const antes: Record<string, CalcMuestraParticularidadDecision> = {};
    const despues = setDecisionParticularidad(antes, "CH-01", "excluir");
    expect(despues["CH-01"]).toEqual({ decision: "excluir" });
    expect(antes).toEqual({});
  });

  it("null limpia la decisión (vuelve a pendiente) y descarta su nota", () => {
    const antes = { "CH-01": { decision: "excluir" as const, nota: "local externo" } };
    const despues = setDecisionParticularidad(antes, "CH-01", null);
    expect(despues["CH-01"]).toBeUndefined();
    expect(antes["CH-01"]).toEqual({ decision: "excluir", nota: "local externo" });
  });

  it("cambiar de decisión conserva la nota documentada", () => {
    const antes = { "CH-01": { decision: "revisado" as const, nota: "consultar a DTI" } };
    const despues = setDecisionParticularidad(antes, "CH-01", "excluir");
    expect(despues["CH-01"]).toEqual({ decision: "excluir", nota: "consultar a DTI" });
  });

  it("la nota exige decisión previa (no crea entradas huérfanas) y vacía se limpia", () => {
    expect(setNotaParticularidad({}, "CH-01", "hola")).toEqual({});
    const conDecision = { "CH-01": { decision: "incluir" as const } };
    const conNota = setNotaParticularidad(conDecision, "CH-01", "  cubre EEGG  ");
    expect(conNota["CH-01"]).toEqual({ decision: "incluir", nota: "cubre EEGG" });
    const notaLimpia = setNotaParticularidad(conNota, "CH-01", "   ");
    expect(notaLimpia["CH-01"]).toEqual({ decision: "incluir" });
  });

  it("resumenDecisiones cuenta por tipo y deja el resto como pendiente", () => {
    const decisiones = {
      a: { decision: "incluir" as const },
      b: { decision: "excluir" as const },
      c: { decision: "excluir" as const },
      d: { decision: "revisado" as const },
    };
    expect(resumenDecisiones(["a", "b", "c", "d", "e", "f"], decisiones)).toEqual({
      total: 6,
      incluir: 1,
      excluir: 2,
      revisado: 1,
      pendientes: 2,
    });
  });
});

describe("normalizeParticularidadesDecisiones — round-trip por jsonlite", () => {
  it("desempaca decision/nota que llegan como arrays de 1 elemento", () => {
    const raw = { "CH-01": { decision: ["excluir"], nota: ["queda lejos"] } };
    expect(normalizeParticularidadesDecisiones(raw)).toEqual({
      "CH-01": { decision: "excluir", nota: "queda lejos" },
    });
  });

  it("descarta entradas sin decisión reconocible (nada se auto-decide)", () => {
    const raw = {
      "CH-01": { decision: "excluir" },
      "CH-02": { decision: "borrar" },
      "CH-03": "excluir",
      "": { decision: "incluir" },
    };
    expect(normalizeParticularidadesDecisiones(raw)).toEqual({
      "CH-01": { decision: "excluir" },
    });
  });

  it("payload ausente o con forma inválida degrada a {}", () => {
    expect(normalizeParticularidadesDecisiones(undefined)).toEqual({});
    expect(normalizeParticularidadesDecisiones(null)).toEqual({});
    expect(normalizeParticularidadesDecisiones([1, 2])).toEqual({});
    expect(normalizeParticularidadesDecisiones("x")).toEqual({});
  });
});

describe("normalizeCalcMuestraAulasParticularidades — contrato v1 defensivo", () => {
  it("normaliza el payload completo del backend (escalares, strings numéricos)", () => {
    const raw = {
      schema: ["calc_muestra_aulas_particularidades_v1"],
      session_type_dominante: { categoria: ["CLASE"], share: ["0.94"], total_categorias: ["3"] },
      multi_facultad: [
        { id: "CH-10", curso: "MATE BÁSICA", facultades: ["CIENCIAS", "DERECHO"], n_facultades: "2" },
      ],
      codigo_z: { id: "CH-20", curso: "DEPORTE", codigo: "Z101" },
      nombre_tesis: [{ id: "CH-30", curso: "TESIS 2", nivel: "10" }],
      counts: { multi_facultad: "5", codigo_z: 1, nombre_tesis: 1 },
    };
    const out = normalizeCalcMuestraAulasParticularidades(raw);
    expect(out).not.toBeNull();
    expect(out?.session_type_dominante).toEqual({ categoria: "CLASE", share: 0.94, total_categorias: 3 });
    expect(out?.multi_facultad).toEqual([
      { id: "CH-10", curso: "MATE BÁSICA", facultades: ["CIENCIAS", "DERECHO"], n_facultades: 2 },
    ]);
    // jsonlite puede desempacar la lista de 1 fila a objeto: se recupera.
    expect(out?.codigo_z).toEqual([{ id: "CH-20", curso: "DEPORTE", codigo: "Z101" }]);
    expect(out?.nombre_tesis).toEqual([{ id: "CH-30", curso: "TESIS 2", nivel: "10" }]);
    // counts conserva el total real aunque las filas vengan capadas.
    expect(out?.counts).toEqual({ multi_facultad: 5, codigo_z: 1, nombre_tesis: 1 });
  });

  it("sin dominante ('NA'/vacío) queda null y no rompe el resto", () => {
    const raw = {
      schema: "calc_muestra_aulas_particularidades_v1",
      session_type_dominante: { categoria: "NA", share: "NA", total_categorias: "NA" },
      multi_facultad: [],
      codigo_z: [],
      nombre_tesis: [],
      counts: {},
    };
    const out = normalizeCalcMuestraAulasParticularidades(raw);
    expect(out?.session_type_dominante).toBeNull();
    expect(out?.counts).toEqual({ multi_facultad: 0, codigo_z: 0, nombre_tesis: 0 });
  });

  it("payload ausente o irreconocible degrada a null (la UI se comporta como hoy)", () => {
    expect(normalizeCalcMuestraAulasParticularidades(null)).toBeNull();
    expect(normalizeCalcMuestraAulasParticularidades(undefined)).toBeNull();
    expect(normalizeCalcMuestraAulasParticularidades("x")).toBeNull();
    expect(normalizeCalcMuestraAulasParticularidades({})).toBeNull();
  });

  it("filas sin id se descartan (no hay decisión posible sin clave estable)", () => {
    const raw = {
      schema: "calc_muestra_aulas_particularidades_v1",
      session_type_dominante: null,
      multi_facultad: [{ curso: "SIN ID", facultades: ["A", "B"], n_facultades: 2 }],
      codigo_z: [],
      nombre_tesis: [],
      counts: { multi_facultad: 1 },
    };
    const out = normalizeCalcMuestraAulasParticularidades(raw);
    expect(out?.multi_facultad).toEqual([]);
  });
});
