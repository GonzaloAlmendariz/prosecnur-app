import { beforeEach, describe, expect, it } from "vitest";
import type { RankingBase, RankingRotulos } from "../../../api/graficosRotulos";
import { usePlanStore, type GraficosConfig } from "../store";
import {
  baseInicial,
  cambioDe,
  categoriasHuerfanas,
  cuantosRotulos,
  errorCorto,
  filasRanking,
  filtrarFilas,
  pedidoGuardar,
  rotulosCon,
  textoAviso,
} from "./modeloRotulosCortos";

// Identidad › Rótulos cortos con el ranking del ADR 0141: dos rankings por base, del rótulo más largo al más corto.
const BECA = "Por beca de estudios (puede ser beca 18 o alguna otra beca externa a la universidad)";
const BASE: RankingBase = {
  base: "arte",
  preguntas: [
    { ref: "arte$p1", etiqueta: "¿Cuál es tu edad?", largo: 17, usos: 2 },
    { ref: "arte$p2", etiqueta: "¿Qué tan satisfecho estás con la enseñanza en tu facultad?", largo: 58, usos: 1, corto_en_grafico: "Satisfacción" },
    { ref: "arte$p3", etiqueta: "¿Cómo financias tus estudios?", largo: 29, usos: 0, corto_en_grafico: "¿Cómo financias tus estudios? (versión larga)" },
  ],
  opciones: [
    { ref: "arte$financia", codigo: "2", etiqueta: "Recursos propios", largo: 16, usos: 1 },
    { ref: "arte$financia", codigo: "1", etiqueta: BECA, largo: BECA.length, usos: 1 },
  ],
};

describe("filasRanking", () => {
  it("preguntas del rótulo más largo al más corto, con el corto del plan y la sugerencia del gráfico", () => {
    const filas = filasRanking(BASE, "preguntas", { [BECA]: "Beca", preguntas: { "arte$p1": "Edad" } });
    expect(filas.map((f) => f.clave)).toEqual(["arte$p2", "arte$p3", "arte$p1"]);
    expect(filas.map((f) => f.detalle)).toEqual(["p2", "p3", "p1"]);
    expect(filas[2].corto).toBe("Edad");
    expect(filas[0].sugerencia).toBe("Satisfacción");
    // Una sugerencia que no acorta no se ofrece; ninguna se aplica sola.
    expect(filas[1].sugerencia).toBeNull();
    expect(filas[0].corto).toBe("");
  });

  it("categorías: el mapa de opciones salta la clave reservada y casa con espacios normalizados", () => {
    const filas = filasRanking(BASE, "categorias", { [`${BECA}  `.replace("beca 18", "beca  18")]: "Beca 18", preguntas: { "arte$p1": "Edad" } });
    expect(filas.map((f) => f.etiqueta)).toEqual([BECA, "Recursos propios"]);
    expect(filas[0].corto).toBe("Beca 18");
    expect(filas[0].detalle).toBe("financia");
  });

  it("sin base no hay filas; la búsqueda ignora tildes y mira rótulo, corto y variable", () => {
    expect(filasRanking(undefined, "preguntas", undefined)).toEqual([]);
    const filas = filasRanking(BASE, "preguntas", undefined);
    expect(filtrarFilas(filas, "ENSENANZA").map((f) => f.clave)).toEqual(["arte$p2"]);
    expect(filtrarFilas(filas, "p3").map((f) => f.clave)).toEqual(["arte$p3"]);
    expect(filtrarFilas(filas, "  ")).toHaveLength(3);
  });
});

