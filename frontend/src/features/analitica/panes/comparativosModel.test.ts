import { describe, expect, it } from "vitest";
import { normalizarComparativoResultado } from "../../../api/analitica";
import { ApiError } from "../../../api/core";
import type { EquivalenciaFila, EquivalenciasEstado } from "../../../api/equivalencias";
import {
  DIRECCION_EQUIVALENCIAS,
  DIRECCION_PONDERACION,
  accionParaError,
  accionParaAviso,
  bloqueoDeGeneracion,
  detalleCobertura,
  especialesSinMapa,
  etiquetaDeAviso,
  comparativosDisponibles,
  comparativosReducer,
  construirBody,
  celdaNa,
  celdaNoOfrecidas,
  describirNa,
  errorDesde,
  estadoInicial,
  filasArmonizadas,
  motivoVacio,
  periodosDeSerie,
  rotuloDe,
  rotuloPorDefecto,
  totalSinMapa,
} from "./comparativosModel";

const armon = {
  escala: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }],
  por_base: {
    hsvg2024: { comparable: true, mapa: {} },
    hsvg2025: { comparable: false, mapa: {} },
  },
};

const VARS = { hsvg2024: "p1_24", hsvg2025: "p1_25", base_sin_anio: "p1_x", otra_base: "p1_o" };

function fila(parcial: Partial<EquivalenciaFila>): EquivalenciaFila {
  return { seccion: "", etiqueta_estandar: "", variables: VARS, cantidad: 4, ...parcial };
}

function estado(parcial: Partial<EquivalenciasEstado> = {}): EquivalenciasEstado {
  return {
    ok: true,
    disponible: true,
    declarada: true,
    n_filas: 3,
    bases: ["hsvg2024", "hsvg2025", "base_sin_anio"],
    cobertura: {},
    desfasadas: [],
    filas: [
      fila({ id: "p1", etiqueta_estandar: "Acoso", seccion: "Clima", armonizacion: armon }),
      fila({ etiqueta_estandar: "Sin armonizar" }),
      fila({ id: "7", etiqueta_estandar: "Sexo", armonizacion: armon }),
    ],
    ...parcial,
  };
}

