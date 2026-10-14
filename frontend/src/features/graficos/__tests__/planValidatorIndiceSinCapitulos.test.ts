import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";

// Arte y Diseño (2026-10-13): el índice en «facetas» sin capítulos y sin separadores en el informe salía en el PowerPoint
// con la plantilla antigua y capítulos de ejemplo. Gonzalo: «no se puede exportar si no está definido».

const entrada = (slides: Slide[]): EntradaValidarPlan => ({
  slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
  slidesById: {}, graficadoresById: {}, presetsByName: {}, variables: [], multi: false,
});
const lamina = (id: string, tipo: string, payload: Record<string, unknown> = {}) => ({ id, tipo, payload }) as unknown as Slide;

describe("índice sin capítulos", () => {
  test("bloquea la exportación y lleva a la lámina", () => {
    const r = validarPlan(entrada([lamina("p", "p_slide_portada"), lamina("i", "p_slide_indice", { meta: { composicion: "facetas" } })]));
    const e = r.errors.find((x) => x.code === "indice-sin-capitulos");
    expect(e?.message).toBe("Lámina 2 (Índice): no tiene capítulos y el informe no tiene separadores de capítulo. Escribe sus capítulos en el índice o agrega separadores al informe.");
    expect(e?.slideId).toBe("i");
    expect(r.canExport).toBe(false);
  });

  test("con capítulos propios o separadores de capítulo en el informe, se exporta", () => {
    expect(validarPlan(entrada([lamina("i", "p_slide_indice", { secciones: "Gestión\nDocencia" })])).canExport).toBe(true);
    expect(validarPlan(entrada([lamina("i", "p_slide_indice"), lamina("s", "p_slide_seccion", { titulo: "Resultados" })])).canExport).toBe(true);
  });

  test("un separador de subcapítulo o sin título no cuenta", () => {
    const r = validarPlan(entrada([
      lamina("i", "p_slide_indice"),
      lamina("a", "p_slide_seccion", { titulo: "Detalle", meta: { nivel: "subcapitulo" } }),
      lamina("b", "p_slide_seccion", { titulo: "  " }),
    ]));
    expect(r.canExport).toBe(false);
  });
});
