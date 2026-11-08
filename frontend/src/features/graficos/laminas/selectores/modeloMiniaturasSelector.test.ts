// Miniatura real del selector: qué tarjetas piden, que con faltas no se pide, ids estables y un lote a la vez.
import { describe, expect, it } from "vitest";
import type { InventarioPublico } from "../../../../api/graficosInventario";
import type { EstadoInventario } from "./fichaDatos";
import {
  ERROR_SIN_GRAFICO, ERROR_SIN_IMAGEN, idMiniaturaSelector, laminaDeOpcion, laminasDelSelector, miniaturaDeEntrada, muestraDePreguntas,
  NOTA_SIN_PREGUNTAS, notasDelSelector, opcionesQuePiden, planSelector, puedePedir, tipoDePregunta, type FuenteSelector,
} from "./modeloMiniaturasSelector";
import { cruzarConEstudio, usaDeTarjeta } from "./fichaDatos";
import { presetDe } from "./opcionesLamina";
import type { EstudioDelSelector } from "./opcionesLamina";

const publico = (base: string, escala: number): InventarioPublico => ({
  base, publico: base, n: 100,
  preguntas: { escala, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0 },
  padron: { declarado: false, valor: null, origen: "", motivo: "" },
});
const DOS: EstadoInventario = { estado: "listo", publicos: [publico("docentes", 40), publico("estudiantes", 30)] };
const UNO: EstadoInventario = { estado: "listo", publicos: [publico("docentes", 40)] };
const ESTUDIO: EstudioDelSelector = {
  bases: ["docentes", "estudiantes"], baseActiva: "docentes", indicador: { codigos: ["4", "5"], etiqueta: "Top Two Box" },
};
const SIN_INDICADOR: EstudioDelSelector = { bases: ["docentes", "estudiantes"], baseActiva: "docentes" };

