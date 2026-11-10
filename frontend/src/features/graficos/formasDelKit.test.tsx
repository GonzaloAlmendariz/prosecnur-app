// @vitest-environment happy-dom
/**
 * Gráficos entrega por el kit (ADR 0133, fase 5): una prueba por forma que usa
 * la oleada 3, sobre componentes reales.
 *
 * - anclada con job: "Archivos por base" del menú "Conjunto"; el menú se cierra,
 *   el disparador sólo se deshabilita y el ZIP cuelga de él con los avisos del
 *   motor al pie;
 * - bloque con archivo del backend: "Exportar plan" del plan portátil, bajo la
 *   cabecera del cuerpo;
 * - bloque local: "Exportar componentes" (JSON armado en el front), fuera de la
 *   fila de acciones que da forma de barra a todo botón.
 *
 * Lo que vigila es lo que pidió Gonzalo: el disparador sólo se deshabilita (sin
 * spinner ni cambio de rótulo), lo único que se mueve es la línea del
 * contenedor, y dentro del contenedor no hay enlaces ni botones primarios.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPollUpdate } from "../../hooks/useJob";
import type { JobSnapshot } from "../../api/jobs";
import type { DepsCompartir } from "./compartir/accionesCompartir";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  refresh: vi.fn(async () => undefined),
  flush: vi.fn(async () => true),
  pptAll: vi.fn(async () => ({ ok: true, job_id: "all-1", kind: "graficos.ppt_all" })),
  polls: new Map<string, (u: JobPollUpdate<unknown>) => void>(),
}));

vi.mock("../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
vi.mock("../../hooks/useJob", () => ({
  iniciarJobPoll: (jobId: string, onUpdate: (u: JobPollUpdate<unknown>) => void) => {
    espia.polls.set(jobId, onUpdate);
    return () => undefined;
  },
}));
vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({
    state: { session_id: "s1", estudio_processing_mode: "independent_siblings", n_bases: 2 },
    refresh: espia.refresh,
  }),
  useOptionalSession: () => null,
}));
vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiGraficosPptAll: espia.pptAll,
  apiGraficosConsolidadoPreflight: vi.fn(async () => ({
    ok: true, schema: "graficos_consolidado/v1", ready: true, blockers: [], releases: [], n_slides: 0, n_comparison_slides: 0,
  })),
}));
vi.mock("./configSnapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./configSnapshot")>()),
  flushGraficosConfigIfHydrated: espia.flush,
}));

const { useBandejaEntregables } = await import("../../components/entregables/bandejaStore");
const { MultibaseReportMenu } = await import("./MultibaseReportMenu");
const { PlanPortatilContenido } = await import("./compartir/PlanPortatilContenido");
const { SeccionesJsonContenido } = await import("./compartir/SeccionesJsonContenido");
const { useCompartirPlan } = await import("./compartir/useCompartirPlan");

let host: HTMLDivElement;
let root: Root;
const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.flush.mockClear();
  espia.pptAll.mockClear();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
  URL.createObjectURL = vi.fn(() => "blob:graficos");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  URL.createObjectURL = original.crear;
  URL.revokeObjectURL = original.revocar;
});

function boton(texto: string): HTMLButtonElement {
  const b = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((x) => x.getAttribute("aria-label") === texto || x.textContent?.trim() === texto);
  if (!b) throw new Error(`Sin botón "${texto}"`);
  return b;
}

function contenedor(forma: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-entregable-forma="${forma}"]`);
}

/** Lo neutro del contenedor: sin enlaces, sin primarios y sin spinner en ninguna parte de la vista. */
function sinResaltadoNiSpinner(el: HTMLElement) {
  expect(el.querySelectorAll("a")).toHaveLength(0);
  expect(el.querySelectorAll(".pulso-button--primary")).toHaveLength(0);
  expect(host.querySelectorAll(".pulso-spin, [class*='spin']")).toHaveLength(0);
}