describe("filas candidatas y serie", () => {
  it("solo ofrece filas con armonización y elige la ref que el backend resuelve sin ambigüedad", () => {
    const filas = filasArmonizadas(estado());
    expect(filas.map((f) => f.clave)).toEqual(["0", "2"]);
    // id textual viaja como id, id numérico viaja como índice
    expect(filas.map((f) => f.ref)).toEqual(["p1", 2]);
    expect(filas.map((f) => f.claveNota)).toEqual(["p1", "7"]);
    expect(filas[0].basesComparables).toEqual(["hsvg2024"]);
    expect(filas.every((f) => f.seleccionable)).toBe(true);
    expect(filas[0].nCategorias).toBe(2);
  });

  it("no ofrece una fila comparable en 0 mediciones de la serie", () => {
    const nada = {
      escala: armon.escala,
      por_base: { hsvg2024: { comparable: false, mapa: {} }, otra_base: { comparable: true, mapa: {} } },
    };
    const e = estado({ filas: [fila({ id: "p1", etiqueta_estandar: "Acoso", armonizacion: armon }), fila({ id: "z", etiqueta_estandar: "Nada", armonizacion: nada })] });
    const filas = filasArmonizadas(e);
    // `otra_base` no está en la serie: no cuenta
    expect(filas[1].basesComparables).toEqual([]);
    expect(filas[1].seleccionable).toBe(false);
    const ui = estadoInicial(filas, periodosDeSerie(e));
    expect(ui.preguntas).toEqual(["0"]);
    // aunque se cuele en la selección, no viaja
    const forzada = comparativosReducer(ui, { tipo: "alternar-pregunta", clave: "1" });
    expect(construirBody(forzada, "frecuencias", filas, periodosDeSerie(e)).filas).toEqual(["p1"]);
  });

  it("no cuenta como comparable una base sin variable declarada", () => {
    const arm3 = {
      escala: armon.escala,
      por_base: {
        hsvg2024: { comparable: true, mapa: {} },
        hsvg2025: { comparable: true, mapa: {} },
        hsvg2026: { comparable: true, mapa: {} },
      },
    };
    const e = estado({
      bases: ["hsvg2024", "hsvg2025", "hsvg2026"],
      armonizacion_periodos: ["hsvg2024", "hsvg2025", "hsvg2026"],
      filas: [
        fila({ id: "a", etiqueta_estandar: "Acoso", armonizacion: arm3, variables: { hsvg2024: "p1", hsvg2025: "p1", hsvg2026: " " } }),
        fila({ id: "b", etiqueta_estandar: "Solo 2026", armonizacion: arm3, variables: { hsvg2026: "q9" } }),
        fila({ id: "c", etiqueta_estandar: "Ninguna", armonizacion: arm3, variables: {} }),
      ],
    });
    const filas = filasArmonizadas(e);
    expect(filas[0].basesComparables).toEqual(["hsvg2024", "hsvg2025"]);
    expect(filas[0].basesSinVariable).toEqual(["hsvg2026"]);
    expect(filas[0].seleccionable).toBe(true);
    expect(filas[1].basesComparables).toEqual(["hsvg2026"]);
    expect(filas[1].seleccionable).toBe(true);
    expect(filas[2].basesComparables).toEqual([]);
    expect(filas[2].seleccionable).toBe(false);
    expect(detalleCobertura(filas[0], 3, { hsvg2026: "2026" }))
      .toBe("comparable en 2 de 3 mediciones, 2 categorías, sin variable en 2026");
    expect(detalleCobertura(filas[1], 3, {}))
      .toBe("comparable en 1 de 3 mediciones, 2 categorías, sin variable en 2024 y 2025");
    expect(detalleCobertura({ ...filas[0], basesSinVariable: [] }, 3, {}))
      .toBe("comparable en 2 de 3 mediciones, 2 categorías");
  });

  it("ordena la serie por armonizacion_periodos y cae a las bases", () => {
    expect(periodosDeSerie(estado({ armonizacion_periodos: ["hsvg2025", "hsvg2024"] })))
      .toEqual(["hsvg2025", "hsvg2024"]);
    expect(periodosDeSerie(estado())).toEqual(["hsvg2024", "hsvg2025", "base_sin_anio"]);
    // F6: sin declarar y con año en todas, cronológico aunque la carga fuera otra.
    expect(periodosDeSerie(estado({ bases: ["hsvg2026", "hsvg2024", "hsvg2025"] })))
      .toEqual(["hsvg2024", "hsvg2025", "hsvg2026"]);
  });

  it("rotula con el año del nombre de la base, como .armz_rotulos()", () => {
    expect(rotuloPorDefecto("hsvg2024")).toBe("2024");
    expect(rotuloPorDefecto("base_sin_anio")).toBe("base_sin_anio");
  });

  it("clasifica el vacío", () => {
    expect(motivoVacio(null)).toBe("sin-equivalencias");
    expect(motivoVacio(estado({ declarada: false }))).toBe("sin-equivalencias");
    expect(motivoVacio(estado({ filas: [fila({ etiqueta_estandar: "x" })] }))).toBe("sin-armonizadas");
    expect(motivoVacio(estado({ bases: ["solo"], armonizacion_periodos: [] }))).toBe("sin-serie");
    expect(motivoVacio(estado())).toBeNull();
  });

  it("la pestaña solo existe con dos o más bases", () => {
    expect(comparativosDisponibles(undefined)).toBe(false);
    expect(comparativosDisponibles(1)).toBe(false);
    expect(comparativosDisponibles(2)).toBe(true);
  });
});

