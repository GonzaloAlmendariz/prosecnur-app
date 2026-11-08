// Miniatura real del selector: qué tarjetas piden, que con faltas no se pide, ids estables y un lote a la vez.
import { describe, expect, it } from "vitest";
import type { InventarioPublico } from "../../../../api/graficosInventario";
import type { EstadoInventario } from "./fichaDatos";
import {
  idMiniaturaSelector, laminasDelSelector, miniaturaDeEntrada, opcionesQuePiden, planSelector, puedePedir,
} from "./modeloMiniaturasSelector";
import type { EstudioDelSelector } from "./opcionesLamina";

const publico = (base: string, escala: number): InventarioPublico => ({
  base, publico: base, n: 100,
  preguntas: { escala, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0 },
  padron: { declarado: false, valor: null, origen: "", motivo: "" },
});
const DOS: EstadoInventario = { estado: "listo", publicos: [publico("docentes", 40), publico("estudiantes", 30)] };
const UNO: EstadoInventario = { estado: "listo", publicos: [publico("docentes", 40)] };
const ESTUDIO: EstudioDelSelector = { bases: ["docentes", "estudiantes"], baseActiva: "docentes" };

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
});
