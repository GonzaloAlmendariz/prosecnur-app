import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import {
  bottomDisponible,
  categoriasElegibles,
  composicionDeLamina,
  NOTA_BOTTOM_NO_NATIVO,
  formaTwoBox,
  leerTwoBox,
  patchTwoBox,
  preguntaDeEscala,
  type CambioTwoBox,
  type Composicion,
} from "./twoBox";

type R = Record<string, unknown>;

// Los 26 graficadores del registro (`.GRAFICOS_SALIDA_EDITOR`, graficos_metadata.R).
const GRAFICADORES = [
  "p_barras_agrupadas", "p_barras_categoricas", "p_barras_apiladas", "p_barras_multiapiladas", "p_nube_palabras",
  "p_mapa_cobertura_territorial", "p_pie", "p_donut", "p_numerico", "p_histograma", "p_boxplot", "p_media_rango",
  "p_barras_divergentes", "p_puntos_comparativos", "p_mapa_resultado_distrital", "p_cifra", "p_dumbbell", "p_lollipop",
  "p_serie_temporal", "p_radar", "p_tabla", "p_dim_radar", "p_dim_heatmap", "p_dim_comparativo_radarbar", "p_dim_foda",
  "p_dim_heatmap_criterios",
];

/** Aplica el patch como lo hace el store y simula guardar y leer el plan (JSON). */
function aplicar(graficador: string, args: R, presets: Record<string, R>, cambio: CambioTwoBox, composicion: Composicion = "sola"): R {
  const next = mergeSlotArgsPatch(args, patchTwoBox(graficador, args, presets, cambio, composicion));
  return JSON.parse(JSON.stringify(next)) as R;
}

describe("formaTwoBox: qué graficadores ofrecen Top/Bottom Two Box", () => {
  it("sólo las escalas que dibuja graficar_barras_apiladas()", () => {
    const con = GRAFICADORES.filter((g) => formaTwoBox(g, {}) !== null);
    expect(con).toEqual(["p_barras_apiladas", "p_barras_multiapiladas"]);
  });
  it("la multiapilada «multilista» lo declara por bloque", () => {
    expect(formaTwoBox("p_barras_multiapiladas", { modo: "multilista" })).toBe("por_bloque");
    expect(formaTwoBox("p_barras_multiapiladas", { modo: "var_cruce" })).toBe("multiapiladas");
    expect(leerTwoBox("p_barras_multiapiladas", { modo: "multilista" }, {})).toBeNull();
  });
});

