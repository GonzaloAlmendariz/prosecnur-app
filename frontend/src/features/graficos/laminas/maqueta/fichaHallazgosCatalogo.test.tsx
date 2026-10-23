// Hallazgos M2–M7 del recorrido del catálogo del recetario en la app (docs/qa/checklist-catalogo-recetario-2026-10-14.md):
// la ficha decía cosas que no eran ciertas o callaba ajustes encendidos.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Slide } from "../../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../../usePlanValidator";
import { ranurasDeMaqueta } from "../modeloMaqueta";
import { datosEstructura } from "./datosEstructura";
import { FichaRanura } from "./FichaRanura";
import { fichaDeRanura, TTB_SIN_RESPUESTAS, type FichaInfo } from "./fichaModelo";

const ACUERDO = ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"];
const v = (source: string, name: string, labels: string[], label = name) =>
  ({ name, source, label, list_name: `l_${name}`, tipo: "select_one", seccion: "", choices: labels.map((l, i) => ({ name: String(i + 1), label: l })), n_non_empty: 100 });
const VARS = ["docentes", "estudiantes"].flatMap((s) => [
  v(s, "p1", ACUERDO, "La Unidad cuenta con tutoría"), v(s, "p2", ACUERDO, "Los trámites son claros"),
  v(s, "sexo", ["Mujer", "Hombre"], "Sexo"), v(s, "mision", ["Sí", "No"], "¿Conoce la misión?"),
]) as never[];
const slide = (graficador: string, args: Record<string, unknown>) =>
  ({ id: "s", tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: { graficador, args } } }) as unknown as Slide;
const ficha = (s: Slide): FichaInfo => fichaDeRanura(ranurasDeMaqueta(s, VARS, {})[0], "Tipo");

describe("M2 · Top Two Box sin respuestas", () => {
  it("la ficha lo avisa y el panel lo cuenta como aviso, sin bloquear", () => {
    const s = slide("p_barras_multiapiladas", { modo: "var", vars: ["estudiantes$p1", "estudiantes$p2"], barra_extra: ["top2box"] });
    expect(ficha(s).avisos).toContain(TTB_SIN_RESPUESTAS);
    const entrada = { slides: [s], presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [], slidesById: {}, graficadoresById: {}, presetsByName: {}, variables: VARS, multi: true } as unknown as EntradaValidarPlan;
    const r = validarPlan(entrada);
    expect(r.warnings.some((w) => w.code === "ttb-sin-respuestas")).toBe(true);
    expect(r.canExport).toBe(true);
  });

  it("con sus respuestas declaradas no hay aviso", () => {
    const s = slide("p_barras_multiapiladas", { modo: "var", vars: ["estudiantes$p1", "estudiantes$p2"], barra_extra: ["top2box"], top2box_labels: ["De acuerdo", "Totalmente de acuerdo"] });
    expect(ficha(s).avisos).not.toContain(TTB_SIN_RESPUESTAS);
  });
});

describe("M3 · ancho del tema con el control vigente", () => {
  const publicos = (ancho: string) => slide("p_barras_multiapiladas", { modo: "var_cruce", vars: { Tutoria: ["docentes$p1", "estudiantes$p1"] }, ancho_tema: ancho });
  it("«Más ancho» y «Más angosto» aparecen como ajuste", () => {
    expect(ficha(publicos("ancho")).ajustes).toContain("Temas anchos");
    expect(ficha(publicos("angosto")).ajustes).toContain("Temas angostos");
    expect(ficha(publicos("auto")).ajustes.some((a) => a.startsWith("Temas"))).toBe(false);
  });
});

describe("M5 · gráficos sin `var` que sí tienen pregunta", () => {
  it("la matriz de cuadrantes por sus temas y las dimensiones por su objetivo no dicen «falta elegir la pregunta»", () => {
    const matriz = ficha(slide("p_matriz_cuadrantes", { temas: { Tutoría: ["estudiantes$p1", "docentes$p1"] }, corte_x: "3,4", corte_y: "3,4" }));
    expect(matriz.faltaPregunta).toBe(false);
    expect(matriz.preguntas).toContain("Tutoría");
    const dim = ficha(slide("p_dim_heatmap", { modo: "general", objetivo: "idx_comp", cruce: "estudiantes$sexo" }));
    expect(dim.faltaPregunta).toBe(false);
    expect(dim.ajustes).toContain("Por grupos: Sexo");   // su `modo` («general») no es el de las multiapiladas
    expect(ficha(slide("p_dim_heatmap_criterios", { config_criterios: [{ id: "a", titulo: "Técnicas", vars: [] }] })).preguntas).toContain("Técnicas");
  });
});

describe("M6 · sin cifras de ejemplo", () => {
  it("la dona y la cifra destacada no muestran «64%» ni «31%» en la maqueta", () => {
    for (const g of ["p_donut", "p_cifra"]) {
      const info = ficha(slide(g, { var: "estudiantes$mision" }));
      const html = renderToStaticMarkup(<FichaRanura info={info} w={4} h={3} clave="k" />);
      expect(html, g).not.toMatch(/64%|31%/);
    }
  });
});

