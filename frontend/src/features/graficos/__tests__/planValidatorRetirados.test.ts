// R11-3: Avisos ve los tipos retirados por el ADR 0137. El validador del cliente no consultaba retirados.ts mientras
// /api/graficos/validar devolvía un aviso por ranura: el panel decía «sin avisos» con dos ranuras que salen en blanco.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
import type { VarWithSource } from "../useVariables";

const variables = [
  { name: "p5", label: "Satisfacción", source: "estudiantes", list_name: "satis" },
  { name: "sexo", label: "Sexo", source: "estudiantes", list_name: "sexo" },
] as unknown as VarWithSource[];

const entrada = (slides: Slide[], extra: Partial<EntradaValidarPlan> = {}): EntradaValidarPlan => ({
  slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
  slidesById: { p_slide_1_grafico: { slots: ["grafico"], titulo_humano: "Un gráfico", slot_specs: [{ name: "grafico", label: "Gráfico", role: "chart" }] } } as unknown as EntradaValidarPlan["slidesById"],
  graficadoresById: {}, presetsByName: {}, variables, multi: false, ...extra,
});

const lamina = (graficador: string, args: Record<string, unknown> = {}) =>
  ({ id: `s-${graficador}`, tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: { graficador, args } } }) as unknown as Slide;

describe("validador del plan: tipos retirados (R11-3)", () => {
  it("un aviso por ranura retirada, con el texto del backend y el reemplazo del registro", () => {
    const r = validarPlan(entrada([lamina("p_dim_radar", { var: "estudiantes$nada" })], {
      retirados: [{ name: "p_dim_radar", titulo_humano: "Radar por dimensiones", adr: "0137",
        reemplazo: { texto: "Media y rango sobre la columna del índice", graficador: "p_media_rango" } }],
    }));
    const avisos = r.issues.filter((i) => i.code === "tipo-retirado");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ severity: "warning", slideId: "s-p_dim_radar", slotName: "grafico" });
    expect(avisos[0].message).toMatch(/: el espacio "Gráfico" usa "Radar por dimensiones", que ya no existe; sale en blanco\. Cámbialo por Media y rango sobre la columna del índice\.$/);
    expect(avisos[0].detalle).toBe('El espacio "Gráfico" usa "Radar por dimensiones", que ya no existe; sale en blanco. Cámbialo por Media y rango sobre la columna del índice.');
    // Sus args no se validan: la ranura sale en blanco, una variable perdida no es otro aviso.
    expect(r.issues.some((i) => i.code === "var-unknown")).toBe(false);
  });

  it("sin el registro manda la lista congelada, con el nombre del backend", () => {
    const r = validarPlan(entrada([lamina("p_significancia_publicos")]));
    expect(r.warnings.find((i) => i.code === "tipo-retirado")?.message)
      .toContain('usa "Diferencias significativas entre públicos", que ya no existe; sale en blanco. Cámbialo por otro tipo de gráfico.');
  });

  it("el mapa de calor con una pregunta como objetivo sale como el mapa de calor por cruce", () => {
    const r = validarPlan(entrada([lamina("p_dim_heatmap", { objetivo: "p5", cruce: "sexo" })]));
    expect(r.warnings.find((i) => i.code === "tipo-retirado")?.message)
      .toContain('sale como "Mapa de calor por cruce", con las mismas cifras.');
  });

  it("un tipo vigente no avisa", () => {
    expect(validarPlan(entrada([lamina("p_barras_agrupadas", { var: "p5" })])).issues.some((i) => i.code === "tipo-retirado")).toBe(false);
  });
});
