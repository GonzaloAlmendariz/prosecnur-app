import { describe, expect, it } from "vitest";

import type { FilaArmonizada } from "../panes/comparativosModel";
import {
  cifrasDeComparativos,
  cifrasDeLaCabecera,
  estadoDeArchivo,
  estadoDeComparativos,
  filaEnFoco,
  filasVisibles,
  filtroInicial,
  opcionesDeFiltro,
  todasElegidas,
} from "./modeloDeComparativos";

const SERIE = ["docentes", "estudiantes", "egresados", "administrativos"];

function fila(clave: string, comparables: string[], parcial: Partial<FilaArmonizada> = {}): FilaArmonizada {
  return {
    clave,
    ref: `p${clave}`,
    claveNota: `p${clave}`,
    etiqueta: `Pregunta ${clave}`,
    seccion: "",
    basesComparables: comparables,
    basesSinVariable: SERIE.filter((b) => !comparables.includes(b)),
    nCategorias: null,
    mismaEscala: true,
    seleccionable: comparables.length > 0,
    esSegmento: false,
    ...parcial,
  };
}

const FILAS = [
  fila("0", SERIE),
  fila("1", SERIE.slice(0, 3)),
  fila("2", SERIE.slice(0, 3)),
  fila("3", ["docentes", "estudiantes"], { etiqueta: "Trato del personal" }),
];

describe("cifras de la cabecera", () => {
  it("cuenta armonizadas y en todas las bases sobre las filas de la matriz", () => {
    const matriz = { filas: Array.from({ length: 6 }, () => ({ seccion: "", etiqueta_estandar: "", variables: {}, cantidad: 1 })), desfasadas: ["egresados", "fuera_de_la_serie"] };
    const c = cifrasDeComparativos(matriz, FILAS, SERIE);
    expect(c).toEqual({ bases: 4, armonizadas: 4, filasDeLaMatriz: 6, enTodas: 1, cambiadas: 1 });
    const cifras = cifrasDeLaCabecera(c);
    expect(cifras.map((x) => [x.clave, x.valor, x.base ?? null])).toEqual([
      ["bases", "4", null], ["armonizadas", "4", "6"], ["en-todas", "1", "6"], ["cambiadas", "1", "4"],
    ]);
    expect(cifras.find((x) => x.clave === "armonizadas")?.tono).toBeUndefined();
  });

  it("sin bases cambiadas no publica esa cifra", () => {
    const c = cifrasDeComparativos({ filas: [], desfasadas: [] }, [], SERIE);
    expect(cifrasDeLaCabecera(c).map((x) => x.clave)).toEqual(["bases", "armonizadas", "en-todas"]);
  });
});

describe("filtros por cobertura", () => {
  it("en todas, en una menos y todas, con sus conteos", () => {
    expect(opcionesDeFiltro(FILAS, 4).map((o) => [o.id, o.rotulo, o.conteo])).toEqual([
      ["todas-las-bases", "En las 4 bases", 1], ["una-menos", "En 3", 2], ["todas", "Todas", 4],
    ]);
    expect(opcionesDeFiltro(FILAS.slice(3), 2).map((o) => o.id)).toEqual(["todas-las-bases", "todas"]);
  });

  it("filtra por el número de bases comparables y por texto", () => {
    expect(filasVisibles(FILAS, "una-menos", 4, "").map((f) => f.clave)).toEqual(["1", "2"]);
    expect(filasVisibles(FILAS, "todas", 4, "trato").map((f) => f.clave)).toEqual(["3"]);
    expect(filtroInicial(FILAS, 4)).toBe("todas-las-bases");
    expect(filtroInicial(FILAS.slice(1), 4)).toBe("todas");
  });

  it("el foco se busca por la referencia de la fila, no por su posición", () => {
    expect(filaEnFoco(FILAS, "p2")?.clave).toBe("2");
    expect(filaEnFoco(FILAS, "2")).toBeNull();
  });

  it("todas elegidas mira solo las visibles que se pueden elegir", () => {
    expect(todasElegidas(FILAS.slice(1, 3), ["1", "2"])).toBe(true);
    expect(todasElegidas(FILAS, ["1", "2"])).toBe(false);
    expect(todasElegidas([], [])).toBe(false);
  });
});

describe("estado de la pestaña y de cada archivo", () => {
  it("sin generar no afirma nada", () => {
    expect(estadoDeComparativos("inactiva", false)).toBeNull();
    expect(estadoDeComparativos("en_curso", true)?.texto).toBe("Generando");
    expect(estadoDeComparativos("fallo", false)?.tono).toBe("atencion");
    expect(estadoDeComparativos("lista", true)?.texto).toBe("Generado");
  });

  it("el archivo generado es solo el del tipo que se pidió", () => {
    const datos = { filename: "c.xlsx", resumen: { n_preguntas: 18 } } as never;
    const base = { pedido: null, enCurso: false, resultado: { tipo: "frecuencias" as const, datos }, nOmitidas: 2, bloqueo: null };
    expect(estadoDeArchivo("frecuencias", base)).toEqual({ tipo: "generado", filename: "c.xlsx", nPreguntas: 18, nOmitidas: 2 });
    expect(estadoDeArchivo("cruces", { ...base, bloqueo: "Elige una variable" })).toEqual({ tipo: "bloqueado", motivo: "Elige una variable" });
    expect(estadoDeArchivo("cruces", { ...base, pedido: "cruces", enCurso: true })).toEqual({ tipo: "generando" });
    expect(estadoDeArchivo("cruces", base)).toEqual({ tipo: "listo" });
  });
});
