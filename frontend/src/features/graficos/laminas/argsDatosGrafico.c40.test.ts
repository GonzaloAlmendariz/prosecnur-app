// C40 en Gráficos > Láminas > tarjeta de un gráfico (docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md). Las firmas
// de abajo copian `name`, `tipo_input`, `default` y `depende` de api/R/graficos_metadata.R (sólo los args que importan);
// cada asignado es además formal de su constructor del plan (los que no lo son quedan pendientes en el registro).
import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import { mergeSlotArgsPatch } from "../store";
import {
  AYUDA_BRECHA,
  AYUDA_CEROS,
  AYUDA_CORTES,
  AYUDA_EJE_MIN,
  AYUDA_LIMITE_SUPERIOR,
  AYUDA_MIN_N,
  AYUDA_TIPO_RANGO,
  RETIRADOS,
  camposDeDatos,
  esRetirado,
  interruptorEncendido,
  medicionesDeSerie,
} from "./argsDatosGrafico";

type Extra = Partial<Pick<ArgMetadata, "default" | "depende" | "choices">>;
const a = (name: string, tipo_input: ArgMetadata["tipo_input"], extra: Extra = {}): ArgMetadata =>
  ({ name, label: name, tipo_input, grupo: "datos", descripcion: "", ...extra });
const publicos = { depende: { arg: "modo", valores: ["publicos"] } };
const nombres = (args: readonly ArgMetadata[], v: Record<string, unknown>, g: string) => camposDeDatos(args, v, g).map((c) => c.arg.name);
const campo = (args: readonly ArgMetadata[], v: Record<string, unknown>, g: string, n: string) =>
  camposDeDatos(args, v, g).find((c) => c.arg.name === n);

const lollipop = [
  a("var", "variable"), a("excluir_opciones", "codigos_list"),
  a("orden", "choice", { default: "mayor_menor" }), a("top_n", "number"), a("resaltar", "codigos_list"),
];
const dumbbell = [
  a("corte", "codigos_list"), a("corte_etiqueta", "string"), a("orden", "choice", { default: "brecha" }),
  a("mostrar_brecha", "bool", { default: true }), a("umbral_brecha_pct", "number", { default: 0 }),
  a("etiqueta_brecha", "string", { default: "pts" }),
];
const serie = [
  a("corte", "codigos_list"), a("corte_etiqueta", "string"), a("orden_periodos", "codigos_list"),
  a("mostrar_valores", "bool", { default: true }), a("max_series_con_cifras", "number", { default: 5 }),
  a("valores_decimales", "number", { default: 0 }), a("destacar_ultimo", "bool", { default: true }),
];
const radar = [
  a("modo", "choice"), a("var", "variable_opt", { depende: { arg: "modo", valores: ["sm"] } }), a("corte", "codigos_list", publicos),
  a("eje_min", "number", { default: 0, ...publicos }), a("mostrar_tabla", "bool", { default: true, ...publicos }),
  a("tabla_titulo", "string", publicos), a("tabla_ancho_tema", "number", publicos), a("tabla_proporcion", "number", publicos),
  a("top_n", "number"), a("sm_omit_codes", "codigos_list"), a("sm_omit_na", "bool"),
  a("mostrar_valores", "bool", { default: false }), a("valores_decimales", "number", { default: 0 }),
];
const tabla = [a("modo", "choice"), a("top_n", "number"), a("sm_omit_codes", "codigos_list"), a("umbral_rojo_pct", "number", { default: 60 })];
const agrupadas = [
  a("var", "variable"), a("mostrar_ceros", "bool", { default: false }), a("max_categorias", "number", { default: 12 }),
  a("agrupar_resto_en_otros", "bool", { default: true }), a("otros_al_final", "bool", { default: true }),
  a("etiqueta_otros", "string", { default: "Otros" }),
];
const pie = [a("var", "variable"), a("top_k", "number"), a("etiqueta_otros", "string", { default: "Otros" })];
const mapa = [
  a("scope", "choice", { default: "district" }), a("ubigeo", "string"), a("unit", "choice", { default: "zonas" }),
  a("coverage_mode", "choice", { default: "efectivas" }), a("mostrar_manzanas", "bool", { default: false }),
];
const distrital = [
  a("var", "variable"), a("cruces", "variable"), a("corte", "codigos_list"), a("min_n", "number", { default: 1 }),
  a("cortes", "codigos_list"), a("rotulo", "string"),
];
const dims = [a("modo", "choice"), a("objetivo", "string"), a("cruce", "variable_opt"), a("incluir_total", "bool"),
  a("brecha_filas", "bool"), a("brecha_cols", "bool"), a("brecha_cortes", "codigos_list"), a("mostrar_n_cruce_x", "bool"),
  a("modo_semaforo", "choice"), a("radar_min_ejes", "number"), a("iter_var", "variable_opt"), a("iter_level", "string")];
