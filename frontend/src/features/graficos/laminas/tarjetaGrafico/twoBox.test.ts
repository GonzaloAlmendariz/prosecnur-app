import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import {
  categoriasElegibles,
  formaTwoBox,
  leerTwoBox,
  patchTwoBox,
  preguntaDeEscala,
  type CambioTwoBox,
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
function aplicar(graficador: string, args: R, presets: Record<string, R>, cambio: CambioTwoBox): R {
  const next = mergeSlotArgsPatch(args, patchTwoBox(graficador, args, presets, cambio));
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
    expect(out.overrides).toEqual({ mostrar_barra_extra: true });
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

  it("el Bottom Two Box va por overrides y no toca el par del Top", () => {
    const args = { modo: "cruce", var: "p1", top2box: true, top2box_labels: ["X", "Y"], overrides: { mostrar_barra_extra: true } };
    const out = aplicar("p_barras_multiapiladas", args, {}, { caja: "bottom", activa: true });
    expect(out).toMatchObject({ top2box: true, top2box_labels: ["X", "Y"], overrides: { mostrar_barra_extra: true, columna_bottom2box: true } });
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
