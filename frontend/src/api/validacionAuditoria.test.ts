import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiAuditar,
  apiAuditoriaEstado,
  apiCaso,
  apiReglaProbar,
  normalizarAplicabilidad,
  normalizarAuditoriaEstado,
  normalizarCaseIds,
  normalizarCaso,
  normalizarCifrasHallazgos,
  normalizarCoincideCon,
  normalizarEsperado,
  normalizarIdentificacionCasos,
  normalizarPruebaDeRegla,
  normalizarVistaPrevia,
} from "./validacionAuditoria";

// Cargas reales del contrato M2 (Corrección 15-M), copiadas de
// scratchpad/CONTRATO_VALIDACION_M2.md, y las formas que Plumber produce:
// escalar en vector de uno, lista de uno como objeto, NULL como {}, NA como null.

const CIFRAS_AUDIT_REFERENCE = {
  n_hallazgos: 3,
  n_reglas_evaluadas: 20,
  n_reglas_con_casos: 2,
  n_casos_evaluados: 72,
  n_encuestados_con_hallazgos: 3,
  n_registros_sin_encuestado: 0,
  n_casos_con_hallazgos: 3,
  por_tabla: [
    { tabla: "principal", nivel: "encuestado", n_registros: 72, n_hallazgos: 3,
      n_registros_con_hallazgos: 3, n_encuestados_con_hallazgos: 3, n_registros_sin_encuestado: 0 },
  ],
};

describe("cifras_hallazgos", () => {
  it("lee la carga real de audit_reference con su grano", () => {
    const c = normalizarCifrasHallazgos(CIFRAS_AUDIT_REFERENCE);
    expect(c).toEqual({
      n_hallazgos: 3,
      n_reglas_evaluadas: 20,
      n_reglas_con_casos: 2,
      n_casos_evaluados: 72,
      n_encuestados_con_hallazgos: 3,
      n_registros_sin_encuestado: 0,
      por_tabla: [
        { tabla: "principal", nivel: "encuestado", n_registros: 72, n_hallazgos: 3,
          n_registros_con_hallazgos: 3, n_encuestados_con_hallazgos: 3, n_registros_sin_encuestado: 0 },
      ],
    });
  });

  it("no expone el conteo de compatibilidad que mezcla grano", () => {
    expect(normalizarCifrasHallazgos(CIFRAS_AUDIT_REFERENCE)).not.toHaveProperty("n_casos_con_hallazgos");
  });

  it("sin auditoría (null, NA, {} o []) no hay cifras", () => {
    for (const vacio of [null, undefined, "NA", {}, [], [null]]) {
      expect(normalizarCifrasHallazgos(vacio)).toBeNull();
    }
  });

  it("sin cuántas reglas evaluó no hay cifras, en vez de un cero", () => {
    expect(normalizarCifrasHallazgos({ n_hallazgos: 0, n_casos_evaluados: 72 })).toBeNull();
  });

  it("una cifra ausente queda null, no 0", () => {
    const c = normalizarCifrasHallazgos({ n_reglas_evaluadas: [5], n_casos_evaluados: null, n_encuestados_con_hallazgos: "NA" });
    expect(c?.n_reglas_evaluadas).toBe(5);
    expect(c?.n_casos_evaluados).toBeNull();
    expect(c?.n_encuestados_con_hallazgos).toBeNull();
  });

  it("una hija de grupo repetido cuenta registros; un objeto suelto es una lista de uno", () => {
    const c = normalizarCifrasHallazgos({
      n_reglas_evaluadas: 192,
      por_tabla: { tabla: "rep_servicios", n_registros: 667, n_registros_con_hallazgos: 40, n_encuestados_con_hallazgos: 35 },
    });
    expect(c?.por_tabla).toEqual([
      { tabla: "rep_servicios", nivel: "registro", n_registros: 667, n_hallazgos: null,
        n_registros_con_hallazgos: 40, n_encuestados_con_hallazgos: 35, n_registros_sin_encuestado: null },
    ]);
  });
});

