// @vitest-environment happy-dom
/**
 * Hojas de ruta entrega por el kit (ADR 0133, fase 5): una prueba por forma que
 * usa el módulo, sobre componentes reales.
 *
 * - bloque: el informe de diseño muestral (job del motor que sigue el kit);
 * - anclada: el Excel de la matriz poblacional (del motor) y el CSV de la vista
 *   (archivo local del kit), bajo el menú «Descargar» del cajón;
 * - fila: la hoja del día de una jornada, en su celda del plan.
 *
 * Lo que vigila es lo que pidió Gonzalo: el disparador sólo se deshabilita (sin
 * spinner ni cambio de rótulo), lo único que se mueve es la línea del
 * contenedor, y dentro del contenedor no hay enlaces ni botones primarios.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  informe: vi.fn<(formato: string) => Promise<unknown>>(),
  matriz: vi.fn<(config: unknown) => Promise<unknown>>(),
  /** El callback del poll del job: la prueba decide cuándo termina. */
  poll: null as null | ((update: unknown) => void),
}));

vi.mock("../../../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
vi.mock("../../../../hooks/useJob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../hooks/useJob")>()),
  iniciarJobPoll: (_id: string, alActualizar: (update: unknown) => void) => {
    espia.poll = alActualizar;
    return () => undefined;
  },
}));
// El nombre del CSV lleva el código de la Ficha del estudio (ADR 0133 §3).
vi.mock("../../../../api/planner", () => ({ apiPlannerEstado: async () => ({ planner: { estudio: { codigo: "HSVG2026" } } }) }));
vi.mock("../../../../api/workspace", () => ({ apiProjectStatus: async () => ({ path: "/Users/ana/hsvg.pulso" }) }));
vi.mock("../../../../api/hojasRuta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/hojasRuta")>()),
  apiHojasRutaReporteDecisionalIniciar: espia.informe,
  apiHojasRutaPopulationExport: espia.matriz,
}));

const { ApiError } = await import("../../../../api/core");
const { useBandejaEntregables } = await import("../../../../components/entregables/bandejaStore");
const { fechaDelNombre } = await import("../../../../components/entregables/archivoLocal");
const { InformeDiseno } = await import("../seleccion/InformeDiseno");
const { HojaDelDia } = await import("../seleccion/HojaDelDia");
const { PoblacionCajon } = await import("../poblacion/PoblacionCajon");
const { useLienzoHojasRuta } = await import("../store");

let host: HTMLDivElement;
let root: Root;

type Diferida = { promesa: Promise<unknown>; resolver: (v: unknown) => void };
function diferida(): Diferida {
  let resolver: (v: unknown) => void = () => undefined;
  const promesa = new Promise<unknown>((res) => { resolver = res; });
  return { promesa, resolver };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.informe.mockReset();
  espia.matriz.mockReset();
  espia.poll = null;
  useBandejaEntregables.getState().vaciar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

function boton(texto: string): HTMLButtonElement {
  const b = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
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

describe("bloque: el informe de diseño muestral", () => {
  it("el kit sigue el job: el botón sólo se deshabilita, la línea es del contenedor y al terminar se descarga el archivo", async () => {
    espia.informe.mockResolvedValue({ ok: true, job_id: "j1", formato: "html" });
    await act(async () => { root.render(<InformeDiseno deshabilitado={false} />); });
    await act(async () => { boton("Descargar el informe").click(); });

    expect(espia.informe).toHaveBeenCalledWith("html");
    const disparador = boton("Descargar el informe");
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe("Descargar el informe");
    const enCurso = contenedor("bloque");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.querySelector(".pulso-barra-avance")).not.toBeNull();
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    // Contrato del motor (pendiente en el backend): el job devuelve el archivo registrado.
    await act(async () => {
      espia.poll?.({ snapshot: { status: "done", result_data: { ok: true, file_id: "inf1", filename: "HSVG2026_Reporte_de_muestra_territorial_10_11_26.html" } } });
    });
    const lista = contenedor("bloque");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("HSVG2026_Reporte_de_muestra_territorial_10_11_26.html");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/inf1/download", "HSVG2026_Reporte_de_muestra_territorial_10_11_26.html");
    expect(boton("Descargar el informe").disabled).toBe(false);
  });

  it("fallo: la causa legible con su código en el contenedor, una sola alerta", async () => {
    espia.informe.mockRejectedValue(new ApiError("E_NO_SAMPLE_SIZE", "Ejecuta el cálculo de tamaño muestral antes de generar el reporte."));
    await act(async () => { root.render(<InformeDiseno deshabilitado={false} />); });
    await act(async () => { boton("Descargar el informe").click(); });
    const fallo = contenedor("bloque");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo generar el informe de diseño muestral");
    expect(fallo?.textContent).toContain("Ejecuta el cálculo de tamaño muestral");
    expect(fallo?.textContent).toContain("E_NO_SAMPLE_SIZE");
    expect(host.querySelectorAll("[role='alert']")).toHaveLength(1);
  });
});

describe("anclada: el Excel de la matriz poblacional bajo el menú «Descargar»", () => {
  const matriz = {
    vigente: true, pesoPorRango: [1], total: 100, porUbigeo: { "150101": 100 },
    filas: [{ ubigeo: "150101", territorio: "150101", porRango: [{ H: 40, M: 60 }], total: 100 }],
  };

  it("flota junto al menú, el menú no cambia de rótulo y el error sale con la causa legible, sin el código pegado", async () => {
    useLienzoHojasRuta.getState().setCajonPoblacion("matriz");
    const d = diferida();
    espia.matriz.mockReturnValue(d.promesa);
    await act(async () => {
      root.render(<PoblacionCajon matriz={matriz} rangos={[{ id: "r1", label: "18-29", min: 18, max: 29 }]} sexo zonas={[]} config={{}} />);
    });
    await act(async () => { boton("Descargar la matriz: Descargar").click(); });
    await act(async () => { boton("Excel, por distrito").click(); });

    expect(espia.matriz).toHaveBeenCalledTimes(1);
    const enCurso = contenedor("anclada");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.parentElement?.classList.contains("hr-entrega-anclaje")).toBe(true);
    // Una sola señal: el disparador del menú se deshabilita y conserva su rótulo.
    expect(boton("Descargar la matriz: Descargar").disabled).toBe(true);
    expect(boton("Descargar la matriz: Descargar").textContent).toBe("Descargar");
    sinResaltadoNiSpinner(enCurso as HTMLElement);

    await act(async () => { d.resolver({ ok: true, file_id: "m1", filename: "HSVG2026_Matriz_poblacional_10_11_26.xlsx", size: [2048] }); await d.promesa; });
    const lista = contenedor("anclada");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("2 KB");
    expect(boton("Descargar la matriz: Descargar").disabled).toBe(false);
    sinResaltadoNiSpinner(lista as HTMLElement);
  });

  it("el formato real del error (« · E_…») no deja el código dentro de la causa", async () => {
    useLienzoHojasRuta.getState().setCajonPoblacion("matriz");
    espia.matriz.mockRejectedValue(new Error("La configuración no tiene territorios. · E_HOJAS_RUTA_SIN_TERRITORIOS"));
    await act(async () => {
      root.render(<PoblacionCajon matriz={matriz} rangos={[{ id: "r1", label: "18-29", min: 18, max: 29 }]} sexo={false} zonas={[]} config={{}} />);
    });
    await act(async () => { boton("Descargar la matriz: Descargar").click(); });
    await act(async () => { boton("Excel, por distrito").click(); });
    const fallo = contenedor("anclada");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    const causa = fallo?.querySelector(".pulso-entregable-meta--fallo")?.textContent ?? "";
    expect(causa).toContain("La configuración no tiene territorios.");
    expect(causa).not.toContain("E_HOJAS_RUTA_SIN_TERRITORIOS");
    expect(fallo?.querySelector(".pulso-entregable-codigo")?.textContent).toBe("E_HOJAS_RUTA_SIN_TERRITORIOS");
  });
});

