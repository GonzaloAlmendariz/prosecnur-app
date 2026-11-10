// @vitest-environment happy-dom
/**
 * Dashboard › gráfico en pantalla completa › «Copiar» (DB-02/03, ADR 0133 fase 5).
 *
 * El portapapeles sigue igual: si acepta la imagen, el botón dice «Copiado» y
 * no hay archivo. Si no la acepta (Safari, Firefox sin permiso), el PNG ya no
 * baja por un enlace armado a mano: sale por el kit de entregables como archivo
 * local, en un contenedor en bloque entre la cabecera y el gráfico.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espia = vi.hoisted(() => ({ descargar: vi.fn() }));

vi.mock("../../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("html-to-image", () => ({ toBlob: async () => new Blob(["png"], { type: "image/png" }) }));

const { FullscreenScope } = await import("./FullscreenWrapper");
const { useBandejaEntregables } = await import("../../../components/entregables/bandejaStore");

let host: HTMLDivElement;
let root: Root;
const ctx = { maxed: true, open: () => undefined, close: () => undefined, toggle: () => undefined };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  useBandejaEntregables.getState().vaciar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function copiar() {
  await act(async () => { root.render(<FullscreenScope ctx={ctx} title="Satisfacción por sede"><div>gráfico</div></FullscreenScope>); });
  const boton = host.querySelector<HTMLButtonElement>("button[aria-label='Copiar el gráfico como imagen']");
  await act(async () => { boton?.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return boton;
}

describe("respaldo del portapapeles por el kit", () => {
  it("sin ClipboardItem, el PNG sale como archivo local en el contenedor, entre la cabecera y el gráfico", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    const boton = await copiar();
    const lista = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
    expect(lista?.dataset.entregableFase).toBe("lista");
    expect(lista?.textContent).toContain("satisfacci-n-por-sede.png");
    expect(lista?.previousElementSibling?.classList.contains("dash-fs-head")).toBe(true);
    expect(lista?.nextElementSibling?.classList.contains("dash-fs-body")).toBe(true);
    expect(lista?.querySelectorAll("a")).toHaveLength(0);
    expect(espia.descargar).toHaveBeenCalledWith(expect.any(String), "satisfacci-n-por-sede.png");
    expect(boton?.textContent).not.toContain("Descargado");
  });

  it("con portapapeles, «Copiado» en el botón y ningún archivo", async () => {
    const write = vi.fn(async () => undefined);
    vi.stubGlobal("ClipboardItem", class { constructor(public items: unknown) {} });
    vi.stubGlobal("navigator", { ...navigator, clipboard: { write } });
    const boton = await copiar();
    expect(write).toHaveBeenCalledTimes(1);
    expect(boton?.textContent).toContain("Copiado");
    expect(host.querySelector("[data-entregable-forma]")).toBeNull();
    expect(espia.descargar).not.toHaveBeenCalled();
  });
});
