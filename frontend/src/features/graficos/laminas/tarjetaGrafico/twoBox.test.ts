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
  valorHeredado,
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

const APILADAS = "p_barras_apiladas";
const MULTI = "p_barras_multiapiladas";

/** Aplica el patch como lo hace el store y simula guardar y leer el plan (JSON). */
function aplicar(graficador: string, args: R, presets: Record<string, R>, cambio: CambioTwoBox, composicion: Composicion = "sola"): R {
  const next = mergeSlotArgsPatch(args, patchTwoBox(graficador, args, presets, cambio, composicion));
  return JSON.parse(JSON.stringify(next)) as R;
}

describe("formaTwoBox: qué graficadores llevan barra extra", () => {
  it("sólo las escalas que dibuja graficar_barras_apiladas()", () => {
    expect(GRAFICADORES.filter((g) => formaTwoBox(g, {}) !== null)).toEqual([APILADAS, MULTI]);
  });
  it("la multiapilada «multilista» lo declara por bloque, y su valor de lámina también se lee", () => {
    expect(formaTwoBox(MULTI, { modo: "multilista" })).toBe("por_bloque");
    expect(formaTwoBox(MULTI, { modo: "var_cruce" })).toBe("multiapiladas");
    expect(leerTwoBox(MULTI, { modo: "multilista", overrides: { barra_extra: ["conteos"] } }, {})).toMatchObject({ forma: "por_bloque", valor: ["conteos"], origen: "lamina" });
  });
});

