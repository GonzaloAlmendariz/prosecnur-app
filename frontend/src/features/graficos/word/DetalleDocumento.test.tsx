import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import { tituloCortoWord } from "../vistaGeneral/paginasWord";

vi.mock("zustand", async (importOriginal) => {
  const real = await importOriginal<typeof import("zustand")>();
  const create = <T,>(init: StateCreator<T, [], []>) => {
    const api = real.createStore<T>()(init);
    api.getInitialState = api.getState;
    return Object.assign(<U,>(selector: (s: T) => U) => real.useStore(api, selector), api);
  };
  return { ...real, create };
});
const { usePlanStore } = await import("../store");
const { DetalleDocumento } = await import("./DetalleDocumento");

const pintar = () => renderToStaticMarkup(createElement(DetalleDocumento, { tituloInforme: "Encuesta de satisfacción estudiantil con los servicios de la universidad 2026", resumen: "Contenido e índice de gráficos · «Cómo leer»" }));

// W2: Word › Documento escribe `documento_word` y la maqueta usa el mismo título corto que el motor.
describe("Word › Documento", () => {
  beforeEach(() => usePlanStore.getState().setDocumentoWord({}));

  // Mata: un título corto que no corte como `.word_titulo_corto` (60 caracteres, en la última palabra, con «…»).
  it("el título corto automático corta como el motor y el dado manda", () => {
    expect(tituloCortoWord("Encuesta de satisfacción estudiantil con los servicios de la universidad 2026"))
      .toBe("Encuesta de satisfacción estudiantil con los servicios de…");
    expect(tituloCortoWord("ENCUESTA DE SATISFACCIÓN")).toBe("Encuesta de satisfacción");
    expect(tituloCortoWord("Lo que sea", "Satisfacción 2026")).toBe("Satisfacción 2026");
  });

  it("sin decisiones: placeholders del recetario y «Cómo leer» automático", () => {
    const html = pintar();
    expect(html).toContain('placeholder="Encuesta de satisfacción estudiantil con los servicios de…"');
    expect(html).toMatch(/aria-checked="true"[^>]*>Automático/);
    expect(html).toContain("Va solo con las explicaciones que el informe usa en 2 o más láminas.");
    expect(html).toContain("el contenido, el índice de gráficos");
  });

  // Mata: un segmentado que no lea `como_leer` del store.
  it("lee lo decidido en `documento_word`", () => {
    usePlanStore.getState().setDocumentoWord({ titulo_corto: "Satisfacción 2026", como_leer: false, fuente: "Fuente: PULSO PUCP 2026." });
    const html = pintar();
    expect(html).toContain('value="Satisfacción 2026"');
    expect(html).toContain('value="Fuente: PULSO PUCP 2026."');
    expect(html).toMatch(/aria-checked="true"[^>]*>Nunca/);
    expect(html).toContain("El documento no lo lleva.");
  });
});
