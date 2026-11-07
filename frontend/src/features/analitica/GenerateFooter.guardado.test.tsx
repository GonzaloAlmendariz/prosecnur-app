// @vitest-environment happy-dom
/**
 * ADR 0133: el backend copia cada entregable a `Entregables/<Módulo>` junto al
 * proyecto. Si el meta del archivo trae `guardado_en`, el pie de «Generar» no
 * abre el diálogo de guardado (lo duplicaría) y dice en qué carpeta quedó; sin
 * `guardado_en`, el diálogo se abre como antes.
 */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProsecnurApi } from "../project/types";
import type { EntregableGuardado, FileJobResult, MultiBaseResult } from "../../api/client";

const PROYECTO = "/Users/ana/Estudios/HSVG2026/HSVG2026.pulso";

const espia = vi.hoisted(() => ({
  saveFileAs: vi.fn(async (_fileId: string, path: string) => ({ ok: true as const, path, filename: path.split("/").pop() ?? path, size: 1 })),
  onDone: null as null | ((d: FileJobResult) => void),
}));

vi.mock("../project/ProjectShell", () => ({
  useProjectShell: () => ({ project: { status: { path: PROYECTO } } }),
}));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiSaveFileAs: espia.saveFileAs,
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));

vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({ refresh: async () => undefined }),
}));

// El job se resuelve a mano: el doble entrega el resultado como lo haría el poll.
vi.mock("../../components/JobProgress", () => ({
  JobProgress: ({ onDone }: { onDone: (d: FileJobResult) => void }) => {
    espia.onDone = onDone;
    return null;
  },
}));

const { GenerateFooter } = await import("./PaneKit");
const { useReporteRun } = await import("./useReporteRun");
const { carpetaDelEntregable, normalizeEntregableGuardado, separadorDelSistema } = await import("../../api/client");

let host: HTMLDivElement;
let root: Root;
let dialogo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  dialogo = vi.fn(async () => "/Users/ana/Estudios/HSVG2026/frecuencias.xlsx");
  window.prosecnurApi = { saveEntregableDialog: dialogo } as unknown as ProsecnurApi;
  espia.saveFileAs.mockClear();
  espia.onDone = null;
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

async function montar(fileId: string, g?: EntregableGuardado | null) {
  await act(async () => {
    root.render(
      <GenerateFooter label="Generar frecuencias" busy={false} fileId={fileId} downloadName="frecuencias.xlsx" error="" onGenerate={vi.fn()} guardado={g} />,
    );
  });
}

// Imita useReporteRun: el job termina, el padre fija el fileId y suelta el jobId.
function ConJob() {
  const [jobId, setJobId] = useState<string | null>("job-1");
  const [fileId, setFileId] = useState<string | null>(null);
  return (
    <GenerateFooter
      label="Generar frecuencias"
      busy={false}
      jobId={jobId}
      fileId={fileId}
      downloadName="frecuencias.xlsx"
      error=""
      onGenerate={vi.fn()}
      onJobDone={(d) => { setFileId(d.file_id); setJobId(null); }}
      onJobError={vi.fn()}
      onJobCancelled={vi.fn()}
    />
  );
}