describe("estado y body", () => {
  const filas = filasArmonizadas(estado());
  const periodos = ["hsvg2024", "hsvg2025"];

  it("arranca con todas las preguntas y los rótulos por defecto", () => {
    const ui = estadoInicial(filas, periodos);
    expect(ui.preguntas).toEqual(["0", "2"]);
    expect(ui.rotulos).toEqual({ hsvg2024: "2024", hsvg2025: "2025" });
    expect(bloqueoDeGeneracion(ui, "frecuencias")).toBeNull();
    expect(bloqueoDeGeneracion(ui, "cruces")).toMatch(/variable de cruce/);
  });

  it("arma el body del simple con rótulos, notas por pregunta y notas generales limpias", () => {
    let ui = estadoInicial(filas, periodos);
    ui = comparativosReducer(ui, { tipo: "rotulo", base: "hsvg2025", valor: "  " });
    ui = comparativosReducer(ui, { tipo: "rotulo", base: "hsvg2024", valor: "Año 2024" });
    ui = comparativosReducer(ui, { tipo: "nota-pregunta", clave: "2", valor: " Nota sexo " });
    ui = comparativosReducer(ui, { tipo: "notas-generales", valor: "Fuente propia\n\n  Otra  " });
    expect(construirBody(ui, "frecuencias", filas, periodos)).toEqual({
      filas: ["p1", 2],
      rotulos_periodos: { hsvg2024: "Año 2024" },
      notas_pregunta: { "7": "Nota sexo" },
      notas_generales: ["Fuente propia", "Otra"],
    });
  });

  it("en cruces una variable de cruce no se tabula como pregunta", () => {
    let ui = estadoInicial(filas, periodos);
    ui = comparativosReducer(ui, { tipo: "alternar-cruce", clave: "2" });
    ui = comparativosReducer(ui, { tipo: "nota-pregunta", clave: "2", valor: "no viaja" });
    const body = construirBody(ui, "cruces", filas, periodos);
    expect(body.filas).toEqual(["p1"]);
    expect(body.cruces).toEqual([2]);
    expect(body.notas_pregunta).toBeUndefined();
    // el simple conserva la pregunta aunque sea cruce
    expect(construirBody(ui, "frecuencias", filas, periodos).filas).toEqual(["p1", 2]);

    ui = comparativosReducer(ui, { tipo: "alternar-pregunta", clave: "0" });
    expect(bloqueoDeGeneracion(ui, "cruces")).toMatch(/no sea variable de cruce/);
  });

  it("sigue el ciclo enviar, job, listo y descarta un listo sin job", () => {
    let ui = estadoInicial(filas, periodos);
    const datos = normalizarComparativoResultado({ file_id: "f1" });
    expect(comparativosReducer(ui, { tipo: "listo", datos })).toBe(ui);
    ui = comparativosReducer(ui, { tipo: "enviando", comparativo: "cruces" });
    ui = comparativosReducer(ui, { tipo: "job", comparativo: "cruces", id: "j1" });
    expect(ui.job).toEqual({ id: "j1", tipo: "cruces" });
    ui = comparativosReducer(ui, { tipo: "listo", datos });
    expect(ui.job).toBeNull();
    expect(ui.resultado?.tipo).toBe("cruces");
  });
});

describe("errores", () => {
  it("lee el código de ApiError y del mensaje de un job", () => {
    expect(errorDesde(new ApiError("E_ARMONIZADA_PESO_NO_DECLARADO", "La base 2025 trae peso")))
      .toEqual({ mensaje: "La base 2025 trae peso", codigo: "E_ARMONIZADA_PESO_NO_DECLARADO" });
    expect(errorDesde("Mapa roto en 2024 · E_ARMONIZADA_MAPA_ROTO"))
      .toEqual({ mensaje: "Mapa roto en 2024", codigo: "E_ARMONIZADA_MAPA_ROTO" });
    expect(errorDesde("falló sin código").codigo).toBeNull();
  });

  it("lleva cada error a donde se resuelve, con dirección canónica", () => {
    expect(DIRECCION_EQUIVALENCIAS).toBe("/carga?pestana=equivalencias");
    expect(DIRECCION_PONDERACION).toBe("/analitica?pestana=ponderacion");
    expect(accionParaError("E_ARMONIZADA_PESO_NO_DECLARADO")?.href).toBe(DIRECCION_PONDERACION);
    expect(accionParaError("E_PONDERACION_COLUMNA_INEXISTENTE")?.href).toBe(DIRECCION_PONDERACION);
    expect(accionParaError("E_ARMONIZADA_MAPA_ROTO")?.href).toBe(DIRECCION_EQUIVALENCIAS);
    expect(accionParaError("E_EQUIV_SIN_ARMONIZACION")?.href).toBe(DIRECCION_EQUIVALENCIAS);
    expect(accionParaError("E_NO_RP_DATA")?.href).toBe("/carga?pestana=fuentes");
    expect(accionParaError("E_ARMONIZADA_PERIODO_REPEAT")?.href).toBe(DIRECCION_EQUIVALENCIAS);
    expect(accionParaError("E_ARMONIZADA_SIN_CRUCES")).toBeNull();
    expect(accionParaError(null)).toBeNull();
  });
});

