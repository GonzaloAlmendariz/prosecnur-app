import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraEstudio } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../../api/calcMuestraGeneral";
import {
  ARCHIVO_MARCO_INICIAL,
  SELECCION_INICIAL,
  archivoDesdeInspeccion,
  archivoMarcoReducer,
  errorGeneralDesde,
  modalidadDeTecnica,
  formatearEntero,
  formatearPeso,
  formatearPi,
  nDesfasado,
  opcionesMetodo,
  paginar,
  puedeDeclarar,
  reconciliarEstudio,
  reservasValidas,
  seleccionReducer,
  semillaValida,
  sugerirColumnaId,
} from "../modelo";

const marco = (tamano = ""): CalcMuestraGeneralMarco => ({
  file_id: "f",
  hoja: "padron",
  columnas: { id: "dni", estrato: "distrito", tamano },
  marco_hash: "h",
  N: 300,
  estratos: [],
  declarado_at: "",
});

const corrida = (over: Partial<CalcMuestraGeneralCorrida> = {}): CalcMuestraGeneralCorrida => ({
  corrida: {
    run_id: "r1", semilla: 42, rng_kind: "", r_version: "", metodo: "sistematico", marco_hash: "h",
    modalidad: "probabilistica", config_hash: "c", N: 300, n_titulares: 10, n_reservas: 0, piso_incumplible: false, reservas_omitidas_pps: false,
  },
  estratos: [],
  unidades: [],
  n_fuente: 10,
  componente_id: "c1",
  sorteado_at: "",
  ...over,
});

describe("formatearPi", () => {
  it("lee una π pequeña sin notación científica ni cero", () => {
    expect(formatearPi(3.71e-5)).toBe("0.0000371");
    expect(formatearPi(0.25)).toBe("0.25");
    expect(formatearPi(0.1428571)).toBe("0.1429");
    expect(formatearPi(0.001)).toBe("0.001");
    expect(formatearPi(1)).toBe("1");
    expect(formatearPi(null)).toBe("—");
  });

  it("peso y enteros con separador de miles", () => {
    expect(formatearPeso(26954.177897)).toBe("26,954.18");
    expect(formatearPeso(null)).toBe("—");
    expect(formatearEntero(5000)).toBe("5,000");
  });
});

describe("archivo del marco", () => {
  const inspeccion = {
    type: "workbook",
    sheets: [
      { name: "Leeme", columns_sample: [] },
      { name: "padron", columns_sample: ["DNI", "distrito", "hogares"] },
    ],
  };

  it("elige la primera hoja con columnas y propone id, estrato y tamaño por su nombre", () => {
    const { archivo, hoja } = archivoDesdeInspeccion("f1", "padron.xlsx", inspeccion);
    expect(hoja).toBe("padron");
    expect(archivo.esLibro).toBe(true);
    const e = archivoMarcoReducer(ARCHIVO_MARCO_INICIAL, { tipo: "subido", archivo, hoja });
    expect(e.columnas).toEqual({ id: "DNI", estrato: "distrito", tamano: "hogares" });
    expect(e.propuestas).toEqual(e.columnas);
    expect(puedeDeclarar(e)).toBe(true);
  });

  it("un CSV no envía hoja", () => {
    const { archivo } = archivoDesdeInspeccion("f1", "m.csv", { type: "table", sheets: [{ name: "datos", columns_sample: ["x"] }] });
    expect(archivo.esLibro).toBe(false);
  });

  it("sin id no se declara; cambiar de hoja vuelve a sugerir", () => {
    const { archivo, hoja } = archivoDesdeInspeccion("f1", "p.xlsx", inspeccion);
    let e = archivoMarcoReducer(ARCHIVO_MARCO_INICIAL, { tipo: "subido", archivo, hoja });
    e = archivoMarcoReducer(e, { tipo: "columna", rol: "id", valor: "" });
    expect(puedeDeclarar(e)).toBe(false);
    e = archivoMarcoReducer(e, { tipo: "hoja", hoja: "Leeme" });
    expect(e.columnas.id).toBe("");
  });

  it("un fallo conserva el archivo y el error", () => {
    const { archivo, hoja } = archivoDesdeInspeccion("f1", "p.xlsx", inspeccion);
    let e = archivoMarcoReducer(ARCHIVO_MARCO_INICIAL, { tipo: "subido", archivo, hoja });
    e = archivoMarcoReducer(e, { tipo: "declarando" });
    e = archivoMarcoReducer(e, { tipo: "fallo", error: { texto: "2 ids se repiten · E_CALC_MUESTRA_GENERAL_MARCO", codigo: "E_CALC_MUESTRA_GENERAL_MARCO", detalle: null } });
    expect(e.fase).toBe("listo");
    expect(e.archivo?.file_id).toBe("f1");
    expect(e.error?.texto).toContain("E_CALC_MUESTRA_GENERAL_MARCO");
  });

  it("sugiere id sólo cuando el nombre lo dice", () => {
    expect(sugerirColumnaId(["nombre", "cod_alumno", "edad"])).toBe("cod_alumno");
    expect(sugerirColumnaId(["nombre", "idioma"])).toBe("");
  });
});

