import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanStore } from "../store";
import { ayudaOtros, ROTULO_OTROS } from "./interruptorOtrosModel";
import { objetivoDeReenfoque, type ElementoEnfocable } from "./tecladoVistaGeneral";

// Contrato A5 2b (W1): el interruptor de «Otros» de la barra de Vista general y el arreglo F1-bis del foco.

vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: null }) }));
const { EnlaceOtrosVista } = await import("./EnlaceOtros");
const { SeccionOtros } = await import("../estiloInforme/SeccionOtros");


describe("Vista general · interruptor de «Otros»", () => {
  beforeEach(() => usePlanStore.getState().hydrate({
    version: "graficos/4", plan: { slides: [] }, presets: {}, w_presets: {}, selected_slide_id: null,
    paletas: {}, iconos: [], overrides_reusables: [], debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  }));

  // El rótulo de «Otros» nombra las dos salidas (lo usa el segmentado de la regla en Reglas).
  it("el rótulo nombra PowerPoint y Word", () => {
    expect(ROTULO_OTROS).toBe("Respuestas Otros en el PowerPoint y el Word");
  });

  // R7 (D4): el control vive en Reglas (SeccionOtros, conectado al setter deshacible); la barra del Informe sólo enlaza.
  it("Reglas lee y escribe `autoOtrosSlides` y la barra del Informe monta el enlace, no un segundo interruptor", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const reglas = fs.readFileSync(path.join(dir, "../estiloInforme/PestanaEstiloInforme.tsx"), "utf8");
    expect(reglas).toContain("usePlanStore((s) => s.autoOtrosSlides)");
    expect(reglas).toContain("onCambiar={setAutoOtros}");
    const barra = fs.readFileSync(path.join(dir, "BarraVistaGeneral.tsx"), "utf8");
    expect(barra).toContain("<EnlaceOtros />");
    expect(barra).not.toContain("<InterruptorOtros");
    usePlanStore.getState().setAutoOtrosSlides(true);
    expect(usePlanStore.getState().autoOtrosSlides).toBe(true);
  });

  // Mata: un enlace que no diga el estado o una regla cuyo segmentado no siga al valor.
  it("el enlace dice cómo está y la regla marca la opción elegida", () => {
    expect(renderToStaticMarkup(createElement(EnlaceOtrosVista, { encendido: false, onIr: () => undefined }))).toContain("Sin respuestas Otros");
    expect(renderToStaticMarkup(createElement(EnlaceOtrosVista, { encendido: true, onIr: () => undefined }))).toContain("Con respuestas Otros");
    const regla = (v: boolean) => renderToStaticMarkup(createElement(SeccionOtros, { encendido: v, ayuda: "AYUDA", onCambiar: () => undefined }));
    expect(regla(true)).toMatch(/aria-checked="true"[^>]*>Después de su gráfico/);
    expect(regla(true)).toContain("AYUDA");
    expect(regla(false)).toMatch(/aria-checked="true"[^>]*>No agregar/);
    expect(regla(false)).toContain("no sale en el informe");
  });

  // L1 del rediseño (2026-10-14): el Word SÍ las lleva (reporte_word_otros.R, tabla tras cada gráfico); la ayuda decía lo contrario.
  it("la ayuda dice que van al PowerPoint y al Word y, con un informe por base, que vale para la activa", () => {
    expect(ayudaOtros({ visible: false, clave: "conjunto" })).toContain("una tabla numerada en el Word");
    expect(ayudaOtros({ visible: false, clave: "conjunto" })).not.toContain("no las lleva");
    expect(ayudaOtros({ visible: true, clave: "por-base" })).toContain("Vale para la base activa.");
    expect(ayudaOtros({ visible: true, clave: "conjunto" })).not.toContain("base activa");
  });
});

// F1-bis (C4, teclado): Alt+flecha al cruzar de capítulo desmonta el `<li>` de la tarjeta; el reenfoque guarda su id.
describe("Vista general · reenfoque tras reordenar (F1-bis)", () => {
  const nodo = (tarjeta: string | null): ElementoEnfocable => ({
    closest: (sel) => (sel === "[data-vg-tarjeta]" && tarjeta ? { getAttribute: (n) => (n === "data-vg-tarjeta" ? tarjeta : null) } : null),
  });

  // Mata: guardar el nodo (`document.activeElement`) en vez del id de la tarjeta.
  it("dentro de una tarjeta devuelve su id; fuera, el propio nodo; sin foco, null", () => {
    expect(objetivoDeReenfoque(nodo("s-abc"))).toBe("s-abc");
    const asa = nodo(null);
    expect(objetivoDeReenfoque(asa)).toBe(asa);
    expect(objetivoDeReenfoque(null)).toBeNull();
  });

  it("aplicar() guarda el objetivo de reenfoque y el efecto busca la tarjeta por id tras el render", () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "VistaGeneral.tsx"), "utf8");
    const aplicar = src.slice(src.indexOf("const aplicar = useCallback"), src.indexOf("const anunciarMovidas"));
    expect(aplicar).toContain("objetivoDeReenfoque(activo)");
    expect(aplicar).not.toMatch(/reenfocar\.current = \(document\.activeElement/);
    expect(src).toContain('typeof pendiente === "string" ? tarjetaEl(pendiente)');
    expect(src).toContain("enfocarSinDesplazar(el)");
  });
});
