// @vitest-environment happy-dom
/**
 * La cabecera de pestaña de Analítica sobre la página real. Frecuencias y
 * Cruces dibujan la suya, como el prototipo: el título, los casos que cuentan,
 * las cifras del archivo y "Generar Excel" en un contenedor; la página no pinta
 * la propia, y su barra de fuente (versión de la base y plantilla) baja a los
 * ajustes. Las demás pestañas conservan la cabecera estándar con la banda de
 * casos debajo.
 *
 * Y la readiness (hallazgo del QA: la marca se publicaba con "Leyendo las
 * tablas del archivo" en pantalla): mientras la vista previa, la config o la
 * preparación se leen, alguna marca queda en "false" y la vista no se da por
 * lista; al llegar la vista previa, sí.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrucesPreview, FrecuenciasPreview } from "../../../api/analitica";
import { evaluarMarcas } from "../../../lib/navegacion/runtime";
import { respuestaSinPesos as crucesSinPesos } from "../cruces/ejemploDeCruces.test-util";
import { cabeceraCompacta, PESTANAS_CON_VISTA_PREVIA } from "./cabeceraCompacta";
import { respuestaReal } from "./ejemploDeVistaPrevia.test-util";

const { nunca, vistaPrevia } = vi.hoisted(() => ({
  nunca: () => new Promise<never>(() => undefined),
  vistaPrevia: {
    frecuencias: vi.fn<() => Promise<FrecuenciasPreview>>(),
    cruces: vi.fn<() => Promise<CrucesPreview>>(),
  },
}));
const sesion = {
  session_id: "s", xlsform: true, data: true, instrumento_parsed: true, data_previewed: true,
  analitica_prep_ok: true, analitica_fuente: "originales", active_base: "Monitoreo territorial", n_bases: 1,
};

vi.mock("../../../api/analitica", async (original) => ({
  ...(await original<typeof import("../../../api/analitica")>()),
  apiAnaliticaUniverso: async () => [],
  apiAnaliticaVariables: nunca,
  apiAnaliticaFrecuenciasPreview: () => vistaPrevia.frecuencias(),
  apiAnaliticaCrucesPreview: () => vistaPrevia.cruces(),
  apiAnaliticaDataReview: nunca,
  apiAnaliticaPreparar: nunca,
  apiAnaliticaConfigGet: nunca,
}));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { ...sesion }, refresh: async () => undefined }) }));
vi.mock("../useAnaliticaAutosave", () => ({ useAnaliticaAutosave: () => undefined }));
vi.mock("../../project/ProjectModulesContext", () => ({ useProjectModules: () => ({ overview: null }) }));
vi.mock("../useReporteRun", () => ({
  useReporteRun: () => ({
    generacion: { estado: { fase: "inactiva" }, cerrar: () => undefined },
    busy: false, lastResult: null, perBase: [], runSync: async () => undefined, runAsync: async () => undefined,
  }),
}));

let host: HTMLDivElement;
let root: Root;

const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function montar(pestana: string) {
  const { default: AnaliticaPage } = await import("../AnaliticaPage");
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/analitica?pestana=${pestana}`]}>
        <AnaliticaPage />
      </MemoryRouter>,
    );
  });
  await esperar();
}

const cabeceraDeLaPagina = () => host.querySelector<HTMLElement>(".pulso-analitica-panel-head");
const cabeceraPropia = () => host.querySelector<HTMLElement>(".tablas-cabecera");
/** Lo que el QA lee: todas las marcas del documento, con el contrato de `estadoListo()`. */
const listo = () => evaluarMarcas(Array.from(host.querySelectorAll("[data-audit-ready]")).map((e) => ({
  valor: e.getAttribute("data-audit-ready") ?? "",
  inactiva: false,
  descripcion: e.className,
}))).listo;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vistaPrevia.frecuencias.mockReset().mockImplementation(nunca);
  vistaPrevia.cruces.mockReset().mockImplementation(nunca);
  const { useAnaliticaStore, DEFAULT_CONFIG } = await import("../store");
  useAnaliticaStore.setState({
    config: { ...DEFAULT_CONFIG, cruces: { ...DEFAULT_CONFIG.cruces, cruces_vars: [{ name: "M5_district" }] } },
    hydrated: true, dirty: false, errorGuardado: null,
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("cabecera de las pestañas con vista previa", () => {
  it("son Frecuencias y Cruces", () => {
    expect([...PESTANAS_CON_VISTA_PREVIA]).toEqual(["frecuencias", "cruces"]);
    expect(cabeceraCompacta("datos")).toBe(false);
  });

  it.each(["frecuencias", "cruces"])("en %s la cabecera es la de la pestaña, con los casos que cuentan, las cifras y Generar Excel", async (pestana) => {
    await montar(pestana);
    // La página no pinta la suya: una sola cabecera.
    expect(cabeceraDeLaPagina()).toBeNull();
    expect(host.querySelectorAll(".pulso-tab-heading")).toHaveLength(1);
    const cabecera = cabeceraPropia();
    expect(cabecera?.querySelector("h2")?.textContent).toBe(pestana === "cruces" ? "Cruces" : "Frecuencias");
    // El antetítulo a la vista es "Analítica", como el prototipo; el número de pestaña solo para el lector de pantalla.
    expect(cabecera?.querySelector(".pulso-tab-heading-eyebrow")?.textContent).toBe("Analítica");
    expect(cabecera?.querySelector(".pulso-sr-only:not(.pulso-tab-heading-eyebrow)")?.textContent).toMatch(/^Pestaña \d+ de \d+$/);
    expect(cabecera?.querySelector(".pulso-universo")?.textContent).toContain("Cuentan todos los casos");
    expect(cabecera?.querySelector('dl[aria-label^="Cifras del archivo"]')).not.toBeNull();
    expect(Array.from(cabecera?.querySelectorAll("button") ?? []).some((b) => b.textContent?.trim() === "Generar Excel")).toBe(true);
    // La barra de fuente baja a los ajustes, fuera de la cabecera.
    expect(cabecera?.querySelector(".pulso-analitica-sourcebar")).toBeNull();
    expect(host.querySelector(".tablas-panel--ajustes .tablas-datos .pulso-analitica-sourcebar")).not.toBeNull();
    expect(host.querySelector("#analitica-panel")?.hasAttribute("data-cabecera-propia")).toBe(true);
  });

  it("las demás pestañas llevan la cabecera común del kit, con la banda de casos debajo y la fuente en las acciones", async () => {
    await montar("ficha");
    const tabHeading = cabeceraDeLaPagina()?.querySelector<HTMLElement>(".pulso-tab-heading");
    // Plan 4.7: la cabecera del kit (`CabeceraDePestana`), con el antetítulo "Analítica" y sin "pestaña n de m".
    expect(cabeceraDeLaPagina()?.querySelector(".pulso-cabecera-pestana")).not.toBeNull();
    expect(tabHeading?.querySelector(".pulso-tab-heading-eyebrow")?.textContent).toBe("Analítica");
    expect(tabHeading?.querySelector("h2")?.textContent).toBe("Ficha técnica");
    expect(cabeceraDeLaPagina()?.textContent).not.toMatch(/[Pp]estaña \d+ de \d+/);
    expect(tabHeading?.querySelector(".pulso-cabecera-pestana-acciones .pulso-analitica-sourcebar")).not.toBeNull();
    expect(cabeceraDeLaPagina()?.querySelector(":scope > .pulso-analitica-universo-banda .pulso-universo")).not.toBeNull();
    expect(tabHeading?.querySelector(".pulso-analitica-sourcebar")).not.toBeNull();
    expect(cabeceraPropia()).toBeNull();
    expect(host.querySelector("#analitica-panel")?.hasAttribute("data-cabecera-propia")).toBe(false);
  });
});

describe("cabecera de Ponderación", () => {
  it("dibuja la suya, la del kit con su interruptor, y la fuente baja a Ajustes", async () => {
    await montar("ponderacion");
    expect(cabeceraDeLaPagina()).toBeNull();
    expect(host.querySelectorAll(".pulso-tab-heading")).toHaveLength(1);
    const cabecera = host.querySelector<HTMLElement>(".pond-cabecera");
    expect(cabecera?.querySelector("h2")?.textContent).toBe("Ponderación");
    expect(cabecera?.querySelector(".pulso-tab-heading-eyebrow")?.textContent).toBe("Analítica");
    expect(cabecera?.querySelector('[role="switch"]')).not.toBeNull();
    expect(cabecera?.textContent).not.toMatch(/[Pp]estaña \d+ de \d+/);
    expect(cabecera?.querySelector(".pulso-analitica-sourcebar")).toBeNull();
    expect(host.querySelector(".pulso-panel-de-mesa--ajustes .pond-datos .pulso-analitica-sourcebar")).not.toBeNull();
    expect(host.querySelector(".pulso-panel-de-mesa--ajustes .pulso-universo")).not.toBeNull();
    expect(host.querySelector("#analitica-panel")?.hasAttribute("data-cabecera-propia")).toBe(true);
  });
});

describe("readiness de Frecuencias y Cruces", () => {
  it.each(["frecuencias", "cruces"] as const)("en %s no se da por lista mientras la vista previa se lee; al llegar, sí", async (pestana) => {
    let soltar: () => void = () => undefined;
    if (pestana === "frecuencias") vistaPrevia.frecuencias.mockImplementation(() => new Promise((r) => { soltar = () => r(respuestaReal()); }));
    else vistaPrevia.cruces.mockImplementation(() => new Promise((r) => { soltar = () => r(crucesSinPesos()); }));
    await montar(pestana);
    // La sección ya publicó su marca, pero la carga de la tabla la retiene.
    expect(host.querySelector("#analitica-panel")?.getAttribute("data-audit-ready")).toBe(`analitica-${pestana}`);
    expect(host.textContent).toContain(pestana === "cruces" ? "Leyendo las tablas cruzadas del archivo" : "Leyendo las tablas del archivo");
    expect(listo()).toBe(false);
    await act(async () => { soltar(); });
    await esperar();
    expect(host.textContent).not.toContain("Leyendo las tablas");
    expect(listo()).toBe(true);
  });

  it("con la config de Analítica sin hidratar la vista no está lista", async () => {
    const { useAnaliticaStore } = await import("../store");
    useAnaliticaStore.setState({ hydrated: false });
    await montar("frecuencias");
    expect(host.textContent).toContain("Cargando la configuración de Analítica");
    expect(listo()).toBe(false);
  });
});
