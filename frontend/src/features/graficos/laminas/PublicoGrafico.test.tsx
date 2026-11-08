// Ítem 9 (2026-11-08): «Respuestas bajo el enunciado» con sus tres opciones a la vista y «Automático» diciendo qué rige.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicoGrafico } from "./PublicoGrafico";

const ESTADO = { plan: { slides: [{ id: "s1", tipo: "dos" }] }, updateSlotArgs: () => undefined };
vi.mock("../store", () => ({ usePlanStore: (sel: (s: typeof ESTADO) => unknown) => sel(ESTADO), SLIDE_GRAF_SLOTS: { dos: ["g1", "g2"] } }));

const radios = (html: string) => [...html.matchAll(/role="radio" aria-checked="(true|false)"[^>]*>([^<]+)</g)].map((m) => `${m[2]}:${m[1]}`);

describe("PublicoGrafico en segmentado", () => {
  it("sin decidir marca «Automático» con la regla que rige, y no hay desplegable", () => {
    const html = renderToStaticMarkup(<PublicoGrafico slideId="s1" slot="g1" valor={{ graficador: "p_barras_categoricas", args: {} }} />);
    expect(radios(html)).toEqual(["Automático (si el n cambia):true", "Mostrar:false", "Ocultar:false"]);
    expect(html).not.toContain("<select");
  });
  it("una decisión guardada se ve marcada", () => {
    const html = renderToStaticMarkup(<PublicoGrafico slideId="s1" slot="g1" valor={{ graficador: "p_pie", args: { overrides: { mostrar_publico: false } } }} />);
    expect(radios(html)).toContain("Ocultar:true");
  });
});
