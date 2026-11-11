// @vitest-environment happy-dom
/**
 * La cabecera de pestaña de Analítica sobre la página real: en las pestañas con
 * vista previa (Frecuencias y Cruces) es la compacta y la línea de casos que
 * cuentan va en su misma fila, de modo que el alto que antes se llevaban la
 * cabecera estándar y la banda de abajo pasa a las tablas. Las demás pestañas
 * conservan la cabecera estándar con la banda debajo.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cabeceraCompacta, PESTANAS_CON_VISTA_PREVIA } from "./cabeceraCompacta";

const nunca = () => new Promise<never>(() => undefined);
const sesion = {
  session_id: "s", xlsform: true, data: true, instrumento_parsed: true, data_previewed: true,
  analitica_prep_ok: true, analitica_fuente: "originales", active_base: "Monitoreo territorial", n_bases: 1,
};

vi.mock("../../../api/analitica", async (original) => ({
  ...(await original<typeof import("../../../api/analitica")>()),
  apiAnaliticaUniverso: async () => [],
  apiAnaliticaVariables: nunca,
  apiAnaliticaFrecuenciasPreview: nunca,
  apiAnaliticaCrucesPreview: nunca,
  apiAnaliticaDataReview: nunca,
  apiAnaliticaPreparar: nunca,
  apiAnaliticaConfigGet: nunca,
}));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { ...sesion }, refresh: async () => undefined }) }));
vi.mock("../useAnaliticaAutosave", () => ({ useAnaliticaAutosave: () => undefined }));
vi.mock("../useReporteRun", () => ({
  useReporteRun: () => ({
    generacion: { estado: { fase: "inactiva" }, cerrar: () => undefined },
    busy: false, lastResult: null, perBase: [], runSync: async () => undefined, runAsync: async () => undefined,
  }),
}));

let host: HTMLDivElement;
let root: Root;

async function montar(pestana: string) {
  const { default: AnaliticaPage } = await import("../AnaliticaPage");
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/analitica?pestana=${pestana}`]}>
        <AnaliticaPage />
      </MemoryRouter>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

const cabecera = () => host.querySelector<HTMLElement>(".pulso-analitica-panel-head");
const tabHeading = () => cabecera()?.querySelector<HTMLElement>(".pulso-tab-heading");

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { useAnaliticaStore, DEFAULT_CONFIG } = await import("../store");
  useAnaliticaStore.setState({ config: DEFAULT_CONFIG, hydrated: true, dirty: false, errorGuardado: null });
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

  it.each(["frecuencias", "cruces"])("en %s es la compacta y lleva los casos que cuentan en su fila", async (pestana) => {
    await montar(pestana);
    expect(tabHeading()?.getAttribute("data-variante")).toBe("compacta");
    // La línea de casos vive dentro de la cabecera, antes del control de la fuente, y no hay banda debajo.
    const universo = tabHeading()?.querySelector(".pulso-universo");
    expect(universo?.textContent).toContain("Cuentan todos los casos");
    expect(cabecera()?.querySelector(":scope > .pulso-analitica-universo-banda")).toBeNull();
    // El nombre de la pestaña sigue siendo el encabezado, y el número de pestaña se sigue leyendo.
    expect(tabHeading()?.querySelector("h2")?.textContent).toBe(pestana === "cruces" ? "Cruces" : "Frecuencias");
    expect(tabHeading()?.textContent).toMatch(/pestaña \d+ de \d+/);
  });

  it("las demás pestañas conservan la cabecera estándar con la banda de casos debajo", async () => {
    await montar("datos");
    expect(tabHeading()?.getAttribute("data-variante")).toBe("estandar");
    expect(cabecera()?.querySelector(":scope > .pulso-analitica-universo-banda .pulso-universo")).not.toBeNull();
    expect(tabHeading()?.querySelector(".pulso-universo")).toBeNull();
  });
});
