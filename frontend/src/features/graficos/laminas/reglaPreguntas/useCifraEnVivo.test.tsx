// La cifra en vivo: el borrador se ve al instante, se confirma al soltar o tras la espera, y cae cuando lo guardado lo
// alcanza o cambia el tipo de regla.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESPERA_CIFRA_MS, useCifraEnVivo, type CifraEnVivo } from "./useCifraEnVivo";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; window?: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof g.window === "undefined") g.window = { HTMLIFrameElement: class {} };
const doc = { nodeType: 9, documentElement: { namespaceURI: "http://www.w3.org/1999/xhtml" }, addEventListener: () => undefined, removeEventListener: () => undefined };
const contenedor = () => ({ nodeType: 1, tagName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as Element;

let ultimo: CifraEnVivo | null = null;
const confirmar = vi.fn();
function Prueba({ guardado, clave }: { guardado: number; clave: string }) {
  ultimo = useCifraEnVivo(guardado, clave, confirmar);
  return null;
}

let root: Root | null = null;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { act(() => root?.unmount()); root = null; ultimo = null; confirmar.mockClear(); vi.useRealTimers(); });

describe("useCifraEnVivo", () => {
  it("mover se ve al instante y se confirma una vez al soltar; lo guardado alcanzado limpia el borrador", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Prueba guardado={10} clave="mayor_diferencia" />); });
    await act(async () => { ultimo?.mover(12); });
    await act(async () => { ultimo?.mover(13); });
    expect(ultimo?.valor).toBe(13);
    expect(ultimo?.enVivo).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
    await act(async () => { ultimo?.soltar(); });
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith(13);
    await act(async () => { root?.render(<Prueba guardado={13} clave="mayor_diferencia" />); });
    expect(ultimo?.enVivo).toBe(false);
    expect(ultimo?.valor).toBe(13);
  });

  it("sin soltar (teclado, escritura) confirma tras la espera; cambiar de tipo descarta el borrador", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Prueba guardado={60} clave="bajo_umbral" />); });
    await act(async () => { ultimo?.mover(70); });
    await act(async () => { vi.advanceTimersByTime(ESPERA_CIFRA_MS); });
    expect(confirmar).toHaveBeenCalledWith(70);
    await act(async () => { ultimo?.mover(80); });
    await act(async () => { root?.render(<Prueba guardado={15} clave="diferencia_minima" />); });
    expect(ultimo?.valor).toBe(15);
    await act(async () => { vi.advanceTimersByTime(ESPERA_CIFRA_MS * 2); });
    expect(confirmar).toHaveBeenCalledTimes(1);
  });
});
