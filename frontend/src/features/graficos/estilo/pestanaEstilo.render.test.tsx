import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import { normalizeEstiloOpciones } from "../../../api/graficosEstilo";
import { usePlanStore, type GraficosConfig } from "../store";
import { useEstiloUi } from "./estiloUiStore";

// Pestaña «Estilo del cliente»: lo que el markup promete (C1, vacío propio, readiness, subida por teclado, sellos) sin
// levantar la pila. `useEffect` no corre en el render estático: las opciones se ponen a mano.

// zustand pinta el render de servidor con `getInitialState`: se apunta al estado vivo para ver lo que el test prepara.
vi.mock("zustand", async (importOriginal) => {
  const real = await importOriginal<typeof import("zustand")>();
  const create = <T,>(init: StateCreator<T, [], []>) => {
    const api = real.createStore<T>()(init);
    api.getInitialState = api.getState;
    return Object.assign(<U,>(selector: (s: T) => U) => real.useStore(api, selector), api);
  };
  return { ...real, create };
});
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { analitica_prep_ok: true } }) }));
vi.stubGlobal("localStorage", { getItem: () => "sid-test", setItem: () => undefined, removeItem: () => undefined });
const { default: PestanaEstilo } = await import("./PestanaEstilo");

// Las secciones viven en subpestañas (I9): el markup de la pestaña es el de sus subpestañas juntas.
function pintar(search = "?pestana=estilo") {
  return ["logos", "letra", "iconos"].map((foco) =>
    renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/graficos${search}&foco=${foco}`] }, createElement(PestanaEstilo)))).join("\n");
}

const OPCIONES = normalizeEstiloOpciones({
  roles: [{ id: "cifras", word: { grafico_cifra: 9.5 } }],
  logos: [{ lugar: "portada_izquierda", logo: "pucp", nombre: "PUCP" }],
});

beforeEach(() => {
  usePlanStore.getState().hydrate({
    version: "graficos/4", plan: { slides: [] }, presets: {}, w_presets: {}, selected_slide_id: null,
    paletas: {}, iconos: [], overrides_reusables: [], debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    estilo_cliente: {
      version: 1, ambito: "proyecto",
      logos: { contraportada: { file_id: "f-acnur", nombre: "ACNUR" } },
      letra: { paso: "estandar", roles: { cifras: "grande" } },
    },
  } as GraficosConfig);
  usePlanStore.getState().setEstiloClienteDefaults({ version: 1, ambito: "proyecto", logos: {}, letra: { paso: "estandar", roles: {} } });
  useEstiloUi.getState().setOpciones(OPCIONES);
});

describe("PestanaEstilo · markup", () => {
  it("declara su superficie, sus grupos y un solo dueño de desplazamiento", () => {
    const html = pintar();
    expect(html).toContain('data-audit-ready="graficos-estilo"');
    expect(html).toContain('data-qa-surface="graficos/f6-estilo"');
    expect(html.match(/data-qa-scroll-owner=/g)).toHaveLength(3);   // uno por subpestaña dibujada
    for (const grupo of ["f6-estilo-secciones", "f6-estilo-ambitos", "f6-estilo-logos", "f6-estilo-pasos", "f6-estilo-roles"]) {
      expect(html).toContain(`data-qa-geometry-group="graficos/${grupo}"`);
    }
    // Tres lugares de logo, cinco roles: marcos pares.
    expect(html.match(/class="pulso-f6-estilo-logo"/g)).toHaveLength(3);
    expect(html.match(/class="pulso-f6-estilo-rol"/g)).toHaveLength(5);
  });

  it("sin opciones todavía, la readiness queda en false", () => {
    useEstiloUi.getState().setOpciones(null);
    expect(pintar()).toContain('data-audit-ready="false"');
  });

  it("sellos: Propio donde hay decisión, Del recetario en lo demás, y «Modificado» por sección", () => {
    const html = pintar();
    expect(html.match(/is-propio/g)).toHaveLength(2); // contraportada + rol cifras
    expect(html).toContain("Por defecto");
    expect(html.match(/pulso-f6-estilo-modificado/g)).toHaveLength(2);
    expect(html).toContain("Ahora: <strong>PUCP</strong>");
    expect(html).toContain('src="/logos-estandar/pucp.png"');
    expect(html).toContain("11,5 pt = 9,5 + 2");
  });

  it("la subida es un botón real y el selector de archivos sólo pide PNG", () => {
    const html = pintar();
    expect(html.match(/<button[^>]*>(?:(?!<\/button>).)*Subir PNG/g)?.length).toBe(2);
    expect(html).toContain("Reemplazar PNG");
    expect(html).toContain('accept="image/png,.png"');
    expect(html).toContain('aria-label="Volver al logo por defecto en contraportada"');
    expect(html).toContain('type="radio" name="f6-estilo-ambito"');
  });

  // L2 (2026-10-14): en el compartido sólo logos y letra dicen por qué no; colores e íconos se ajustan.
  it("en el informe compartido los logos no se ajustan y dicen por qué", () => {
    const html = pintar("?pestana=identidad&scope=consolidado");
    expect(html).toContain("Los logos y la letra hoy sólo se aplican al Word");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-audit-ready="graficos-estilo"');
    expect(html).not.toContain("Subir PNG");
  });

  it("en el informe compartido los colores de las respuestas sí se ajustan", () => {
    const html = pintar("?pestana=identidad&scope=consolidado&foco=colores");
    expect(html).not.toContain("hoy sólo se aplican al Word");
    expect(html).toContain("Colores de las respuestas");
  });
});
