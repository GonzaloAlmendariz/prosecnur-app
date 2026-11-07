// @vitest-environment happy-dom
/**
 * ADR 0133: el informe que el backend ya copió a `Entregables/<Módulo>` no
 * abre el diálogo de guardado al aparecer (lo duplicaría); el menú dice en qué
 * carpeta quedó. Sin `guardado_en`, el diálogo se abre como antes.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProsecnurApi } from "../project/types";
import type { EntregableGuardado } from "../../api/client";
import type { ExportarInformeMenuProps } from "./ExportarInformeMenu";

const PROYECTO = "/Users/ana/Estudios/HSVG2026/HSVG2026.pulso";

const espia = vi.hoisted(() => ({
  saveFileAs: vi.fn(async (_fileId: string, path: string) => ({ ok: true as const, path, filename: path.split("/").pop() ?? path, size: 1 })),
}));

vi.mock("../project/ProjectShell", () => ({
  useProjectShell: () => ({ project: { status: { path: PROYECTO } } }),
}));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiSaveFileAs: espia.saveFileAs,
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));

vi.mock("./estilo/ColoresPendientesAviso", () => ({
  ColoresPendientesAviso: () => null,
  ID_COLORES_PENDIENTES: "colores-pendientes",
  useColoresPendientes: () => ({ pendientes: [], completar: () => undefined }),
}));

const { ExportarInformeMenu } = await import("./ExportarInformeMenu");
const { normalizeEntregableGuardado } = await import("../../api/client");

let host: HTMLDivElement;
let root: Root;
let dialogo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  dialogo = vi.fn(async () => "/Users/ana/Estudios/HSVG2026/reporte.pptx");
  window.prosecnurApi = { saveEntregableDialog: dialogo } as unknown as ProsecnurApi;
  espia.saveFileAs.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  delete window.prosecnurApi;
});

function guardado(parcial: Partial<EntregableGuardado>): EntregableGuardado {
  return { guardadoEn: null, avisoGuardado: null, modulo: null, rotulo: null, ...parcial };
}

async function montar(props: Partial<ExportarInformeMenuProps>) {
  const base: ExportarInformeMenuProps = {
    onExportPpt: vi.fn(),
    onExportWord: vi.fn(),
    pptFileId: null,
    docxFileId: null,
    pptFilename: null,
    docxFilename: null,
    exportBusy: false,
    exportJobKind: null,
    canExportFinal: true,
    isSharedReport: false,
    prepBlocked: false,
  };
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ExportarInformeMenu {...base} {...props} />
      </MemoryRouter>,
    );
  });
}

async function abrirMenu() {
  const boton = host.querySelector<HTMLButtonElement>(".pulso-gv2-export-menu-trigger");
  expect(boton).not.toBeNull();
  await act(async () => { boton?.click(); });
}

describe("ExportarInformeMenu con la copia junto al proyecto (ADR 0133)", () => {
  it("con guardado_en no abre el diálogo y el menú dice la carpeta", async () => {
    await montar({
      pptFileId: "ppt-guardado",
      pptFilename: "HSVG2026_Reporte_07_11_26.pptx",
      pptGuardado: guardado({ guardadoEn: "/Users/ana/Estudios/HSVG2026/Entregables/Dashboard/HSVG2026_Reporte_07_11_26.pptx" }),
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(espia.saveFileAs).not.toHaveBeenCalled();
    await abrirMenu();
    const archivos = host.querySelector(".pulso-gv2-export-menu-files");
    expect(archivos?.textContent).toMatch(/Guardado en Entregables[\\/]Dashboard/);
    expect(archivos?.textContent).not.toContain("Guardado como");
  });

  it("PPT de Gráficos: el result_data de graficos.ppt llega con su file_id y no abre el diálogo", async () => {
    // Lo que hace GraficosPage.onExportDone: fija file_id y la copia en el mismo lote.
    const resultData = {
      ok: true, file_id: "ppt-job", filename: "HSVG2026_Reporte_de_graficos_07_11_26.pptx", size: 99, avisos: [],
      modulo: "Procesamiento", rotulo: "Reporte de gráficos",
      guardado_en: "/Users/ana/Estudios/HSVG2026/Entregables/Procesamiento/HSVG2026_Reporte_de_graficos_07_11_26.pptx",
      aviso_guardado: null,
    };
    await montar({ exportBusy: true, exportJobKind: "ppt" });
    await montar({ pptFileId: resultData.file_id, pptFilename: resultData.filename, pptGuardado: normalizeEntregableGuardado(resultData) });
    expect(dialogo).not.toHaveBeenCalled();
    await abrirMenu();
    expect(host.querySelector(".pulso-gv2-export-menu-files")?.textContent).toMatch(/Guardado en Entregables[\\/]Procesamiento/);
  });

  it("el PPT y el Word copiados a la misma carpeta la dicen una vez", async () => {
    await montar({
      pptFileId: "ppt-par",
      docxFileId: "docx-par",
      pptGuardado: guardado({ guardadoEn: "/Users/ana/Estudios/HSVG2026/Entregables/Dashboard/a.pptx" }),
      docxGuardado: guardado({ guardadoEn: "/Users/ana/Estudios/HSVG2026/Entregables/Dashboard/a.docx" }),
    });
    expect(dialogo).not.toHaveBeenCalled();
    await abrirMenu();
    const textos = host.querySelector(".pulso-gv2-export-menu-files")?.textContent ?? "";
    expect(textos.match(/Guardado en/g)).toHaveLength(1);
  });

  it("sin guardado_en abre el diálogo como hoy", async () => {
    await montar({ pptFileId: "ppt-sin-copia", pptFilename: "reporte.pptx", pptGuardado: guardado({}) });
    expect(dialogo).toHaveBeenCalledTimes(1);
    expect(dialogo.mock.calls[0][0]).toMatchObject({
      defaultName: "reporte.pptx",
      defaultPath: "/Users/ana/Estudios/HSVG2026/reporte.pptx",
    });
    expect(espia.saveFileAs).toHaveBeenCalledWith("ppt-sin-copia", "/Users/ana/Estudios/HSVG2026/reporte.pptx", { overwrite: true });
    await abrirMenu();
    expect(host.textContent).toContain("Guardado como reporte.pptx");
  });

  it("el aviso de guardado se muestra como nota neutra junto al archivo", async () => {
    const aviso = "La ruta pasa de 240 caracteres: el archivo no se copió junto al proyecto.";
    await montar({ pptFileId: "ppt-aviso", pptFilename: "reporte.pptx", pptGuardado: guardado({ avisoGuardado: aviso }) });
    expect(dialogo).toHaveBeenCalledTimes(1);
    await abrirMenu();
    const nota = Array.from(host.querySelectorAll(".pulso-gv2-export-menu-files small")).map((n) => n.textContent);
    expect(nota).toEqual([aviso]);
  });
});
