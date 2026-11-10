// @vitest-environment happy-dom
/**
 * Cálculo de muestra entrega por el kit (ADR 0133, fase 5). El módulo usa una
 * sola forma, el bloque (tarjetas, cabecera de panel y paquete), y esta prueba
 * la recorre sobre componentes reales:
 *
 * - la solicitud para DTI: el motor responde JSON con `export.file_id` (antes
 *   el front lo leía como blob y bajaba ese JSON con extensión .xlsx);
 * - el listado de la selección vigente, en bloque bajo la cabecera del panel;
 * - la tarjeta del reporte: sin «Ver reporte» ni URL de descarga, el contenedor
 *   en bloque bajo su fila y el botón sin spinner ni cambio de rótulo.
 *
 * Y los normalizadores conservan el meta del entregable (`guardado_en`, peso,
 * rótulo): sin eso el kit descarga lo que el motor ya copió junto al proyecto.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  red: { cuerpo: {} as unknown, estado: 200, espera: Promise.resolve() as Promise<unknown> },
}));

vi.mock("../../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
  headers: (extra?: Record<string, string>) => ({ ...(extra ?? {}) }),
  apiFetch: async () => {
    await espia.red.espera;
    return new Response(JSON.stringify(espia.red.cuerpo), { status: espia.red.estado, headers: { "Content-Type": "application/json" } });
  },
}));

const { apiCalcMuestraSolicitudDtiExportar, apiCalcMuestraAulasExportar, normalizeCalcMuestraArchivoExportado } = await import("../../../api/calcMuestra");
const { apiCalcMuestraGeneralExportar } = await import("../../../api/calcMuestraGeneral");
const { archivoDesdeRespuesta } = await import("../../../components/entregables/archivoDesdeRespuesta");
const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { SolicitudDtiButton } = await import("../universidad/definicion/SolicitudDtiButton");
const { ReporteMetodologicoCard } = await import("../didactica/ReporteMetodologicoCard");
const { SalidasEntregablesTab } = await import("../universidad/salidas/SalidasEntregablesTab");
const { memoriaDefensaComoArchivo } = await import("./memoriaDefensa");

const GUARDADO = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Cálculo de muestra\\HSVG2026_Solicitud_DTI_10_11_26.xlsx";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.red.estado = 200;
  espia.red.espera = Promise.resolve();
  useBandejaEntregables.getState().vaciar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function boton(texto: string): HTMLButtonElement {
  const b = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((x) => x.getAttribute("aria-label") === texto || x.textContent?.trim() === texto);
  if (!b) throw new Error(`Sin botón "${texto}"`);
  return b;
}

describe("normalizadores: el archivo y su meta", () => {
  it("la solicitud DTI lee export.file_id y conserva el meta del entregable con escalares de R", async () => {
    espia.red.cuerpo = {
      ok: true,
      export: { ok: true, file_id: ["dti1"], filename: ["HSVG2026_Solicitud_DTI_10_11_26.xlsx"], size: [4096], guardado_en: [GUARDADO], modulo: "Cálculo de muestra" },
    };
    const r = await apiCalcMuestraSolicitudDtiExportar({ variables: [] });
    expect(r).toMatchObject({ file_id: "dti1", filename: "HSVG2026_Solicitud_DTI_10_11_26.xlsx", size: 4096, guardado_en: GUARDADO });
    expect(archivoDesdeRespuesta(r)[0]).toMatchObject({ fileId: "dti1", guardadoEn: GUARDADO, tamano: 4096, formato: "xlsx" });
  });

  it("el anexo de cursos-horario y el listado general también conservan guardado_en", async () => {
    espia.red.cuerpo = { ok: true, export: { file_id: "a1", filename: "Anexo.xlsx", size: 10, guardado_en: GUARDADO }, state: {} };
    expect((await apiCalcMuestraAulasExportar()).export.guardado_en).toBe(GUARDADO);
    espia.red.cuerpo = { ok: true, export: { file_id: "g1", filename: "Listado.xlsx", size: 10 }, guardado_en: GUARDADO };
    expect((await apiCalcMuestraGeneralExportar("c1")).guardado_en).toBe(GUARDADO);
  });

  it("sin file_id no hay archivo: lo dice en vez de entregar un vacío", () => {
    expect(() => normalizeCalcMuestraArchivoExportado({ ok: true, export: {} }, "la solicitud para DTI")).toThrow(/no devolvió el archivo de la solicitud para DTI/);
  });
});

describe("bloque: la solicitud para DTI", () => {
  it("el botón sólo se deshabilita, el contenedor queda en su propio renglón y descarga con el nombre del motor", async () => {
    let resolver: (v: unknown) => void = () => undefined;
    const pendiente = new Promise<unknown>((res) => { resolver = res; });
    espia.red.espera = pendiente;
    espia.red.cuerpo = { ok: true, export: { file_id: "dti2", filename: "HSVG2026_Solicitud_DTI_10_11_26.xlsx", size: 2048 } };
    await act(async () => { root.render(<SolicitudDtiButton />); });
    await act(async () => { boton("Exportar solicitud para DTI (XLSX)").click(); });

    const disparador = boton("Exportar solicitud para DTI (XLSX)");
    expect(disparador.disabled).toBe(true);
    expect(disparador.textContent?.trim()).toBe("Exportar solicitud para DTI (XLSX)");
    expect(host.querySelector("[data-entregable-forma='bloque']")?.getAttribute("data-entregable-fase")).toBe("en_curso");
    expect(host.querySelectorAll(".pulso-spin, [class*='spin']")).toHaveLength(0);

    await act(async () => { resolver(null); await pendiente; await new Promise((r) => setTimeout(r, 0)); });
    const lista = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.parentElement?.classList.contains("cmv2-defi-dti")).toBe(true);
    expect(lista?.querySelectorAll("a")).toHaveLength(0);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/dti2/download", "HSVG2026_Solicitud_DTI_10_11_26.xlsx");
  });

  it("fallo: la causa con su código en el contenedor, sin otra alerta suelta", async () => {
    espia.red.estado = 400;
    espia.red.cuerpo = { error: { code: "E_CALC_MUESTRA_DTI_INPUT", message: "La solicitud no trae variables." } };
    await act(async () => { root.render(<SolicitudDtiButton />); });
    await act(async () => { boton("Exportar solicitud para DTI (XLSX)").click(); await new Promise((r) => setTimeout(r, 0)); });
    const fallo = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("No se pudo generar la solicitud de base para DTI");
    expect(fallo?.textContent).toContain("E_CALC_MUESTRA_DTI_INPUT");
    expect(host.querySelectorAll("[role='alert']")).toHaveLength(1);
  });
});

describe("bloque: la tarjeta del reporte metodológico", () => {
  const noop = () => undefined;
  const base = { puedeGenerar: true, formato: "html" as const, onFormato: noop, onGenerar: noop, aulasListas: true, onExportarAulas: noop };

  it("en curso: el botón sólo se deshabilita, sin «Generando…», y el contenedor va bajo la fila", () => {
    const html = renderToStaticMarkup(
      <ReporteMetodologicoCard
        {...base}
        reporte={{ estado: { fase: "en_curso", titulo: "Reporte metodológico", porcentaje: 40 }, onCerrar: noop }}
        anexo={{ estado: { fase: "inactiva" }, onCerrar: noop }}
      />,
    );
    // «Generando» sólo lo dice el contenedor; el botón conserva su rótulo.
    expect(html).not.toContain("Generando…");
    expect(html.match(/<button[^>]*class="cmv2-primary"[^>]*>[\s\S]*?<\/button>/)?.[0]).not.toContain("Generando");
    expect(html).not.toMatch(/spin/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Generar reporte/);
    expect(html).toContain('data-entregable-forma="bloque"');
    expect(html).toContain('data-entregable-fase="en_curso"');
  });

  it("listo: sin «Ver reporte» ni enlaces; el archivo lo muestra el contenedor", () => {
    const html = renderToStaticMarkup(
      <ReporteMetodologicoCard
        {...base}
        reporte={{
          estado: { fase: "lista", titulo: "Reporte metodológico", archivos: [{ fileId: "r1", nombre: "HSVG2026_Reporte_de_muestra_10_11_26.html", formato: "html" }] },
          onCerrar: noop,
        }}
        anexo={{ estado: { fase: "inactiva" }, onCerrar: noop }}
      />,
    );
    expect(html).not.toContain("Ver reporte");
    expect(html).not.toContain("<a ");
    expect(html).toContain("HSVG2026_Reporte_de_muestra_10_11_26.html");
  });
});

describe("bloque: el paquete de defensa, una pieza por contenedor", () => {
  it("la memoria JSON es un archivo local del kit con su nombre y su contenido", async () => {
    const local = memoriaDefensaComoArchivo({ semilla: 42 }, new Date("2026-11-10T12:00:00Z"));
    expect(local.nombre).toBe("memoria-defensa-2026-11-10.json");
    expect(local.blob.type).toBe("application/json");
    expect(JSON.parse(await local.blob.text())).toEqual({ semilla: 42 });
  });

  it("las tres piezas en sus contenedores y el botón sin spinner ni «Generando paquete…»", () => {
    const noop = () => undefined;
    const lista = (nombre: string, formato: string) => ({
      estado: { fase: "lista" as const, titulo: nombre, archivos: [{ fileId: nombre, nombre, formato }] },
      onCerrar: noop,
    });
    const html = renderToStaticMarkup(
      <SalidasEntregablesTab
        model={{ selectionReady: true, replacementReady: false } as never}
        workspace={{} as never}
        onWorkspace={noop}
        reporte={{
          puedeGenerar: true, disponible: false, formato: "html", onFormato: noop, onGenerar: noop,
          reporte: { estado: { fase: "inactiva" }, onCerrar: noop }, aulasListas: true,
        }}
        paquete={{
          puedeGenerar: true,
          enCurso: true,
          onGenerar: noop,
          entregas: {
            reporte: lista("Reporte.html", "html"),
            anexo: lista("Anexo.xlsx", "xlsx"),
            memoria: { estado: { fase: "en_curso", titulo: "Memoria JSON de reproducibilidad", porcentaje: null }, onCerrar: noop },
          },
        }}
      />,
    );
    const piezas = html.slice(html.indexOf("cmv2-sal-paquete-piezas"));
    expect(piezas.match(/data-entregable-forma="bloque"/g)).toHaveLength(3);
    expect(piezas).toContain("Memoria JSON de reproducibilidad");
    expect(html).not.toContain("Generando paquete");
    expect(html).not.toMatch(/pulso-spin/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Generar paquete de defensa/);
  });
});
