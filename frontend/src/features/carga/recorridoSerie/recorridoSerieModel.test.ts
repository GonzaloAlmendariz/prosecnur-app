import { describe, expect, it } from "vitest";
import type { BaseVariables } from "../../../api/baseVariables";
import type { EquivalenciaFila } from "../../../api/equivalencias";
import type { Segmento, SegmentosEstado } from "../../../api/segmentos";
import { PANELES_CARGA, PANEL_SEGMENTOS } from "../panelesCarga";
import {
  filasComparables,
  hrefDeEnlace,
  pasosDelRecorrido,
  porBaseConTope,
  readinessRecorrido,
  resumenRecorrido,
  todoHecho,
  type EntradaRecorrido,
  type Lectura,
  type PasoId,
  type PasoRecorrido,
} from "./recorridoSerieModel";

const BASES = ["2024", "2025", "2026"];

const vars = (base: string, extra: Partial<BaseVariables> = {}): Lectura<BaseVariables> => ({
  tipo: "listo",
  datos: { base, ya_codificada: false, extras: [], calculadas: [], retiradas: [], retiradas_pendientes: [], avisos: [], ...extra },
});

const columna = (name: string, declarada = false) => ({
  name, label: name, tipo: "text" as const, opciones: [], n_validos: 10, declarada,
});

const escala = [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }];
const armonizada = (bases: string[]): EquivalenciaFila["armonizacion"] => ({
  escala,
  por_base: Object.fromEntries(bases.map((b) => [b, { comparable: true, mapa: {} }])),
});

const fila = (variables: Record<string, string>, arm: EquivalenciaFila["armonizacion"] = undefined): EquivalenciaFila => ({
  seccion: "", etiqueta_estandar: "P", variables, cantidad: Object.keys(variables).length, ...(arm ? { armonizacion: arm } : {}),
});

const segmento = (clave: string, estados: Record<string, "definido" | "sin_origen" | "incompleto">): Segmento => ({
  clave,
  nombre: `cruce_${clave}`,
  etiqueta: clave,
  escala,
  por_base: Object.fromEntries(Object.entries(estados).map(([b, estado]) => [b, { origen: "x", mapa: {}, estado, n_sin_mapa: 0, codigos_sin_mapa: [] }])),
  fila_ref: "",
});

const segs = (segmentos: Segmento[], disponible = true): Lectura<SegmentosEstado> => ({
  tipo: "listo", datos: { disponible, bases: BASES, segmentos },
});

function completa(extra: Partial<EntradaRecorrido> = {}): EntradaRecorrido {
  return {
    bases: BASES,
    ordenDeclarado: true,
    ordenPorAnio: true,
    ordenEditable: true,
    filas: [fila({ "2024": "p1", "2025": "q1", "2026": "r1" }, armonizada(BASES))],
    variables: Object.fromEntries(BASES.map((b) => [b, vars(b)])),
    segmentos: segs([segmento("edad", { "2024": "definido", "2025": "definido", "2026": "definido" })]),
    ponderacion: {
      tipo: "listo",
      datos: [
        { base: "2024", ponderacion: { tipo: "sin_ponderar" } },
        { base: "2025", ponderacion: { tipo: "calibracion" } },
        { base: "2026", ponderacion: { tipo: "columna", columna: "peso" } },
      ],
    },
    ...extra,
  };
}

const paso = (pasos: PasoRecorrido[], id: PasoId) => {
  const p = pasos.find((x) => x.id === id);
  if (!p) throw new Error(`sin paso ${id}`);
  return p;
};

describe("recorrido de la serie: seis pasos, siempre en el mismo orden", () => {
  it("numera los seis pasos del 1 al 6", () => {
    const pasos = pasosDelRecorrido(completa());
    expect(pasos.map((p) => [p.numero, p.id])).toEqual([
      [1, "bases"], [2, "variables"], [3, "segmentos"], [4, "matriz"], [5, "ponderacion"], [6, "comparativos"],
    ]);
  });

  it("con todo hecho, la banda se puede plegar y lo dice", () => {
    const pasos = pasosDelRecorrido(completa());
    expect(pasos.every((p) => p.estado === "hecho")).toBe(true);
    expect(todoHecho(pasos)).toBe(true);
    expect(resumenRecorrido(pasos)).toBe("Los seis pasos están hechos");
    expect(paso(pasos, "bases").detalle).toBe("2024 → 2025 → 2026");
    expect(paso(pasos, "segmentos").detalle).toBe("1 segmento en las 3 bases");
    expect(paso(pasos, "matriz").detalle).toBe("1 fila");
    expect(paso(pasos, "comparativos").detalle).toBe("1 pregunta lista para comparar");
  });
});