describe("barras apiladas: lo que lee el motor va en overrides", () => {
  it("sin estilo del informe manda el recetario: Top Two Box encendido, sin categorías, sin Bottom", () => {
    expect(leerTwoBox("p_barras_apiladas", { var: "p1" }, {})).toEqual({
      forma: "apiladas",
      top: { activa: true, etiquetas: [], delInforme: false },
      bottom: { activa: false, etiquetas: [], delInforme: false },
    });
  });

  it("declarar las dos categorías escribe overrides.top2box_labels y conserva los demás overrides", () => {
    const args = { var: "p1", overrides: { etiquetas_vars: { p1: "Corta" } } };
    const out = aplicar("p_barras_apiladas", args, {}, { caja: "top", etiquetas: ["De acuerdo", "Muy de acuerdo"] });
    expect(out.overrides).toEqual({ etiquetas_vars: { p1: "Corta" }, top2box_labels: ["De acuerdo", "Muy de acuerdo"] });
    expect(leerTwoBox("p_barras_apiladas", out, {})?.top.etiquetas).toEqual(["De acuerdo", "Muy de acuerdo"]);
  });

  it("apagar el Top Two Box pide mostrar_barra_extra = FALSE; volver a encenderlo borra la clave (vuelve al recetario)", () => {
    const off = aplicar("p_barras_apiladas", { var: "p1" }, {}, { caja: "top", activa: false });
    expect(off.overrides).toEqual({ mostrar_barra_extra: false });
    expect(leerTwoBox("p_barras_apiladas", off, {})?.top.activa).toBe(false);
    const on = aplicar("p_barras_apiladas", off, {}, { caja: "top", activa: true });
    expect(on.overrides).toBeUndefined();
    expect(leerTwoBox("p_barras_apiladas", on, {})?.top.activa).toBe(true);
  });

  it("si el informe muestra otra columna, encenderlo pide el preset top2box explícito", () => {
    const presets = { barras_apiladas: { mostrar_barra_extra: false, barra_extra_preset: "ninguno" } };
    expect(leerTwoBox("p_barras_apiladas", {}, presets)?.top.activa).toBe(false);
    const on = aplicar("p_barras_apiladas", {}, presets, { caja: "top", activa: true });
    expect(on.overrides).toEqual({ mostrar_barra_extra: true, barra_extra_preset: "top2box" });
  });

  it("Bottom Two Box al lado: columna_bottom2box + bottom2box_labels; apagarlo borra la clave", () => {
    const on = aplicar("p_barras_apiladas", {}, {}, { caja: "bottom", activa: true });
    expect(on.overrides).toEqual({ columna_bottom2box: true });
    const conCats = aplicar("p_barras_apiladas", on, {}, { caja: "bottom", etiquetas: ["Nada", "Poco"] });
    expect(leerTwoBox("p_barras_apiladas", conCats, {})?.bottom).toEqual({ activa: true, etiquetas: ["Nada", "Poco"], delInforme: false });
    const off = aplicar("p_barras_apiladas", conCats, {}, { caja: "bottom", activa: false });
    expect(off.overrides).toEqual({ bottom2box_labels: ["Nada", "Poco"] });
    expect(leerTwoBox("p_barras_apiladas", off, {})?.bottom.activa).toBe(false);
  });

  it("sin Top Two Box no hay Bottom Two Box (el motor la exige junto al top2box)", () => {
    const args = { overrides: { mostrar_barra_extra: false, columna_bottom2box: true } };
    expect(leerTwoBox("p_barras_apiladas", args, {})?.bottom.activa).toBe(false);
  });

  it("las categorías del estilo del informe se heredan y elegir las mismas no las copia al gráfico", () => {
    const presets = { barras_apiladas: { top2box_labels: ["A", "B"] } };
    expect(leerTwoBox("p_barras_apiladas", {}, presets)?.top).toEqual({ activa: true, etiquetas: ["A", "B"], delInforme: true });
    const otras = aplicar("p_barras_apiladas", {}, presets, { caja: "top", etiquetas: ["B", "C"] });
    expect(otras.overrides).toEqual({ top2box_labels: ["B", "C"] });
    const iguales = aplicar("p_barras_apiladas", otras, presets, { caja: "top", etiquetas: ["A", "B"] });
    expect(iguales.overrides).toBeUndefined();
  });

  it("con «Dividir por» hereda también el preset de multiapiladas (el motor delega en modo cruce)", () => {
    const presets = { barras_apiladas: { columna_bottom2box: false }, multi_apiladas: { columna_bottom2box: true } };
    expect(leerTwoBox("p_barras_apiladas", { cruces: "sexo" }, presets)?.bottom.activa).toBe(true);
    expect(leerTwoBox("p_barras_apiladas", {}, presets)?.bottom.activa).toBe(false);
  });
});

