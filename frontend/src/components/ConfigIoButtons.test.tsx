// @vitest-environment happy-dom
/**
 * ConfigIoButtons sobre el kit de entregables (ADR 0133, fase 5): exportar arma
 * el JSON en el front y lo entrega `useGeneracion` en un contenedor en forma
 * bloque, en su propia línea bajo los botones; importar sigue siendo una línea
 * de estado. El botón no gira ni cambia de rótulo, y el nombre lleva la fecha
 * como los del motor, no la hora en milisegundos.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espia = vi.hoisted(() => ({ descargar: vi.fn() }));
vi.mock("../lib/descargas", () => ({ descargarArchivo: espia.descargar }));

const { ConfigIoButtons } = await import("./ConfigIoButtons");
const { useBandejaEntregables } = await import("./entregables/bandejaStore");
const { fechaDelNombre } = await import("./entregables/archivoLocal");

let host: HTMLDivElement;
let root: Root;
const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
let blobs: Blob[];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  useBandejaEntregables.getState().vaciar();
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return "blob:config"; });
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  URL.createObjectURL = original.crear;
  URL.revokeObjectURL = original.revocar;
});

function boton(nombre: string): HTMLButtonElement {
  const b = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((x) => x.getAttribute("aria-label") === nombre);
  if (!b) throw new Error(`Sin botón "${nombre}"`);
  return b;
}

describe("exportar: bloque del kit con un JSON armado en el front", () => {
  it("entrega el JSON con fecha en el nombre, sin spinner ni otro rótulo, y el contenedor en su propia línea", async () => {
    let soltar: (v: unknown) => void = () => undefined;
    const onExport = vi.fn(() => new Promise<unknown>((res) => { soltar = res; }));
    await act(async () => {
      root.render(
        <ConfigIoButtons onExport={onExport} onImport={vi.fn()} filenamePrefix="pulso_logica" exportTitulo="Lógica SurveyMonkey" exportLabel="Exportar lógica JSON" />,
      );
    });
    const exportar = boton("Exportar lógica JSON");
    await act(async () => { exportar.click(); });

    // Mientras arma el payload: el botón solo se deshabilita y la espera es la línea del contenedor.
    expect(exportar.disabled).toBe(true);
    expect(exportar.textContent?.trim()).toBe("Exportar lógica JSON");
    expect(host.querySelectorAll(".pulso-spin, [class*='spin']")).toHaveLength(0);
    const bloque = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(bloque?.dataset.entregableFase).toBe("en_curso");
    expect(bloque?.textContent).toContain("Lógica SurveyMonkey");
    expect(bloque?.parentElement?.className).toBe("pulso-config-io-entrega");

    await act(async () => { soltar({ reglas: [{ de: "p1", a: "p3" }] }); });
    const nombre = `pulso_logica_${fechaDelNombre()}.json`;
    expect(host.querySelector("[data-entregable-forma='bloque']")?.getAttribute("data-entregable-fase")).toBe("lista");
    expect(host.textContent).toContain(nombre);
    expect(espia.descargar).toHaveBeenCalledWith("blob:config", nombre);
    expect(JSON.parse(await blobs[0].text())).toEqual({ reglas: [{ de: "p1", a: "p3" }] });
    expect(exportar.disabled).toBe(false);
    expect(host.querySelectorAll("a")).toHaveLength(0);
    expect(host.querySelectorAll(".pulso-button--primary")).toHaveLength(0);
    // Ya no hay chip "Exportado ✓": el contenedor dice cómo quedó el archivo.
    expect(host.querySelector(".pulso-config-io-estado")).toBeNull();
  });

  it("un fallo al armar el payload se dice en el contenedor con Reintentar", async () => {
    await act(async () => {
      root.render(<ConfigIoButtons onExport={async () => { throw new Error("Sin configuración guardada"); }} onImport={vi.fn()} />);
    });
    await act(async () => { boton("Exportar JSON").click(); });
    const bloque = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(bloque?.dataset.entregableFase).toBe("fallo");
    expect(bloque?.textContent).toContain("No se pudo generar la configuración");
    expect(bloque?.textContent).toContain("Sin configuración guardada");
    expect(espia.descargar).not.toHaveBeenCalled();
  });
});

describe("importar: línea de estado, sin contenedor", () => {
  async function subir(texto: string) {
    const input = host.querySelector<HTMLInputElement>("input[type='file']");
    if (!input) throw new Error("Sin input de archivo");
    Object.defineProperty(input, "files", { value: [new File([texto], "plantilla.json", { type: "application/json" })], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  }

  it("pasa el JSON leído y muestra el mensaje que devuelve el consumidor", async () => {
    const onImport = vi.fn(async () => "Plantilla aplicada");
    await act(async () => { root.render(<ConfigIoButtons onExport={vi.fn()} onImport={onImport} />); });
    await subir('{"a":1}');
    expect(onImport).toHaveBeenCalledWith({ a: 1 });
    expect(host.querySelector("[role='status']")?.textContent?.trim()).toBe("Plantilla aplicada");
    expect(host.querySelector("[data-entregable-forma]")).toBeNull();
  });

  it("un archivo que no es JSON se dice como error", async () => {
    await act(async () => { root.render(<ConfigIoButtons onExport={vi.fn()} onImport={vi.fn()} />); });
    await subir("{no");
    expect(host.querySelector("[role='alert']")?.textContent).toMatch(/^ ?JSON inválido/);
  });
});