describe("M7 · grupos y significancia", () => {
  it("las apiladas con cruce dicen «Por grupos» y la significancia encendida se nombra", () => {
    expect(ficha(slide("p_barras_apiladas", { var: "estudiantes$p1", cruces: "estudiantes$sexo" })).ajustes).toContain("Por grupos: Sexo");
    expect(ficha(slide("p_barras_agrupadas", { var: "estudiantes$mision", cruces: "estudiantes$sexo", mostrar_significancia: true })).ajustes)
      .toEqual(expect.arrayContaining(["Por grupos: Sexo", "Diferencias significativas"]));
  });
});

describe("M4 · índice que toma sus capítulos del informe", () => {
  it("sin capítulos propios, la maqueta lista los separadores de capítulo (no los de subcapítulo)", () => {
    const indice = { tipo: "p_slide_indice", payload: { titulo: "Índice" } } as unknown as Slide;
    const informe = [
      indice,
      { tipo: "p_slide_seccion", payload: { titulo: "Perfil" } },
      { tipo: "p_slide_seccion", payload: { titulo: "Detalle", meta: { nivel: "subcapitulo" } } },
      { tipo: "p_slide_seccion", payload: { titulo: "Resultados" } },
    ] as unknown as Slide[];
    expect(datosEstructura(indice, informe).capitulos).toEqual(["Perfil", "Resultados"]);
    expect(datosEstructura(indice).capitulos).toEqual([]);
  });
});

