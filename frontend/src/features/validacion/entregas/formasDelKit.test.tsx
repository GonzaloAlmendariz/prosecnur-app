// @vitest-environment happy-dom
/**
 * Validación entrega por el kit (ADR 0133, fase 5). Usa una sola forma, el
 * bloque, en tres variantes:
 *
 * - síncrono: el plan de limpieza en Excel (Paso 1 de Instrumento);
 * - job sin `file_id`: el paquete metodológico, que el motor todavía no
 *   registra; el ZIP se baja del resultado del job como archivo local;
 * - varios archivos: "Cerrar y generar base", con la base limpia, la revisión y
 *   las decisiones de limpieza en un solo contenedor.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPollUpdate } from "../../../hooks/useJob";
import type { JobSnapshot } from "../../../api/jobs";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  polls: new Map<string, (u: JobPollUpdate<unknown>) => void>(),
  plan: vi.fn(),
  paquete: vi.fn(),
  zip: vi.fn(),
  cerrar: vi.fn(),
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
vi.mock("../../../api/validacion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/validacion")>()),
  apiV2InstrumentoExportPlan: espia.plan,
  apiV2MethodologyReportBundle: espia.paquete,
  apiV2MethodologyBundleArchivo: espia.zip,
  apiV2LimpiezaFinalize: espia.cerrar,
}));

const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { ContenedorEntregable } = await import("../../../components/entregables/ContenedorEntregable");
const { useEntregasInstrumento } = await import("./useEntregasInstrumento");
const { useCierreLimpieza } = await import("./useCierreLimpieza");

let host: HTMLDivElement;
let root: Root;
const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  for (const f of [espia.descargar, espia.plan, espia.paquete, espia.zip, espia.cerrar]) f.mockReset();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
  URL.createObjectURL = vi.fn(() => "blob:validacion");
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

function bloques(): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('[data-entregable-forma="bloque"]'));
}

function sinResaltadoNiSpinner(el: HTMLElement) {
  expect(el.querySelectorAll("a")).toHaveLength(0);
  expect(el.querySelectorAll(".pulso-button--primary")).toHaveLength(0);
  expect(host.querySelectorAll(".pulso-spin")).toHaveLength(0);
}

function snap(parcial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "j", kind: "validacion.v2.methodology_report_bundle", status: "running", started_at: "", finished_at: null,
    has_file_result: true, result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

function PasoPlan() {
  const { plan, paquete, exportarPlan, generarPaquete } = useEntregasInstrumento("base_a");
  const ocupado = plan.enCurso || paquete.enCurso;
  return (
    <>
      <button type="button" disabled={ocupado} onClick={() => void exportarPlan()}>Exportar a Excel</button>
      <button type="button" disabled={ocupado} onClick={() => void generarPaquete()}>Paquete metodológico PDF + R</button>
      <ContenedorEntregable estado={plan.estado} forma="bloque" onCerrar={plan.cerrar} />
      <ContenedorEntregable estado={paquete.estado} forma="bloque" onCerrar={paquete.cerrar} />
    </>
  );
}

describe("bloque: el Paso 1 de Instrumento", () => {
  it("el plan sale con el nombre del motor en un clic, sin el enlace Descargar", async () => {
    espia.plan.mockResolvedValueOnce({ ok: true, file_id: "f-plan", size: 5000, original_name: "HSVG2026_Plan_de_limpieza_10_11_26.xlsx" });
    await act(async () => { root.render(<PasoPlan />); });
    await act(async () => { boton("Exportar a Excel").click(); });
    expect(espia.plan).toHaveBeenCalledWith("base_a");
    const [lista] = bloques();
    expect(lista.dataset.entregableFase).toBe("lista");
    expect(lista.textContent).toContain("HSVG2026_Plan_de_limpieza_10_11_26.xlsx");
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-plan/download", "HSVG2026_Plan_de_limpieza_10_11_26.xlsx");
    sinResaltadoNiSpinner(lista);
  });

  it("el paquete espera su job y baja el ZIP del resultado con el nombre de la cabecera; los botones sólo se deshabilitan", async () => {
    espia.paquete.mockResolvedValueOnce({ ok: true, job_id: "met-1", kind: "validacion.v2.methodology_report_bundle" });
    espia.zip.mockResolvedValueOnce({ blob: new Blob(["zip"]), disposicion: 'attachment; filename="HSVG2026_Metodologia_de_validacion_10_11_26.zip"' });
    await act(async () => { root.render(<PasoPlan />); });
    await act(async () => { boton("Paquete metodológico PDF + R").click(); });
    expect(boton("Exportar a Excel").disabled).toBe(true);
    expect(boton("Paquete metodológico PDF + R").textContent?.trim()).toBe("Paquete metodológico PDF + R");
    const [enCurso] = bloques();
    expect(enCurso.dataset.entregableFase).toBe("en_curso");
    sinResaltadoNiSpinner(enCurso);

    await act(async () => {
      espia.polls.get("met-1")?.({ snapshot: snap({ status: "done", result_data: { ok: true, size: 3, filename: "x.zip", entries: ["a.pdf", "b.R"] } }) });
    });
    expect(espia.zip).toHaveBeenCalledWith("met-1");
    const [lista] = bloques();
    expect(lista.dataset.entregableFase).toBe("lista");
    expect(lista.textContent).toContain("HSVG2026_Metodologia_de_validacion_10_11_26.zip");
    expect(espia.descargar).toHaveBeenCalledWith("blob:validacion", "HSVG2026_Metodologia_de_validacion_10_11_26.zip");
    expect(useBandejaEntregables.getState().entradas[0]?.modulo).toBe("Procesamiento");
  });

  it("si el resultado del job ya trae su archivo, se usa ése y no se baja el ZIP aparte", async () => {
    espia.paquete.mockResolvedValueOnce({ ok: true, job_id: "met-2" });
    await act(async () => { root.render(<PasoPlan />); });
    await act(async () => { boton("Paquete metodológico PDF + R").click(); });
    await act(async () => {
      espia.polls.get("met-2")?.({ snapshot: snap({ status: "done", result_data: { ok: true, file_id: "f-zip", filename: "HSVG2026_Metodologia.zip", size: 10 } }) });
    });
    expect(espia.zip).not.toHaveBeenCalled();
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-zip/download", "HSVG2026_Metodologia.zip");
  });
});

function Cierre() {
  const cierre = useCierreLimpieza("base_a");
  return (
    <>
      <button type="button" disabled={cierre.cerrando} onClick={() => void cierre.finalizar()}>Cerrar y generar base</button>
      <ContenedorEntregable estado={cierre.estado} forma="bloque" onCerrar={cierre.cerrar} />
    </>
  );
}

describe("bloque con varios archivos: Cerrar y generar base", () => {
  it("los tres archivos del cierre en un contenedor, sin descarga automática; cada uno se baja por el kit", async () => {
    let resolver: (v: unknown) => void = () => {};
    espia.cerrar.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    await act(async () => { root.render(<Cierre />); });
    await act(async () => { boton("Cerrar y generar base").click(); });
    expect(boton("Cerrar y generar base").disabled).toBe(true);
    expect(bloques()[0].dataset.entregableFase).toBe("en_curso");
    sinResaltadoNiSpinner(bloques()[0]);

    await act(async () => {
      resolver({ ok: true, summary: {}, before_after_preview: null, artifacts: { finalized_at: "2026-11-10T10:00:00Z", files: [
        { kind: "base_limpia", label: "Base final limpia", file_id: "f1", filename: "HSVG2026_Base_limpia_10_11_26.xlsx", original_name: "HSVG2026_Base_limpia_10_11_26.xlsx", size: 100, generated_at: "" },
        { kind: "reporte_html", label: "Reporte HTML ejecutivo", file_id: "f2", filename: "HSVG2026_Revision_de_limpieza_10_11_26.html", original_name: "x", size: 200, generated_at: "" },
        { kind: "excel_detalle", label: "Excel detalle de decisiones", file_id: "f3", filename: "HSVG2026_Decisiones_de_limpieza_10_11_26.xlsx", original_name: "y", size: 300, generated_at: "" },
      ] } });
    });
    const [lista] = bloques();
    expect(lista.dataset.entregableFase).toBe("lista");
    expect(lista.querySelectorAll("li")).toHaveLength(3);
    expect(lista.querySelector("ul")?.getAttribute("data-qa-geometry-contract")).toBe("equal");
    expect(lista.textContent).toContain("HSVG2026_Base_limpia_10_11_26.xlsx");
    expect(lista.textContent).toContain("HSVG2026_Decisiones_de_limpieza_10_11_26.xlsx");
    expect(espia.descargar).not.toHaveBeenCalled();
    sinResaltadoNiSpinner(lista);
    await act(async () => { boton("Descargar").click(); });
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f1/download", "HSVG2026_Base_limpia_10_11_26.xlsx");
    expect(useBandejaEntregables.getState().entradas[0]?.estado.fase).toBe("lista");
  });

  it("un cierre que falla se dice en el contenedor, con Reintentar", async () => {
    espia.cerrar.mockRejectedValueOnce(new Error("Quedan casos sin decisión."));
    await act(async () => { root.render(<Cierre />); });
    await act(async () => { boton("Cerrar y generar base").click(); });
    const [fallo] = bloques();
    expect(fallo.dataset.entregableFase).toBe("fallo");
    expect(fallo.textContent).toContain("No se pudo generar la base limpia");
    expect(fallo.textContent).toContain("Quedan casos sin decisión.");
    expect(boton("Reintentar")).toBeTruthy();
  });
});