describe("normalizarComparativoResultado", () => {
  it("tolera las formas de R: {} por lista vacía, escalares y tipos desconocidos", () => {
    const r = normalizarComparativoResultado({
      ok: true,
      file_id: ["f1"],
      filename: "comparativo_simple.xlsx",
      size: 2048,
      sha256: "abc",
      artifacts: [
        { file_id: "f1", filename: "comparativo_simple.xlsx", role: "deliverable", size: 2048, sha256: "abc", mime: "x" },
        { file_id: "f2", filename: "m.json", role: "manifest", size: 10, sha256: "d", mime: "application/json" },
        { filename: "sin id" },
      ],
      periodos: [{ base: "hsvg2024", rotulo: "2024" }, { base: "" }],
      resumen: {
        hoja: "Comparativo",
        n_preguntas: 1,
        preguntas: [{
          titulo: "Acoso",
          n_c: ["hsvg2025"],
          n_a: {},
          sin_mapa: [{
            base: "hsvg2024", n_sin_mapa: 3, n_especial_sin_mapa: 2, codigos_sin_mapa: "5",
            codigos_especiales: ["98", "99"], etiquetas_especiales: ["No sabe", ""],
          }],
          no_ofrecidas: { hsvg2025: ["3"], hsvg2024: {} },
        }],
        avisos: [
          { tipo: "sin_mapa", base: "hsvg2024", mensaje: "3 casos sin mapa" },
          { tipo: "nuevo_tipo", mensaje: "otro aviso" },
          { tipo: "peso_ignorado", base: "hsvg2025", mensaje: "La base trae peso y se ignoró" },
          { tipo: "ponderacion", mensaje: "" },
        ],
        ponderacion: { hsvg2025: { peso_ignorado: [true] }, hsvg2024: { peso_ignorado: false } },
      },
    });
    expect(r.file_id).toBe("f1");
    expect(r.artifacts.map((a) => a.role)).toEqual(["deliverable", "manifest"]);
    expect(r.periodos).toEqual([{ base: "hsvg2024", rotulo: "2024" }]);
    const p = r.resumen.preguntas[0];
    expect(p.n_c).toEqual(["hsvg2025"]);
    expect(p.n_a).toEqual([]);
    expect(p.n_reducidas).toBeNull();
    expect(p.sin_mapa[0].codigos_sin_mapa).toEqual(["5"]);
    expect(p.no_ofrecidas).toEqual({ hsvg2025: ["3"] });
    expect(totalSinMapa(p)).toBe(3);
    expect(especialesSinMapa(p.sin_mapa[0])).toEqual(["98 No sabe", "99"]);
    expect(r.resumen.ponderacion).toEqual({ hsvg2025: { peso_ignorado: true }, hsvg2024: { peso_ignorado: false } });
    // Ningún aviso se filtra: el tipo desconocido se muestra con su nombre original.
    expect(r.resumen.avisos.map((a) => a.tipo)).toEqual(["sin_mapa", "otro", "peso_ignorado"]);
    expect(r.resumen.avisos.map(etiquetaDeAviso)).toEqual(["Sin correspondencia", "nuevo_tipo", "Peso ignorado"]);
    expect(accionParaAviso(r.resumen.avisos[2])?.href).toBe(DIRECCION_PONDERACION);
    expect(accionParaAviso(r.resumen.avisos[0])).toBeNull();
  });

  it("lee n.c. y n.a. como listas: períodos en el simple, casillas en el de cruces", () => {
    // Forma medida en el job real del 2026-10-13 (armon.pulso, comparativo simple).
    const simple = normalizarComparativoResultado({
      periodos: [{ base: "administrativos", rotulo: "Adm" }],
      resumen: { preguntas: [{ titulo: "Género", n_c: ["administrativos"], n_a: [] }] },
    });
    const q = simple.resumen.preguntas[0];
    expect(q.n_c).toEqual(["administrativos"]);
    expect(q.n_c.map((b) => rotuloDe(b, simple.periodos))).toEqual(["Adm"]);
    const cruces = normalizarComparativoResultado({
      periodos: [{ base: "hsvg2024", rotulo: "2024" }],
      resumen: {
        preguntas: [{
          titulo: "Acoso",
          n_c: "Sexo no es comparable en 2024",
          n_a: [{ periodo: "hsvg2024", cruce: "Sexo", categoria: "Otro" }, "hsvg2024"],
          n_reducidas: [2],
        }],
      },
    });
    const c = cruces.resumen.preguntas[0];
    expect(c.n_c).toEqual(["Sexo no es comparable en 2024"]);
    expect(c.n_a.map((x) => describirNa(x, cruces.periodos))).toEqual(["2024, Sexo: Otro", "2024"]);
    expect(c.n_reducidas).toBe(2);
  });

  it("solo dice «Ninguna» en n.a. y no ofrecidas cuando el resumen lo cubre", () => {
    const per = [{ base: "hsvg2024", rotulo: "2024" }];
    const sinCampo = normalizarComparativoResultado({
      periodos: per,
      resumen: { preguntas: [{ titulo: "A", n_c: [], n_a: [], no_ofrecidas: {} }] },
    }).resumen.preguntas[0];
    expect(sinCampo.no_ofrecidas_cruce).toBeNull();
    expect(celdaNa(sinCampo, "frecuencias", per)).toEqual({ items: [], cubierto: true });
    expect(celdaNa(sinCampo, "cruces", per)).toEqual({ items: [], cubierto: false });
    expect(celdaNoOfrecidas(sinCampo, "frecuencias", per)).toEqual({ items: [], cubierto: true });
    expect(celdaNoOfrecidas(sinCampo, "cruces", per)).toEqual({ items: [], cubierto: false });

    const conCampo = normalizarComparativoResultado({
      periodos: per,
      resumen: {
        preguntas: [{
          titulo: "A", n_c: [], n_a: [], no_ofrecidas: { hsvg2024: ["3"] },
          no_ofrecidas_cruce: { Sexo: { hsvg2024: ["9", "8"] }, Edad: {} },
        }],
      },
    }).resumen.preguntas[0];
    expect(conCampo.no_ofrecidas_cruce).toEqual({ Sexo: { hsvg2024: ["9", "8"] } });
    expect(celdaNoOfrecidas(conCampo, "cruces", per)).toEqual({
      items: ["2024: código 3", "Sexo, 2024: códigos 9, 8"],
      cubierto: true,
    });
    const vacioDeclarado = normalizarComparativoResultado({
      resumen: { preguntas: [{ titulo: "A", no_ofrecidas_cruce: {} }] },
    }).resumen.preguntas[0];
    expect(celdaNoOfrecidas(vacioDeclarado, "cruces", [])).toEqual({ items: [], cubierto: true });
  });

  it("devuelve un resultado vacío pero válido ante basura", () => {
    const r = normalizarComparativoResultado({ resumen: { preguntas: {}, avisos: {} } });
    expect(r.resumen.preguntas).toEqual([]);
    expect(r.resumen.avisos).toEqual([]);
    expect(r.filename).toBe("comparativo.xlsx");
    expect(normalizarComparativoResultado(null).artifacts).toEqual([]);
  });
});