describe("GenerateFooter con la copia junto al proyecto (ADR 0133)", () => {
  it("con guardado_en no abre el diálogo y dice la carpeta relativa al proyecto", async () => {
    await montar("f-guardado", guardado({ guardadoEn: "/Users/ana/Estudios/HSVG2026/Entregables/Procesamiento/HSVG2026_Frecuencias_07_11_26.xlsx" }));
    expect(dialogo).not.toHaveBeenCalled();
    expect(espia.saveFileAs).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Guardado en Entregables[\\/]Procesamiento/);
    expect(host.textContent).not.toContain("Guardado como");
  });

  it("el resultado de un job con guardado_en tampoco abre el diálogo", async () => {
    await act(async () => { root.render(<ConJob />); });
    expect(espia.onDone).not.toBeNull();
    await act(async () => {
      espia.onDone?.({
        ok: true,
        file_id: "f-job",
        filename: "HSVG2026_Frecuencias_07_11_26.xlsx",
        size: 10,
        guardado_en: "/Users/ana/Estudios/HSVG2026/Entregables/Procesamiento/HSVG2026_Frecuencias_07_11_26.xlsx",
        aviso_guardado: null,
      });
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Guardado en Entregables[\\/]Procesamiento/);
  });

  it("sin guardado_en abre el diálogo como hoy y dice «Guardado como»", async () => {
    await montar("f-sin-copia", null);
    expect(dialogo).toHaveBeenCalledTimes(1);
    expect(dialogo.mock.calls[0][0]).toMatchObject({
      defaultName: "frecuencias.xlsx",
      defaultPath: "/Users/ana/Estudios/HSVG2026/frecuencias.xlsx",
    });
    expect(espia.saveFileAs).toHaveBeenCalledWith("f-sin-copia", "/Users/ana/Estudios/HSVG2026/frecuencias.xlsx", { overwrite: true });
    expect(host.textContent).toContain("Guardado como frecuencias.xlsx");
  });

  it("el aviso de guardado se muestra como nota y, sin copia, el diálogo sigue abriéndose", async () => {
    const aviso = "La ruta pasa de 240 caracteres: el archivo no se copió junto al proyecto.";
    await montar("f-aviso", guardado({ avisoGuardado: aviso }));
    expect(dialogo).toHaveBeenCalledTimes(1);
    const nota = host.querySelector(".analitica-generate-hint");
    expect(nota?.textContent).toBe(aviso);
  });
});

// Los panes reales: useReporteRun + GenerateFooter con guardado={run.guardado}.
const disparar = vi.hoisted(() => ({
  sync: null as null | ((out: MultiBaseResult) => Promise<void>),
  job: null as null | (() => Promise<void>),
}));

function PaneReal() {
  const run = useReporteRun();
  disparar.sync = (out) => run.runSync(async () => out);
  disparar.job = () => run.runAsync(async () => ({ ok: true, job_id: "job-pane", kind: "analitica.cruces" }));
  return (
    <GenerateFooter
      label="Generar"
      busy={run.busy}
      jobId={run.jobId}
      fileId={run.fileId}
      downloadName={run.filename ?? "frecuencias.xlsx"}
      guardado={run.guardado}
      perBase={run.perBase}
      error={run.error}
      onGenerate={vi.fn()}
      onJobDone={run.onJobDone}
      onJobError={run.onJobError}
      onJobCancelled={run.onJobCancelled}
    />
  );
}

const CARPETA = "/Users/ana/Estudios/HSVG2026/Entregables/Procesamiento";

