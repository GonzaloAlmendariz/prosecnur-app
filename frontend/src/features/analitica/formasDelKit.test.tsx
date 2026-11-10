// @vitest-environment happy-dom
/**
 * Analítica entrega por el kit (ADR 0133, fase 5): una prueba por forma que usa
 * la oleada 3, sobre componentes reales.
 *
 * - anclada: "Guardar plantilla" del menú "Plantilla" (JSON armado en el front),
 *   colgada de la barra de fuente;
 * - bloque con job: los comparativos (pie de panel), con avance, el fallo con su
 *   código y su acción, y el libro listo con el manifiesto al pie.
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
import type { EquivalenciaFila, EquivalenciasEstado } from "../../api/equivalencias";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  refresh: vi.fn(async () => undefined),
  configExport: vi.fn(async () => ({ ok: true, version: "analitica/1", config: { secciones: [] } })),
  frecuencias: vi.fn(async () => ({ ok: true, job_id: "cmp-1", kind: "analitica.armonizada" })),
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
  useSession: () => ({ state: { analitica_fuente: "originales", active_base: null }, refresh: espia.refresh }),
  useOptionalSession: () => null,
}));
vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiAnaliticaConfigExport: espia.configExport,
  apiAnaliticaVariables: vi.fn(async () => ({ grain: null })),
}));
vi.mock("../../api/analitica", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/analitica")>()),
  apiAnaliticaComparativoFrecuencias: espia.frecuencias,
}));
vi.mock("../../api/ponderacionBases", () => ({ getPonderacionBases: vi.fn(async () => { throw new Error("sin lectura"); }) }));

const armon = {
  escala: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }],
  por_base: { hsvg2024: { comparable: true, mapa: {} }, hsvg2025: { comparable: true, mapa: {} } },
};
const VARS = { hsvg2024: "p1_24", hsvg2025: "p1_25" };
function fila(parcial: Partial<EquivalenciaFila>): EquivalenciaFila {
  return { seccion: "", etiqueta_estandar: "", variables: VARS, cantidad: 2, ...parcial };
}
const EQUIVALENCIAS: EquivalenciasEstado = {
  ok: true,
  disponible: true,
  declarada: true,
  n_filas: 1,
  bases: ["hsvg2024", "hsvg2025"],
  cobertura: {},
  desfasadas: [],
  filas: [fila({ id: "p1", etiqueta_estandar: "Acoso", seccion: "Clima", armonizacion: armon })],
} as EquivalenciasEstado;

vi.mock("../../api/equivalencias", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/equivalencias")>()),
  getEquivalencias: vi.fn(async () => EQUIVALENCIAS),
}));

const { useBandejaEntregables } = await import("../../components/entregables/bandejaStore");
const { AnaliticaHeader } = await import("./AnaliticaHeader");
const { ComparativosPane } = await import("./panes/ComparativosPane");
const { fechaDelNombre } = await import("../../components/entregables/archivoLocal");

let host: HTMLDivElement;
let root: Root;
const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.frecuencias.mockClear();
  espia.configExport.mockClear();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
  URL.createObjectURL = vi.fn(() => "blob:analitica");
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
    id: "cmp-1", kind: "analitica.armonizada", status: "running", started_at: "", finished_at: null,
    has_file_result: true, result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

describe("anclada: Guardar plantilla", () => {
  it("el menú se cierra, el disparador conserva su rótulo y el JSON cuelga de la barra, fuera de sus acciones", async () => {
    await act(async () => {
      root.render(<MemoryRouter><AnaliticaHeader prepBusy={false} prepError="" variant="panel" /></MemoryRouter>);
    });
    const disparador = host.querySelector<HTMLButtonElement>(".pulso-analitica-template-trigger");
    expect(disparador?.textContent).toBe("Plantilla");
    await act(async () => { disparador?.click(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[role='menuitem']")?.click(); });

    expect(host.querySelector(".pulso-analitica-template-popover")).toBeNull();
    expect(espia.configExport).toHaveBeenCalledTimes(1);
    const anclada = contenedor("anclada");
    expect(anclada?.dataset.entregableFase).toBe("lista");
    // Fuera de `.pulso-analitica-source-actions`, cuyas reglas vuelven píldora todo botón.
    expect(anclada?.closest(".pulso-analitica-source-actions")).toBeNull();
    expect(anclada?.parentElement?.classList.contains("pulso-analitica-sourcebar")).toBe(true);
    const nombre = `prosecnur_analitica_${fechaDelNombre()}.json`;
    expect(anclada?.textContent).toContain(nombre);
    expect(espia.descargar).toHaveBeenCalledWith("blob:analitica", nombre);
    expect(disparador?.textContent).toBe("Plantilla");
    sinResaltadoNiSpinner(anclada as HTMLElement);
  });
});

describe("bloque con job: los comparativos", () => {
  async function montar() {
    await act(async () => { root.render(<MemoryRouter><ComparativosPane /></MemoryRouter>); });
    // La matriz y la ponderación se leen al montar.
    await act(async () => { await Promise.resolve(); });
  }

  it("en curso: los botones sólo se deshabilitan; listo: el libro sin enlaces y el manifiesto al pie", async () => {
    await montar();
    const generar = boton("Generar comparativo simple");
    await act(async () => { generar.click(); });

    expect(espia.frecuencias).toHaveBeenCalledTimes(1);
    expect(generar.disabled).toBe(true);
    expect(generar.textContent).toBe("Generar comparativo simple");
    expect(boton("Generar comparativo de cruces").disabled).toBe(true);
    let bloque = contenedor("bloque");
    expect(bloque?.dataset.entregableFase).toBe("en_curso");
    expect(bloque?.textContent).toContain("Comparativo simple");
    sinResaltadoNiSpinner(bloque as HTMLElement);

    await act(async () => {
      espia.polls.get("cmp-1")?.({ snapshot: snap({ status: "running", progress: { percent: 40, message: "Tabulando" } }) } as JobPollUpdate<unknown>);
    });
    expect(contenedor("bloque")?.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("40");

    await act(async () => {
      espia.polls.get("cmp-1")?.({
        snapshot: snap({
          status: "done",
          result_data: {
            ok: true, file_id: "f-cmp", filename: "HSVG_Comparativo_de_frecuencias_10_11_26.xlsx", size: 4096,
            artifacts: [
              { file_id: "f-cmp", filename: "HSVG_Comparativo_de_frecuencias_10_11_26.xlsx", role: "deliverable" },
              { file_id: "f-man", filename: "HSVG_Comparativo_de_frecuencias_manifiesto_10_11_26.json", role: "manifest" },
            ],
            periodos: [{ base: "hsvg2024", rotulo: "2024" }, { base: "hsvg2025", rotulo: "2025" }],
            resumen: { n_preguntas: 1, preguntas: [{ titulo: "Acoso" }], avisos: [] },
          },
        }),
      } as JobPollUpdate<unknown>);
    });
    bloque = contenedor("bloque");
    expect(bloque?.dataset.entregableFase).toBe("lista");
    expect(bloque?.textContent).toContain("HSVG_Comparativo_de_frecuencias_10_11_26.xlsx");
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-cmp/download", "HSVG_Comparativo_de_frecuencias_10_11_26.xlsx");
    expect(boton("Manifiesto").closest("[data-entregable-forma='bloque']")).toBe(bloque);
    sinResaltadoNiSpinner(bloque as HTMLElement);
    // El resumen sigue en su panel, ya sin la pastilla de descarga.
    expect(host.querySelector(".pulso-comparativos-resultado")).not.toBeNull();
    expect(host.querySelector(".analitica-download-pill")).toBeNull();
    expect(generar.disabled).toBe(false);
  });

  it("fallo: la causa sin el código pegado, el código aparte y la acción que lo resuelve al pie", async () => {
    await montar();
    await act(async () => { boton("Generar comparativo simple").click(); });
    await act(async () => {
      espia.polls.get("cmp-1")?.({
        snapshot: snap({ status: "error", error: "La base 2025 no declara peso · E_ARMONIZADA_PESO_NO_DECLARADO" }),
      } as JobPollUpdate<unknown>);
    });
    const bloque = contenedor("bloque");
    expect(bloque?.dataset.entregableFase).toBe("fallo");
    expect(bloque?.textContent).toContain("No se pudo generar el comparativo simple");
    expect(bloque?.textContent).toContain("La base 2025 no declara peso");
    expect(bloque?.querySelector(".pulso-entregable-codigo")?.textContent).toBe("E_ARMONIZADA_PESO_NO_DECLARADO");
    expect(boton("Ir a Ponderación").closest("[data-entregable-forma='bloque']")).toBe(bloque);
    expect(host.querySelector(".pulso-comparativos-error")).toBeNull();
    sinResaltadoNiSpinner(bloque as HTMLElement);
  });
});