const TIPOS_RANGO = [
  { value: "minmax", label: "Mínimo a máximo" }, { value: "iqr", label: "50 % central (P25–P75)" },
  { value: "p10_p90", label: "Percentiles 10 a 90" }, { value: "custom", label: "Percentiles a medida" },
];
const mediaRango = [a("var", "variable"), a("cruce", "variable_opt"), a("decimales_promedio", "number", { default: 1 }),
  a("tipo_rango", "choice", { default: "minmax", choices: TIPOS_RANGO }), a("mostrar_ref_label", "bool"),
  a("cortes_chip", "codigos_list"), a("modo_semaforo", "choice")];
// p_boxplot todavía declara `chip_decimales`: sigue sin control (no es la firma de media y rango).
const boxplot = [a("var", "variable"), a("cruce", "variable_opt"), a("chip_decimales", "number")];
const ceros = { default: false };
const apiladas = [a("var", "variable"), a("cruces", "variable_opt"), a("excluir_opciones", "codigos_list"),
  a("mostrar_categorias_en_cero", "bool", ceros)];
const multiapiladas = [a("vars", "codigos_list"), a("mostrar_categorias_en_cero", "bool", ceros)];
const histograma = [a("var", "variable"), a("grupo", "variable_opt"), a("ancho_bin", "number"), a("bins", "number"),
  a("limite_superior", "number"), a("mostrar_bins_vacios", "bool", { default: true })];
const tresOlas = { vars: { Confianza: ["o1$p1", "o2$p1", "o3$p1"] } };
const dosOlas = { vars: { Confianza: ["o1$p1", "o2$p1"] } };