describe("barras apiladas: lo que lee el motor va en overrides.barra_extra", () => {
  it("sin estilo del informe manda el recetario: Top Two Box, sin categorías, sin Bottom ni Conteos", () => {
    expect(leerTwoBox(APILADAS, { var: "p1" }, {})).toEqual({
      forma: "apiladas",
      valor: ["top2box"],
      origen: "ninguno",
      conteos: false,
      top: { activa: true, etiquetas: [], delInforme: false },
      bottom: { activa: false, etiquetas: [], delInforme: false },
    });
  });

  it("el preset del informe con barra_extra manda sobre el recetario y se reporta como heredado", () => {
    const presets = { barras_apiladas: { barra_extra: ["conteos"] } };
    expect(leerTwoBox(APILADAS, {}, presets)).toMatchObject({ valor: ["conteos"], origen: "preset", conteos: true });
    expect(valorHeredado(APILADAS, {}, presets)).toEqual(["conteos"]);
  });

  it("un estilo guardado con las claves viejas se LEE, pero nunca se escribe", () => {
    const presets = { barras_apiladas: { mostrar_barra_extra: true, barra_extra_preset: "top2box", columna_bottom2box: true } };
    expect(leerTwoBox(APILADAS, {}, presets)).toMatchObject({ valor: ["top2box", "bottom2box"], origen: "preset" });
    const out = aplicar(APILADAS, {}, presets, { valor: ["conteos"] });
    expect(out).toEqual({ overrides: { barra_extra: ["conteos"] } });
  });

  it("apagar escribe barra_extra = false; volver a lo heredado borra la clave", () => {
    const off = aplicar(APILADAS, { var: "p1" }, {}, { valor: false });
    expect(off.overrides).toEqual({ barra_extra: false });
    expect(leerTwoBox(APILADAS, off, {})).toMatchObject({ valor: false, origen: "lamina" });
    const on = aplicar(APILADAS, off, {}, { valor: ["top2box"] });
    expect(on.overrides).toBeUndefined();
    expect(leerTwoBox(APILADAS, on, {})?.origen).toBe("ninguno");
  });

  it("nunca escribe las claves viejas", () => {
    const out = aplicar(APILADAS, { var: "p1" }, {}, { valor: ["top2box", "bottom2box"] });
    expect(out.overrides).toEqual({ barra_extra: ["top2box", "bottom2box"] });
    for (const vieja of ["mostrar_barra_extra", "barra_extra_preset", "columna_bottom2box", "top2box", "word_mostrar_barra_extra"]) {
      expect(JSON.stringify(out)).not.toContain(`"${vieja}":`);
    }
  });

  it("Conteos va solo: el valor que llega combinado se normaliza antes de escribirse", () => {
    const presets = { barras_apiladas: { barra_extra: false } };
    const out = aplicar(APILADAS, {}, presets, { valor: ["top2box", "conteos"] });
    expect(out.overrides).toEqual({ barra_extra: ["top2box"] });
  });

  it("declarar las dos categorías escribe overrides.top2box_labels y conserva los demás overrides", () => {
    const args = { var: "p1", overrides: { etiquetas_vars: { p1: "Corta" } } };
    const out = aplicar(APILADAS, args, {}, { caja: "top", etiquetas: ["De acuerdo", "Muy de acuerdo"] });
    expect(out.overrides).toEqual({ etiquetas_vars: { p1: "Corta" }, top2box_labels: ["De acuerdo", "Muy de acuerdo"] });
    expect(leerTwoBox(APILADAS, out, {})?.top.etiquetas).toEqual(["De acuerdo", "Muy de acuerdo"]);
  });

  it("Bottom Two Box: se enciende con el valor y sus categorías van en bottom2box_labels", () => {
    const on = aplicar(APILADAS, {}, {}, { valor: ["top2box", "bottom2box"] });
    expect(on.overrides).toEqual({ barra_extra: ["top2box", "bottom2box"] });
    const conCats = aplicar(APILADAS, on, {}, { caja: "bottom", etiquetas: ["Nada", "Poco"] });
    expect(leerTwoBox(APILADAS, conCats, {})?.bottom).toEqual({ activa: true, etiquetas: ["Nada", "Poco"], delInforme: false });
    const off = aplicar(APILADAS, conCats, {}, { valor: ["top2box"] });
    expect(off.overrides).toEqual({ bottom2box_labels: ["Nada", "Poco"] });
    expect(leerTwoBox(APILADAS, off, {})?.bottom.activa).toBe(false);
  });

  it("las categorías del estilo del informe se heredan y elegir las mismas no las copia al gráfico", () => {
    const presets = { barras_apiladas: { top2box_labels: ["A", "B"] } };
    expect(leerTwoBox(APILADAS, {}, presets)?.top).toEqual({ activa: true, etiquetas: ["A", "B"], delInforme: true });
    const otras = aplicar(APILADAS, {}, presets, { caja: "top", etiquetas: ["B", "C"] });
    expect(otras.overrides).toEqual({ top2box_labels: ["B", "C"] });
    expect(aplicar(APILADAS, otras, presets, { caja: "top", etiquetas: ["A", "B"] }).overrides).toBeUndefined();
  });

  it("con «Dividir por» hereda también el preset de multiapiladas (el motor delega en modo cruce)", () => {
    const presets = { barras_apiladas: { barra_extra: ["top2box"] }, multi_apiladas: { barra_extra: ["top2box", "bottom2box"] } };
    expect(leerTwoBox(APILADAS, { cruces: "sexo" }, presets)?.bottom.activa).toBe(true);
    expect(leerTwoBox(APILADAS, {}, presets)?.bottom.activa).toBe(false);
  });
});

describe("multiapiladas: barra_extra de la lámina y categorías del plan", () => {
  it("un barra_extra suelto en los args de la lámina se lee y, al cambiar, se retira para que no tape los overrides", () => {
    const args = { modo: "var", vars: ["p1"], barra_extra: false };
    expect(leerTwoBox(MULTI, args, {})).toMatchObject({ valor: false, origen: "lamina" });
    const out = aplicar(MULTI, args, {}, { valor: ["conteos"] });
    expect(out).toEqual({ modo: "var", vars: ["p1"], overrides: { barra_extra: ["conteos"] } });
    expect(leerTwoBox(MULTI, out, {})?.valor).toEqual(["conteos"]);
  });

  it("los overrides mandan sobre args.barra_extra", () => {
    expect(leerTwoBox(MULTI, { barra_extra: false, overrides: { barra_extra: ["top2box"] } }, {})?.valor).toEqual(["top2box"]);
  });

  it("las categorías del Top Two Box son top2box_labels del plan; igualar lo heredado las borra", () => {
    const out = aplicar(MULTI, { modo: "var", vars: ["p1", "p2"] }, {}, { caja: "top", etiquetas: ["X", "Y"] });
    expect(out.top2box_labels).toEqual(["X", "Y"]);
    expect(out).not.toHaveProperty("top2box");
    expect(leerTwoBox(MULTI, out, {})?.top).toEqual({ activa: true, etiquetas: ["X", "Y"], delInforme: false });
    expect(aplicar(MULTI, out, {}, { caja: "top", etiquetas: [] })).toEqual({ modo: "var", vars: ["p1", "p2"] });
  });

  it("un plan sin barra_extra sigue al recetario", () => {
    expect(leerTwoBox(MULTI, { modo: "var", vars: ["p1"] }, {})?.top).toEqual({ activa: true, etiquetas: [], delInforme: false });
  });
});

