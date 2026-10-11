// Cambiar el tipo de una lámina conserva sus gráficos donde caben y lista lo que no cabe (F6.2; dirección F6
// principio 3 y §4.3).
import { describe, expect, it } from "vitest";
import type { GraficadorRef, Slide } from "../../../../api/graficos";
import { graficosDeLamina, graficosPorSlot, planearCambioTipo } from "./cambioTipoLamina";

const g = (graficador: string, v = "P1"): GraficadorRef => ({ graficador, args: { var: v } });

const cuatro: Pick<Slide, "tipo" | "payload"> = {
  tipo: "p_slide_4_graficos",
  payload: {
    titulo: "Perfil", base: "Base: 120", pie: "", etiqueta: "",
    superior_izquierda: g("p_barras_categoricas", "P1"),
    superior_derecha: g("p_pie", "P2"),
    inferior_izquierda: g("p_barras_apiladas", "P3"),
    inferior_derecha: null,
    meta: { antetitulo: "Perfil", variante: "banda", motor_nativo: false },
  },
};

describe("planearCambioTipo", () => {
  it("a un tipo con menos ranuras: conserva por nombre y en orden, y lista el sobrante", () => {
    const c = planearCambioTipo(cuatro, "p_slide_2_graficos");
    expect(c.conservados.map((r) => [r.desde, r.hacia])).toEqual([
      ["superior_izquierda", "izquierda"],
      ["superior_derecha", "derecha"],
    ]);
    expect(c.sobrantes.map((s) => s.slot)).toEqual(["inferior_izquierda"]);
    expect(c.payload.izquierda).toEqual(g("p_barras_categoricas", "P1"));
    expect(c.payload.derecha).toEqual(g("p_pie", "P2"));
    expect(c.payload).not.toHaveProperty("superior_izquierda");
  });

  it("a un tipo con los mismos nombres: cada gráfico se queda en su ranura", () => {
    const c = planearCambioTipo(cuatro, "p_slide_3_graficos_poblacion_corona");
    expect(graficosPorSlot(c)).toEqual({ superior_izquierda: "p_barras_categoricas", superior_derecha: "p_pie", inferior: "p_barras_apiladas" });
    expect(c.sobrantes).toEqual([]);
  });

  it("a un tipo con más ranuras: no pierde nada y deja vacías las que sobran", () => {
    const c = planearCambioTipo({ tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: g("p_pie") } }, "p_slide_3_graficos_fila");
    expect(c.conservados.map((r) => r.hacia)).toEqual(["izquierda"]);
    expect(c.payload.centro).toBeNull();
    expect(c.payload.derecha).toBeNull();
    expect(c.sobrantes).toEqual([]);
  });

  it("a una lámina sin ranuras: todos los gráficos son sobrantes", () => {
    const c = planearCambioTipo(cuatro, "p_slide_seccion");
    expect(c.conservados).toEqual([]);
    expect(c.sobrantes).toHaveLength(3);
  });

  it("un gráfico nunca entra a una ranura de cifra; una cifra prefiere la suya", () => {
    const origen: Pick<Slide, "tipo" | "payload"> = {
      tipo: "p_slide_3_graficos_fila",
      payload: { izquierda: g("p_cifra", "N"), centro: g("p_barras_categoricas"), derecha: g("p_pie") },
    };
    const c = planearCambioTipo(origen, "p_slide_cifras_y_graficos");
    expect(graficosPorSlot(c)).toEqual({ cifra_izquierda: "p_cifra", grafico_izquierda: "p_barras_categoricas", grafico_derecha: "p_pie" });
    expect(c.payload.cifra_centro).toBeNull();

    const sinLugar = planearCambioTipo({ tipo: "p_slide_2_graficos", payload: { izquierda: g("p_pie"), derecha: g("p_lollipop") } }, "p_slide_cifras_y_graficos");
    expect(Object.keys(graficosPorSlot(sinLugar)).some((s) => s.startsWith("cifra_"))).toBe(false);
  });

  it("una cifra sin ranura de cifra libre va a una de gráfico", () => {
    const c = planearCambioTipo({ tipo: "p_slide_cifras_y_graficos", payload: { cifra_izquierda: g("p_cifra") } }, "p_slide_1_grafico");
    expect(graficosPorSlot(c)).toEqual({ grafico: "p_cifra" });
  });

  it("pasan los textos que el tipo nuevo acepta y se avisan los que no", () => {
    const c = planearCambioTipo(cuatro, "p_slide_2_graficos");
    expect(c.payload).toMatchObject({ titulo: "Perfil", base: "Base: 120" });
    const sinBase = planearCambioTipo({ tipo: "p_slide_portada", payload: { titulo: "Informe", subtitulo: "Consolidado", fecha: "" } }, "p_slide_1_grafico");
    expect(sinBase.payload.titulo).toBe("Informe");
    expect(sinBase.textosSobrantes).toEqual(["subtitulo"]);
  });

  it("acepta los args del registro como claves del tipo nuevo", () => {
    const c = planearCambioTipo({ tipo: "p_slide_1_grafico", payload: { titulo: "T", etiqueta: "A" } }, "p_slide_redondeo", { clavesDestino: ["titulo", "texto"] });
    expect(c.payload.titulo).toBe("T");
    expect(c.textosSobrantes).toEqual(["etiqueta"]);
  });

  it("de meta pasan antetítulo y ruta anterior; la variante del tipo anterior se descarta", () => {
    const c = planearCambioTipo(cuatro, "p_slide_2_graficos");
    expect(c.payload.meta).toEqual({ antetitulo: "Perfil", motor_nativo: false });
  });

  it("el mismo tipo no cambia nada", () => {
    const c = planearCambioTipo(cuatro, "p_slide_4_graficos");
    expect(c.mismoTipo).toBe(true);
    expect(c.payload).toEqual(cuatro.payload);
    expect(c.sobrantes).toEqual([]);
  });

  it("no muta la lámina de origen", () => {
    const antes = JSON.stringify(cuatro);
    planearCambioTipo(cuatro, "p_slide_1_grafico");
    expect(JSON.stringify(cuatro)).toBe(antes);
  });

  it("graficosDeLamina ignora ranuras vacías o mal formadas", () => {
    expect(graficosDeLamina({ tipo: "p_slide_2_graficos", payload: { izquierda: { graficador: "" }, derecha: g("p_pie") } }).map((x) => x.slot)).toEqual(["derecha"]);
  });
});
