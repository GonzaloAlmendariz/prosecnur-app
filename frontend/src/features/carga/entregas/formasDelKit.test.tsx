// @vitest-environment happy-dom
/**
 * Carga entrega por el kit (ADR 0133, fase 5): una prueba por forma que usa el
 * módulo, sobre componentes reales.
 *
 * - bloque: los botones .xlsx, .csv y .sav del resumen de respuestas, con el
 *   contenedor bajo su línea (antes: un aviso de carga lejano arriba del
 *   workbench y la ventana navegando a la URL del archivo);
 * - fila: «Descargar base» de cada base del estudio, con el contenedor al pie
 *   de la misma fila.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espia = vi.hoisted(() => ({
  descargar: vi.fn(),
  exportar: vi.fn<(format: string, base?: string | null) => Promise<unknown>>(),
}));

vi.mock("../../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));
vi.mock("../../../api/xlsformEditor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/xlsformEditor")>()),
  apiCargaExportNormalized: espia.exportar,
}));

const { ApiError } = await import("../../../api/core");
const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");
const { RespuestasResumen } = await import("../RespuestasResumen");
const { DescargaDeBaseEnFila, useDescargaDeBase } = await import("./DescargaDeBase");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.exportar.mockReset();
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

const PREVIEW = {
  n_filas: 120,
  n_columnas: 40,
  compatibilidad: null,
  normalizacion: { applied: true, aliases: 0, select_multiple: 2 },
  columnas: [],
} as unknown as Parameters<typeof RespuestasResumen>[0]["preview"];

describe("bloque: la base preparada del resumen de respuestas", () => {
  it("el botón del formato sólo se deshabilita y el contenedor va bajo la línea de descargas", async () => {
    let resolver: (v: unknown) => void = () => undefined;
    const generar = vi.fn(() => new Promise<unknown>((res) => { resolver = res; }));
    await act(async () => {
      root.render(
        <RespuestasResumen preview={PREVIEW} cambios={null} onCerrarCambios={() => undefined} mapeo={null} detallesNormalizacion={[]} exportar={{ disabled: false, generar }} />,
      );
    });
    await act(async () => { boton(".sav").click(); });

    expect(generar).toHaveBeenCalledWith("sav");
    for (const f of [".xlsx", ".csv", ".sav"]) expect(boton(f).disabled).toBe(true);
    const enCurso = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(enCurso?.dataset.entregableFase).toBe("en_curso");
    expect(enCurso?.previousElementSibling?.classList.contains("pulso-resp-descargas")).toBe(true);
    expect(host.querySelectorAll(".pulso-spin, [class*='spin']")).toHaveLength(0);

    await act(async () => { resolver({ ok: true, file_id: "n1", original_name: "HSVG2026_Base_normalizada_10_11_26.sav", size: 4096 }); });
    const lista = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.querySelectorAll("a")).toHaveLength(0);
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/n1/download", "HSVG2026_Base_normalizada_10_11_26.sav");
    expect(boton(".xlsx").disabled).toBe(false);
  });
});

function FilaDeBase({ nombre }: { nombre: string }) {
  const descarga = useDescargaDeBase(nombre);
  return (
    <div className="pulso-base-row">
      <button type="button" aria-label={`Descargar base ${nombre}`} disabled={descarga.estado.fase === "en_curso"} onClick={descarga.descargar}>
        Descargar base
      </button>
      <DescargaDeBaseEnFila gen={descarga} />
    </div>
  );
}

describe("fila: «Descargar base» de cada base", () => {
  it("pide el Excel de esa base y el contenedor ocupa el pie de su fila", async () => {
    let resolver: (v: unknown) => void = () => undefined;
    espia.exportar.mockReturnValue(new Promise<unknown>((res) => { resolver = res; }));
    await act(async () => { root.render(<><FilaDeBase nombre="docentes" /><FilaDeBase nombre="alumnos" /></>); });
    expect(host.querySelector("[data-entregable-forma]")).toBeNull();
    await act(async () => { boton("Descargar base docentes").click(); });

    expect(espia.exportar).toHaveBeenCalledWith("xlsx", "docentes");
    expect(boton("Descargar base docentes").disabled).toBe(true);
    expect(boton("Descargar base alumnos").disabled).toBe(false);
    const fila = host.querySelector<HTMLElement>("[data-entregable-forma='fila']");
    expect(fila?.dataset.entregableFase).toBe("en_curso");
    expect(fila?.closest(".pulso-base-row-entrega")).not.toBeNull();

    await act(async () => { resolver({ ok: true, file_id: "d1", original_name: "HSVG2026_Base_normalizada_docentes_10_11_26.xlsx" }); });
    expect(host.querySelector<HTMLElement>("[data-entregable-forma='fila']")?.dataset.entregableFase).toBe("lista");
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/d1/download", "HSVG2026_Base_normalizada_docentes_10_11_26.xlsx");
  });

  it("el error queda en la fila de esa base, con Reintentar", async () => {
    espia.exportar.mockRejectedValue(new ApiError("E_NO_DATA", "La base no tiene respuestas cargadas."));
    await act(async () => { root.render(<FilaDeBase nombre="docentes" />); });
    await act(async () => { boton("Descargar base docentes").click(); });
    const fallo = host.querySelector<HTMLElement>("[data-entregable-forma='fila']");
    expect(fallo?.dataset.entregableFase).toBe("fallo");
    expect(fallo?.textContent).toContain("La base no tiene respuestas cargadas.");
    expect(fallo?.querySelector("button[aria-label='Reintentar']")).not.toBeNull();
  });
});