describe("reconciliarEstudio", () => {
  const comp = (id: string, N: number) => ({ id, marco: { marco_validado: N } }) as unknown as CalcMuestraComponente;
  const estudio = (...componentes: CalcMuestraComponente[]) => ({ componentes }) as unknown as CalcMuestraEstudio;

  it("sin ediciones en vuelo adopta el estudio del backend", () => {
    const enviado = estudio(comp("c1", 0));
    const respuesta = estudio(comp("c1", 300));
    expect(reconciliarEstudio({ componenteId: "c1", actual: enviado, enviado, estudioRespuesta: respuesta, componenteRespuesta: null }))
      .toEqual({ estudio: respuesta, limpio: true });
  });

  it("con ediciones en vuelo sólo sustituye el componente declarado", () => {
    const enviado = estudio(comp("c1", 0), comp("c2", 7));
    const actual = estudio(comp("c1", 0), comp("c2", 9));
    const r = reconciliarEstudio({
      componenteId: "c1", actual, enviado,
      estudioRespuesta: estudio(comp("c1", 300), comp("c2", 7)), componenteRespuesta: null,
    });
    expect(r?.limpio).toBe(false);
    expect(r?.estudio.componentes.map((c) => c.marco.marco_validado)).toEqual([300, 9]);
  });
});

describe("selección", () => {
  it("PPS se deshabilita con motivo cuando el marco no declaró tamaño", () => {
    expect(opcionesMetodo(marco()).find((o) => o.id === "pps")?.motivoDeshabilitado).toMatch(/tamaño/);
    expect(opcionesMetodo(marco("hogares")).find((o) => o.id === "pps")?.motivoDeshabilitado).toBeNull();
  });

  it("la semilla por defecto es la del motor y se valida al sortear", () => {
    expect(SELECCION_INICIAL.semilla).toBe("20260924");
    expect(semillaValida("20260924")).toBe(20260924);
    expect(semillaValida("0")).toBeNull();
    expect(semillaValida("1.5")).toBeNull();
    expect(reservasValidas("")).toBe(0);
    expect(reservasValidas("-1")).toBeNull();
  });

  it("precarga método y semilla de la corrida vigente una sola vez", () => {
    let e = seleccionReducer(SELECCION_INICIAL, { tipo: "precargar", corrida: corrida() });
    expect(e).toMatchObject({ metodo: "sistematico", semilla: "42", precargadoDe: "r1" });
    e = seleccionReducer(e, { tipo: "semilla", valor: "7" });
    e = seleccionReducer(e, { tipo: "precargar", corrida: corrida() });
    expect(e.semilla).toBe("7");
  });

  it("pagina sin salirse de rango", () => {
    const lista = Array.from({ length: 120 }, (_, i) => i);
    expect(paginar(lista, 0)).toMatchObject({ pagina: 0, paginas: 3, desde: 1, hasta: 50 });
    expect(paginar(lista, 9)).toMatchObject({ pagina: 2, desde: 101, hasta: 120 });
    expect(paginar([], 0)).toMatchObject({ paginas: 1, desde: 0, hasta: 0 });
  });

  it("avisa si el n del componente cambió después de sortear", () => {
    const c = { resultado: { n_operativo: 12 } } as unknown as CalcMuestraComponente;
    expect(nDesfasado(corrida(), c)).toBe(12);
    expect(nDesfasado(corrida({ n_fuente: 12 }), c)).toBeNull();
    expect(nDesfasado(null, c)).toBeNull();
  });
});

describe("técnicas que no se sortean", () => {
  it("la técnica anticipa la modalidad; el motor manda", () => {
    expect(modalidadDeTecnica("prob_estratificado")).toBe("probabilistica");
    expect(modalidadDeTecnica("intencion_censal")).toBe("censo");
    expect(modalidadDeTecnica("barrido")).toBe("censo");
    expect(modalidadDeTecnica("no_prob_cuotas")).toBe("sin_sorteo");
    expect(modalidadDeTecnica("listado_externo_meta_fija")).toBe("sin_sorteo");
  });

  it("el 409 de técnica bloquea Sortear con el mensaje del motor, no como error suelto", () => {
    const error = errorGeneralDesde(Object.assign(
      new Error("La técnica «prob_conglomerado_multietapico» no selecciona unidades con probabilidad conocida · E_CALC_MUESTRA_GENERAL_TECNICA"),
      { code: "E_CALC_MUESTRA_GENERAL_TECNICA" },
    ));
    const e = seleccionReducer({ ...SELECCION_INICIAL, sorteando: true }, { tipo: "fallo", error, tecnica: "prob_conglomerado_multietapico" });
    expect(e.error).toBeNull();
    expect(e.sorteando).toBe(false);
    expect(e.bloqueo).toEqual({ tecnica: "prob_conglomerado_multietapico", texto: error.texto });
  });

  it("otro error del motor no bloquea", () => {
    const error = { texto: "x · E_CALC_MUESTRA_GENERAL_N", codigo: "E_CALC_MUESTRA_GENERAL_N", detalle: null };
    const e = seleccionReducer(SELECCION_INICIAL, { tipo: "fallo", error, tecnica: "prob_estratificado" });
    expect(e.bloqueo).toBeNull();
    expect(e.error).toBe(error);
  });
});

describe("opcionesMetodo · π según haya estratos", () => {
  it("con estrato declarado la π es la del estrato; sin estrato, la del marco", async () => {
    const { opcionesMetodo } = await import("../modelo");
    const base = { file_id: "f", hoja: "", marco_hash: "h", N: 10, estratos: [], declarado_at: "" };
    const con = opcionesMetodo({ ...base, columnas: { id: "id", estrato: "zona", tamano: "" } } as never);
    const sin = opcionesMetodo({ ...base, columnas: { id: "id", estrato: "", tamano: "" } } as never);
    expect(con[0].detalle).toContain("n_h/N_h");
    expect(sin[0].detalle).toContain("π = n/N");
  });
});