describe("multiapiladas: el par top2box + top2box_labels del constructor de bloques", () => {
  it("declarar las categorías enciende top2box (sin él las etiquetas no llegan al motor)", () => {
    const out = aplicar("p_barras_multiapiladas", { modo: "var", vars: ["p1", "p2"] }, {}, { caja: "top", etiquetas: ["X", "Y"] });
    expect(out.top2box).toBe(true);
    expect(out.top2box_labels).toEqual(["X", "Y"]);
    // El recetario ya muestra la columna: `overrides.mostrar_barra_extra = TRUE` sería copiar lo heredado.
    expect(out.overrides).toBeUndefined();
    expect(leerTwoBox("p_barras_multiapiladas", out, {})?.top).toEqual({ activa: true, etiquetas: ["X", "Y"], delInforme: false });
  });

  it("apagarlo fija top2box = FALSE y overrides.mostrar_barra_extra = FALSE, como el constructor", () => {
    const args = { modo: "var", vars: ["p1"], top2box: true, top2box_labels: ["X", "Y"], overrides: { mostrar_barra_extra: true } };
    const out = aplicar("p_barras_multiapiladas", args, {}, { caja: "top", activa: false });
    expect(out.top2box).toBe(false);
    expect(out.overrides).toEqual({ mostrar_barra_extra: false });
    expect(out.top2box_labels).toEqual(["X", "Y"]);
    expect(leerTwoBox("p_barras_multiapiladas", out, {})?.top.activa).toBe(false);
  });

  it("un plan que nunca pasó por el constructor sigue al recetario (columna encendida, falta declarar)", () => {
    expect(leerTwoBox("p_barras_multiapiladas", { modo: "var", vars: ["p1"] }, {})?.top).toEqual({ activa: true, etiquetas: [], delInforme: false });
  });

  it.each(["var", "cruce", "var_cruce"])("modo %s solo en su lámina: el Bottom Two Box se ofrece y se enciende", (modo) => {
    const args = { modo, var: "p1", vars: ["p1"], top2box: true, top2box_labels: ["X", "Y"] };
    expect(bottomDisponible("p_barras_multiapiladas", args, {})).toEqual({ ofrecer: true, editable: true, activa: false });
    const on = aplicar("p_barras_multiapiladas", args, {}, { caja: "bottom", activa: true });
    expect(on.overrides).toEqual({ columna_bottom2box: true });
    expect(leerTwoBox("p_barras_multiapiladas", on, {})?.bottom.activa).toBe(true);
    expect(bottomDisponible("p_barras_multiapiladas", on, {})).toEqual({ ofrecer: true, editable: true, activa: true });
    expect(aplicar("p_barras_multiapiladas", on, {}, { caja: "bottom", activa: false })).toEqual(args);
  });

  it("en una lámina de varios gráficos (mixtas, paneles) no se enciende: aún no sale en la lámina nativa", () => {
    const args = { modo: "cruce", var: "p1", top2box: true, top2box_labels: ["X", "Y"] };
    expect(patchTwoBox("p_barras_multiapiladas", args, {}, { caja: "bottom", activa: true }, "varios")).toEqual({});
    expect(bottomDisponible("p_barras_multiapiladas", args, {}, "varios")).toEqual({ ofrecer: true, editable: false, activa: false, nota: NOTA_BOTTOM_NO_NATIVO });
    // Barras apiladas no cambia: se sigue ofreciendo como hasta ahora.
    expect(bottomDisponible("p_barras_apiladas", {}, {}, "varios")).toEqual({ ofrecer: true, editable: false, activa: false, nota: NOTA_BOTTOM_NO_NATIVO });
    expect(bottomDisponible("p_barras_apiladas", {}, {}, "sola")).toEqual({ ofrecer: true, editable: true, activa: false });
  });

  it("composicionDeLamina: las de 2 o más gráficos son «varios»", () => {
    expect(composicionDeLamina("p_slide_1_grafico")).toBe("sola");
    expect(composicionDeLamina("p_slide_1_grafico_narrativo")).toBe("sola");
    expect(composicionDeLamina(undefined)).toBe("sola");
    for (const t of ["p_slide_2_graficos", "p_slide_2_graficos_vertical", "p_slide_3_graficos_fila", "p_slide_4_graficos", "p_slide_5_graficos_poblacion", "p_slide_cifras_y_graficos"]) {
      expect(composicionDeLamina(t)).toBe("varios");
    }
  });

  it("si ya lo tiene guardado en una lámina de varios gráficos se muestra y se deja quitar", () => {
    const args = { modo: "cruce", var: "p1", top2box: true, top2box_labels: ["X", "Y"], overrides: { columna_bottom2box: true } };
    expect(leerTwoBox("p_barras_multiapiladas", args, {})?.bottom.activa).toBe(true);
    expect(bottomDisponible("p_barras_multiapiladas", args, {}, "varios")).toMatchObject({ ofrecer: true, editable: true, activa: true });
    const off = aplicar("p_barras_multiapiladas", args, {}, { caja: "bottom", activa: false }, "varios");
    expect(off).toEqual({ modo: "cruce", var: "p1", top2box: true, top2box_labels: ["X", "Y"] });
    expect(bottomDisponible("p_barras_multiapiladas", off, {}, "varios")).toMatchObject({ editable: false });
  });

  it("multilista: deshabilitado con nota; uno guardado se deja quitar y no se vuelve a encender", () => {
    const args = { modo: "multilista", vars: { a: ["p1"], b: ["p2"] } };
    expect(bottomDisponible("p_barras_multiapiladas", args, {})).toEqual({ ofrecer: true, editable: false, activa: false, nota: NOTA_BOTTOM_NO_NATIVO });
    expect(patchTwoBox("p_barras_multiapiladas", args, {}, { caja: "bottom", activa: true })).toEqual({});
    const guardado = { ...args, overrides: { columna_bottom2box: true } };
    expect(bottomDisponible("p_barras_multiapiladas", guardado, {})).toMatchObject({ editable: true, activa: true });
    const off = aplicar("p_barras_multiapiladas", guardado, {}, { caja: "bottom", activa: false });
    expect(off).toEqual(args);
    expect(bottomDisponible("p_barras_multiapiladas", off, {})).toMatchObject({ editable: false, activa: false });
    // Las categorías y el Top Two Box de la multilista son de cada bloque: la tarjeta no escribe nada.
    expect(patchTwoBox("p_barras_multiapiladas", args, {}, { caja: "top", activa: false })).toEqual({});
    expect(patchTwoBox("p_barras_multiapiladas", args, {}, { caja: "bottom", etiquetas: ["N"] })).toEqual({});
  });

  it("multilista con el estilo del informe pidiéndolo: apagar y volver a encender es volver a lo heredado", () => {
    const presets = { multi_apiladas: { columna_bottom2box: true } };
    const args = { modo: "multilista", vars: { a: ["p1"] } };
    expect(bottomDisponible("p_barras_multiapiladas", args, presets)).toMatchObject({ editable: true, activa: true });
    const off = aplicar("p_barras_multiapiladas", args, presets, { caja: "bottom", activa: false });
    expect(off.overrides).toEqual({ columna_bottom2box: false });
    expect(aplicar("p_barras_multiapiladas", off, presets, { caja: "bottom", activa: true })).toEqual(args);
  });

  it("en barras apiladas el Bottom Two Box sí se ofrece, y nunca sin Top Two Box", () => {
    expect(bottomDisponible("p_barras_apiladas", {}, {})).toEqual({ ofrecer: true, editable: true, activa: false });
    expect(bottomDisponible("p_barras_apiladas", { overrides: { mostrar_barra_extra: false } }, {})).toEqual({ ofrecer: false, editable: false, activa: false });
  });

  it("si el estilo del informe lo pide, apagarlo en el gráfico y volver a encenderlo es volver a lo heredado", () => {
    const presets = { multi_apiladas: { columna_bottom2box: true } };
    const args = { modo: "var", vars: ["p1"] };
    expect(bottomDisponible("p_barras_multiapiladas", args, presets)).toMatchObject({ editable: true });
    const off = aplicar("p_barras_multiapiladas", args, presets, { caja: "bottom", activa: false });
    expect(off.overrides).toEqual({ columna_bottom2box: false });
    expect(bottomDisponible("p_barras_multiapiladas", off, presets)).toMatchObject({ editable: true });
    expect(aplicar("p_barras_multiapiladas", off, presets, { caja: "bottom", activa: true })).toEqual(args);
  });
});

