// @vitest-environment happy-dom
/**
 * Codificación entrega por el kit (ADR 0133, fase 5): una prueba por forma.
 *
 * - anclada: la barra de Matrices (`useEntregasMatrices` con el contenedor
 *   anclado), con una matriz del motor y el respaldo JSON armado en el front;
 * - bloque con job: "Aplicar a la base", seguido fuera de React,
 *   con los dos archivos en un solo contenedor y sin el panel "Resultado".
 *
 * Vigila lo que pidió Gonzalo: el disparador sólo se deshabilita, lo único que
 * se mueve es la línea del contenedor y dentro no hay enlaces ni primarios.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPollUpdate } from "../../../hooks/useJob";
import type { JobSnapshot } from "../../../api/jobs";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  cancelar: vi.fn(async () => ({ ok: true })),
  polls: new Map<string, (u: JobPollUpdate<unknown>) => void>(),
  matriz: vi.fn(),
  respaldo: vi.fn(),
}));

vi.mock("../../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../../hooks/useJob", () => ({
  iniciarJobPoll: (jobId: string, onUpdate: (u: JobPollUpdate<unknown>) => void) => {
    espia.polls.set(jobId, onUpdate);
    return () => undefined;
  },
}));
vi.mock("../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
vi.mock("../../../api/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/jobs")>()),
  apiJobCancel: espia.cancelar,
}));
vi.mock("../../../api/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/dashboard")>()),
  apiCodifMatricesExport: espia.matriz,
  apiCodifExportJson: espia.respaldo,
}));

const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { ContenedorEntregable } = await import("../../../components/entregables/ContenedorEntregable");
const { useEntregasMatrices } = await import("./useEntregasMatrices");
const { AdaptarAplicacionVista } = await import("../AdaptarAplicacion");
const { claveAplicar, selectAplicarEntrada, useAplicarAvisosStore } = await import("../aplicarAvisosStore");
const { seguirAdaptacion, cancelarAdaptacion, olvidarAdaptacionesSeguidas } = await import("./seguirAdaptacion");

let host: HTMLDivElement;
let root: Root;
const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.cancelar.mockClear();
  espia.matriz.mockReset();
  espia.respaldo.mockReset();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
  useAplicarAvisosStore.getState().reset();
  olvidarAdaptacionesSeguidas();
  URL.createObjectURL = vi.fn(() => "blob:codificacion");
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

function sinResaltadoNiSpinner(el: HTMLElement) {
  expect(el.querySelectorAll("a")).toHaveLength(0);
  expect(el.querySelectorAll(".pulso-button--primary")).toHaveLength(0);
  expect(host.querySelectorAll(".pulso-spin, [class*='giro']")).toHaveLength(0);
}

function snap(parcial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "j", kind: "codificacion.aplicar", status: "running", started_at: "", finished_at: null,
    has_file_result: false, result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

/** La barra de Matrices reducida a lo que prueba la forma: disparadores y el contenedor anclado. */
function BarraMatrices() {
  const entregas = useEntregasMatrices();
  return (
    <div className="pulso-codificacion-matrix-commandbar" style={{ position: "relative" }}>
      <button type="button" disabled={entregas.enCurso} onClick={() => void entregas.matriz("client", ["P1"], "base")}>Matriz para el cliente</button>
      <button type="button" disabled={entregas.enCurso} onClick={() => void entregas.respaldo()}>Respaldo JSON</button>
      <ContenedorEntregable estado={entregas.estado} forma="anclada" onCerrar={entregas.cerrar} />
    </div>
  );
}

describe("anclada: la barra de Matrices", () => {
  it("la matriz del motor flota bajo la barra; el botón sólo se deshabilita y el nombre de respaldo llega si el motor no lo manda", async () => {
    let resolver: (v: unknown) => void = () => {};
    espia.matriz.mockImplementation(() => new Promise((r) => { resolver = r; }));
    await act(async () => { root.render(<BarraMatrices />); });
    await act(async () => { boton("Matriz para el cliente").click(); });

    expect(espia.matriz).toHaveBeenCalledWith("client", ["P1"], "base");
    expect(boton("Matriz para el cliente").disabled).toBe(true);
    expect(boton("Matriz para el cliente").textContent?.trim()).toBe("Matriz para el cliente");
    const enCurso = contenedor("anclada");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.textContent).toContain("Matriz para el cliente");
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    await act(async () => { resolver({ ok: true, file_id: "f-cli", size: 2048, visibility: "client" }); });
    const lista = contenedor("anclada");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("Matriz_de_codificacion_para_el_cliente.xlsx");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-cli/download", "Matriz_de_codificacion_para_el_cliente.xlsx");
    expect(useBandejaEntregables.getState().entradas[0]?.modulo).toBe("Procesamiento");
  });

  it("el respaldo JSON se arma en el front y queda Descargado; un fallo dice qué no se generó, con Reintentar", async () => {
    espia.respaldo.mockResolvedValueOnce({ ok: true, suggested_filename: "HSVG2026_codificacion.json", variables: [] });
    await act(async () => { root.render(<BarraMatrices />); });
    await act(async () => { boton("Respaldo JSON").click(); });
    const lista = contenedor("anclada");
    expect(lista?.textContent).toContain("HSVG2026_codificacion.json");
    expect(lista?.textContent).toContain("Descargado");
    expect(espia.descargar).toHaveBeenCalledWith("blob:codificacion", "HSVG2026_codificacion.json");

    espia.respaldo.mockRejectedValueOnce(new Error("El backend no respondió."));
    await act(async () => { boton("Respaldo JSON").click(); });
    const fallo = contenedor("anclada");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo generar el respaldo de codificación");
    expect(boton("Reintentar")).toBeTruthy();
  });
});

