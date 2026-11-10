// @vitest-environment happy-dom
/**
 * Monitoreo entrega por el kit (ADR 0133, fase 5): una prueba por forma que usa
 * el módulo, sobre componentes reales.
 *
 * - bloque con job: el PDF de avance de Salidas (tarjeta), con avance real y Cancelar;
 * - bloque local: la base de barrido de supervisión (cabecera), un CSV armado en el front;
 * - bloque con nota: el libro de aulas (tarjeta de operaciones), con qué lleva dentro al pie;
 * - anclada y fila: los envoltorios de Monitoreo alrededor del contenedor del kit.
 *
 * Lo que vigila es lo que pidió Gonzalo: el disparador sólo se deshabilita (sin
 * spinner ni cambio de rótulo), lo único que se mueve es la línea del
 * contenedor, y dentro del contenedor no hay enlaces ni botones primarios.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPollUpdate } from "../../../hooks/useJob";
import type { JobSnapshot } from "../../../api/jobs";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  cancelar: vi.fn(async () => ({ ok: true })),
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
vi.mock("../../../api/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/jobs")>()),
  apiJobCancel: espia.cancelar,
}));

const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { TarjetaPdfDeAvance } = await import("../salidas/TarjetaPdfDeAvance");
const { BaseDeBarridoDeSupervision } = await import("../core/BaseDeBarridoDeSupervision");
const { AulasOperationsPanel } = await import("../profiles/aulas/AulasOperationsPanel");
const { useEntrega } = await import("./useEntrega");
const { EntregaAnclada } = await import("./EntregaAnclada");
const { EntregaEnFila } = await import("./EntregaEnFila");
const { archivoCsv } = await import("../../../components/entregables/archivoLocal");

let host: HTMLDivElement;
let root: Root;

type Diferida = { promesa: Promise<unknown>; resolver: (v: unknown) => void };
function diferida(): Diferida {
  let resolver: (v: unknown) => void = () => undefined;
  const promesa = new Promise<unknown>((res) => { resolver = res; });
  return { promesa, resolver };
}

function snap(parcial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "j", kind: "monitoreo.telefonico_advance_pdf", status: "running", started_at: "", finished_at: null,
    has_file_result: true, result_filename: null, result_data: {}, error: {}, ...parcial,
  };
}

const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.cancelar.mockClear();
  espia.polls.clear();
  useBandejaEntregables.getState().vaciar();
  URL.createObjectURL = vi.fn(() => "blob:monitoreo");
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
  if (!b) throw new Error(`Sin botón «${texto}»`);
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

const TEXTOS = { eyebrow: "PDF telefónico", title: "PDF de avance telefónico", detail: "Avance", button: "Generar PDF telefónico" };

function BancoPdf({ generar }: { generar: () => Promise<unknown> }) {
  const entrega = useEntrega(TEXTOS.title, { formato: "pdf", articulo: "el" });
  return <TarjetaPdfDeAvance textos={TEXTOS} ofrecePortada entrega={entrega} habilitado generar={generar} />;
}

describe("bloque con job: el PDF de avance de Salidas", () => {
  it("en curso: el botón sólo se deshabilita, la línea sigue el avance real y hay Cancelar; listo: el archivo sin enlaces", async () => {
    const generar = vi.fn(async () => ({ ok: true, job_id: "pdf-1", kind: "monitoreo.telefonico_advance_pdf" }));
    await act(async () => { root.render(<BancoPdf generar={generar} />); });
    await act(async () => { boton(TEXTOS.button).click(); });

    const disparador = boton(TEXTOS.button);
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe(TEXTOS.button);
    await act(async () => { espia.polls.get("pdf-1")?.({ snapshot: snap({ progress: { percent: 55, message: "Renderizando avance telefónico..." } }) }); });
    const enCurso = contenedor("bloque");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.querySelector(".pulso-barra-avance")).not.toBeNull();
    expect(enCurso?.textContent).toContain("Renderizando avance telefónico");
    sinResaltadoNiSpinner(enCurso as HTMLElement);
    await act(async () => { boton("Cancelar").click(); });
    expect(espia.cancelar).toHaveBeenCalledWith("pdf-1");

    await act(async () => {
      espia.polls.get("pdf-1")?.({ snapshot: snap({ status: "done", result_data: { ok: true, file_id: "f-pdf", filename: "HSVG2026_Avance_telefonico_10_11_26.pdf", size: 4096 } }) });
    });
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("HSVG2026_Avance_telefonico_10_11_26.pdf");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f-pdf/download", "HSVG2026_Avance_telefonico_10_11_26.pdf");
    expect(boton(TEXTOS.button).disabled).toBe(false);
  });

  it("la forma del motor (ADR 0133): con guardado_en el PDF ya quedó en Entregables\\Monitoreo y no se descarga otra vez", async () => {
    const generar = vi.fn(async () => ({ ok: true, job_id: "pdf-3" }));
    await act(async () => { root.render(<BancoPdf generar={generar} />); });
    await act(async () => { boton(TEXTOS.button).click(); });
    const guardado = "C:\\Estudios\\HSVG2026\\Entregables\\Monitoreo\\HSVG2026_Avance_telefonico_10_11_26.pdf";
    await act(async () => {
      espia.polls.get("pdf-3")?.({ snapshot: snap({ status: "done", result_data: {
        ok: true, file_id: "f-pdf3", filename: "HSVG2026_Avance_telefonico_10_11_26.pdf", size: 8192,
        modulo: "Monitoreo", rotulo: "Avance telefónico", guardado_en: guardado, aviso_guardado: null,
      } }) });
    });
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("Guardado");
    expect(lista?.textContent).toContain("Entregables\\Monitoreo");
    expect(espia.descargar).not.toHaveBeenCalled();
    sinResaltadoNiSpinner(lista as HTMLElement);
  });

  it("fallo: un job que termina sin file_id se dice en el contenedor, con Reintentar", async () => {
    const generar = vi.fn(async () => ({ ok: true, job_id: "pdf-2" }));
    await act(async () => { root.render(<BancoPdf generar={generar} />); });
    await act(async () => { boton(TEXTOS.button).click(); });
    await act(async () => { espia.polls.get("pdf-2")?.({ snapshot: snap({ status: "done", result_data: { ok: true, size: 4096, filename: "x.pdf" } }) }); });
    const fallo = contenedor("bloque");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo generar el PDF de avance telefónico");
    expect(boton("Reintentar")).toBeTruthy();
    sinResaltadoNiSpinner(fallo as HTMLElement);
    expect(host.querySelectorAll("[role='alert']")).toHaveLength(1);
  });
});

describe("bloque local: la base de barrido de supervisión", () => {
  it("el CSV se arma en el front y queda Descargado al instante, bajo la cabecera, sin enlaces", async () => {
    const plan = {
      hasReadBase: false, rows: [{}], targetTotal: 3, selectedTotal: 2, gapTotal: 1,
      exportRows: [{ Responsable: "Ana", "Base propuesta": 2 }],
    };
    await act(async () => { root.render(<BaseDeBarridoDeSupervision plan={plan}><table /></BaseDeBarridoDeSupervision>); });
    await act(async () => { boton("Exportar CSV").click(); });

    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("Descargado");
    expect(lista?.textContent).toMatch(/base-barrido-supervision-propuesta-\d{4}-\d{2}-\d{2}\.csv/);
    // Bajo la cabecera, antes del resumen y de la tabla.
    expect(lista?.closest(".mon-entrega-bloque")?.previousElementSibling?.tagName).toBe("HEADER");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith("blob:monitoreo", expect.stringMatching(/^base-barrido-supervision-propuesta-/));
  });
});

describe("bloque con nota: el libro de aulas", () => {
  it("qué lleva dentro va al pie del archivo listo, no en un aviso suelto; el botón no gira", async () => {
    const d = diferida();
    const generar = vi.fn(() => d.promesa as Promise<{ ok: true; file_id: string; filename: string; unidades: number; partes: number; control: number }>);
    await act(async () => {
      root.render(
        <AulasOperationsPanel
          config={{ enabled: true, plan_rows: 5 } as never}
          sources={[]}
          busy={false}
          onImportPlan={() => {}}
          onSyncField={() => {}}
          onGenerarLibro={generar}
          onImportarLibro={() => {}}
        />,
      );
    });
    await act(async () => { boton("Generar libro").click(); });
    expect(boton("Generar libro").disabled).toBe(true);
    const enCurso = contenedor("bloque");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    await act(async () => { d.resolver({ ok: true, file_id: "libro-1", filename: "HSVG2026_Libro_de_aulas_10_11_26.xlsx", unidades: 3, partes: 2, control: 0 }); await d.promesa; });
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.querySelector(".pulso-entregable-pie .mon-entrega-nota")?.textContent).toMatch(/partes de campo/);
    sinResaltadoNiSpinner(lista as HTMLElement);
  });
});

function BancoAnclada({ generar }: { generar: () => Promise<unknown> }) {
  const entrega = useEntrega("Carga de campo", { formato: "xls", articulo: "la" });
  return (
    <div className="barra">
      <EntregaAnclada entrega={entrega}>
        <button type="button" disabled={entrega.enCurso} onClick={() => { void entrega.ejecutar(generar); }}>Descargar Excel</button>
      </EntregaAnclada>
    </div>
  );
}

function BancoFila({ generar }: { generar: () => Promise<unknown> }) {
  const entrega = useEntrega("Libro en Excel", { formato: "xlsx", articulo: "el" });
  return (
    <ul>
      <li className="fila">
        <p className="texto">Las hojas del equipo, en un archivo.</p>
        <div className="accion">
          <button type="button" disabled={entrega.enCurso} onClick={() => { void entrega.ejecutar(generar); }}>Generar libro</button>
        </div>
        <EntregaEnFila entrega={entrega} className="pie" />
      </li>
    </ul>
  );
}

describe("anclada y fila: los envoltorios de Monitoreo", () => {
  it("anclada: el contenedor flota en el ancla que contiene al disparador", async () => {
    await act(async () => { root.render(<BancoAnclada generar={async () => archivoCsv("a", "carga-de-campo.xls")} />); });
    await act(async () => { boton("Descargar Excel").click(); });
    const lista = contenedor("anclada");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.parentElement?.classList.contains("mon-entrega-anclaje")).toBe(true);
    expect(lista?.parentElement?.contains(boton("Descargar Excel"))).toBe(true);
    sinResaltadoNiSpinner(lista as HTMLElement);
  });

  it("fila: el disparador conserva su celda y el contenedor va bajo la fila entera, no en la celda del botón", async () => {
    const d = diferida();
    await act(async () => { root.render(<BancoFila generar={() => d.promesa} />); });
    // Sin generación, la fila no gana un renglón vacío.
    expect(document.querySelector(".mon-entrega-fila")).toBeNull();
    await act(async () => { boton("Generar libro").click(); });
    expect(boton("Generar libro").disabled).toBe(true);
    const enCurso = contenedor("fila");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    // Su propia línea, hermana de la celda de acción y del texto: no compite con ellos por ancho.
    expect(enCurso?.parentElement?.classList.contains("mon-entrega-fila")).toBe(true);
    expect(enCurso?.parentElement?.classList.contains("pie")).toBe(true);
    expect(enCurso?.parentElement?.parentElement?.classList.contains("fila")).toBe(true);
    expect(boton("Generar libro").closest(".accion")?.contains(enCurso as Node)).toBe(false);
    await act(async () => { d.resolver({ ok: false, error: { code: "E_AULAS_SIN_PLAN", message: "Primero importa el plan." } }); await d.promesa; });
    const fallo = contenedor("fila");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("Primero importa el plan.");
    expect(fallo?.querySelector("button[aria-label='Reintentar']")).not.toBeNull();
    sinResaltadoNiSpinner(fallo as HTMLElement);
  });
});

describe("Salidas: el pie de la fila", () => {
  it("va del texto a la acción en su propio renglón, en ancho y en compacto (H1: el texto vecino quedaba en 0 px)", () => {
    const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../salidas/estandar/salidasDeMonitoreo.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const fila = /\.mon-sal-fila\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(fila).toMatch(/grid-template-columns:\s*36px minmax\(0, 1fr\) auto/);
    const pie = /\.mon-sal-pie\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(pie).toMatch(/grid-column:\s*2 \/ -1/);
    expect(pie).toMatch(/min-width:\s*0/);
    const fuente = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../profiles/aulas/avance/SalidasAulas.tsx"), "utf8");
    expect(fuente).toMatch(/pie:[^\n]*<EntregaEnFila entrega=\{libroExcel\} className="mon-sal-pie" \/>/);
    expect(fuente).not.toMatch(/<EntregaEnFila[^>]*>\s*<PulsoButton/);
  });
});
