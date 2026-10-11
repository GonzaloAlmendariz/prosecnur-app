import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanStore } from "../store";
import { ayudaOtros, CHIP_OTROS, ROTULO_OTROS } from "./interruptorOtros";
import { objetivoDeReenfoque, type ElementoEnfocable } from "./tecladoVistaGeneral";

// Contrato A5 2b (W1): el interruptor de «Otros» de la barra de Vista general y el arreglo F1-bis del foco.

vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: null }) }));
const { InterruptorOtrosVista } = await import("./InterruptorOtros");

const pintar = (encendido: boolean) => renderToStaticMarkup(createElement(InterruptorOtrosVista, { encendido, ayuda: "ayuda", onCambiar: () => undefined }));

describe("Vista general · interruptor de «Otros»", () => {
  beforeEach(() => usePlanStore.getState().hydrate({
    version: "graficos/4", plan: { slides: [] }, presets: {}, w_presets: {}, selected_slide_id: null,
    paletas: {}, iconos: [], overrides_reusables: [], debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  }));

  // Mata: un `aria-checked` fijo o un rótulo que no diga PowerPoint.
  it("aria-checked sigue al valor, el rótulo dice PowerPoint y el chip aparece sólo encendido", () => {
    const apagado = pintar(false);
    expect(apagado).toContain('role="switch"');
    expect(apagado).toContain('aria-checked="false"');
    expect(apagado).toContain(`aria-label="${ROTULO_OTROS}"`);
    expect(ROTULO_OTROS).toBe("Láminas de «Otros» en el PowerPoint");
    expect(apagado).not.toContain(CHIP_OTROS);
    const encendido = pintar(true);
    expect(encendido).toContain('aria-checked="true"');
    expect(encendido).toContain(CHIP_OTROS);
  });

  // Mata: desconectar el interruptor del store (o del setter deshacible) y dejarlo fuera de la barra.
  it("el conectado lee `autoOtrosSlides` del store y la barra de Vista general lo monta", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(dir, "InterruptorOtros.tsx"), "utf8");
    expect(src).toContain("usePlanStore((s) => s.autoOtrosSlides)");
    expect(src).toContain("encendido={encendido}");
    expect(src).toContain("onCambiar={setAutoOtrosSlides}");
    expect(fs.readFileSync(path.join(dir, "BarraVistaGeneral.tsx"), "utf8")).toContain("<InterruptorOtros />");
    usePlanStore.getState().setAutoOtrosSlides(true);
    expect(usePlanStore.getState().autoOtrosSlides).toBe(true);
  });

  it("la ayuda dice que el Word no las lleva y, con un informe por base, que vale para la activa", () => {
    expect(ayudaOtros({ visible: false, clave: "conjunto" })).toContain("el Word no las lleva");
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
