// @vitest-environment happy-dom
/**
 * Material de campo entrega por el kit (ADR 0133, fase 5): una prueba por forma
 * que usa el módulo, sobre componentes reales.
 *
 * - bloque: la base de supervisión (tarjeta) y las hojas de conteo de todas las zonas (cabecera);
 * - fila: la hoja de conteo de una zona, en su celda;
 * - anclada: el Excel de asignación, en la barra de acciones (alineada al inicio).
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
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  supervision: vi.fn<(id: string) => Promise<unknown>>(),
  papel: vi.fn<(id: string, pieza: string, opciones: unknown) => Promise<unknown>>(),
  asignacion: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock("../../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
vi.mock("../../../api/materialSupervision", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/materialSupervision")>()),
  apiSupervisionExcel: espia.supervision,
}));
vi.mock("../../../api/materialTerritorial", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/materialTerritorial")>()),
  apiMaterialTerritorialPapel: espia.papel,
  apiMaterialTerritorialExcelAsignacion: espia.asignacion,
}));

const { normalizarColumnasDeSupervision } = await import("../../../api/materialSupervision");
const { normalizarUnidadesTerritoriales } = await import("../../../api/materialTerritorial");
const { ApiError } = await import("../../../api/core");
const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { EntregaSupervision } = await import("../supervision/SeccionesSupervision");
const { ZonasDeCuotas } = await import("../territorial/ZonasDeCuotas");
const { ExcelDeAsignacion } = await import("../territorial/ExcelDeAsignacion");

const COLUMNAS = normalizarColumnasDeSupervision({
  campaign_id: "supervision.ronda-1", llave: "Código",
  disponibles: { barrido: ["Nombre"], resultados: [] },
  elegidas: { barrido: [], resultados: [] },
  fijas: ["Veredicto"], veredictos: ["Confirmada"], revision: [0],
});

const UNIDADES = normalizarUnidadesTerritoriales({
  campaign_id: "territorial.principal", fase: "field", kind: "cuotas", n_zonas: 1, n_entrevistas: 5,
  units: [{ unit_id: "150103", role: "zona", label: "ATE", n: 5, cuotas: [{ sexo: "Hombre", rango_id: "r1", rango_edad: "18-29", n: 5 }] }],
});

let host: HTMLDivElement;
let root: Root;

type Diferida = { promesa: Promise<unknown>; resolver: (v: unknown) => void; rechazar: (e: unknown) => void };
function diferida(): Diferida {
  let resolver: (v: unknown) => void = () => undefined;
  let rechazar: (e: unknown) => void = () => undefined;
  const promesa = new Promise<unknown>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.supervision.mockReset();
  espia.papel.mockReset();
  espia.asignacion.mockReset();
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

describe("bloque: la base de supervisión en su tarjeta", () => {
  async function montar() {
    await act(async () => {
      root.render(<MemoryRouter><EntregaSupervision campaignId="supervision.ronda-1" columnas={COLUMNAS} casos={2} sinLote={false} /></MemoryRouter>);
    });
  }

  it("en curso: el disparador sólo se deshabilita y la línea es del contenedor; listo: el archivo, sin enlaces", async () => {
    const d = diferida();
    espia.supervision.mockReturnValue(d.promesa);
    await montar();
    await act(async () => { boton("Excel de la supervisión").click(); });

    const disparador = boton("Excel de la supervisión");
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe("Excel de la supervisión");
    const enCurso = contenedor("bloque");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.querySelector(".pulso-barra-avance")).not.toBeNull();
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    await act(async () => { d.resolver({ ok: true, file_id: "f1", filename: "HSVG2026_Base_de_supervision_Ronda_1_10_11_26.xlsx", casos: 2 }); await d.promesa; });
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("HSVG2026_Base_de_supervision_Ronda_1_10_11_26.xlsx");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f1/download", "HSVG2026_Base_de_supervision_Ronda_1_10_11_26.xlsx");
    expect(boton("Excel de la supervisión").disabled).toBe(false);
  });

  it("fallo: la causa con su código en el contenedor, con Reintentar, y nada en una línea suelta", async () => {
    espia.supervision.mockRejectedValue(new ApiError("E_SUPERVISION_SIN_LOTE", "El lote ya no existe."));
    await montar();
    await act(async () => { boton("Excel de la supervisión").click(); });
    const fallo = contenedor("bloque");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo generar la base de supervisión");
    expect(fallo?.textContent).toContain("El lote ya no existe.");
    expect(fallo?.textContent).toContain("E_SUPERVISION_SIN_LOTE");
    expect(boton("Reintentar")).toBeTruthy();
    sinResaltadoNiSpinner(fallo as HTMLElement);
    expect(host.querySelectorAll("[role='alert']")).toHaveLength(1);
  });
});

describe("fila y bloque de cabecera: las hojas de conteo por zona", () => {
  async function montar() {
    await act(async () => { root.render(<MemoryRouter><ZonasDeCuotas campaignId="territorial.principal" unidades={UNIDADES} /></MemoryRouter>); });
  }

  it("fila: la celda conserva su botón deshabilitado y el contenedor queda debajo, en la misma celda", async () => {
    const d = diferida();
    espia.papel.mockReturnValue(d.promesa);
    await montar();
    await act(async () => { boton("Hoja de conteo de ATE").click(); });

    expect(espia.papel).toHaveBeenCalledWith("territorial.principal", "conteo", { unidad: "150103" });
    const disparador = boton("Hoja de conteo de ATE");
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe("Generar");
    const celda = disparador.closest(".rec-entrega-celda");
    const enCurso = celda?.querySelector<HTMLElement>("[data-entregable-forma='fila']");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    sinResaltadoNiSpinner(enCurso as HTMLElement);
    // La cabecera es otra generación: sigue disponible.
    expect(boton("Hojas de conteo de todas").disabled).toBe(false);

    await act(async () => { d.resolver({ file_id: "z1", filename: "HSVG2026_Hoja_de_conteo_ATE_10_11_26.pdf" }); await d.promesa; });
    const lista = celda?.querySelector<HTMLElement>("[data-entregable-forma='fila']");
    expect(lista?.dataset.entregableFase).toBe("lista");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledTimes(1);
  });

  it("fila: el error queda en la misma fila, con Reintentar", async () => {
    espia.papel.mockRejectedValue(new ApiError("E_TERRITORIAL_PAPEL", "La zona no tiene cuotas."));
    await montar();
    await act(async () => { boton("Hoja de conteo de ATE").click(); });
    const fallo = contenedor("fila");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("La zona no tiene cuotas.");
    expect(fallo?.querySelector("button[aria-label='Reintentar']")).not.toBeNull();
    sinResaltadoNiSpinner(fallo as HTMLElement);
  });

  it("cabecera: «Hojas de conteo de todas» abre su contenedor en bloque bajo la cabecera", async () => {
    const d = diferida();
    espia.papel.mockReturnValue(d.promesa);
    await montar();
    await act(async () => { boton("Hojas de conteo de todas").click(); });
    expect(espia.papel).toHaveBeenCalledWith("territorial.principal", "conteo", { alcance: "todas" });
    expect(boton("Hojas de conteo de todas").disabled).toBe(true);
    expect(contenedor("bloque")?.dataset.entregableFase).toBe("en_curso");
    expect(contenedor("fila")).toBeNull();
    await act(async () => { d.resolver({ file_id: "t1", filename: "Hojas.pdf" }); await d.promesa; });
    expect(contenedor("bloque")?.dataset.entregableFase).toBe("lista");
  });
});

describe("anclada: el Excel de asignación en la barra de acciones", () => {
  it("flota bajo el botón (ancla al inicio), el botón sólo se deshabilita y el resultado no lleva enlaces", async () => {
    const d = diferida();
    espia.asignacion.mockReturnValue(d.promesa);
    await act(async () => {
      root.render(<ExcelDeAsignacion campaignId="territorial.principal" deshabilitado={false} aplicar={async () => true} />);
    });
    await act(async () => { boton("Excel para campo").click(); });

    const disparador = boton("Excel para campo");
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe("Excel para campo");
    const enCurso = contenedor("anclada");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.parentElement?.classList.contains("rec-entrega-anclaje")).toBe(true);
    expect(enCurso?.parentElement?.contains(disparador)).toBe(true);
    // El botón está al inicio de su fila: el contenedor se abre hacia la derecha (prop del kit).
    expect(enCurso?.getAttribute("data-entregable-alinear")).toBe("inicio");
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    await act(async () => { d.resolver({ file_id: "x1", filename: "Asignacion.xlsx", size_bytes: 2048 }); await d.promesa; });
    const lista = contenedor("anclada");
    expect(lista?.dataset.entregableFase).toBe("lista");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(boton("Excel para campo").disabled).toBe(false);
  });
});

describe("fila en la lista de material generado", () => {
  it("el contenedor baja a su propio renglón y no comparte la columna `auto` con el botón", () => {
    const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../styles/delivery.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const fila = /\.rec-artifact-list article\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(fila).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
    expect(/\.rec-artifact-list article > \.rec-entrega-celda\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/display:\s*contents/);
    expect(/\.rec-artifact-list article > \.rec-entrega-celda > \.pulso-entregable\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/grid-column:\s*2 \/ -1/);
  });
});