describe("C40 · ASIGNAR", () => {
  it("lollipop: orden y top_n con el rótulo de «Máximo de categorías»", () => {
    expect(nombres(lollipop, {}, "p_lollipop")).toEqual(["var", "orden", "top_n", "excluir_opciones"]);
    expect(campo(lollipop, {}, "p_lollipop", "top_n")?.rotulo).toBe("Máximo de categorías");
  });
  it("dumbbell: orden y la brecha, con su guarda a la vista", () => {
    expect(nombres(dumbbell, {}, "p_dumbbell")).toEqual(["corte", "corte_etiqueta", "orden", "mostrar_brecha", "etiqueta_brecha"]);
    expect(campo(dumbbell, {}, "p_dumbbell", "mostrar_brecha")?.ayuda).toBe(AYUDA_BRECHA);
  });
  it("dumbbell: la unidad de la brecha sólo con la brecha encendida (default TRUE) y con «pts» a la vista", () => {
    expect(campo(dumbbell, {}, "p_dumbbell", "etiqueta_brecha")?.placeholder).toBe("pts");
    expect(nombres(dumbbell, { mostrar_brecha: true }, "p_dumbbell")).toContain("etiqueta_brecha");
    expect(nombres(dumbbell, { mostrar_brecha: false }, "p_dumbbell")).not.toContain("etiqueta_brecha");
    const sinInterruptor = dumbbell.filter((x) => x.name !== "mostrar_brecha");
    expect(nombres(sinInterruptor, {}, "p_dumbbell")).not.toContain("etiqueta_brecha");
    expect(nombres(dumbbell, {}, "p_lollipop")).not.toContain("etiqueta_brecha");
  });
  it("serie: orden de periodos siempre; cifras y su máximo sólo con tres o más mediciones", () => {
    expect(nombres(serie, dosOlas, "p_serie_temporal")).toEqual(["corte", "corte_etiqueta", "orden_periodos"]);
    expect(nombres(serie, tresOlas, "p_serie_temporal")).toEqual(
      ["corte", "corte_etiqueta", "orden_periodos", "mostrar_valores", "max_series_con_cifras"]);
    expect(nombres(serie, { ...tresOlas, mostrar_valores: false }, "p_serie_temporal")).not.toContain("max_series_con_cifras");
    expect(nombres(serie, { ...dosOlas, orden_periodos: ["o3", "o1", "o2"] }, "p_serie_temporal")).toContain("mostrar_valores");
  });
  it("valores_decimales sólo en el radar: en la serie contradice I-c (decimales = Cálculos del informe)", () => {
    expect(nombres(serie, tresOlas, "p_serie_temporal")).not.toContain("valores_decimales");
    expect(nombres(radar, { modo: "sm" }, "p_radar")).toContain("valores_decimales");
  });
  it("radar entre públicos: tabla al costado, su encabezado y el piso del eje con su guarda", () => {
    expect(nombres(radar, { modo: "publicos" }, "p_radar")).toEqual(
      ["modo", "corte", "mostrar_tabla", "tabla_titulo", "eje_min", "valores_decimales"]);
    expect(campo(radar, { modo: "publicos" }, "p_radar", "eje_min")?.ayuda).toBe(AYUDA_EJE_MIN);
    expect(nombres(radar, {}, "p_radar")).not.toContain("mostrar_tabla");
  });
  it("NO ASIGNAR todavía: top_n y sm_omit_codes de radar y tabla (falta «Se muestran X de Y»)", () => {
    for (const [args, g] of [[radar, "p_radar"], [tabla, "p_tabla"]] as const) {
      expect(nombres(args, { modo: "sm" }, g)).not.toContain("top_n");
      expect(nombres(args, { modo: "sm" }, g)).not.toContain("sm_omit_codes");
    }
  });
  it("incluir_total sólo en el heatmap", () => {
    expect(nombres(dims, {}, "p_dim_heatmap")).toContain("incluir_total");
    for (const g of ["p_dim_comparativo_radarbar", "p_dim_radar", "p_dim_foda"]) expect(nombres(dims, {}, g)).not.toContain("incluir_total");
  });
  it("mapa de cobertura: alcance, UBIGEO (sólo con alcance distrito), unidad y cobertura", () => {
    expect(nombres(mapa, {}, "p_mapa_cobertura_territorial")).toEqual(["scope", "ubigeo", "unit", "coverage_mode"]);
    expect(nombres(mapa, { scope: "overview_koica" }, "p_mapa_cobertura_territorial")).not.toContain("ubigeo");
  });
  it("mapa distrital: casos mínimos y cortes, con su guarda; cortes sin default en el registro lleva el del motor", () => {
    expect(nombres(distrital, {}, "p_mapa_resultado_distrital")).toEqual(["var", "cruces", "corte", "min_n", "cortes"]);
    expect(campo(distrital, {}, "p_mapa_resultado_distrital", "min_n")?.ayuda).toBe(AYUDA_MIN_N);
    const cortes = campo(distrital, {}, "p_mapa_resultado_distrital", "cortes");
    expect([cortes?.ayuda, cortes?.placeholder]).toEqual([AYUDA_CORTES, "55, 65, 75"]);
  });
  it("mostrar_ceros con la guarda de 90–99", () => {
    expect(campo(agrupadas, {}, "p_barras_agrupadas", "mostrar_ceros")?.ayuda).toBe(AYUDA_CEROS);
    expect(AYUDA_CEROS).toBe("Las respuestas especiales 90–99 sin casos nunca se muestran.");
  });
  it("etiqueta de «Otros» en torta y dona: sólo con top_k", () => {
    expect(nombres(pie, {}, "p_pie")).not.toContain("etiqueta_otros");
    expect(nombres(pie, { top_k: 3 }, "p_pie")).toContain("etiqueta_otros");
    expect(nombres(pie, { top_k: 3 }, "p_donut")).toContain("etiqueta_otros");
    expect(nombres(pie, { top_k: 0 }, "p_donut")).not.toContain("etiqueta_otros");
  });
  it("agrupadas: máximo, agrupación y etiqueta de «Otros» (formales desde e93c51d); la etiqueta sigue a la agrupación", () => {
    expect(nombres(agrupadas, {}, "p_barras_agrupadas")).toEqual(
      ["var", "max_categorias", "agrupar_resto_en_otros", "etiqueta_otros", "mostrar_ceros"]);
    expect(nombres(agrupadas, { agrupar_resto_en_otros: false }, "p_barras_agrupadas")).not.toContain("etiqueta_otros");
    expect(campo(agrupadas, {}, "p_barras_agrupadas", "etiqueta_otros")?.placeholder).toBe("Otros");
    // top_k no cuenta fuera de torta y dona: en agrupadas manda el interruptor.
    expect(nombres(agrupadas, { agrupar_resto_en_otros: false, top_k: 3 }, "p_barras_agrupadas")).not.toContain("etiqueta_otros");
    // Sin la guarda del graficador (ni interruptor ni top_k), nunca.
    expect(nombres(pie, { top_k: 3 }, "p_barras_categoricas")).not.toContain("etiqueta_otros");
  });
  it("media y rango: decimales_promedio y tipo_rango (default «minmax», cuatro opciones); chip_decimales nunca", () => {
    expect(nombres(mediaRango, {}, "p_media_rango")).toEqual(["var", "cruce", "decimales_promedio", "tipo_rango"]);
    const tipo = campo(mediaRango, {}, "p_media_rango", "tipo_rango");
    expect([tipo?.control, tipo?.ayuda, tipo?.arg.default, tipo?.arg.choices?.length]).toEqual(["opciones", AYUDA_TIPO_RANGO, "minmax", 4]);
    expect(campo(mediaRango, {}, "p_media_rango", "decimales_promedio")?.control).toBe("numero");
    expect(nombres(boxplot, {}, "p_boxplot")).toEqual(["var", "cruce"]);
    expect(nombres(mediaRango, {}, "p_boxplot")).not.toContain("tipo_rango");
  });
  it("apiladas y multiapiladas: categorías en 0 % con la guarda de 90–99; en ningún otro graficador", () => {
    expect(nombres(apiladas, {}, "p_barras_apiladas")).toEqual(["var", "cruces", "mostrar_categorias_en_cero", "excluir_opciones"]);
    expect(campo(apiladas, {}, "p_barras_apiladas", "mostrar_categorias_en_cero")?.ayuda).toBe(AYUDA_CEROS);
    expect(campo(multiapiladas, {}, "p_barras_multiapiladas", "mostrar_categorias_en_cero")?.ayuda).toBe(AYUDA_CEROS);
    expect(nombres(apiladas, {}, "p_barras_agrupadas")).not.toContain("mostrar_categorias_en_cero");
  });
  it("histograma: límite superior, vacío = sin tope, con el rótulo «+» explicado", () => {
    expect(nombres(histograma, {}, "p_histograma")).toEqual(["var", "limite_superior"]);
    const lim = campo(histograma, {}, "p_histograma", "limite_superior");
    expect([lim?.control, lim?.ayuda, lim?.placeholder]).toEqual(["numero", AYUDA_LIMITE_SUPERIOR, "Sin tope"]);
    expect(AYUDA_LIMITE_SUPERIOR).toContain("«+»");
    expect(nombres(histograma, {}, "p_numerico")).not.toContain("limite_superior");
  });
  it("PENDIENTE: iter_var/iter_level no salen (el pie de la lámina nativa no declara el subgrupo)", () => {
    expect(nombres(dims, {}, "p_dim_heatmap")).not.toContain("iter_var");
  });
});