describe("useReporteRun lleva la copia al pie en el mismo render que el archivo", () => {
  it("vía síncrona con una base: guardado_en en la raíz no abre el diálogo", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => {
      await disparar.sync?.({
        ok: true, n_bases: 1, file_id: "sync-una", filename: "HSVG2026_Frecuencias_07_11_26.xlsx", size: 10,
        modulo: "Procesamiento", rotulo: "Frecuencias",
        guardado_en: `${CARPETA}/HSVG2026_Frecuencias_07_11_26.xlsx`, aviso_guardado: null,
      } as MultiBaseResult);
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Guardado en Entregables[\\/]Procesamiento/);
  });

  it("vía síncrona con varias bases: guardado_en dentro de zip no abre el diálogo", async () => {
    await act(async () => { root.render(<PaneReal />); });
    // Cada base trae su meta con guardado_en null: solo se guarda el ZIP.
    const varias = {
      ok: true as const, n_bases: 2,
      zip: { file_id: "sync-zip", filename: "HSVG2026_Frecuencias_por_base_07_11_26.zip", size: 20, guardado_en: `${CARPETA}/HSVG2026_Frecuencias_por_base_07_11_26.zip`, aviso_guardado: null },
      bases: [
        { nombre: "Docentes", file_id: "b1", filename: "a.xlsx", size: 1, guardado_en: null },
        { nombre: "Estudiantes", file_id: "b2", filename: "b.xlsx", size: 1, guardado_en: null },
      ],
    };
    await act(async () => { await disparar.sync?.(varias); });
    expect(dialogo).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Guardado en Entregables[\\/]Procesamiento/);
  });

  it("vía síncrona sin guardado_en: el diálogo se abre como hoy", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => {
      await disparar.sync?.({ ok: true, n_bases: 1, file_id: "sync-sin", filename: "frecuencias.xlsx", size: 10, guardado_en: null, aviso_guardado: null } as MultiBaseResult);
    });
    expect(dialogo).toHaveBeenCalledTimes(1);
  });

  it("vía job: guardado_en en result_data no abre el diálogo", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => { await disparar.job?.(); });
    expect(espia.onDone).not.toBeNull();
    await act(async () => {
      espia.onDone?.({
        ok: true, file_id: "job-pane-file", filename: "HSVG2026_Cruces_07_11_26.xlsx", size: 10,
        modulo: "Procesamiento", rotulo: "Cruces",
        guardado_en: `${CARPETA}/HSVG2026_Cruces_07_11_26.xlsx`, aviso_guardado: null,
      });
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Guardado en Entregables[\\/]Procesamiento/);
  });
});

describe("meta de la copia (api/jobs.ts)", () => {
  it("lee los cuatro campos y tolera el NULL de R como {} o arreglo", () => {
    expect(normalizeEntregableGuardado({ guardado_en: {}, aviso_guardado: [], modulo: ["Procesamiento"], rotulo: "Frecuencias" }))
      .toEqual({ guardadoEn: null, avisoGuardado: null, modulo: "Procesamiento", rotulo: "Frecuencias" });
    expect(normalizeEntregableGuardado(null)).toEqual({ guardadoEn: null, avisoGuardado: null, modulo: null, rotulo: null });
    expect(normalizeEntregableGuardado({ zip: { file_id: "z", guardado_en: "C:\\E\\Entregables\\Procesamiento\\a.zip" } }).guardadoEn)
      .toBe("C:\\E\\Entregables\\Procesamiento\\a.zip");
  });

  it("la carpeta usa el separador del sistema y, si no se sabe, el de la ruta", () => {
    const win = "C:\\Users\\ana\\Estudio\\Entregables\\Procesamiento\\a.xlsx";
    expect(carpetaDelEntregable(win, "C:\\Users\\ana\\Estudio\\HSVG.pulso", null)).toBe("Entregables\\Procesamiento");
    expect(carpetaDelEntregable(win, "c:\\users\\ana\\estudio\\HSVG.pulso", "\\")).toBe("Entregables\\Procesamiento");
    expect(carpetaDelEntregable("C:/Users/ana/Estudio/Entregables/Procesamiento/a.xlsx", null, "\\")).toBe("Entregables\\Procesamiento");
    expect(carpetaDelEntregable("/Users/ana/Estudio/Entregables/Cálculo de muestra/a.pdf", "/Users/ana/Estudio/E.pulso", "/"))
      .toBe("Entregables/Cálculo de muestra");
    expect(carpetaDelEntregable("/otra/parte/a.pdf", "/Users/ana/Estudio/E.pulso", "/")).toBe("/otra/parte");
  });

  it("reconoce Windows y macOS por el navegador", () => {
    expect(separadorDelSistema({ platform: "Win32" })).toBe("\\");
    expect(separadorDelSistema({ userAgentData: { platform: "Windows" } })).toBe("\\");
    expect(separadorDelSistema({ platform: "MacIntel" })).toBe("/");
    expect(separadorDelSistema({ platform: "darwin" })).toBeNull();
    expect(separadorDelSistema({ platform: "Linux x86_64" })).toBeNull();
    expect(separadorDelSistema(undefined)).toBeNull();
  });
});
