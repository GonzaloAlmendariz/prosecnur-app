// @vitest-environment happy-dom
/**
 * El Editor de formularios entrega por el kit (ADR 0133, fase 5): una prueba por forma.
 *
 * - anclada: "Exportar .xlsx" de la banda (`ExportMenu` real) con el contenedor
 *   bajo el botón y lo que no viaja en el .xlsx al pie;
 * - bloque con job: el impreso en PDF o Word (`EntregaImpreso`), con el avance
 *   del motor, el archivo listo y sus avisos al pie.
 *
 * Sin panel "Procesando", sin panel "XLSForm listo" y sin avisos con
 * "Descargar": lo único que se mueve es la línea del contenedor.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPollUpdate } from "../../../hooks/useJob";
import type { JobSnapshot } from "../../../api/jobs";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  polls: new Map<string, (u: JobPollUpdate<unknown>) => void>(),
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

const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { ExportMenu, NOTA_DEL_XLSX } = await import("../shell/ExportMenu");
const { EntregaImpreso } = await import("./EntregaImpreso");
const { useExportacionImpresa, useExportacionXlsform } = await import("./useExportaciones");
const { avisosDelImpreso } = await import("./modeloEntrega");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
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
  expect(host.querySelectorAll(".pulso-spin")).toHaveLength(0);
}

function snap(parcial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "j", kind: "xlsform_editor.formulario_pdf", status: "running", started_at: "", finished_at: null,
    has_file_result: false, result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

function Banda({ exportar }: { exportar: () => Promise<unknown> }) {
  const xlsx = useExportacionXlsform();
  return (
    <ExportMenu
      includeAppColumns={false}
      onIncludeAppColumnsChange={() => {}}
      onExport={() => { void xlsx.ejecutar(exportar); }}
      onOpenDocument={() => {}}
      disabled={xlsx.enCurso}
      entrega={xlsx}
    />
  );
}

describe("anclada: Exportar .xlsx", () => {
  it("el XLSForm flota bajo el botón con lo que no viaja en el archivo; con guardado_en no se descarga", async () => {
    let resolver: (v: unknown) => void = () => {};
    const exportar = vi.fn(() => new Promise((r) => { resolver = r; }));
    await act(async () => { root.render(<Banda exportar={exportar} />); });
    const exportarBtn = host.querySelector<HTMLButtonElement>(".pulso-xf-export-main");
    await act(async () => { exportarBtn?.click(); });
    expect(exportarBtn?.disabled).toBe(true);
    expect(exportarBtn?.textContent).toBe("Exportar.xlsx");
    const enCurso = contenedor("anclada");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.closest(".pulso-xf-export-split")).not.toBeNull();
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    const guardado = "C:\\Estudios\\HSVG2026\\Entregables\\Formularios\\HSVG2026_XLSForm_10_11_26.xlsx";
    await act(async () => {
      resolver({ ok: true, file_id: "f-x", original_name: "HSVG2026_XLSForm_10_11_26.xlsx", size: 9000, modulo: "Formularios", guardado_en: guardado });
    });
    const lista = contenedor("anclada");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("HSVG2026_XLSForm_10_11_26.xlsx");
    expect(lista?.textContent).toContain("Guardado");
    expect(lista?.textContent).toContain(NOTA_DEL_XLSX);
    expect(espia.descargar).not.toHaveBeenCalled();
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(useBandejaEntregables.getState().entradas[0]?.modulo).toBe("Formularios");
  });

  it("un fallo del export se dice en el contenedor, sin aviso aparte", async () => {
    await act(async () => { root.render(<Banda exportar={() => Promise.reject(new Error("El libro no tiene hoja survey."))} />); });
    await act(async () => { host.querySelector<HTMLButtonElement>(".pulso-xf-export-main")?.click(); });
    const fallo = contenedor("anclada");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo generar el XLSForm");
    expect(fallo?.textContent).not.toContain(NOTA_DEL_XLSX);
  });
});

function Impreso({ generar }: { generar: () => Promise<unknown> }) {
  const impreso = useExportacionImpresa();
  return (
    <>
      <button type="button" disabled={impreso.enCurso} onClick={() => void impreso.exportar("word", generar)}>Exportar Word</button>
      <EntregaImpreso entrega={impreso} />
    </>
  );
}

describe("bloque con job: el impreso", () => {
  it("el avance del motor en el bloque; listo, el Word con los avisos del motor al pie", async () => {
    await act(async () => { root.render(<Impreso generar={async () => ({ ok: true, job_id: "imp-1", kind: "xlsform_editor.formulario_word" })} />); });
    await act(async () => { boton("Exportar Word").click(); });
    expect(boton("Exportar Word").disabled).toBe(true);
    await act(async () => { espia.polls.get("imp-1")?.({ snapshot: snap({ progress: { message: "Dibujando" } }) }); });
    const enCurso = contenedor("bloque");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.textContent).toContain("Cuestionario en Word");
    expect(enCurso?.textContent).toContain("Dibujando");
    expect(enCurso?.closest(".xf-entrega-bloque")).not.toBeNull();

    await act(async () => {
      espia.polls.get("imp-1")?.({ snapshot: snap({ status: "done", result_data: {
        ok: true, file_id: "f-w", original_name: "HSVG2026_Cuestionario_Encuesta_10_11_26.docx", size: 50000,
        warnings: ["La matriz P12 no cabe en una columna."],
      } }) });
    });
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("HSVG2026_Cuestionario_Encuesta_10_11_26.docx");
    expect(lista?.querySelector(".xf-entrega-avisos")?.textContent).toBe("La matriz P12 no cabe en una columna.");
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-w/download", "HSVG2026_Cuestionario_Encuesta_10_11_26.docx");
    sinResaltadoNiSpinner(lista as HTMLElement);
  });

  it("los avisos del motor se leen aunque R mande un escalar", () => {
    expect(avisosDelImpreso({ warnings: " Sólo uno " })).toEqual(["Sólo uno"]);
    expect(avisosDelImpreso({ warnings: ["a", "", 3] })).toEqual(["a"]);
    expect(avisosDelImpreso(null)).toEqual([]);
  });
});