describe("validación y pedido", () => {
  it("vacío quita; igual o más largo que el completo no se guarda", () => {
    expect(errorCorto("Recursos propios", "")).toBeNull();
    expect(errorCorto("Recursos propios", "Recursos propios")).toMatch(/más corto .*16 caracteres/);
    expect(errorCorto("Recursos propios", "Propios")).toBeNull();
    const [p2] = filasRanking(BASE, "preguntas", undefined);
    expect(cambioDe(p2, "  ")).toBe("nada");
    expect(cambioDe(p2, "Satisfacción")).toBe("guardar");
    expect(cambioDe({ ...p2, corto: "Satisfacción" }, "")).toBe("quitar");
  });

  it("el POST lleva la sección entera de la fila con el cambio, y la otra sección no viaja", () => {
    const rc = { [BECA]: "Beca", preguntas: { "arte$p1": "Edad" } };
    const [p2] = filasRanking(BASE, "preguntas", rc);
    expect(pedidoGuardar(rc, p2, " Satisfacción ")).toEqual({ preguntas: { "arte$p1": "Edad", "arte$p2": "Satisfacción" } });
    const p1 = filasRanking(BASE, "preguntas", rc)[2];
    expect(pedidoGuardar(rc, p1, "")).toEqual({ preguntas: {} });
    const [beca] = filasRanking(BASE, "categorias", rc);
    expect(pedidoGuardar(rc, beca, "Beca 18")).toEqual({ opciones: { [BECA]: "Beca 18" } });
    expect(rotulosCon(rc, beca, "Beca 18")).toEqual({ [BECA]: "Beca 18", preguntas: { "arte$p1": "Edad" } });
  });

  it("una categoría guardada con otros espacios se reemplaza, no se duplica", () => {
    const vieja = BECA.replace("beca 18", "beca  18");
    const rc = { [vieja]: "Beca" };
    const [beca] = filasRanking(BASE, "categorias", rc);
    expect(pedidoGuardar(rc, beca, "Beca 18")).toEqual({ opciones: { [BECA]: "Beca 18" } });
  });
});

describe("huérfanas, base inicial, avisos y conteo", () => {
  const ranking: RankingRotulos = { bases: [BASE, { base: "musica", preguntas: [], opciones: [] }] };

  it("las categorías guardadas que ninguna base trae siguen visibles para quitarlas (C5)", () => {
    const h = categoriasHuerfanas({ [BECA]: "Beca", "Respuesta retirada": "Retirada", preguntas: { "arte$p1": "Edad" } }, ranking);
    expect(h.map((f) => [f.clave, f.corto])).toEqual([["Respuesta retirada", "Retirada"]]);
    expect(categoriasHuerfanas({ x: "y" }, null)).toEqual([]);
  });

  it("la base elegida, si no la activa, si no la primera", () => {
    expect(baseInicial(ranking, "musica", null)).toBe("musica");
    expect(baseInicial(ranking, "otra", null)).toBe("arte");
    expect(baseInicial(ranking, "musica", "arte")).toBe("arte");
    expect(baseInicial(null, "musica", null)).toBeNull();
  });

  it("el aviso dice el corto repetido y a quiénes", () => {
    const t = textoAviso({ tipo: "preguntas", base: "arte", corto: "Edad", refs: ["arte$p1", "arte$p3"] }, (r) => (r === "arte$p1" ? "¿Cuál es tu edad?" : r));
    expect(t).toBe('"Edad" es el rótulo corto de 2 preguntas de arte: "¿Cuál es tu edad?", "arte$p3".');
  });

  it('cuenta categorías y preguntas; "preguntas" no es una categoría', () => {
    expect(cuantosRotulos({ [BECA]: "Beca", preguntas: { "arte$p1": "Edad", "arte$p2": "Satisf." } })).toBe(3);
    expect(cuantosRotulos({ preguntas: {} })).toBe(0);
    expect(cuantosRotulos(undefined)).toBe(0);
  });
});

describe("setRotulosCortos", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate({
      version: "graficos/4", plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T" } }] },
      presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
      debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    } as unknown as GraficosConfig);
  });

  it("escribe en el plan, es deshacible y un mapa vacío quita la clave sin tocar las láminas", () => {
    const st = usePlanStore.getState();
    st.setRotulosCortos({ [BECA]: "Beca 18" });
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca 18" });
    expect(usePlanStore.getState().dirty).toBe(true);
    st.setRotulosCortos({});
    expect("rotulos_cortos" in usePlanStore.getState().plan).toBe(false);
    expect(usePlanStore.getState().plan.slides).toHaveLength(1);
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca 18" });
  });

  it("guarda `preguntas` anidado y quita un `preguntas` vacío", () => {
    const st = usePlanStore.getState();
    st.setRotulosCortos({ [BECA]: "Beca 18", preguntas: { "arte$p1": "Edad" } });
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca 18", preguntas: { "arte$p1": "Edad" } });
    st.setRotulosCortos({ [BECA]: "Beca 18", preguntas: {} });
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual({ [BECA]: "Beca 18" });
    st.setRotulosCortos({ preguntas: {} });
    expect("rotulos_cortos" in usePlanStore.getState().plan).toBe(false);
  });
});
