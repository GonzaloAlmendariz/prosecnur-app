// Familias del selector de gráfico y encaje en ranuras (F6.2; dirección F6 §4.4).
import { describe, expect, it } from "vitest";
import type { GraficadorMetadata } from "../../../../api/graficos";
import { CATALOGO_GRAFICOS } from "../../iconos/catalogoTipos.generated";
import { encajeEnRanura, FAMILIAS_GRAFICO, familiaDe, familiaInicial, graficosDeFamilia, salidaDe } from "./tiposGrafico";

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
    expect([...ofrecidos].sort()).toEqual(CATALOGO_GRAFICOS.filter((g) => g.en_selector).map((g) => g.name).sort());
    expect(ofrecidos).not.toContain("p_dim_foda");
  });

  it("un graficador fuera del catálogo toma la familia de su categoría", () => {
    expect(familiaDe(meta("p_nuevo", { categoria: "territory" }))).toBe("territorio");
    expect(familiaDe(meta("p_nuevo"))).toBe("categorias");
  });

  it("la salida sale del catálogo", () => {
    expect(salidaDe("p_puntos_comparativos")).toBe("nativa");   // G11: ya sale como el ranking con puntos
    expect(salidaDe("p_tabla")).toBe("ruta_anterior");
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
