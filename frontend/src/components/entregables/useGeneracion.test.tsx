// @vitest-environment happy-dom
/**
 * useGeneracion: la espera y la entrega de un archivo (ADR 0133, fase 4).
 * Generación síncrona, job con avance, fallos, cancelar, con y sin la copia
 * junto al proyecto, y escritorio frente a navegador con el puente simulado.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/core";
import type { JobPollUpdate } from "../../hooks/useJob";
import type { JobSnapshot } from "../../api/jobs";
import type { ProsecnurApi } from "../../features/project/types";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  cancelar: vi.fn(async () => ({ ok: true })),
  polls: new Map<string, (u: JobPollUpdate<unknown>) => void>(),
}));

vi.mock("../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../hooks/useJob", () => ({
  iniciarJobPoll: (jobId: string, onUpdate: (u: JobPollUpdate<unknown>) => void) => {
    espia.polls.set(jobId, onUpdate);
    return () => undefined;
  },
}));
// localStorage de happy-dom no sirve en esta configuración: la URL se arma aparte.
vi.mock("../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
vi.mock("../../api/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/jobs")>()),
  apiJobCancel: espia.cancelar,
}));

const { useGeneracion } = await import("./useGeneracion");
const { useBandejaEntregables } = await import("./bandejaStore");
type Gen = ReturnType<typeof useGeneracion>;

const GUARDADO = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Procesamiento\\HSVG2026_Frecuencias_07_11_26.xlsx";

let host: HTMLDivElement;
let root: Root;
const actual: { gen: Gen | null } = { gen: null };
let avisoDescarga: ((d: { estado: string; nombre: string; ruta: string }) => void) | null = null;

type OpcionesBanco = Parameters<typeof useGeneracion>[0];

function Banco({ describir, articulo, formato }: {
  describir?: OpcionesBanco["describirError"];
  articulo?: OpcionesBanco["articulo"];
  formato?: string;
}) {
  actual.gen = useGeneracion({ titulo: "Frecuencias", modulo: "Procesamiento", describirError: describir, articulo, formato });
  return null;
}

function gen(): Gen {
  if (!actual.gen) throw new Error("sin montar");
  return actual.gen;
}

function snap(parcial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "j", kind: "x", status: "running", started_at: "", finished_at: null, has_file_result: false,
    result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

function escritorio() {
  window.prosecnurApi = {
    saveEntregableDialog: vi.fn(),
    abrirArchivo: vi.fn(async () => ({ ok: true })),
    mostrarEnCarpeta: vi.fn(async () => ({ ok: true })),
    onDescargaTerminada: (cb: (d: { estado: string; nombre: string; ruta: string }) => void) => {
      avisoDescarga = cb;
      return () => { avisoDescarga = null; };
    },
  } as unknown as ProsecnurApi;
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.cancelar.mockClear();
  espia.polls.clear();
  avisoDescarga = null;
  useBandejaEntregables.getState().vaciar();
  await act(async () => { root.render(<Banco />); });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete window.prosecnurApi;
  actual.gen = null;
});

describe("archivo armado en el front (ArchivoLocal)", () => {
  it("se entrega al instante: Descargado, con su peso, sin file_id del backend y bajado de su blob", async () => {
    const { archivoCsv } = await import("./archivoLocal");
    const crear = vi.fn(() => "blob:local-1");
    const revocar = vi.fn();
    const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
    URL.createObjectURL = crear;
    URL.revokeObjectURL = revocar;
    try {
      let r: Awaited<ReturnType<Gen["ejecutar"]>> | null = null;
      await act(async () => { r = await gen().ejecutar(() => Promise.resolve(archivoCsv("a,b\n1,2", "personas.csv"))); });
      expect(r).toMatchObject({ ok: true });
      const estado = gen().estado;
      expect(estado).toMatchObject({ fase: "lista", titulo: "Frecuencias", archivos: [{ nombre: "personas.csv", formato: "csv", guardadoEn: null }] });
      const archivo = estado.fase === "lista" ? estado.archivos[0] : null;
      expect(archivo?.fileId.startsWith("local-")).toBe(true);
      expect(archivo?.tamano).toBeGreaterThan(0);
      expect(archivo?.local).toBeInstanceOf(Blob);
      expect(crear).toHaveBeenCalledTimes(1);
      expect(espia.descargar).toHaveBeenCalledWith("blob:local-1", "personas.csv");
    } finally {
      URL.createObjectURL = original.crear;
      URL.revokeObjectURL = original.revocar;
    }
  });

  it("si armarlo falla, el fallo queda en el contenedor con Reintentar", async () => {
    const fn = vi.fn(async () => { throw new Error("No hay filas que exportar."); });
    await act(async () => { await gen().ejecutar(fn); });
    expect(gen().estado).toMatchObject({ fase: "fallo", causa: "No hay filas que exportar." });
    expect(espia.descargar).not.toHaveBeenCalled();
  });
});

describe("generación síncrona", () => {
  it("con guardado_en no descarga: ya quedó en Entregables", async () => {
    escritorio();
    let r: Awaited<ReturnType<Gen["ejecutar"]>> | null = null;
    await act(async () => {
      r = await gen().ejecutar(async () => ({ ok: true, file_id: "f1", filename: "HSVG2026_Frecuencias_07_11_26.xlsx", size: 10, guardado_en: GUARDADO }));
    });
    expect(r).toMatchObject({ ok: true });
    expect(gen().estado).toMatchObject({ fase: "lista", titulo: "Frecuencias", archivos: [{ fileId: "f1", guardadoEn: GUARDADO }] });
    expect(espia.descargar).not.toHaveBeenCalled();
    expect(avisoDescarga).toBeNull();
    expect(window.prosecnurApi?.saveEntregableDialog).not.toHaveBeenCalled();
  });

  it("sin guardado_en en escritorio: descarga sin diálogo y guarda la ruta que avisa Electron", async () => {
    escritorio();
    await act(async () => {
      await gen().ejecutar(async () => ({ ok: true, file_id: "f2", filename: "Frecuencias.xlsx", size: 10 }));
    });
    expect(espia.descargar).toHaveBeenCalledWith(expect.stringContaining("/api/files/f2/download"), "Frecuencias.xlsx");
    expect(window.prosecnurApi?.saveEntregableDialog).not.toHaveBeenCalled();
    expect(avisoDescarga).not.toBeNull();
    // Un aviso de otra descarga no se toma por este.
    await act(async () => { avisoDescarga?.({ estado: "completed", nombre: "Otro.xlsx", ruta: "C:\\Users\\ana\\Downloads\\Otro.xlsx" }); });
    expect(gen().estado).toMatchObject({ fase: "lista", rutaDescargada: null });
    await act(async () => { avisoDescarga?.({ estado: "completed", nombre: "Frecuencias_2.xlsx", ruta: "C:\\Users\\ana\\Downloads\\Frecuencias_2.xlsx" }); });
    expect(gen().estado).toMatchObject({ fase: "lista", rutaDescargada: "C:\\Users\\ana\\Downloads\\Frecuencias_2.xlsx" });
    expect(avisoDescarga).toBeNull();
  });

  it("sin guardado_en en el navegador: descarga igual y no hay ruta que esperar", async () => {
    await act(async () => {
      await gen().ejecutar(async () => ({ ok: true, file_id: "f3", filename: "Frecuencias.xlsx", size: 10 }));
    });
    expect(espia.descargar).toHaveBeenCalledTimes(1);
    expect(gen().estado).toMatchObject({ fase: "lista", rutaDescargada: null });
  });

  it("un ApiError se dice con su causa y su código, con Reintentar que vuelve a correr", async () => {
    const fn = vi.fn(async () => { throw new ApiError("E_ANALITICA_SIN_BASE", "No hay base activa."); });
    await act(async () => { await gen().ejecutar(fn); });
    const estado = gen().estado;
    expect(estado).toMatchObject({ fase: "fallo", titulo: "No se pudo generar: Frecuencias", causa: "No hay base activa.", codigo: "E_ANALITICA_SIN_BASE" });
    expect(estado.fase === "fallo" && typeof estado.reintentar).toBe("function");
    await act(async () => { if (estado.fase === "fallo") estado.reintentar?.(); });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("con artículo y formato: el fallo se nombra como en el prototipo y el ícono lleva la sigla esperada", async () => {
    await act(async () => { root.render(<Banco articulo="las" formato="xlsx" />); });
    let pendiente: Promise<unknown> = Promise.resolve();
    let soltar: (v: unknown) => void = () => undefined;
    await act(async () => { pendiente = gen().ejecutar(() => new Promise((r) => { soltar = r; })); });
    expect(gen().estado).toMatchObject({ fase: "en_curso", titulo: "Frecuencias", formato: "xlsx" });
    await act(async () => { soltar({ ok: false, error: { code: "E_X", message: "Sin variables." } }); await pendiente; });
    expect(gen().estado).toMatchObject({ fase: "fallo", titulo: "No se pudieron generar las frecuencias", formato: "xlsx" });
    await act(async () => {
      await gen().ejecutar(async () => { throw new Error("x"); }, { titulo: "Informe en Word", articulo: "el", formato: "docx" });
    });
    expect(gen().estado).toMatchObject({ fase: "fallo", titulo: "No se pudo generar el informe en Word", formato: "docx" });
  });

  it("describirError del llamador manda sobre el traductor común", async () => {
    await act(async () => { root.render(<Banco describir={() => ({ causa: "La lámina 3 no se dibuja.", codigo: null })} />); });
    await act(async () => { await gen().ejecutar(async () => { throw new Error("object 'x' not found"); }); });
    expect(gen().estado).toMatchObject({ fase: "fallo", causa: "La lámina 3 no se dibuja." });
  });

  it("una respuesta sin archivo es un fallo, no un «listo» vacío", async () => {
    await act(async () => { await gen().ejecutar(async () => ({ ok: true })); });
    expect(gen().estado).toMatchObject({ fase: "fallo" });
  });

  it("el título de una ejecución puede cambiar (PowerPoint o Word del mismo menú)", async () => {
    await act(async () => { await gen().ejecutar(async () => ({ file_id: "w", filename: "a.docx" }), { titulo: "Informe en Word" }); });
    expect(gen().estado).toMatchObject({ fase: "lista", titulo: "Informe en Word" });
  });
});

describe("generación por job", () => {
  it("sigue el job que arranca ejecutar, con paso, mensaje y porcentaje, y entrega el archivo", async () => {
    escritorio();
    let promesa: Promise<unknown> = Promise.resolve();
    await act(async () => {
      promesa = gen().ejecutar(async () => ({ ok: true, job_id: "job-1", kind: "analitica.cruces" }));
      await Promise.resolve();
    });
    expect(gen().estado).toMatchObject({ fase: "en_curso", porcentaje: null });
    const update = espia.polls.get("job-1");
    expect(update).toBeDefined();
    // `step`/`steps` los manda el motor (jobs.R) aunque el tipo del front aún no los declare.
    const progreso = { step: 2, steps: 4, percent: 40, message: "Calculando cruces" } as JobSnapshot["progress"];
    await act(async () => { update?.({ snapshot: snap({ progress: progreso }) }); });
    expect(gen().estado).toMatchObject({ fase: "en_curso", paso: 2, pasos: 4, porcentaje: 40, mensaje: "Calculando cruces" });
    await act(async () => {
      update?.({ snapshot: snap({ status: "done", result_data: { ok: true, file_id: "fj", filename: "Cruces.xlsx", size: 5, guardado_en: GUARDADO } }) });
      await promesa;
    });
    expect(await promesa).toMatchObject({ ok: true, datos: { file_id: "fj" } });
    expect(gen().estado).toMatchObject({ fase: "lista", archivos: [{ fileId: "fj" }] });
    expect(espia.descargar).not.toHaveBeenCalled();
  });

  it("seguirJob: el error del worker y el error de dominio en result_data son fallos", async () => {
    await act(async () => { void gen().seguirJob("job-2"); });
    await act(async () => { espia.polls.get("job-2")?.({ snapshot: snap({ status: "error", error: "No se pudo leer la base · E_BASE_ILEGIBLE" }) }); });
    expect(gen().estado).toMatchObject({ fase: "fallo", causa: "No se pudo leer la base", codigo: "E_BASE_ILEGIBLE" });

    await act(async () => { void gen().seguirJob("job-3"); });
    await act(async () => {
      espia.polls.get("job-3")?.({ snapshot: snap({ status: "done", result_data: { ok: false, error: { code: "E_SIN_VARIABLES", message: "No hay variables." } } }) });
    });
    expect(gen().estado).toMatchObject({ fase: "fallo", causa: "No hay variables.", codigo: "E_SIN_VARIABLES" });
  });

  it("el job perdido (backend reiniciado) termina en fallo legible", async () => {
    await act(async () => { void gen().seguirJob("job-4"); });
    await act(async () => { espia.polls.get("job-4")?.({ failure: { kind: "lost", message: "El backend se reinició y el trabajo ya no existe. Vuelve a lanzarlo." } }); });
    expect(gen().estado).toMatchObject({ fase: "fallo", causa: expect.stringMatching(/reinició/) });
  });

  it("Cancelar pide cancelar el job y, al confirmarse, el contenedor y la bandeja lo sueltan", async () => {
    let promesa: Promise<unknown> = Promise.resolve();
    await act(async () => { promesa = gen().seguirJob("job-5"); });
    const estado = gen().estado;
    expect(estado.fase === "en_curso" && typeof estado.cancelar).toBe("function");
    await act(async () => { if (estado.fase === "en_curso") estado.cancelar?.(); });
    expect(espia.cancelar).toHaveBeenCalledWith("job-5");
    await act(async () => { espia.polls.get("job-5")?.({ snapshot: snap({ status: "cancelled" }) }); });
    expect(await promesa).toEqual({ ok: false, cancelada: true });
    expect(gen().estado).toEqual({ fase: "inactiva" });
    expect(useBandejaEntregables.getState().entradas).toEqual([]);
  });
});

describe("bandeja y cierre", () => {
  it("cada generación queda en la bandeja; cerrar el contenedor no la saca de allí", async () => {
    await act(async () => { await gen().ejecutar(async () => ({ file_id: "a", filename: "a.xlsx" })); });
    await act(async () => { await gen().ejecutar(async () => { throw new Error("falló"); }); });
    const entradas = useBandejaEntregables.getState().entradas;
    expect(entradas.map((e) => e.estado.fase)).toEqual(["fallo", "lista"]);
    expect(entradas[0].modulo).toBe("Procesamiento");
    await act(async () => { gen().cerrar(); });
    expect(gen().estado).toEqual({ fase: "inactiva" });
    expect(useBandejaEntregables.getState().entradas).toHaveLength(2);
  });

  it("un job sigue en la bandeja aunque la pantalla que lo pidió se desmonte", async () => {
    await act(async () => { void gen().seguirJob("job-6"); });
    act(() => root.unmount());
    root = createRoot(host);
    espia.polls.get("job-6")?.({ snapshot: snap({ status: "done", result_data: { file_id: "f6", filename: "Cruces.xlsx", guardado_en: GUARDADO } }) });
    expect(useBandejaEntregables.getState().entradas[0].estado).toMatchObject({ fase: "lista", archivos: [{ fileId: "f6" }] });
  });
});

describe("ver sin entregar (descargar: false)", () => {
  it("sync: el contenedor queda listo sin descargar ni esperar aviso, y lo dice", async () => {
    escritorio();
    let r: Awaited<ReturnType<Gen["ejecutar"]>> | null = null;
    await act(async () => {
      r = await gen().ejecutar(async () => ({ file_id: "png1", filename: "Ficha.png", size: 10 }), { titulo: "Imagen de una ficha", descargar: false });
    });
    expect(r).toMatchObject({ ok: true, datos: { file_id: "png1" } });
    expect(gen().estado).toMatchObject({ fase: "lista", titulo: "Imagen de una ficha", sinDescargar: true, archivos: [{ fileId: "png1" }] });
    expect(espia.descargar).not.toHaveBeenCalled();
    expect(avisoDescarga).toBeNull();
  });

  it("job: tampoco descarga al terminar; sin la opción, la descarga sigue igual que antes", async () => {
    let promesa: Promise<unknown> = Promise.resolve();
    await act(async () => { promesa = gen().seguirJob("job-png", { descargar: false }); });
    await act(async () => {
      espia.polls.get("job-png")?.({ snapshot: snap({ status: "done", result_data: { file_id: "p2", filename: "Ficha.png" } }) });
      await promesa;
    });
    expect(gen().estado).toMatchObject({ fase: "lista", sinDescargar: true });
    expect(espia.descargar).not.toHaveBeenCalled();

    await act(async () => { await gen().ejecutar(async () => ({ file_id: "p3", filename: "Lote.pdf" })); });
    expect(gen().estado).not.toHaveProperty("sinDescargar");
    expect(espia.descargar).toHaveBeenCalledTimes(1);
  });

  it("con la copia junto al proyecto no cambia nada: ya está guardado", async () => {
    await act(async () => {
      await gen().ejecutar(async () => ({ file_id: "g1", filename: "F.xlsx", guardado_en: GUARDADO }), { descargar: false });
    });
    expect(gen().estado).toMatchObject({ fase: "lista", archivos: [{ guardadoEn: GUARDADO }] });
    expect(espia.descargar).not.toHaveBeenCalled();
  });
});