describe("ida y vuelta: volver a lo heredado deja el gráfico como estaba", () => {
  const MULTI = "p_barras_multiapiladas";
  const recorrer = (g: string, args: R, presets: Record<string, R>, cambios: CambioTwoBox[], composicion: Composicion = "sola") =>
    cambios.reduce((acc, c) => aplicar(g, acc, presets, c, composicion), args);

  it("multiapiladas {top2box} → poner etiquetas → quitarlas: no deja overrides.mostrar_barra_extra", () => {
    const fin = recorrer(MULTI, { modo: "var", vars: ["p1"], top2box: true }, {}, [
      { caja: "top", etiquetas: ["X", "Y"] },
      { caja: "top", etiquetas: [] },
    ]);
    // Con el recetario la columna ya se hereda: `top2box = TRUE` sin etiquetas es lo heredado y también se borra.
    expect(fin).toEqual({ modo: "var", vars: ["p1"] });
  });

  it("multiapiladas con el informe sin columna: {top2box + par} → etiquetas → quitarlas vuelve exacto", () => {
    const presets = { multi_apiladas: { mostrar_barra_extra: false } };
    const inicio = { modo: "var", vars: ["p1"], top2box: true, overrides: { mostrar_barra_extra: true } };
    const fin = recorrer(MULTI, inicio, presets, [
      { caja: "top", etiquetas: ["X", "Y"] },
      { caja: "top", etiquetas: [] },
    ]);
    expect(fin).toEqual(inicio);
  });

  it("apiladas con el informe en «ninguno»: encender y apagar vuelve a {}", () => {
    const presets = { barras_apiladas: { mostrar_barra_extra: false, barra_extra_preset: "ninguno" } };
    const fin = recorrer("p_barras_apiladas", {}, presets, [
      { caja: "top", activa: true },
      { caja: "top", activa: false },
    ]);
    expect(fin).toEqual({});
    const otroPreset = { barras_apiladas: { barra_extra_preset: "ninguno" } };
    expect(recorrer("p_barras_apiladas", {}, otroPreset, [{ caja: "top", activa: true }, { caja: "top", activa: false }])).toEqual({});
  });

  // Propiedad: toda secuencia de toques que termina en la configuración heredada deja el patch acumulado vacío.
  const PRESETS: Record<string, R>[] = [
    {},
    { barras_apiladas: { mostrar_barra_extra: false, barra_extra_preset: "ninguno" } },
    { barras_apiladas: { barra_extra_preset: "ninguno" }, multi_apiladas: { mostrar_barra_extra: false } },
    { barras_apiladas: { top2box_labels: ["A", "B"] }, multi_apiladas: { top2box_labels: ["A", "B"], columna_bottom2box: true } },
  ];
  const TOQUES: CambioTwoBox[] = [
    { caja: "top", activa: true },
    { caja: "top", activa: false },
    { caja: "top", etiquetas: ["X", "Y"] },
    { caja: "top", etiquetas: ["A", "B"] },
    { caja: "top", etiquetas: [] },
    { caja: "bottom", activa: true },
    { caja: "bottom", activa: false },
    { caja: "bottom", etiquetas: ["N", "P"] },
    { caja: "bottom", etiquetas: [] },
  ];
  /** Toques que devuelven cada caja a lo heredado (estado y categorías). */
  function volver(g: string, args: R, presets: Record<string, R>, k: Composicion): R {
    const ini = leerTwoBox(g, {}, presets)!;
    let a = aplicar(g, args, presets, { caja: "bottom", etiquetas: ini.bottom.etiquetas }, k);
    a = aplicar(g, a, presets, { caja: "bottom", activa: ini.bottom.activa }, k);
    a = aplicar(g, a, presets, { caja: "top", activa: true }, k);
    a = aplicar(g, a, presets, { caja: "top", etiquetas: ini.top.etiquetas }, k);
    return aplicar(g, a, presets, { caja: "top", activa: ini.top.activa }, k);
  }
  const BASES: [string, R][] = [
    ["p_barras_apiladas", { var: "p1" }],
    [MULTI, { modo: "var", vars: ["p1"] }],
    [MULTI, { modo: "cruce", var: "p1" }],
    [MULTI, { modo: "var_cruce", vars: { a: ["p1"], b: ["p2"] } }],
  ];
  const COMPOSICIONES: Composicion[] = ["sola", "varios"];

  it("para toda secuencia de hasta tres toques y su vuelta, el patch acumulado es vacío", () => {
    let casos = 0;
    const secuencias: CambioTwoBox[][] = [[]];
    for (let n = 0; n < 3; n += 1) {
      for (const s of secuencias.filter((x) => x.length === n)) for (const t of TOQUES) secuencias.push([...s, t]);
    }
    for (const presets of PRESETS) {
      for (const [g, base] of BASES) {
        for (const k of COMPOSICIONES) {
          for (const s of secuencias) {
            const fin = volver(g, recorrer(g, base, presets, s, k), presets, k);
            expect({ presets, g, k, s, fin }).toEqual({ presets, g, k, s, fin: base });
            expect(leerTwoBox(g, fin, presets)).toEqual(leerTwoBox(g, base, presets));
            casos += 1;
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(1000);
  });
});

describe("preguntaDeEscala y categoriasElegibles", () => {
  it("la pregunta de la que salen las categorías", () => {
    expect(preguntaDeEscala("p_barras_apiladas", { var: "p1" })).toBe("p1");
    expect(preguntaDeEscala("p_barras_multiapiladas", { modo: "var", vars: ["p2", "p3"] })).toBe("p2");
    expect(preguntaDeEscala("p_barras_multiapiladas", { modo: "cruce", var: "p4", vars: ["p9"] })).toBe("p4");
    expect(preguntaDeEscala("p_barras_multiapiladas", { modo: "var_cruce", vars: { a: ["base$p5"], b: ["base$p6"] } })).toBe("base$p5");
    expect(preguntaDeEscala("p_barras_multiapiladas", { modo: "multilista" })).toBe("");
    expect(preguntaDeEscala("p_barras_agrupadas", { var: "p1" })).toBe("");
  });
  it("sin residuales ni las que el gráfico excluye", () => {
    const cats = [
      { codigo: "1", etiqueta: "Nada", residual: false },
      { codigo: "2", etiqueta: "Mucho", residual: false },
      { codigo: "3", etiqueta: "Bastante", residual: false },
      { codigo: "99", etiqueta: "SIN INF", residual: true },
    ];
    expect(categoriasElegibles(cats, ["3"])).toEqual(["Nada", "Mucho"]);
    // El endpoint no marca SIN INF como residual (acrconta): el criterio del constructor la saca igual.
    expect(categoriasElegibles([...cats.slice(0, 3), { codigo: "9", etiqueta: "SIN INF", residual: false }, { codigo: "8", etiqueta: "No sabe / no opina", residual: false }], [])).toEqual(["Nada", "Mucho", "Bastante"]);
    expect(categoriasElegibles(cats, undefined)).toEqual(["Nada", "Mucho", "Bastante"]);
  });
});