describe("Bottom Two Box según lo que dibuja la lámina nativa", () => {
  it.each(["var", "cruce", "var_cruce"])("modo %s solo en su lámina: el Bottom Two Box se ofrece y se enciende", (modo) => {
    const args = { modo, var: "p1", vars: ["p1"], top2box_labels: ["X", "Y"] };
    expect(bottomDisponible(MULTI, args, {})).toEqual({ ofrecer: true, editable: true, activa: false });
    const on = aplicar(MULTI, args, {}, { valor: ["top2box", "bottom2box"] });
    expect(on.overrides).toEqual({ barra_extra: ["top2box", "bottom2box"] });
    expect(bottomDisponible(MULTI, on, {})).toEqual({ ofrecer: true, editable: true, activa: true });
    expect(aplicar(MULTI, on, {}, { valor: ["top2box"] })).toEqual(args);
  });

  it("en una lámina de varios gráficos (mixtas, paneles) no se enciende: aún no sale en la lámina nativa", () => {
    const args = { modo: "cruce", var: "p1", top2box_labels: ["X", "Y"] };
    expect(patchTwoBox(MULTI, args, {}, { valor: ["top2box", "bottom2box"] }, "varios")).toEqual({});
    expect(bottomDisponible(MULTI, args, {}, "varios")).toEqual({ ofrecer: true, editable: false, activa: false, nota: NOTA_BOTTOM_NO_NATIVO });
    expect(bottomDisponible(APILADAS, {}, {}, "varios")).toEqual({ ofrecer: true, editable: false, activa: false, nota: NOTA_BOTTOM_NO_NATIVO });
    expect(bottomDisponible(APILADAS, {}, {}, "sola")).toEqual({ ofrecer: true, editable: true, activa: false });
  });

  it("composicionDeLamina: las de 2 o más gráficos son «varios»", () => {
    expect(composicionDeLamina("p_slide_1_grafico")).toBe("sola");
    expect(composicionDeLamina(undefined)).toBe("sola");
    for (const t of ["p_slide_2_graficos", "p_slide_3_graficos_fila", "p_slide_4_graficos", "p_slide_cifras_y_graficos"]) {
      expect(composicionDeLamina(t)).toBe("varios");
    }
  });

  it("si ya lo tiene guardado en una lámina de varios gráficos se muestra y se deja quitar, no volver a poner", () => {
    const args = { modo: "cruce", var: "p1", overrides: { barra_extra: ["top2box", "bottom2box"] } };
    expect(bottomDisponible(MULTI, args, {}, "varios")).toMatchObject({ editable: true, activa: true });
    const off = aplicar(MULTI, args, {}, { valor: ["top2box"] }, "varios");
    expect(off).toEqual({ modo: "cruce", var: "p1" });
    expect(bottomDisponible(MULTI, off, {}, "varios")).toMatchObject({ editable: false });
  });

  it("multilista: la tarjeta fija el valor de la lámina; las categorías son de cada bloque", () => {
    const args = { modo: "multilista", vars: { a: ["p1"], b: ["p2"] } };
    expect(bottomDisponible(MULTI, args, {})).toEqual({ ofrecer: true, editable: false, activa: false, nota: NOTA_BOTTOM_NO_NATIVO });
    expect(patchTwoBox(MULTI, args, {}, { valor: ["top2box", "bottom2box"] })).toEqual({});
    expect(aplicar(MULTI, args, {}, { valor: ["conteos"] }).overrides).toEqual({ barra_extra: ["conteos"] });
    expect(patchTwoBox(MULTI, args, {}, { caja: "top", etiquetas: ["N", "P"] })).toEqual({});
    expect(patchTwoBox(MULTI, args, {}, { caja: "bottom", etiquetas: ["N"] })).toEqual({});
  });

  it("si el estilo del informe lo pide, apagarlo en el gráfico y volver a encenderlo es volver a lo heredado", () => {
    const presets = { multi_apiladas: { barra_extra: ["top2box", "bottom2box"] } };
    const args = { modo: "multilista", vars: { a: ["p1"] } };
    expect(bottomDisponible(MULTI, args, presets)).toMatchObject({ editable: true, activa: true });
    const off = aplicar(MULTI, args, presets, { valor: ["top2box"] });
    expect(off.overrides).toEqual({ barra_extra: ["top2box"] });
    expect(aplicar(MULTI, off, presets, { valor: ["top2box", "bottom2box"] })).toEqual(args);
  });
});