describe("C40 · RETIRAR", () => {
  const todos = [...RETIRADOS, "brecha_filas", "brecha_cols", "brecha_cortes", "modo_foda", "usar_pesos", "corte_score", "titulos_areas_foda"];
  it("ningún retirado vuelve a mostrarse, en ningún graficador", () => {
    const args = todos.map((n) => a(n, "bool"));
    for (const g of ["p_barras_agrupadas", "p_radar", "p_tabla", "p_histograma", "p_dim_heatmap", "p_dim_foda", "p_media_rango", "p_dumbbell"]) {
      expect(nombres(args, {}, g)).toEqual([]);
    }
  });
  it("las firmas reales tampoco los dejan pasar", () => {
    expect(nombres(radar, { modo: "publicos" }, "p_radar")).not.toEqual(expect.arrayContaining(["tabla_ancho_tema"]));
    expect(nombres(dims, {}, "p_dim_heatmap").filter((n) => esRetirado(n, "p_dim_heatmap"))).toEqual([]);
    expect(nombres(mediaRango, {}, "p_media_rango")).not.toEqual(expect.arrayContaining(["cortes_chip"]));
    expect(esRetirado("incluir_total", "p_dim_comparativo_radarbar")).toBe(true);
    expect(esRetirado("incluir_total", "p_dim_heatmap")).toBe(false);
  });
  it("un retirado guardado se conserva intacto al editar otro campo de la tarjeta", () => {
    const guardado = { var: "p1", invertir_leyenda: true, cortes_chip: ["60", "80"], brecha_filas: true };
    const tras = mergeSlotArgsPatch(guardado, { mostrar_ceros: true });
    expect(tras).toEqual({ ...guardado, mostrar_ceros: true });
  });
});

describe("C40 · modelo", () => {
  it("un interruptor sin guardar vale su default del registro", () => {
    expect(interruptorEncendido({ default: true }, undefined)).toBe(true);
    expect(interruptorEncendido({ default: true }, false)).toBe(false);
    expect(interruptorEncendido({}, undefined)).toBe(false);
  });
  it("siActivo con el default: «Máximo de series» sale sin mostrar_valores guardado (default TRUE)", () => {
    expect(nombres(serie, tresOlas, "p_serie_temporal")).toContain("max_series_con_cifras");
  });
  it("mediciones de la serie: orden declarado o fuentes del primer tema", () => {
    expect(medicionesDeSerie(tresOlas)).toBe(3);
    expect(medicionesDeSerie(dosOlas)).toBe(2);
    expect(medicionesDeSerie({ orden_periodos: ["a", "b", "c", "d"] })).toBe(4);
    expect(medicionesDeSerie({})).toBe(0);
  });
  it("sin graficador, lo restringido a un graficador no sale", () => {
    expect(camposDeDatos(lollipop, {}).map((c) => c.arg.name)).not.toContain("top_n");
  });
});