// Ítem 9 de la maqueta (M1 del catálogo): el glifo de cada tipo cambia con sus ajustes y la ficha los nombra; sin guardar,
// dibuja lo que el motor dibuja (los defectos del registro). Mata: un ajuste que la ficha nombra y el dibujo no cambia, o
// un defecto distinto al del motor.
describe("ítem 9 · el glifo refleja los ajustes de su tipo", () => {
  const dibujo = (s: Slide) => {
    const info = ficha(s);
    // Sólo el glifo: los chips de la ficha cambian de ancho con el texto del ajuste y darían el «cambio» solos.
    const html = renderToStaticMarkup(<FichaRanura info={info} w={4} h={3} clave="k" />);
    // Su contenido, sin la caja: la caja se mueve cuando la ficha suma un chip.
    const glifo = html.match(/<svg class="pulso-glifo pulso-ficha-glifo[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? "";
    expect(glifo).not.toBe("");
    return glifo;
  };
  const casos: Array<[string, Record<string, unknown>, Record<string, unknown>, string]> = [
    ["p_barras_agrupadas", { var: "estudiantes$mision" }, { var: "estudiantes$mision", max_categorias: 4 }, "Resto en Otros"],
    ["p_barras_agrupadas", { var: "estudiantes$mision" }, { var: "estudiantes$mision", overrides: { resaltar_mayor: true } }, "La mayor resaltada"],
    ["p_barras_agrupadas", { var: "estudiantes$mision" }, { var: "estudiantes$mision", overrides: { resaltar_opciones: ["No"] } }, "Destacada: No"],
    ["p_barras_categoricas", { var: "estudiantes$mision" }, { var: "estudiantes$mision", overrides: { resaltar_opciones: ["Sí"] } }, "Destacada: Sí"],
    ["p_barras_categoricas", { var: "estudiantes$mision" }, { var: "estudiantes$mision", cruces: "estudiantes$sexo" }, "Por grupos: Sexo"],
    ["p_barras_agrupadas", { var: "estudiantes$mision" }, { var: "estudiantes$mision", overrides: { marcas_eje: true } }, "Marcas del eje"],
    ["p_lollipop", { var: "estudiantes$mision" }, { var: "estudiantes$mision", top_n: 3 }, "Primeras 3"],
    ["p_lollipop", { var: "estudiantes$mision" }, { var: "estudiantes$mision", resaltar: ["Sí"] }, "Destacada: Sí"],
    ["p_donut", { var: "estudiantes$mision" }, { var: "estudiantes$mision", top_k: 2 }, "Resto en Otros"],
    ["p_barras_divergentes", { vars: ["estudiantes$p1"] }, { vars: ["estudiantes$p1"], incluir_neutro: false }, "Sin el neutro partido"],
    ["p_serie_temporal", { var: "estudiantes$p1" }, { var: "estudiantes$p1", mostrar_valores: false }, "Sin cifras"],
    ["p_nube_palabras", { var: "estudiantes$p1" }, { var: "estudiantes$p1", mostrar_ranking: false }, "Sin ranking de palabras"],
    ["p_radar", { var: "estudiantes$p1", modo: "publicos" }, { var: "estudiantes$p1", modo: "publicos", mostrar_tabla: false }, "Sin tabla al costado"],
    ["p_dim_heatmap", { objetivo: "idx" }, { objetivo: "idx", incluir_total: true }, "Columna Total"],
    ["p_tabla", { vars: ["estudiantes$p1"] }, { vars: ["estudiantes$p1"], umbral_rojo_pct: 50 }, "En rojo bajo 50 %"],
    ["p_matriz_cuadrantes", { temas: { T: ["estudiantes$p1"] } }, { temas: { T: ["estudiantes$p1"] }, destacado: "abajo_der" }, "Destacado abajo a la derecha"],
  ];
  it.each(casos)("%s: el ajuste cambia el dibujo y se nombra", (g, antes, despues, nombre) => {
    const a = slide(g, antes), d = slide(g, despues);
    expect(ficha(d).ajustes).toContain(nombre);
    expect(ficha(a).ajustes).not.toContain(nombre);
    expect(dibujo(d)).not.toBe(dibujo(a));
  });

  it("la dona nombra la respuesta y la frase de su centro (recetario p70)", () => {
    const f = ficha(slide("p_donut", { var: "estudiantes$mision", al_centro: "No", frase_centro: "no conoce la misión" }));
    expect(f.ajustes).toEqual(expect.arrayContaining(["Al centro: No", "“no conoce la misión”"]));
    expect(ficha(slide("p_donut", { var: "estudiantes$mision" })).ajustes.some((a) => a.startsWith("Al centro"))).toBe(false);
  });

  it("filtro y subpregunta: la ficha lista las dos preguntas y lo que habilita (recetario p192–p194)", () => {
    const f = ficha(slide("p_filtro_subpregunta", { var: "estudiantes$mision", habilita: ["Sí"], subpregunta: "estudiantes$p1", disposicion: "abajo" }));
    expect(f.faltaPregunta).toBe(false);
    expect(f.preguntas).toEqual(["¿Conoce la misión?", "La Unidad cuenta con tutoría"]);
    expect(f.ajustes).toEqual(expect.arrayContaining(["Habilita: Sí", "Subpregunta abajo"]));
  });

  it("diferencias significativas: la ficha lista los temas entre públicos y lo que suma (recetario p112)", () => {
    const f = ficha(slide("p_significancia_publicos", { vars: { Tutoría: ["docentes$p1", "estudiantes$p1"] }, corte: ["De acuerdo", "Totalmente de acuerdo"] }));
    expect(f.faltaPregunta).toBe(false);
    expect(f.preguntas).toContain("La Unidad cuenta con tutoría");   // como en el radar entre públicos: el tema por su pregunta
    expect(f.ajustes).toContain("Suman: De acuerdo, Totalmente de acuerdo");
  });

  it("los interruptores sin guardar dibujan lo que dibuja el motor (defectos del registro)", () => {
    expect(ficha(slide("p_barras_divergentes", { vars: ["estudiantes$p1"] })).glifo.neutro).toBe(true);
    expect(ficha(slide("p_dumbbell", { vars: ["estudiantes$p1"] })).glifo.brecha).toBe(true);
    expect(ficha(slide("p_serie_temporal", { var: "estudiantes$p1" })).glifo.cifras).toBe(true);
    expect(ficha(slide("p_nube_palabras", { var: "estudiantes$p1" })).glifo.ranking).toBe(true);
    expect(ficha(slide("p_matriz_cuadrantes", { temas: { T: ["estudiantes$p1"] } })).glifo.destacado).toBe("arriba_izq");
    // Sin `resaltar_mayor` la lámina pinta todas las barras igual: la maqueta no promete la mayor resaltada.
    expect(ficha(slide("p_barras_agrupadas", { var: "estudiantes$mision" })).glifo.mayor).toBe(false);
  });

  it("los retirados (sin efecto en la lámina nativa) no cambian la ficha", () => {
    const base = ficha(slide("p_barras_categoricas", { var: "estudiantes$mision" }));
    const conRetirados = ficha(slide("p_barras_categoricas", { var: "estudiantes$mision", mostrar_promedio: true, formato_valor: "n" }));
    expect(conRetirados.ajustes).toEqual(base.ajustes);
    expect(conRetirados.glifo).toEqual(base.glifo);
  });
});

// Inventario de configuraciones, ítem 1 (recetario p79): la columna Bottom Two Box junto a la Top Two Box. El editor ya la
// ofrecía; la maqueta no la dibujaba. Mata: encenderla y que la ficha siga igual.
describe("ítem 1 · Bottom Two Box en la maqueta de multiapiladas", () => {
  const ttb = { modo: "var", vars: ["estudiantes$p1", "estudiantes$p2"], barra_extra: ["top2box"], top2box_labels: ["De acuerdo", "Totalmente de acuerdo"] };
  const conBtb = { ...ttb, overrides: { barra_extra: ["top2box", "bottom2box"], bottom2box_labels: ["Totalmente en desacuerdo", "En desacuerdo"] } };
  it("la ficha la nombra y dibuja su columna al lado de la Top Two Box", () => {
    const sin = ficha(slide("p_barras_multiapiladas", ttb));
    const con = ficha(slide("p_barras_multiapiladas", conBtb));
    expect(sin.ajustes).not.toContain("Bottom Two Box");
    expect(con.ajustes).toContain("Bottom Two Box");
    const html = (f: FichaInfo) => renderToStaticMarkup(<FichaRanura info={f} w={8} h={4} clave="k" />);
    expect(html(sin)).not.toContain("is-btb");
    expect(html(con).match(/is-btb/g)?.length).toBe(html(con).match(/is-ttb/g)?.length);
  });
});