describe("anclada: el CSV de esta vista, armado en el front", () => {
  it("sale por el mismo contenedor como archivo local, con su nombre, sin enlaces", async () => {
    useLienzoHojasRuta.getState().setCajonPoblacion("matriz");
    await act(async () => {
      root.render(
        <PoblacionCajon
          matriz={{ vigente: true, pesoPorRango: [1], total: 100, porUbigeo: { "150101": 100 }, filas: [{ ubigeo: "150101", territorio: "150101", porRango: [{ H: 40, M: 60 }], total: 100 }] }}
          rangos={[{ id: "r1", label: "18-29", min: 18, max: 29 }]}
          sexo={false}
          zonas={[]}
          config={{}}
        />,
      );
    });
    await act(async () => { boton("Descargar la matriz: Descargar").click(); });
    await act(async () => { boton("CSV de esta vista").click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(espia.matriz).not.toHaveBeenCalled();
    const lista = contenedor("anclada");
    expect(lista?.dataset.entregableFase).toBe("lista");
    const nombre = `HSVG2026_Matriz_poblacional_${fechaDelNombre()}.csv`;
    expect(lista?.textContent).toContain(nombre);
    expect(lista?.parentElement?.classList.contains("hr-entrega-anclaje")).toBe(true);
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith(expect.any(String), nombre);
  });
});

describe("fila: la hoja del día de una jornada", () => {
  it("la celda conserva su botón deshabilitado y el contenedor queda debajo, en la misma celda", async () => {
    const d = diferida();
    const generar = vi.fn(() => d.promesa);
    await act(async () => { root.render(<HojaDelDia jornada="J03" generar={generar} />); });
    await act(async () => { boton("Hoja del día de la jornada J03").click(); });

    const disparador = boton("Hoja del día de la jornada J03");
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe("Hoja del día");
    const celda = disparador.closest(".hr-entrega-celda");
    expect(celda?.querySelector<HTMLElement>("[data-entregable-forma='fila']")?.dataset.entregableFase).toBe("en_curso");

    await act(async () => { d.resolver({ ok: true, file_id: "h1", filename: "HSVG2026_Hoja_del_dia_J03_10_11_26.pdf" }); await d.promesa; });
    const lista = celda?.querySelector<HTMLElement>("[data-entregable-forma='fila']");
    expect(lista?.dataset.entregableFase).toBe("lista");
    sinResaltadoNiSpinner(lista as HTMLElement);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/h1/download", "HSVG2026_Hoja_del_dia_J03_10_11_26.pdf");
  });

  it("el error queda en la misma fila, con Reintentar", async () => {
    const generar = vi.fn(() => Promise.reject(new ApiError("E_NOT_FOUND", "La jornada J09 no existe en el plan de campo con estos supuestos.")));
    await act(async () => { root.render(<HojaDelDia jornada="J09" generar={generar} />); });
    await act(async () => { boton("Hoja del día de la jornada J09").click(); });
    const fallo = contenedor("fila");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("La jornada J09 no existe");
    expect(fallo?.querySelector("button[aria-label='Reintentar']")).not.toBeNull();
  });
});
