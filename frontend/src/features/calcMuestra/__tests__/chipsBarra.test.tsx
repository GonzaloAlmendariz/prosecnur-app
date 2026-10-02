/**
 * Gonzalo (2026-10-02): los chips de la barra de aulas «no sé qué tan
 * necesarios son y se ven bastante mal». Se quedan sólo los que dicen algo
 * que no está en otro sitio: el fallo del autosave, y el tipo, que ahora abre
 * el selector.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChromeIndicator } from "../../../components/ChromeIndicator";
import { estadoGuardado, VistaIndicadorGuardado } from "../hooks/IndicadorGuardadoCalcMuestra";

describe("«Guardado» sólo se dice cuando falla", () => {
  it("guardado, pendiente o en vuelo: no pinta nada (el .pulso tiene su propio estado)", () => {
    for (const s of [
      { dirty: false, guardando: false, errorGuardado: false },
      { dirty: true, guardando: false, errorGuardado: false },
      { dirty: true, guardando: true, errorGuardado: false },
    ]) {
      expect(renderToStaticMarkup(<VistaIndicadorGuardado estado={estadoGuardado(s)} />)).toBe("");
    }
  });
  it("si el autosave falló, lo dice", () => {
    const html = renderToStaticMarkup(<VistaIndicadorGuardado estado={estadoGuardado({ dirty: true, guardando: false, errorGuardado: true })} />);
    expect(html).not.toBe("");
  });
});

describe("el indicador «Tipo» abre el selector", () => {
  it("con onClick es un botón con la misma geometría; sin él, un dato", () => {
    const boton = renderToStaticMarkup(<ChromeIndicator label="Tipo" value="Conglomerados en aulas" onClick={() => {}} />);
    expect(boton).toMatch(/^<button type="button" class="pulso-chrome-indicator is-accion"/);
    expect(boton).toContain("data-chrome-indicator");
    const dato = renderToStaticMarkup(<ChromeIndicator label="Etapa" value="Propuesta" />);
    expect(dato).toMatch(/^<span class="pulso-chrome-indicator"/);
  });
});
