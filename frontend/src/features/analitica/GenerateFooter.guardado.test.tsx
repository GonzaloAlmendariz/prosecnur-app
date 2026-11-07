// @vitest-environment happy-dom
/**
 * ADR 0133, fases 2 y 4: el backend copia cada entregable a `Entregables/<Módulo>`
 * junto al proyecto y el pie de «Generar» lo muestra en el contenedor de
 * entregables (forma «bloque»). Nunca abre el diálogo de guardado: con
 * `guardado_en` no descarga nada y dice la carpeta; sin él, descarga sin
 * diálogo. Mientras genera, el botón solo se deshabilita: ni spinner ni otro
 * rótulo; lo único que se mueve es la línea del contenedor.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProsecnurApi } from "../project/types";
import type { JobPollUpdate } from "../../hooks/useJob";
import type { MultiBaseResult } from "../../api/client";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  refresh: vi.fn(async () => undefined),
  polls: new Map<string, (u: JobPollUpdate<unknown>) => void>(),
}));

vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({ refresh: espia.refresh }),
}));
vi.mock("../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
// El job se resuelve a mano: el doble entrega el resultado como lo haría el poll.
vi.mock("../../hooks/useJob", () => ({
  iniciarJobPoll: (jobId: string, onUpdate: (u: JobPollUpdate<unknown>) => void) => {
    espia.polls.set(jobId, onUpdate);
    return () => undefined;
  },
}));

const { GenerateFooter } = await import("./PaneKit");
const { useReporteRun } = await import("./useReporteRun");
const { carpetaDelEntregable, normalizeEntregableGuardado, separadorDelSistema } = await import("../../api/client");
const { useBandejaEntregables } = await import("../../components/entregables/bandejaStore");

const CARPETA = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Procesamiento";

let host: HTMLDivElement;
let root: Root;
let dialogo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  dialogo = vi.fn(async () => "C:\\Users\\ana\\frecuencias.xlsx");
  window.prosecnurApi = {
    saveEntregableDialog: dialogo,
    abrirArchivo: vi.fn(async () => ({ ok: true })),
    mostrarEnCarpeta: vi.fn(async () => ({ ok: true })),
    onDescargaTerminada: () => () => undefined,
  } as unknown as ProsecnurApi;
  espia.descargar.mockClear();
  espia.refresh.mockClear();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  delete window.prosecnurApi;
});

// Los panes reales: useReporteRun + GenerateFooter con run={run}.
const disparar = vi.hoisted(() => ({
  sync: null as null | ((out: unknown) => Promise<void>),
  job: null as null | (() => Promise<void>),
  lastResult: null as unknown,
}));

function PaneReal() {
  const run = useReporteRun("Frecuencias", { articulo: "las", formato: "xlsx" });
  disparar.sync = (out) => run.runSync(async () => out);
  disparar.job = () => run.runAsync(async () => ({ ok: true, job_id: "job-pane", kind: "analitica.cruces" }));
  disparar.lastResult = run.lastResult;
  return <GenerateFooter label="Generar frecuencias" run={run} onGenerate={vi.fn()} />;
}

function botonGenerar(): HTMLButtonElement | null {
  return Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes("Generar frecuencias")) ?? null;
}

describe("GenerateFooter sobre el contenedor de entregables (ADR 0133)", () => {
  it("vía síncrona con una base: guardado_en no descarga ni abre el diálogo y dice la carpeta", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => {
      await disparar.sync?.({
        ok: true, n_bases: 1, file_id: "sync-una", filename: "HSVG2026_Frecuencias_07_11_26.xlsx", size: 49152,
        modulo: "Procesamiento", rotulo: "Frecuencias",
        guardado_en: `${CARPETA}\\HSVG2026_Frecuencias_07_11_26.xlsx`, aviso_guardado: null,
      });
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(espia.descargar).not.toHaveBeenCalled();
    const contenedor = host.querySelector("[data-entregable-forma='bloque']");
    expect(contenedor?.getAttribute("data-entregable-fase")).toBe("lista");
    expect(contenedor?.textContent).toContain("Guardado");
    expect(contenedor?.textContent).toContain("Entregables\\Procesamiento");
    expect(host.querySelectorAll("a")).toHaveLength(0);
    expect(espia.refresh).toHaveBeenCalled();
  });

  it("vía síncrona con varias bases: el ZIP es el entregable y cada base se baja suelta", async () => {
    await act(async () => { root.render(<PaneReal />); });
    const varias: MultiBaseResult = {
      ok: true, n_bases: 2,
      zip: { file_id: "sync-zip", filename: "HSVG2026_Frecuencias_por_base_07_11_26.zip", size: 20 },
      bases: [
        { nombre: "Docentes", file_id: "b1", filename: "a.xlsx", size: 1 },
        { nombre: "Estudiantes", file_id: "b2", filename: "b.xlsx", size: 1 },
      ],
    };
    (varias.zip as Record<string, unknown>).guardado_en = `${CARPETA}\\HSVG2026_Frecuencias_por_base_07_11_26.zip`;
    await act(async () => { await disparar.sync?.(varias); });
    expect(dialogo).not.toHaveBeenCalled();
    expect(espia.descargar).not.toHaveBeenCalled();
    expect(host.textContent).toContain("HSVG2026_Frecuencias_por_base_07_11_26.zip");
    const porBase = Array.from(host.querySelectorAll<HTMLButtonElement>(".pulso-entregable-pie button"));
    expect(porBase.map((b) => b.textContent?.trim())).toEqual(["Docentes", "Estudiantes"]);
    await act(async () => { porBase[1].click(); });
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/b2/download", "b.xlsx");
  });

  it("vía síncrona sin guardado_en: descarga sin diálogo", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => {
      await disparar.sync?.({ ok: true, n_bases: 1, file_id: "sync-sin", filename: "frecuencias.xlsx", size: 10, guardado_en: null, aviso_guardado: null });
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/sync-sin/download", "frecuencias.xlsx");
    expect(host.textContent).toContain("Descargado");
  });

  it("el aviso de guardado se muestra como nota junto al archivo", async () => {
    const aviso = "La ruta pasa de 240 caracteres: el archivo no se copió junto al proyecto.";
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => {
      await disparar.sync?.({ ok: true, n_bases: 1, file_id: "f-aviso", filename: "frecuencias.xlsx", size: 10, aviso_guardado: aviso });
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(host.querySelector(".pulso-entregable-nota")?.textContent).toBe(aviso);
  });

  it("vía job: el botón solo se deshabilita, la línea es lo único que se mueve y guardado_en no abre el diálogo", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => { void disparar.job?.(); await Promise.resolve(); });
    const boton = botonGenerar();
    expect(boton?.disabled).toBe(true);
    expect(boton?.textContent).toBe("Generar frecuencias");
    expect(boton?.querySelector(".pulso-spin")).toBeNull();
    expect(host.querySelectorAll("[role='progressbar']")).toHaveLength(1);
    expect(host.querySelector("[data-entregable-fase]")?.getAttribute("data-entregable-fase")).toBe("en_curso");
    expect(host.querySelector(".pulso-entregable-tile")?.textContent).toBe("XLSX");
    await act(async () => {
      espia.polls.get("job-pane")?.({
        snapshot: {
          id: "job-pane", kind: "analitica.cruces", status: "done", started_at: "", finished_at: null,
          has_file_result: false, result_filename: null, error: {},
          result_data: {
            ok: true, file_id: "job-pane-file", filename: "HSVG2026_Cruces_07_11_26.xlsx", size: 10,
            modulo: "Procesamiento", rotulo: "Cruces",
            guardado_en: `${CARPETA}\\HSVG2026_Cruces_07_11_26.xlsx`, aviso_guardado: null,
          },
        },
      });
    });
    expect(dialogo).not.toHaveBeenCalled();
    expect(botonGenerar()?.disabled).toBe(false);
    expect(host.textContent).toContain("Entregables\\Procesamiento");
    expect(disparar.lastResult).toMatchObject({ file_id: "job-pane-file" });
  });

  it("un fallo se dice en el contenedor con su código y Reintentar", async () => {
    await act(async () => { root.render(<PaneReal />); });
    await act(async () => {
      await disparar.sync?.(Promise.reject(new Error("No hay base activa. · E_ANALITICA_SIN_BASE")));
    });
    const contenedor = host.querySelector("[data-entregable-fase='fallo']");
    expect(contenedor?.getAttribute("role")).toBe("alert");
    expect(contenedor?.querySelector(".pulso-entregable-nombre")?.textContent).toBe("No se pudieron generar las frecuencias");
    expect(contenedor?.textContent).toContain("No hay base activa.");
    expect(host.querySelector(".pulso-entregable-codigo")?.textContent).toBe("E_ANALITICA_SIN_BASE");
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