describe("identificacion_casos", () => {
  it("lee los dos métodos de la base auditada", () => {
    expect(normalizarIdentificacionCasos({ metodo: "columna_candidata", columna: "respondent_id", n_filas: 72, n_filas_sin_llave: 0 }))
      .toEqual({ metodo: "columna_candidata", columna: "respondent_id", n_filas: 72, n_filas_sin_llave: 0 });
    expect(normalizarIdentificacionCasos({ metodo: ["numero_fila"], columna: null, n_filas: 10 }))
      .toEqual({ metodo: "numero_fila", columna: null, n_filas: 10, n_filas_sin_llave: null });
  });

  it("sin auditoría o con un método desconocido no hay identificación", () => {
    expect(normalizarIdentificacionCasos(null)).toBeNull();
    expect(normalizarIdentificacionCasos({})).toBeNull();
    expect(normalizarIdentificacionCasos({ metodo: "huella" })).toBeNull();
  });
});

describe("aplicable y motivo_no_aplicable", () => {
  it("lee los cinco motivos del contrato", () => {
    for (const m of ["columna_ausente", "numeracion_anterior", "auditoria_sin_fila_de_origen", "regla_sin_casos", "sin_filas_en_principal"]) {
      const a = normalizarAplicabilidad({ aplicable: false, motivo_no_aplicable: m });
      expect(a.aplicable).toBe(false);
      expect(a.motivo_no_aplicable).toBe(m);
    }
  });

  it("los motivos de la llave declarada se agrupan y uno desconocido queda como otro, con su texto", () => {
    expect(normalizarAplicabilidad({ aplicable: false, motivo_no_aplicable: "llave_sin_valor" }).motivo_no_aplicable).toBe("llave_declarada");
    const otro = normalizarAplicabilidad({ aplicable: [false], motivo_no_aplicable: ["nuevo_motivo"] });
    expect(otro.motivo_no_aplicable).toBe("otro");
    expect(otro.motivo_crudo).toBe("nuevo_motivo");
  });

  it("null (sin auditoría) no se lee como aplicable ni como no aplicable", () => {
    const a = normalizarAplicabilidad({ aplicable: null, motivo_no_aplicable: null });
    expect(a.aplicable).toBeNull();
    expect(a.motivo_no_aplicable).toBeNull();
    expect(normalizarAplicabilidad({}).aplicable).toBeNull();
  });

  it("una decisión aplicable no lleva motivo aunque llegue uno", () => {
    const a = normalizarAplicabilidad({ aplicable: true, motivo_no_aplicable: "regla_sin_casos" });
    expect(a.aplicable).toBe(true);
    expect(a.motivo_no_aplicable).toBeNull();
  });

  it("lee el registro de los casos resueltos al pasar a lista", () => {
    const a = normalizarAplicabilidad({
      id: "PD_001", aplicable: true, target_case_ids_resueltos: ["AUD-009", "AUD-041"],
      casos_resueltos_en: "2026-11-11T18:22:44Z", identificacion_casos: { metodo: "anterior", columna: "response_id" },
    });
    expect(a.target_case_ids_resueltos).toEqual(["AUD-009", "AUD-041"]);
    expect(a.casos_resueltos_en).toBe("2026-11-11T18:22:44Z");
    expect(a.identificacion_casos?.metodo).toBe("anterior");
  });
});

describe("before_after_preview", () => {
  it("lee las filas nuevas y los avisos", () => {
    const p = normalizarVistaPrevia({
      before: { filas_base: 72, filas_evaluadas: 70, filas_fuera_universo: 2, total_inconsistencias: 3 },
      after: { filas_base: 69, filas_evaluadas: 67, filas_fuera_universo: 2, total_inconsistencias: 0 },
      impact: { cases_excluded: 3 },
      decisions_ready: 2,
      warnings: ["La decisión PD_001 no se aplica: la regla ya no marca casos en la última auditoría."],
    });
    expect(p?.before.filas_evaluadas).toBe(70);
    expect(p?.after.filas_fuera_universo).toBe(2);
    expect(p?.casos_excluidos).toBe(3);
    expect(p?.warnings).toHaveLength(1);
  });

  it("una auditoría anterior a la corrección deja las filas nuevas en null y un aviso suelto es una lista", () => {
    const p = normalizarVistaPrevia({ before: { filas_base: null, filas_fuera_universo: null }, after: {}, warnings: "Un aviso" });
    expect(p?.before.filas_base).toBeNull();
    expect(p?.before.filas_fuera_universo).toBeNull();
    expect(p?.warnings).toEqual(["Un aviso"]);
    expect(normalizarVistaPrevia(null)).toBeNull();
  });
});