describe("bloque con job: Aplicar a la base", () => {
  const A = claveAplicar("sid-1", "base_a");
  const nada = () => {};
  function Vista() {
    const entrada = useAplicarAvisosStore(selectAplicarEntrada(A));
    return (
      <AdaptarAplicacionVista
        entrada={entrada} nPreguntas={2} onBackToCodificar={nada} onBackToMatrices={nada} onAdaptar={nada}
        onCancelar={entrada.jobId ? () => cancelarAdaptacion(entrada.jobId as string) : undefined}
        onCerrarEntrega={() => useAplicarAvisosStore.getState().cerrarEntrega(A)} onEnfocado={nada}
      />
    );
  }

  it("el avance real va al contenedor con Cancelar; al terminar, los dos archivos con su nombre en un solo bloque, sin descarga automática", async () => {
    const store = useAplicarAvisosStore.getState();
    store.iniciar(A);
    store.recibir(A, { ok: true, job_id: "adp-1", kind: "codificacion.aplicar", omitidas: [], textos_sin_codigo: [], avisos_incompletos: [] });
    const alTerminar = vi.fn();
    await act(async () => { root.render(<Vista />); });
    seguirAdaptacion(A, "adp-1", alTerminar);
    seguirAdaptacion(A, "adp-1", alTerminar); // un segundo montaje no sigue el job dos veces

    await act(async () => { espia.polls.get("adp-1")?.({ snapshot: snap({ progress: { percent: 35, message: "Adaptando base de datos..." } }) }); });
    const disparador = host.querySelector<HTMLButtonElement>('[data-testid="codificacion-adaptar-boton"]');
    expect(disparador?.disabled).toBe(true);
    expect(disparador?.textContent?.trim()).toBe("Aplicar a la base");
    const enCurso = contenedor("bloque");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.textContent).toContain("Adaptando base de datos");
    expect(enCurso?.querySelector(".pulso-barra-avance")).not.toBeNull();
    sinResaltadoNiSpinner(enCurso as HTMLElement);
    await act(async () => { boton("Cancelar").click(); });
    expect(espia.cancelar).toHaveBeenCalledWith("adp-1");

    await act(async () => {
      espia.polls.get("adp-1")?.({ snapshot: snap({ status: "done", result_data: {
        ok: true,
        data_adaptada: { file_id: "f-data", size: 4096, filename: "HSVG2026_Data_adaptada_10_11_26.xlsx" },
        instrumento_adaptado: { file_id: "f-inst", size: 2048, filename: "HSVG2026_Instrumento_adaptado_10_11_26.xlsx" },
      } }) });
    });
    expect(alTerminar).toHaveBeenCalledTimes(1);
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.querySelectorAll("li")).toHaveLength(2);
    expect(lista?.textContent).toContain("HSVG2026_Data_adaptada_10_11_26.xlsx");
    expect(lista?.textContent).toContain("HSVG2026_Instrumento_adaptado_10_11_26.xlsx");
    expect(host.textContent).not.toContain("Archivos adaptados listos para descargar");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).not.toHaveBeenCalled();
    await act(async () => { boton("Descargar").click(); });
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-data/download", "HSVG2026_Data_adaptada_10_11_26.xlsx");
    expect(useBandejaEntregables.getState().entradas[0]?.estado.fase).toBe("lista");

    await act(async () => { boton("Cerrar").click(); });
    expect(contenedor("bloque")).toBeNull();
  });

  it("un job que muere se dice en el mismo contenedor, sin Alert aparte", async () => {
    const store = useAplicarAvisosStore.getState();
    store.iniciar(A);
    store.recibir(A, { ok: true, job_id: "adp-2", kind: "codificacion.aplicar", omitidas: [], textos_sin_codigo: [], avisos_incompletos: [] });
    await act(async () => { root.render(<Vista />); });
    seguirAdaptacion(A, "adp-2", () => {});
    await act(async () => { espia.polls.get("adp-2")?.({ snapshot: snap({ status: "error", error: "El worker se cerró." }) }); });
    const fallo = contenedor("bloque");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo aplicar la codificación");
    // El texto del motor no llega crudo: la causa va en castellano y dice que la base no cambió.
    expect(fallo?.textContent).not.toContain("El worker se cerró.");
    expect(fallo?.textContent).toContain("La base no cambió.");
    expect(host.querySelectorAll("[role='alert']")).toHaveLength(1);
  });
});