describe("paso 1 · Bases", () => {
  it("sin orden declarado y sin años en los nombres falta declarar el orden", () => {
    const p = paso(pasosDelRecorrido(completa({ ordenDeclarado: false, ordenPorAnio: false })), "bases");
    expect(p.estado).toBe("falta");
    expect(p.detalle).toBe("3 bases · orden sin declarar");
  });

  it("sin matriz guardada el orden no se edita aún: lleva a Fuentes", () => {
    const p = paso(pasosDelRecorrido(completa({ ordenEditable: false })), "bases");
    expect(p.enlace).toMatchObject({ tipo: "direccion", etiqueta: "Fuentes" });
    const editable = paso(pasosDelRecorrido(completa()), "bases");
    expect(editable.enlace).toMatchObject({ tipo: "panel", panel: "orden-serie" });
  });
});

describe("paso 2 · Variables de cada base", () => {
  it("cuenta columnas sin incorporar y retiradas sin motivo, por base, y enlaza a la primera", () => {
    const p = paso(pasosDelRecorrido(completa({
      variables: {
        "2024": vars("2024"),
        "2025": vars("2025", { retiradas_pendientes: ["P12"] }),
        "2026": vars("2026", { extras: [columna("a"), columna("b"), columna("c"), columna("d", true)] }),
      },
    })), "variables");
    expect(p.estado).toBe("falta");
    expect(p.detalle).toBe("2025: 1 retirada sin motivo · 2026: 3 columnas sin incorporar");
    expect(p.enlace).toEqual({ tipo: "panel", panel: "variables-base", foco: "2025", etiqueta: "Variables de la base" });
  });

  it("mientras alguna base lee, el paso está leyendo; una lectura fallida no es un vacío", () => {
    expect(paso(pasosDelRecorrido(completa({ variables: { "2024": vars("2024") } })), "variables").estado).toBe("leyendo");
    const fallo = paso(pasosDelRecorrido(completa({
      variables: { "2024": vars("2024"), "2025": { tipo: "error", mensaje: "x" }, "2026": vars("2026") },
    })), "variables");
    expect(fallo.estado).toBe("sin-lectura");
    expect(fallo.detalle).toBe("No se pudo leer 2025");
  });
});

describe("paso 3 · Segmentos de cruce", () => {
  it("con la ruta todavía sin publicar o sin segmentos: «Sin segmentos declarados», sin romper", () => {
    for (const lectura of [segs([], false), segs([])]) {
      const p = paso(pasosDelRecorrido(completa({ segmentos: lectura })), "segmentos");
      expect(p.estado).toBe("no-empezado");
      expect(p.detalle).toBe("Sin segmentos declarados");
    }
  });

  it("cuenta por base lo que no está definido; una base ausente del segmento también falta", () => {
    const p = paso(pasosDelRecorrido(completa({
      segmentos: segs([
        segmento("edad", { "2024": "definido", "2025": "definido", "2026": "sin_origen" }),
        segmento("sexo", { "2024": "definido", "2025": "definido", "2026": "incompleto" }),
        segmento("ciclo", { "2024": "definido", "2025": "definido" }),
      ]),
    })), "segmentos");
    expect(p.estado).toBe("falta");
    expect(p.detalle).toBe("2026: faltan 3 segmentos");
  });

  it("el enlace sólo escribe la dirección del panel declarado", () => {
    const p = paso(pasosDelRecorrido(completa()), "segmentos");
    expect(p.enlace).toMatchObject({ tipo: "panel", panel: "segmentos" });
    expect(PANELES_CARGA).toContain(PANEL_SEGMENTOS);
    expect(PANEL_SEGMENTOS.clase).toBe("sideover");
  });
});