describe("case_ids, esperado y coincide_con", () => {
  it("un id null queda null: no se inventa", () => {
    expect(normalizarCaseIds(["AUD-009", null, "NA", ""])).toEqual(["AUD-009", null, null, null]);
    expect(normalizarCaseIds("AUD-009")).toEqual(["AUD-009"]);
    expect(normalizarCaseIds(undefined)).toEqual([]);
  });

  it("esperado tiene el largo de casos, con null donde no hay enunciado", () => {
    const e = normalizarEsperado([
      { anomalia_tipo: "valor_invalido", sujeto: "AUD-009", hecho: "Respondió 17 en Edad", choque: "y ese valor no está entre las opciones" },
      null,
    ], 3);
    expect(e).toHaveLength(3);
    expect(e[0]?.choque).toBe("y ese valor no está entre las opciones");
    expect(e[1]).toBeNull();
    expect(e[2]).toBeNull();
  });

  it("coincide_con: null de la regla no es [] de una fila ni null de una fila sin pareja", () => {
    expect(normalizarCoincideCon(null, 4)).toBeNull();
    expect(normalizarCoincideCon(undefined, 4)).toBeNull();
    const c = normalizarCoincideCon([
      [{ id_caso: "e3", similitud: 0.9167, n_comparables: 12, n_coincidencias: 11 }],
      null,
      [],
      { id_caso: "e5", similitud: 1, n_comparables: 12, n_coincidencias: 12 },
    ], 4);
    expect(c).toEqual([
      [{ id_caso: "e3", similitud: 0.9167, n_comparables: 12, n_coincidencias: 11 }],
      null,
      [],
      [{ id_caso: "e5", similitud: 1, n_comparables: 12, n_coincidencias: 12 }],
    ]);
  });

  it("una sola fila marcada sin pareja ([null]) sigue siendo de la regla de casi iguales", () => {
    expect(normalizarCoincideCon([null], 1)).toEqual([null]);
  });
});

