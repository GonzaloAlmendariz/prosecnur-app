// Familias del selector de gráfico y encaje en ranuras (F6.2; dirección F6 §4.4).
import { describe, expect, it } from "vitest";
import type { GraficadorMetadata } from "../../../../api/graficos";
import { CATALOGO_GRAFICOS } from "../../iconos/catalogoTipos.generated";
import { TIPOS_RETIRADOS_0137 } from "../../retirados";
import {
  encajeEnRanura, entradasDeFamilia, FAMILIAS_GRAFICO, familiaDe, familiaInicial, familiasVisibles, familiaVisible, graficoDeEntrada,
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

describe("entradas del catálogo (ADR 0139: las variantes son tarjetas propias)", () => {
  const todos = CATALOGO_GRAFICOS.map((g) => meta(g.name, { descripcion: `desc ${g.name}` }));

  it("cada variante es una tarjeta de su familia, detrás de su graficador, con su nombre y descripción", () => {
    for (const v of VARIANTES_GRAFICO) {
      const ids = entradasDeFamilia(todos, v.familia as never).map((e) => e.id);
      expect(ids).toContain(v.id);
      expect(ids.indexOf(v.id)).toBeGreaterThan(ids.indexOf(v.graficador));
    }
    const comparar = entradasDeFamilia(todos, "comparar");
    const contraste = comparar.find((e) => e.id === "p_dumbbell:contraste");
    expect(contraste?.meta.name).toBe("p_dumbbell");
    expect(contraste?.descripcion).toMatch(/dos públicos/);
    expect(comparar.find((e) => e.id === "p_dumbbell")?.descripcion).toBe("desc p_dumbbell");
  });

  it("sin su graficador en el registro, la variante no se ofrece", () => {
    const sinDumbbell = todos.filter((g) => g.name !== "p_dumbbell");
    expect(entradasDeFamilia(sinDumbbell, "comparar").map((e) => e.id)).not.toContain("p_dumbbell:contraste");
  });

  it("usar una variante escribe sus args fijos y quita los suyos; volver al tipo base quita el estilo resumen", () => {
    const comparar = entradasDeFamilia(todos, "comparar");
    const aperturas = comparar.find((e) => e.id === "p_dumbbell:aperturas");
    const contraste = comparar.find((e) => e.id === "p_dumbbell:contraste");
    const base = comparar.find((e) => e.id === "p_dumbbell");
    if (!aperturas || !contraste || !base) throw new Error("faltan entradas");
    const previo = { graficador: "p_dumbbell", args: { vars: ["p1"], cruce: null, bases: ["a", "b"] } };
    expect(graficoDeEntrada(aperturas, previo)).toEqual({ graficador: "p_dumbbell", args: { vars: ["p1"], estilo: "resumen" } });
    expect(graficoDeEntrada(contraste, { graficador: "p_dumbbell", args: {} }).args).toEqual({ estilo: "resumen", cruce: null });
    expect(graficoDeEntrada(base, { graficador: "p_dumbbell", args: { estilo: "resumen", cruce: null, regla: { tipo: "x" } } }).args)
      .toEqual({ cruce: null });
  });

  it("la ranura de cifra dice en una línea por qué un gráfico no va", () => {
    expect(encajeEnRanura("p_pie", "cifra_izquierda").corto).toBe("Esta ranura recibe solo cifras");
  });
});