const escala = (name: string) => ({
  name, tipo: "select_one acuerdo",
  choices: ["1", "2", "3", "4", "5"].map((c) => ({ name: c, label: `Opción ${c}` })),
});
const FUENTES: FuenteSelector[] = [
  { name: "docentes", variables: [{ name: "edad", tipo: "integer" }, ...["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map(escala)] },
  { name: "estudiantes", variables: ["e1", "e2", "e3"].map(escala) },
];

const graficoDe = (payload: Record<string, unknown>) =>
  Object.values(payload).find((v) => !!v && typeof v === "object" && "graficador" in (v as object)) as
    { graficador: string; args: Record<string, unknown> };

describe("opcionesQuePiden", () => {
  it("fuera de «Comparar», sólo la enfocada; dentro, las dos comparadas; nunca la galería", () => {
    expect(opcionesQuePiden("p_slide_1_grafico:panorama", ["p_slide_1_grafico:contraste"], false)).toEqual(["p_slide_1_grafico:panorama"]);
    expect(opcionesQuePiden("p_slide_1_grafico:panorama", ["p_slide_1_grafico:contraste", "p_slide_2_graficos"], true))
      .toEqual(["p_slide_1_grafico:contraste", "p_slide_2_graficos"]);
    expect(opcionesQuePiden(null, [], false)).toEqual([]);
  });
});

describe("puedePedir", () => {
  it("una tarjeta con gráfico y el estudio suficiente pide", () => {
    expect(puedePedir("p_slide_1_grafico:panorama", DOS)).toBe(true);
    expect(puedePedir("p_slide_1_grafico:contraste", DOS)).toBe(true);
  });

  it("con faltas no pide: el contraste en un estudio de un solo público se queda con el glifo", () => {
    expect(puedePedir("p_slide_1_grafico:contraste", UNO)).toBe(false);
  });

  it("sin gráfico de partida (composición o cierre) no pide: saldría una lámina vacía", () => {
    expect(puedePedir("p_slide_2_graficos", DOS)).toBe(false);
    expect(puedePedir("p_slide_cierre_hallazgos:cierre", DOS)).toBe(false);
  });

  it("mientras se lee el estudio, o si no se pudo leer, no pide", () => {
    expect(puedePedir("p_slide_1_grafico:panorama", { estado: "cargando" })).toBe(false);
    expect(puedePedir("p_slide_1_grafico:panorama", { estado: "error", mensaje: "x" })).toBe(false);
  });
});

describe("laminasDelSelector", () => {
  it("ids estables por tarjeta y la misma clave mientras no cambien la tarjeta ni el estudio", () => {
    expect(idMiniaturaSelector("p_slide_1_grafico:contraste")).toBe("selector-p_slide_1_grafico-contraste");
    const a = laminasDelSelector(["p_slide_1_grafico:contraste", "p_slide_2_graficos"], DOS, ESTUDIO, "g");
    const b = laminasDelSelector(["p_slide_1_grafico:contraste"], DOS, ESTUDIO, "g");
    expect(a.map((l) => l.id)).toEqual(["selector-p_slide_1_grafico-contraste"]);
    expect(a[0].slide.id).toBe(a[0].id);
    expect(a[0].clave).toBe(b[0].clave);
    expect(laminasDelSelector(["p_slide_1_grafico:contraste"], DOS, ESTUDIO, "otro")[0].clave).not.toBe(a[0].clave);
  });

  it("la lámina lleva el gráfico de la tarjeta con las bases del estudio", () => {
    const [l] = laminasDelSelector(["p_slide_1_grafico:contraste"], DOS, ESTUDIO, "g");
    const g = Object.values(l.slide.payload).find((v) => !!v && typeof v === "object" && "graficador" in (v as object)) as
      { graficador: string; args: Record<string, unknown> };
    expect(g.graficador).toBe("p_dumbbell");
    expect(g.args.bases).toEqual(["docentes", "estudiantes"]);
  });
});

describe("R5-1: la miniatura lleva lo que el gráfico necesita para dibujarse", () => {
  it("el contraste lleva el par de bases, su regla y el indicador por defecto del estudio", () => {
    const g = graficoDe(laminaDeOpcion("p_slide_1_grafico:contraste", ESTUDIO).payload);
    expect(g.args.bases).toEqual(["docentes", "estudiantes"]);
    expect(g.args.corte).toBe("4,5");
    expect(g.args.corte_etiqueta).toBe("Top Two Box");
    expect(g.args.regla).toBeTruthy();
  });

  it("el panorama y las fortalezas también nacen con el indicador (en lista)", () => {
    expect(graficoDe(laminaDeOpcion("p_slide_1_grafico:panorama", ESTUDIO).payload).args.corte).toEqual(["4", "5"]);
    expect(graficoDe(laminaDeOpcion("p_slide_1_grafico:fortalezas", ESTUDIO).payload).args.corte).toEqual(["4", "5"]);
  });

  it("sin preguntas ni regla de partida, la miniatura usa las primeras que la ficha cuenta, repartidas entre públicos", () => {
    const g = graficoDe(laminaDeOpcion("p_slide_1_grafico:divergentes", ESTUDIO, { inventario: DOS, fuentes: FUENTES }).payload);
    expect(g.args.vars).toEqual(["docentes$p1", "docentes$p2", "docentes$p3", "estudiantes$e1", "estudiantes$e2", "estudiantes$e3"]);
    // Con un solo público con preguntas, las seis de ése.
    const uno = graficoDe(laminaDeOpcion("p_slide_1_grafico:divergentes", ESTUDIO, { inventario: UNO, fuentes: FUENTES }).payload);
    expect(uno.args.vars).toEqual(["docentes$p1", "docentes$p2", "docentes$p3", "docentes$p4", "docentes$p5", "docentes$p6"]);
    // Sin contexto (al insertar), las preguntas no se inventan.
    expect(graficoDe(laminaDeOpcion("p_slide_1_grafico:divergentes", ESTUDIO).payload).args.vars).toBeUndefined();
  });

  it("la muestra de un gráfico de varios públicos reparte entre los que tienen preguntas", () => {
    const usa = usaDeTarjeta(presetDe("p_slide_1_grafico:panorama"));
    if (!usa) throw new Error("sin usa");
    const cruce = cruzarConEstudio(usa, DOS.estado === "listo" ? DOS.publicos : []);
    expect(muestraDePreguntas(usa, cruce, FUENTES, "docentes", 4)).toEqual(["docentes$p1", "docentes$p2", "estudiantes$e1", "estudiantes$e2"]);
  });

  it("R7-5: un gráfico sólo de escala toma las preguntas de UNA escala, la más común entre las bases (Arte, tres bases)", () => {
    const frecuencia = (name: string) => ({
      name, tipo: "select_one frec",
      choices: ["Nunca", "A veces", "Casi siempre", "Siempre"].map((label, i) => ({ name: String(i + 1), label })),
    });
    const fuentes: FuenteSelector[] = [
      { name: "docentes", variables: [frecuencia("f1"), escala("p1"), escala("p2")] },
      { name: "estudiantes", variables: [frecuencia("g1"), escala("e1"), escala("e2")] },
      { name: "administrativos", variables: [escala("a1"), frecuencia("h1")] },
    ];
    const tres: EstadoInventario = { estado: "listo", publicos: [publico("docentes", 3), publico("estudiantes", 3), publico("administrativos", 2)] };
    const usa = usaDeTarjeta(presetDe("p_slide_1_grafico:divergentes"))!;
    const muestra = muestraDePreguntas(usa, cruzarConEstudio(usa, tres.estado === "listo" ? tres.publicos : []), fuentes, "estudiantes");
    expect(muestra).toEqual(["docentes$p1", "docentes$p2", "estudiantes$e1", "estudiantes$e2", "administrativos$a1"]);
  });

  it("clasifica las preguntas como el inventario: escala, opción única, múltiple, numérica, abierta", () => {
    expect(tipoDePregunta(escala("p1"))).toBe("escala");
    expect(tipoDePregunta({ name: "s", tipo: "select_one sexo", choices: [{ name: "1", label: "H" }, { name: "2", label: "M" }] })).toBe("opcion_unica");
    expect(tipoDePregunta({ name: "m", tipo: "select_multiple x" })).toBe("multiple");
    expect(tipoDePregunta({ name: "n", tipo: "integer" })).toBe("numerica");
    expect(tipoDePregunta({ name: "t", tipo: "text" })).toBe("abierta");
    expect(tipoDePregunta({ name: "x", tipo: "integer", graphable: false })).toBeNull();
  });

  it("una tarjeta incompleta no pide y dice por qué en una línea", () => {
    // Sin indicador en el estudio, el contraste no se dibujaría: no pide y lo dice.
    expect(laminasDelSelector(["p_slide_1_grafico:contraste"], DOS, SIN_INDICADOR, "g")).toEqual([]);
    expect(notasDelSelector(["p_slide_1_grafico:contraste"], DOS, SIN_INDICADOR)["p_slide_1_grafico:contraste"])
      .toBe("Sin vista previa: marca qué respuestas suman el indicador.");
    // El mapa de calor por cruce pide una pregunta y un cruce, no una lista: sin muestra, falta elegir preguntas.
    const conOpcionUnica: EstadoInventario = {
      estado: "listo",
      publicos: (DOS.estado === "listo" ? DOS.publicos : []).map((p) => ({ ...p, preguntas: { ...p.preguntas, opcion_unica: 5 } })),
    };
    expect(notasDelSelector(["p_slide_1_grafico:mapa_calor"], conOpcionUnica, ESTUDIO, FUENTES)["p_slide_1_grafico:mapa_calor"]).toBe(NOTA_SIN_PREGUNTAS);
    // ADR 0137: una tarjeta con un tipo retirado no pide ni lleva nota: no se ofrece.
    expect(notasDelSelector(["p_slide_1_grafico:significancia"], conOpcionUnica, ESTUDIO, FUENTES)).toEqual({});
    expect(laminasDelSelector(["p_slide_1_grafico:significancia"], conOpcionUnica, ESTUDIO, "g", FUENTES)).toEqual([]);
    // Las aperturas piden la pregunta que divide.
    expect(notasDelSelector(["p_slide_1_grafico:aperturas"], UNO, ESTUDIO)["p_slide_1_grafico:aperturas"]).toMatch(/^Sin vista previa: elige la variable que divide a los grupos/);
    // Las completas no llevan nota.
    expect(notasDelSelector(["p_slide_1_grafico:contraste"], DOS, ESTUDIO)).toEqual({});
  });
});

describe("planSelector y miniaturaDeEntrada", () => {
  it("con un lote del selector corriendo no pide otro; sin él, lo nuevo o lo que cambió de clave", () => {
    const l = { id: "selector-a", clave: "k2" };
    const entradas = { "selector-a": { estado: "ok" as const, clave: "k1", src: "s", anterior: null, error: null } };
    expect(planSelector([l], entradas, 1)).toBeNull();
    expect(planSelector([l], entradas, 0)).toEqual([l]);
    expect(planSelector([{ id: "selector-a", clave: "k1" }], entradas, 0)).toBeNull();
  });

  it("error: sin imagen y con su nota; mientras se rehace, la anterior", () => {
    expect(miniaturaDeEntrada({ estado: "error", clave: "k", src: null, anterior: "x", error: "Falló" })).toEqual({ src: null, error: "Falló" });
    expect(miniaturaDeEntrada({ estado: "pendiente", clave: "k", src: null, anterior: "x", error: null })).toEqual({ src: "x", error: null });
    expect(miniaturaDeEntrada(undefined)).toEqual({ src: null, error: null });
  });

  it("R5-1: una imagen sin gráfico cuenta como error, con el motivo del motor si lo trae", () => {
    expect(miniaturaDeEntrada({ estado: "sin_datos", clave: "k", src: "s", anterior: null, error: null })).toEqual({ src: null, error: ERROR_SIN_GRAFICO });
    expect(miniaturaDeEntrada({
      estado: "ok", clave: "k", src: "s", anterior: null, error: null, vacios: { vacios: 1, pedidos: 1, motivo: "Falta el indicador" },
    })).toEqual({ src: null, error: "Sin vista previa: falta el indicador." });
    expect(miniaturaDeEntrada({ estado: "sin_imagen", clave: "k", src: null, anterior: null, error: null })).toEqual({ src: null, error: ERROR_SIN_IMAGEN });
    // Un gráfico vacío de dos no es una lámina en blanco.
    expect(miniaturaDeEntrada({
      estado: "ok", clave: "k", src: "s", anterior: null, error: null, vacios: { vacios: 1, pedidos: 2, motivo: null },
    }).src).toBe("s");
  });
});