describe("paso 4 · Matriz", () => {
  it("dice cuántas filas, cuántas sin armonizar y cuántas faltan en alguna base", () => {
    const p = paso(pasosDelRecorrido(completa({
      filas: [
        fila({ "2024": "p1", "2025": "q1", "2026": "r1" }, armonizada(BASES)),
        fila({ "2024": "p2", "2025": "q2" }),
        fila({ "2024": "p3", "2026": "r3" }),
      ],
    })), "matriz");
    expect(p.estado).toBe("falta");
    expect(p.detalle).toBe("3 filas · 2 sin armonizar · 2 faltan en alguna base");
    expect(p.enlace).toMatchObject({ tipo: "panel", panel: "mapa-bases" });
  });

  it("faltar en una base sin filas sin armonizar no es una falta: se informa", () => {
    const p = paso(pasosDelRecorrido(completa({
      filas: [fila({ "2024": "p1", "2025": "q1" }, armonizada(["2024", "2025"]))],
    })), "matriz");
    expect(p.estado).toBe("hecho");
    expect(p.detalle).toBe("1 fila · 1 falta en alguna base");
  });

  it("sin filas no está empezada", () => {
    expect(paso(pasosDelRecorrido(completa({ filas: [] })), "matriz")).toMatchObject({
      estado: "no-empezado", detalle: "Sin preguntas en la matriz",
    });
  });
});

describe("paso 5 · Ponderación", () => {
  it("una base que trae columna de peso sin declarar es una falta, con su nombre y la columna", () => {
    const p = paso(pasosDelRecorrido(completa({
      ponderacion: {
        tipo: "listo",
        datos: [
          { base: "2024", ponderacion: { tipo: "sin_declarar", columnasPeso: ["factor_ponderacion"] } },
          { base: "2025", ponderacion: { tipo: "calibracion" } },
          { base: "2026", ponderacion: { tipo: "sin_leer" } },
        ],
      },
    })), "ponderacion");
    expect(p.estado).toBe("falta");
    expect(p.detalle).toBe("2024 trae «factor_ponderacion» sin declarar");
    expect(p.enlace).toMatchObject({ tipo: "direccion", etiqueta: "Ponderación" });
    expect(p.enlace.tipo === "direccion" && p.enlace.href).toContain("pestana=ponderacion");
  });

  it("lo que no se puede leer desde aquí no se supone: queda «sin lectura»", () => {
    const p = paso(pasosDelRecorrido(completa({
      ponderacion: {
        tipo: "listo",
        datos: [
          { base: "2024", ponderacion: { tipo: "sin_leer" } },
          { base: "2025", ponderacion: { tipo: "sin_leer" } },
          { base: "2026", ponderacion: { tipo: "columna", columna: "peso" } },
        ],
      },
    })), "ponderacion");
    expect(p.estado).toBe("sin-lectura");
    expect(p.detalle).toBe("2026: columna «peso» · 2 bases sin leer aquí");
  });

  it("sin declarar y sin columnas de peso es «sin ponderar»: un hecho, no una falta", () => {
    const p = paso(pasosDelRecorrido(completa({
      ponderacion: {
        tipo: "listo",
        datos: [
          { base: "2025", ponderacion: { tipo: "columna", columna: "factor_ponderacion" } },
          { base: "2026", ponderacion: { tipo: "sin_declarar", columnasPeso: [] } },
        ],
      },
    })), "ponderacion");
    expect(p.estado).toBe("hecho");
    expect(p.detalle).toBe("2025: columna «factor_ponderacion» · 2026: sin ponderar");
  });

  it("si la lectura no dice las columnas de peso, sigue pendiente", () => {
    const p = paso(pasosDelRecorrido(completa({
      ponderacion: { tipo: "listo", datos: [{ base: "2024", ponderacion: { tipo: "sin_declarar", columnasPeso: null } }] },
    })), "ponderacion");
    expect(p).toMatchObject({ estado: "falta", detalle: "2024 sin peso declarado" });
  });

  it("con la serie entera declarada está hecho", () => {
    const p = paso(pasosDelRecorrido(completa()), "ponderacion");
    expect(p.estado).toBe("hecho");
    expect(p.detalle).toBe("2024: sin ponderar · y 2 bases más");
  });
});

