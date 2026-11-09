// Familias del selector de gráfico y encaje en ranuras (F6.2; dirección F6 §4.4).
import { describe, expect, it } from "vitest";
import type { GraficadorMetadata } from "../../../../api/graficos";
import { CATALOGO_GRAFICOS } from "../../iconos/catalogoTipos.generated";
import { TIPOS_RETIRADOS_0137 } from "../../retirados";
import {
  encajeEnRanura, entradasDeFamilia, FAMILIAS_GRAFICO, familiaDe, familiaInicial, familiasVisibles, familiaVisible,
  graficosDeFamilia, salidaDe,
} from "./tiposGrafico";
import { VARIANTES_GRAFICO } from "../../iconos/catalogoTipos.generated";

const meta = (name: string, extra: Partial<GraficadorMetadata> = {}): GraficadorMetadata => ({
  name, titulo_humano: name, descripcion: "", icono_ui: "", args: [], args_extra: [], ...extra,
});

describe("familias", () => {
  it("toda familia del catálogo es una de las siete del selector", () => {
    const ids = new Set(FAMILIAS_GRAFICO.map((f) => f.id));
    expect(CATALOGO_GRAFICOS.filter((g) => !ids.has(g.familia_editor as never)).map((g) => g.name)).toEqual([]);
  });

  it("cada graficador ofrecido cae en exactamente una familia y los retirados en ninguna", () => {
    const todos = CATALOGO_GRAFICOS.map((g) => meta(g.name));
    const ofrecidos = FAMILIAS_GRAFICO.flatMap((f) => graficosDeFamilia(todos, f.id).map((g) => g.name));
    expect(new Set(ofrecidos).size).toBe(ofrecidos.length);
    expect([...ofrecidos].sort()).toEqual(CATALOGO_GRAFICOS.filter((g) => g.en_selector && !TIPOS_RETIRADOS_0137.has(g.name)).map((g) => g.name).sort());
    expect(ofrecidos).not.toContain("p_dim_foda");
  });

  it("ADR 0137: los retirados no se ofrecen y la familia «Dimensiones» ya no existe", () => {
    const todos = CATALOGO_GRAFICOS.map((g) => meta(g.name));
    const porFamilia = new Map(FAMILIAS_GRAFICO.map((f) => [f.id, graficosDeFamilia(todos, f.id)]));
    for (const g of TIPOS_RETIRADOS_0137) expect([...porFamilia.values()].flat().map((m) => m.name)).not.toContain(g);
    expect(FAMILIAS_GRAFICO.map((f) => f.id)).toEqual(["categorias", "escalas", "numeros", "comparar", "territorio", "texto"]);
    const visibles = familiasVisibles(porFamilia, true);
    expect(visibles.map((f) => f.id)).toEqual(FAMILIAS_GRAFICO.map((f) => f.id));
    expect(porFamilia.get("comparar")?.map((g) => g.name)).toContain("p_heatmap_cruce");
    // Sin catálogo todavía no se vacía la columna; la familia de un retirado cae en la primera visible.
    expect(familiasVisibles(new Map(), false)).toHaveLength(FAMILIAS_GRAFICO.length);
    expect(familiaVisible("territorio", visibles.filter((f) => f.id !== "territorio"))).toBe(visibles[0].id);
    expect(familiaVisible("comparar", visibles)).toBe("comparar");
  });

  it("un graficador fuera del catálogo toma la familia de su categoría", () => {
    expect(familiaDe(meta("p_nuevo", { categoria: "territory" }))).toBe("territorio");
    expect(familiaDe(meta("p_nuevo"))).toBe("categorias");
  });

  it("la salida sale del catálogo", () => {
    expect(salidaDe("p_puntos_comparativos")).toBe("nativa");   // G11: ya sale como el ranking con puntos
    expect(salidaDe("p_tabla")).toBe("nativa");   // G11: la tabla del diseño (láminas 197/225)
    expect(salidaDe("p_nube_palabras")).toBe("nativa");   // G11: con su ranking de palabras (lámina 101)
    expect(salidaDe("p_barras_categoricas")).toBe("nativa");
  });

  it("abre en la familia del gráfico actual o, en una ranura de cifra, en Números", () => {
    expect(familiaInicial(meta("p_barras_apiladas"), "grafico")).toBe("escalas");
    expect(familiaInicial(null, "cifra_centro")).toBe("numeros");
    expect(familiaInicial(null, "derecha")).toBe("categorias");
  });
});

describe("encajeEnRanura", () => {
  it("una ranura de cifra recibe sólo cifras; una cifra en ranura de gráfico avisa la ruta anterior", () => {
    expect(encajeEnRanura("p_pie", "cifra_izquierda").cabe).toBe(false);
    expect(encajeEnRanura("p_cifra", "cifra_izquierda")).toEqual({ cabe: true, nota: null });
    expect(encajeEnRanura("p_cifra", "grafico")).toMatchObject({ cabe: true, nota: expect.stringMatching(/como imagen/) });
    expect(encajeEnRanura("p_pie", "izquierda")).toEqual({ cabe: true, nota: null });
  });
});

describe("tarjetas del catálogo (ADR 0139, enmienda 2026-11-09: las variantes son versiones de su tipo)", () => {
  const todos = CATALOGO_GRAFICOS.map((g) => meta(g.name, { descripcion: `desc ${g.name}` }));
  const ofrecidos = FAMILIAS_GRAFICO.flatMap((f) => entradasDeFamilia(todos, f.id));

  it("una tarjeta por tipo: ninguna variante es tarjeta aparte", () => {
    const ids = ofrecidos.map((e) => e.id);
    for (const v of VARIANTES_GRAFICO) expect(ids).not.toContain(v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contrato del catálogo: toda variante es una versión de un tipo que el selector ofrece, en la familia de su tipo", () => {
    for (const v of VARIANTES_GRAFICO) {
      const tarjeta = ofrecidos.find((e) => e.id === v.graficador);
      expect(tarjeta, v.id).toBeDefined();
      expect(tarjeta?.versiones.map((x) => x.id), v.id).toContain(v.id);
      expect(entradasDeFamilia(todos, v.familia as never).map((e) => e.id), v.id).toContain(v.graficador);
    }
  });

  it("la tarjeta con variantes trae la base primero y cada variante detrás; la que no tiene, ninguna versión", () => {
    const dumbbell = ofrecidos.find((e) => e.id === "p_dumbbell");
    expect(dumbbell?.versiones.map((v) => v.id)).toEqual(["p_dumbbell", "p_dumbbell:contraste", "p_dumbbell:aperturas"]);
    expect(dumbbell?.descripcion).toBe("desc p_dumbbell");
    expect(ofrecidos.find((e) => e.id === "p_barras_divergentes")?.versiones.map((v) => v.id))
      .toEqual(["p_barras_divergentes", "p_barras_divergentes:escala_sin_informacion"]);
    expect(ofrecidos.find((e) => e.id === "p_pie")?.versiones).toEqual([]);
  });

  it("sin su graficador en el registro, la tarjeta y sus versiones no se ofrecen", () => {
    const sinDumbbell = todos.filter((g) => g.name !== "p_dumbbell");
    expect(entradasDeFamilia(sinDumbbell, "comparar").map((e) => e.id)).not.toContain("p_dumbbell");
  });

  it("la ranura de cifra dice en una línea por qué un gráfico no va", () => {
    expect(encajeEnRanura("p_pie", "cifra_izquierda").corto).toBe("Esta ranura recibe solo cifras");
  });
});