describe("ida y vuelta: volver a lo heredado deja el gráfico como estaba", () => {
  const recorrer = (g: string, args: R, presets: Record<string, R>, cambios: CambioTwoBox[], composicion: Composicion = "sola") =>
    cambios.reduce((acc, c) => aplicar(g, acc, presets, c, composicion), args);

  // Propiedad: toda secuencia de toques que termina en la configuración heredada deja el patch acumulado vacío.
  const PRESETS: Record<string, R>[] = [
    {},
    { barras_apiladas: { barra_extra: false } },
    { barras_apiladas: { barra_extra: ["conteos"] }, multi_apiladas: { barra_extra: false } },
    { barras_apiladas: { top2box_labels: ["A", "B"] }, multi_apiladas: { top2box_labels: ["A", "B"], barra_extra: ["top2box", "bottom2box"] } },
  ];
  const TOQUES: CambioTwoBox[] = [
    { valor: false },
    { valor: ["top2box"] },
    { valor: ["top2box", "bottom2box"] },
    { valor: ["bottom2box"] },
    { valor: ["conteos"] },
    { caja: "top", etiquetas: ["X", "Y"] },
    { caja: "top", etiquetas: ["A", "B"] },
    { caja: "top", etiquetas: [] },
    { caja: "bottom", etiquetas: ["N", "P"] },
    { caja: "bottom", etiquetas: [] },
  ];
  /** Toques que devuelven la barra y sus categorías a lo heredado. */
  function volver(g: string, args: R, presets: Record<string, R>, k: Composicion): R {
    const ini = leerTwoBox(g, {}, presets)!;
    let a = aplicar(g, args, presets, { caja: "bottom", etiquetas: ini.bottom.etiquetas }, k);
    a = aplicar(g, a, presets, { caja: "top", etiquetas: ini.top.etiquetas }, k);
    // Primero un valor cualquiera permitido en la composición y luego el heredado: la vuelta no depende del camino.
    a = aplicar(g, a, presets, { valor: ["conteos"] }, k);
    return aplicar(g, a, presets, { valor: ini.valor }, k);
  }
  const BASES: [string, R][] = [
    [APILADAS, { var: "p1" }],
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
            casos += 1;
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(1000);
  }, 60_000); // barrido exhaustivo (miles de casos): bajo carga del gate completo pasa de los 5 s por defecto
});

describe("preguntaDeEscala y categoriasElegibles", () => {
  it("la pregunta de la que salen las categorías", () => {
    expect(preguntaDeEscala(APILADAS, { var: "p1" })).toBe("p1");
    expect(preguntaDeEscala(MULTI, { modo: "var", vars: ["p2", "p3"] })).toBe("p2");
    expect(preguntaDeEscala(MULTI, { modo: "cruce", var: "p4", vars: ["p9"] })).toBe("p4");
    expect(preguntaDeEscala(MULTI, { modo: "var_cruce", vars: { a: ["base$p5"], b: ["base$p6"] } })).toBe("base$p5");
    expect(preguntaDeEscala(MULTI, { modo: "multilista" })).toBe("");
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
    expect(categoriasElegibles([...cats.slice(0, 3), { codigo: "9", etiqueta: "SIN INF", residual: false }, { codigo: "8", etiqueta: "No sabe / no opina", residual: false }], [])).toEqual(["Nada", "Mucho", "Bastante"]);
    expect(categoriasElegibles(cats, undefined)).toEqual(["Nada", "Mucho", "Bastante"]);
  });
});