describe("paso 6 · Comparativos", () => {
  it("listo con una fila armonizada comparable en dos bases", () => {
    expect(filasComparables([fila({ "2024": "p1", "2025": "q1" }, armonizada(["2024", "2025"]))], BASES)).toBe(1);
    // Armonizada pero presente en una sola base: no compara nada.
    expect(filasComparables([fila({ "2024": "p1" }, armonizada(["2024"]))], BASES)).toBe(0);
    // No comparable en una de las dos: tampoco.
    const noComp = fila({ "2024": "p1", "2025": "q1" }, {
      escala, por_base: { "2024": { comparable: true, mapa: {} }, "2025": { comparable: false, mapa: {} } },
    });
    expect(filasComparables([noComp], BASES)).toBe(0);
  });

  it("sin filas comparables no está empezado y enlaza a Comparativos", () => {
    const p = paso(pasosDelRecorrido(completa({ filas: [fila({ "2024": "p1", "2025": "q1" })] })), "comparativos");
    expect(p).toMatchObject({ estado: "no-empezado", detalle: "Ninguna pregunta armonizada en 2 bases" });
    expect(p.enlace.tipo === "direccion" && p.enlace.href).toContain("pestana=comparativos");
  });
});

describe("C2: el texto no crece con el número de bases", () => {
  it("dos entradas se nombran; con más, la primera y el resto contado", () => {
    expect(porBaseConTope(["a: 1", "b: 2"])).toBe("a: 1 · b: 2");
    expect(porBaseConTope(["a: 1", "b: 2", "c: 3", "d: 4", "e: 5", "f: 6"])).toBe("a: 1 · y 5 bases más");
  });

  it("con seis bases y todas con faltas, cada detalle sigue siendo de una línea corta", () => {
    const seis = ["b1", "b2", "b3", "b4", "b5", "b6"];
    const pasos = pasosDelRecorrido({
      ...completa(),
      bases: seis,
      variables: Object.fromEntries(seis.map((b) => [b, vars(b, { extras: [columna("x")] })])),
      segmentos: segs([segmento("edad", {})]),
      ponderacion: { tipo: "listo", datos: seis.map((base) => ({ base, ponderacion: { tipo: "sin_declarar" as const, columnasPeso: ["factor"] } })) },
    });
    expect(paso(pasos, "variables").detalle).toBe("b1: 1 columna sin incorporar · y 5 bases más");
    expect(paso(pasos, "segmentos").detalle).toBe("b1: falta 1 segmento · y 5 bases más");
    expect(paso(pasos, "ponderacion").detalle).toBe("6 bases traen columnas de peso sin declarar");
    expect(Math.max(...pasos.map((p) => p.detalle.length))).toBeLessThanOrEqual(60);
  });
});

describe("readiness y enlaces", () => {
  it("`false` mientras algún paso lee", () => {
    expect(readinessRecorrido(pasosDelRecorrido(completa({ segmentos: { tipo: "cargando" } })))).toBe("false");
    expect(readinessRecorrido(pasosDelRecorrido(completa()))).toBe("true");
  });

  it("un panel se abre sobre la dirección actual, reescribiendo panel y foco", () => {
    expect(hrefDeEnlace(
      { tipo: "panel", panel: "variables-base", foco: "2026", etiqueta: "x" },
      "/procesamiento",
      "?seccion=carga&pestana=equivalencias&panel=mapa-bases&foco=2024",
    )).toBe("/procesamiento?seccion=carga&pestana=equivalencias&panel=variables-base&foco=2026");
    expect(hrefDeEnlace(
      { tipo: "panel", panel: "segmentos", etiqueta: "x" },
      "/procesamiento",
      "?seccion=carga&pestana=equivalencias&foco=2024",
    )).toBe("/procesamiento?seccion=carga&pestana=equivalencias&panel=segmentos");
    expect(hrefDeEnlace({ tipo: "direccion", href: "/x?pestana=y", etiqueta: "x" }, "/p", "?a=1")).toBe("/x?pestana=y");
  });
});