describe("estado de la auditoría, prueba de regla y caso", () => {
  it("lee el estado y rechaza uno desconocido", () => {
    const e = normalizarAuditoriaEstado({
      ok: true, base_nombre: "auditoria", estado: "desactualizada", auditada_en: "2026-11-11T18:22:42Z",
      n_reglas_vigentes: 21, n_reglas_auditadas: 20, cambios: { agregadas: ["RC_1"], quitadas: [], modificadas: {} },
    });
    expect(e.estado).toBe("desactualizada");
    expect(e.cambios).toEqual({ agregadas: ["RC_1"], quitadas: [], modificadas: [] });
    expect(normalizarAuditoriaEstado({ estado: "sin_auditoria", auditada_en: null }).auditada_en).toBeNull();
    expect(() => normalizarAuditoriaEstado({ estado: "rara" })).toThrow(/desconocido/);
  });

  it("la prueba de una regla conserva n_base como base de la proporción y un id de ejemplo null", () => {
    const p = normalizarPruebaDeRegla({
      estado: "evaluada", evaluada: true, n_filas: 178, n_base: 142, n_casos: 4, proporcion: 4 / 142,
      ejemplos: [{ id_caso: null, valores: [{ variable: "p4", valor: "2025", papel: "revisada", falla: true }] }],
    });
    expect(p.n_base).toBe(142);
    expect(p.proporcion).toBeCloseTo(0.0282, 4);
    expect(p.ejemplos[0].id_caso).toBeNull();
    expect(p.ejemplos[0].valores[0]).toEqual({ variable: "p4", valor: "2025", papel: "revisada", falla: true });
  });

  it("sin datos la proporción es null, no 0", () => {
    const p = normalizarPruebaDeRegla({ estado: "sin_datos", base_vacia: true, n_filas: 0, n_base: 0, n_casos: 0, proporcion: null });
    expect(p.estado).toBe("sin_datos");
    expect(p.proporcion).toBeNull();
  });

  it("el caso completo trae sus secciones y sus hallazgos", () => {
    const c = normalizarCaso({
      ok: true, base_nombre: "auditoria", id_caso: "AUD-009", tabla: "principal", fila: 9, n_filas_con_el_id: 1,
      en_otras_tablas: [], instrumento_leido: true,
      secciones: [{ seccion: "identificacion", etiqueta: "Identificacion", variables: [
        { variable: "edad", etiqueta: "Edad", tipo: "integer", valor: "17", valor_etiqueta: null },
        { variable: "servicios", etiqueta: "Servicios usados", tipo: "select_multiple", valor: "2 3",
          opciones: [{ codigo: "2", etiqueta: "Informacion" }, { codigo: "3", etiqueta: "Seguimiento" }] },
      ] }],
      hallazgos: { id_regla: "VR_constraint_cbe6c3cc", clase: "inconsistencia_xlsform", variables: { variable: "edad", etiqueta: "Edad" } },
    });
    expect(c.secciones[0].variables.map((v) => v.variable)).toEqual(["edad", "servicios"]);
    expect(c.secciones[0].variables[1].opciones).toHaveLength(2);
    expect(c.hallazgos).toEqual([
      { id_regla: "VR_constraint_cbe6c3cc", nombre: null, clase: "inconsistencia_xlsform", tipo_regla: null, tabla: null,
        variables: [{ variable: "edad", etiqueta: "Edad" }] },
    ]);
    expect(() => normalizarCaso({ ok: true })).toThrow(/identificador del caso/);
  });
});

describe("clientes HTTP", () => {
  afterEach(() => vi.unstubAllGlobals());

  function espiar(cuerpo: unknown) {
    const f = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", f);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-prueba"), setItem: vi.fn(), removeItem: vi.fn() });
    return f;
  }

  it("auditar es un POST a /auditoria con la base en la cabecera", async () => {
    const f = espiar({ ok: true, job_id: "J1", base_nombre: "egresados", n_reglas: 97 });
    const r = await apiAuditar("egresados");
    expect(r.job_id).toBe("J1");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/api/validacion/v2/auditoria");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-Base-Nombre"]).toBe("egresados");
    expect((init?.headers as Record<string, string>)["X-Pulso-Session"]).toBe("sid-prueba");
  });

  it("el estado es un GET a /auditoria/estado", async () => {
    const f = espiar({ ok: true, estado: "vigente", auditada_en: "2026-11-08T10:00:00Z" });
    expect((await apiAuditoriaEstado()).estado).toBe("vigente");
    expect(String(f.mock.calls[0][0])).toContain("/api/validacion/v2/auditoria/estado");
  });

  it("probar manda la regla tal cual y pasa la señal de cancelación", async () => {
    const f = espiar({ estado: "evaluada", evaluada: true, n_casos: 2 });
    const control = new AbortController();
    await apiReglaProbar({ tipo: "rango_num", variables: ["edad"] }, null, { signal: control.signal });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/api/validacion/v2/reglas_custom/probar");
    expect(JSON.parse(String(init?.body))).toEqual({ tipo: "rango_num", variables: ["edad"] });
    expect(init?.signal).toBe(control.signal);
  });

  it("el caso viaja por consulta, codificado", async () => {
    const f = espiar({ ok: true, id_caso: "principal::row::3" });
    await apiCaso("principal::row::3");
    expect(String(f.mock.calls[0][0])).toContain("/api/validacion/v2/caso?id=principal%3A%3Arow%3A%3A3");
  });
});
