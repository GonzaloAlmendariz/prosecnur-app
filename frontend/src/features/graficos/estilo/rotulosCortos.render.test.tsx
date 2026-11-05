import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import { usePlanStore, type GraficosConfig } from "../store";

// Identidad › Rótulos cortos (U3): lo que promete el markup sin levantar la pila.
vi.mock("zustand", async (importOriginal) => {
  const real = await importOriginal<typeof import("zustand")>();
  const create = <T,>(init: StateCreator<T, [], []>) => {
    const api = real.createStore<T>()(init);
    api.getInitialState = api.getState;
    return Object.assign(<U,>(selector: (s: T) => U) => real.useStore(api, selector), api);
  };
  return { ...real, create };
});
const LARGO = "Por beca de estudios (puede ser beca 18 o alguna otra beca externa)";
const catalogo = vi.hoisted(() => ({ listas: null as unknown }));
vi.mock("./usePaletasRespuestas", () => ({ usePaletasRespuestas: () => ({ listas: catalogo.listas, filas: [], error: "" }) }));
const { RotulosCortos } = await import("./RotulosCortos");

function hidratar(rotulos?: Record<string, string>) {
  usePlanStore.getState().hydrate({
    version: "graficos/4", plan: { slides: [], ...(rotulos ? { rotulos_cortos: rotulos } : {}) },
    presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  } as unknown as GraficosConfig);
}

describe("RotulosCortos · markup", () => {
  beforeEach(() => {
    catalogo.listas = [{ list_name: "financia", choices: [{ name: "1", label: LARGO }, { name: "2", label: "Recursos propios" }] }];
  });

  it("sin rótulos: buscador con las respuestas largas y el vacío en su contenedor (C3)", () => {
    hidratar();
    const html = renderToStaticMarkup(createElement(RotulosCortos));
    expect(html).toContain("Acortar una respuesta");
    expect(html).toContain('aria-label="Las respuestas más largas"');
    expect(html).toContain(LARGO);
    expect(html).toContain("Sin rótulos cortos");
    expect(html).not.toContain("data-qa-geometry-group");
  });

  it("con rótulos: un grupo declarado (C1), una fila por rótulo y el aviso del que ya no está en el formulario (C5)", () => {
    hidratar({ [LARGO]: "Beca 18 u otra beca externa", "Respuesta retirada": "Retirada" });
    const html = renderToStaticMarkup(createElement(RotulosCortos));
    expect(html).toContain('data-qa-geometry-group="graficos/identidad-rotulos-cortos"');
    expect(html.match(/data-qa-geometry-member/g)).toHaveLength(2);
    expect(html).toContain("Beca 18 u otra beca externa");
    expect(html.match(/>No está en el formulario</g)).toHaveLength(1);
    expect(html).toContain('aria-label="Quitar el rótulo corto de Retirada"');
    expect(html).not.toContain("Sin rótulos cortos");
    // Con rótulos ya acortados, sin búsqueda no se sugiere nada: la lista manda.
    expect(html).not.toContain("Las respuestas más largas");
  });

  it("sin catálogo todavía: carga, sin buscador ni avisos de formulario", () => {
    catalogo.listas = null;
    hidratar({ [LARGO]: "Beca 18" });
    const html = renderToStaticMarkup(createElement(RotulosCortos));
    expect(html).toContain("Leyendo las respuestas del formulario");
    expect(html).not.toContain("Acortar una respuesta");
    expect(html).not.toContain("No está en el formulario");
  });
});
