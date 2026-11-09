import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import type { RankingRotulos } from "../../../api/graficosRotulos";
import { usePlanStore, type GraficosConfig } from "../store";

// Identidad › Rótulos cortos (U3 + ranking del ADR 0141): lo que promete el markup sin levantar la pila.
vi.mock("zustand", async (importOriginal) => {
  const real = await importOriginal<typeof import("zustand")>();
  const create = <T,>(init: StateCreator<T, [], []>) => {
    const api = real.createStore<T>()(init);
    api.getInitialState = api.getState;
    return Object.assign(<U,>(selector: (s: T) => U) => real.useStore(api, selector), api);
  };
  return { ...real, create };
});
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { session_id: "s", active_base: "arte" } }) }));
const LARGO = "Por beca de estudios (puede ser beca 18 o alguna otra beca externa)";
const { RotulosCortos } = await import("./RotulosCortos");
const { useRotulosCortosUi } = await import("./rotulosCortosStore");

const RANKING: RankingRotulos = {
  bases: [{
    base: "arte",
    preguntas: [
      { ref: "arte$p2", etiqueta: "¿Qué tan satisfecho estás con la enseñanza en tu facultad?", largo: 58, usos: 3, corto_en_grafico: "Satisfacción" },
      { ref: "arte$p1", etiqueta: "¿Cuál es tu edad?", largo: 17, usos: 1 },
    ],
    opciones: [
      { ref: "arte$financia", codigo: "1", etiqueta: LARGO, largo: LARGO.length, usos: 1 },
      { ref: "arte$financia", codigo: "2", etiqueta: "Recursos propios", largo: 16, usos: 0 },
    ],
  }],
};

function hidratar(rotulos?: Record<string, unknown>) {
  usePlanStore.getState().hydrate({
    version: "graficos/4", plan: { slides: [], ...(rotulos ? { rotulos_cortos: rotulos } : {}) },
    presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  } as unknown as GraficosConfig);
}

const render = () => renderToStaticMarkup(createElement(RotulosCortos));

describe("RotulosCortos · markup", () => {
  beforeEach(() => {
    useRotulosCortosUi.setState({ ranking: RANKING, cargando: false, errorCarga: "", base: null, tipo: "preguntas", consulta: "", borradores: {}, errores: {}, guardando: {}, avisos: [] });
  });

  it("Preguntas: grupo declarado (C1), una fila por pregunta del más largo al más corto, sugerencia sin aplicar", () => {
    hidratar({ preguntas: { "arte$p1": "Edad" } });
    const html = render();
    expect(html).toContain('data-qa-geometry-group="graficos/identidad-rotulos-cortos"');
    expect(html.match(/data-qa-geometry-member/g)).toHaveLength(2);
    expect(html.indexOf("satisfecho")).toBeLessThan(html.indexOf("¿Cuál es tu edad?"));
    expect(html).toContain("En un gráfico: &quot;Satisfacción&quot;");
    expect(html).toContain('value="Edad"');
    expect(html).not.toContain('value="Satisfacción"');
    expect(html.match(/>Rótulo corto</g)).toHaveLength(2);
    expect(html).toContain("58 caracteres");
    expect(html).toContain("En 3 láminas");
    expect(html).toContain('data-audit-ready="graficos-rotulos-cortos"');
  });

  it("Categorías: el mapa de opciones de siempre, y la guardada que ya no está en el formulario (C5)", () => {
    useRotulosCortosUi.setState({ tipo: "categorias" });
    hidratar({ [LARGO]: "Beca 18 u otra beca externa", "Respuesta retirada": "Retirada", preguntas: { "arte$p1": "Edad" } });
    const html = render();
    expect(html).toContain('value="Beca 18 u otra beca externa"');
    expect(html).toContain("Sin láminas");
    expect(html.match(/>No está en el formulario</g)).toHaveLength(1);
    expect(html).toContain("Quitar el rótulo corto &quot;Retirada&quot;");
    expect(html).not.toContain(">preguntas<");
  });

  it("los avisos de colisión van en un aviso que no bloquea; sin una sola base no hay selector de base", () => {
    useRotulosCortosUi.setState({ avisos: [{ tipo: "preguntas", base: "arte", corto: "Edad", refs: ["arte$p1", "arte$p2"] }] });
    hidratar();
    const html = render();
    expect(html).toContain("&quot;Edad&quot; es el rótulo corto de 2 preguntas de arte");
    expect(html).not.toContain('aria-label="Base"');
  });

  it("cargando: readiness en false y sin lista; una búsqueda sin resultados contiene su vacío (C3)", () => {
    useRotulosCortosUi.setState({ ranking: null, cargando: true });
    hidratar();
    expect(render()).toContain('data-audit-ready="false"');
    useRotulosCortosUi.setState({ ranking: RANKING, cargando: false, consulta: "zzz" });
    const html = render();
    expect(html).toContain("Ninguna coincide");
    expect(html).not.toContain("data-qa-geometry-group=\"graficos/identidad-rotulos-cortos\"");
  });
});