function snap(parcial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "all-1", kind: "graficos.ppt_all", status: "running", started_at: "", finished_at: null,
    has_file_result: true, result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

describe("anclada con job: Archivos por base", () => {
  it("cierra el menú, guarda antes de lanzar y deja el ZIP colgado del disparador con los avisos al pie", async () => {
    await act(async () => { root.render(<MemoryRouter><MultibaseReportMenu /></MemoryRouter>); });
    const disparador = boton("Entregables del conjunto de bases");
    await act(async () => { disparador.click(); });
    await act(async () => { await Promise.resolve(); });
    const opcion = Array.from(host.querySelectorAll<HTMLButtonElement>(".pulso-multibase-report-option"))
      .find((b) => b.textContent?.includes("Archivos por base"));
    await act(async () => { opcion?.click(); });

    expect(espia.flush).toHaveBeenCalledTimes(1);
    expect(espia.pptAll).toHaveBeenCalledTimes(1);
    expect(host.querySelector(".pulso-multibase-reports-popover")).toBeNull();
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent).toBe("Conjunto");
    let anclada = contenedor("anclada");
    expect(anclada?.dataset.entregableFase).toBe("en_curso");
    expect(anclada?.parentElement?.classList.contains("pulso-multibase-reports")).toBe(true);
    sinResaltadoNiSpinner(anclada as HTMLElement);

    await act(async () => {
      espia.polls.get("all-1")?.({
        snapshot: snap({
          status: "done",
          result_data: {
            ok: true, file_id: "zip-1", filename: "HSVG_Reportes_por_base_10_11_26.zip", size: 9000, n_bases: 2, bases: [],
            guardado_en: "C:\\Estudios\\HSVG\\Entregables\\Procesamiento\\HSVG_Reportes_por_base_10_11_26.zip",
            avisos: ["Lámina 3 de docentes salió en 2 partes"],
          },
        }),
      } as JobPollUpdate<unknown>);
    });
    anclada = contenedor("anclada");
    expect(anclada?.dataset.entregableFase).toBe("lista");
    expect(anclada?.textContent).toContain("HSVG_Reportes_por_base_10_11_26.zip");
    expect(anclada?.textContent).toContain("1 aviso del paquete");
    // Ya quedó junto al proyecto: no se descarga otra copia.
    expect(espia.descargar).not.toHaveBeenCalled();
    expect(disparador.disabled).toBe(false);
    sinResaltadoNiSpinner(anclada as HTMLElement);
  });

  it("si el guardado previo falla, no lanza el paquete y el fallo queda en el contenedor", async () => {
    espia.flush.mockImplementationOnce(async () => { throw new Error("No se pudo guardar el plan"); });
    await act(async () => { root.render(<MemoryRouter><MultibaseReportMenu /></MemoryRouter>); });
    await act(async () => { boton("Entregables del conjunto de bases").click(); });
    const opcion = Array.from(host.querySelectorAll<HTMLButtonElement>(".pulso-multibase-report-option"))
      .find((b) => b.textContent?.includes("Archivos por base"));
    await act(async () => { opcion?.click(); });
    expect(espia.pptAll).not.toHaveBeenCalled();
    const anclada = contenedor("anclada");
    expect(anclada?.dataset.entregableFase).toBe("fallo");
    expect(anclada?.textContent).toContain("No se pudieron generar los archivos por base");
    expect(anclada?.textContent).toContain("No se pudo guardar el plan");
  });
});

function deps(over: Partial<DepsCompartir> = {}): DepsCompartir {
  return {
    configExport: vi.fn(async () => ({ config: { plan: { slides: [] } } })),
    configImport: vi.fn(async () => ({})),
    configGet: vi.fn(async () => ({ config: { plan: { slides: [] } } })),
    shareExport: vi.fn(async () => ({ file_id: "pkg-1", filename: "HSVG_Plan_de_graficos_10_11_26.pulso-graficos.zip" })),
    shareInspect: vi.fn(),
    shareImport: vi.fn(async () => ({})),
    getSession: () => "s1",
    hydrate: vi.fn(),
    ahora: () => new Date(2026, 10, 10),
    ...over,
  };
}

function Compartir({ d, cuerpo }: { d: DepsCompartir; cuerpo: "plan" | "json" }) {
  const control = useCompartirPlan("active", d);
  return cuerpo === "plan" ? <PlanPortatilContenido control={control} /> : <SeccionesJsonContenido control={control} />;
}

describe("bloque: compartir el plan", () => {
  it("Exportar plan: el paquete del backend en el contenedor bajo la cabecera, sin spinner en el botón", async () => {
    let soltar: (v: { file_id: string; filename: string }) => void = () => undefined;
    const d = deps({ shareExport: vi.fn(() => new Promise<{ file_id: string; filename: string }>((res) => { soltar = res; })) });
    await act(async () => { root.render(<Compartir d={d} cuerpo="plan" />); });
    const exportar = boton("Exportar plan");
    await act(async () => { exportar.click(); });
    expect(exportar.disabled).toBe(true);
    expect(exportar.textContent?.trim()).toBe("Exportar plan");
    let bloque = contenedor("bloque");
    expect(bloque?.dataset.entregableFase).toBe("en_curso");
    expect(bloque?.parentElement?.className).toBe("pulso-gv2-share-entrega");
    sinResaltadoNiSpinner(bloque as HTMLElement);

    await act(async () => { soltar({ file_id: "pkg-1", filename: "HSVG_Plan_de_graficos_10_11_26.pulso-graficos.zip" }); });
    bloque = contenedor("bloque");
    expect(bloque?.dataset.entregableFase).toBe("lista");
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/pkg-1/download", "HSVG_Plan_de_graficos_10_11_26.pulso-graficos.zip");
    sinResaltadoNiSpinner(bloque as HTMLElement);
  });

  it("Exportar componentes: el JSON armado en el front, fuera de la fila de acciones", async () => {
    await act(async () => { root.render(<Compartir d={deps()} cuerpo="json" />); });
    await act(async () => { boton("Exportar componentes").click(); });
    const bloque = contenedor("bloque");
    expect(bloque?.dataset.entregableFase).toBe("lista");
    expect(bloque?.closest(".pulso-gv2-share-advanced-actions")).toBeNull();
    expect(bloque?.textContent).toMatch(/pulso_graficos_completo_\d+\.json/);
    expect(espia.descargar).toHaveBeenCalledWith("blob:graficos", expect.stringMatching(/^pulso_graficos_completo_\d+\.json$/));
    sinResaltadoNiSpinner(bloque as HTMLElement);
  });
});
