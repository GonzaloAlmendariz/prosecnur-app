import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrato A5 2b (W1): «Armar desde…» es `panel=armar-desde` (usePanelDireccionable) y los vacíos de Láminas y Vista
// general lo ofrecen. ADR 0096 decisión 9: en el informe compartido deja de estar `aria-disabled` y pide la propuesta
// con `scope: "consolidado"` (antes este archivo fijaba el provisional: deshabilitado, con motivo y 0 llamadas).

const planSugerido = vi.fn();
vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiGraficosPlanSugerido: (...args: unknown[]) => planSugerido(...args),
}));
vi.mock("../usePptStyleProfiles", () => ({ usePptStyleProfiles: () => ({ profiles: [] }) }));
vi.mock("../useGraficosRegistry", () => ({ useGraficosRegistry: () => ({ registry: null, graficadoresById: {} }) }));
vi.mock("../../project/ProjectShell", () => ({ useOptionalProjectShell: () => null }));

const { SuggestedPlanButton } = await import("../SuggestedPlanButton");
const { BotonArmarDesdeVacio } = await import("./BotonArmarDesdeVacio");

// Texto del motivo provisional de la decisión 17; no debe volver a aparecer.
const MOTIVO_PROVISIONAL = "esta opción queda deshabilitada hasta conectarla";

const en = (url: string, nodo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [url] }, nodo));

describe("«Armar desde…» · panel direccionable y alcance", () => {
  beforeEach(() => planSugerido.mockReset());

  // Mata: volver a un `useState` local para abrir (el enlace no reproduciría la vista).
  it("?panel=armar-desde abre el popover; sin el param queda cerrado", () => {
    const abierto = en("/procesamiento?seccion=graficos&pestana=vista-general&panel=armar-desde", createElement(SuggestedPlanButton));
    expect(abierto).toContain('role="dialog"');
    expect(abierto).toContain('data-pulso-panel="armar-desde"');
    expect(abierto).toContain('aria-expanded="true"');
    const cerrado = en("/procesamiento?seccion=graficos&pestana=vista-general", createElement(SuggestedPlanButton));
    expect(cerrado).not.toContain('role="dialog"');
    expect(cerrado).toContain('aria-expanded="false"');
    expect(cerrado).toContain("Armar desde…");
  });

  // F1. Mata: dejar el compartido deshabilitado (o con el motivo provisional) tras conectar la matriz.
  // El render estático no corre efectos, así que la llamada en sí se fija por la fuente (ver abajo) y por
  // `apiGraficosPlanSugerido` en api/client.test.ts (F7).
  it("informe compartido: habilitado, sin motivo y con el formulario de propuesta", () => {
    const html = en("/procesamiento?seccion=graficos&pestana=laminas&scope=consolidado&panel=armar-desde", createElement(SuggestedPlanButton));
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).not.toContain(MOTIVO_PROVISIONAL);
    expect(html).toContain("Actualizar propuesta");
    // Renderizar no llama: la propuesta se pide en el efecto de apertura.
    expect(planSugerido).not.toHaveBeenCalled();
  });

  it("CTA de los vacíos: activo dentro y fuera del compartido", () => {
    const activo = en("/procesamiento?seccion=graficos&pestana=laminas", createElement(BotonArmarDesdeVacio));
    expect(activo).toContain("Armar desde un plan sugerido");
    expect(activo).not.toContain("aria-disabled");
    const compartido = en("/procesamiento?seccion=graficos&pestana=laminas&scope=consolidado", createElement(BotonArmarDesdeVacio));
    expect(compartido).toContain("Armar desde un plan sugerido");
    expect(compartido).not.toContain("aria-disabled");
    expect(compartido).not.toContain(MOTIVO_PROVISIONAL);
  });
});

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fuente = (rel: string) => fs.readFileSync(path.join(AQUI, rel), "utf8");

describe("vacíos y avisos (lectura de la fuente: el vacío y la Vista general necesitan la pila para montarse)", () => {
  // Mata: dejar «Ir al Editor anterior» como salida del vacío de Láminas.
  it("el vacío de Láminas ofrece «Armar desde» y ya no «Ir al Editor anterior»", () => {
    const src = fuente("../laminas/LaminasWorkbench.tsx");
    const vacio = src.slice(src.indexOf("if (!lamina || !slide)"), src.indexOf("return (", src.indexOf("if (!lamina || !slide)") + 40));
    expect(vacio).toContain("<BotonArmarDesdeVacio />");
    expect(src).not.toContain("Ir al Editor anterior");
  });

  it("el vacío de Vista general ofrece «Armar desde» y «N avisos» abre PanelAvisos dentro de la vista", () => {
    const src = fuente("../vistaGeneral/VistaGeneral.tsx");
    const vacio = src.slice(src.indexOf("if (!slides.length)"), src.indexOf("let indiceCapitulo"));
    expect(vacio).toContain("<BotonArmarDesdeVacio />");
    expect(src).not.toContain("Ir al Editor anterior");
    expect(src).toMatch(/<AvisosVistaGeneral estructura=\{estructura\} onIr=\{abrir\} \/>/);
    const avisos = fuente("../vistaGeneral/AvisosVistaGeneral.tsx");
    expect(avisos).toContain("usePanelDireccionable(PANEL_AVISOS_INFORME)");
    expect(avisos).toContain("<PanelAvisos");
  });

  // F1: la propuesta se pide con el alcance de la vista (una sola llamada al abrir, `scope` como segundo argumento).
  it("SuggestedPlanButton pide la propuesta con el alcance de la vista", () => {
    const src = fuente("../SuggestedPlanButton.tsx");
    const generar = src.slice(src.indexOf("async function generate()"), src.indexOf("generar.current = "));
    expect(generar.match(/apiGraficosPlanSugerido\(/g)).toHaveLength(1);
    // El alcance viaja como argumento del cliente (que lo pone en la raíz del cuerpo), no dentro de la config.
    expect(generar).toMatch(/apiGraficosPlanSugerido\([\s\S]*\},\s*[A-Za-z_$][\w$]*\s*\)/);
    expect(generar).not.toMatch(/scope:\s*"consolidado"/);
  });

  // ADR 0102: la matriz ya no arma láminas; no queda «Sincronizar» con ella. Mata: reintroducirlo.
  it("no hay Sincronizar con la matriz", () => {
    const src = fuente("../SuggestedPlanButton.tsx");
    expect(src).not.toMatch(/sincronizarPlan|sincronizarEquivalentes|esEquivalente/);
  });

  it("SuggestedPlanButton abre por la dirección y aplica en un paso", () => {
    const src = fuente("../SuggestedPlanButton.tsx");
    expect(src).toContain("usePanelDireccionable(PANEL_ARMAR_DESDE)");
    expect(src).not.toMatch(/useState\(false\);\s*\n\s*const \[busy/);
    expect(src).toContain("aplicarPlanSugerido({");
    expect(src).not.toMatch(/\b(loadPlan|setEquivalenciasRevision|setScopeRules|applyPptStyleProfile)\(/);
  });
});
