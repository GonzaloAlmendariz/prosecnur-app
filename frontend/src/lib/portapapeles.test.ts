import { afterEach, describe, expect, it, vi } from "vitest";

import { copiarTexto } from "./portapapeles";

// Sin jsdom en el repo: un navigator y un document mínimos bastan para el
// helper (textarea, append/remove y execCommand).
function entorno(writeText: ((t: string) => Promise<void>) | null, copia: boolean) {
  const nodos: unknown[] = [];
  const exec = vi.fn().mockReturnValue(copia);
  vi.stubGlobal("navigator", writeText ? { clipboard: { writeText } } : {});
  vi.stubGlobal("document", {
    createElement: () => ({ value: "", style: {}, setAttribute: vi.fn(), select: vi.fn() }),
    body: {
      appendChild: (n: unknown) => nodos.push(n),
      removeChild: (n: unknown) => nodos.splice(nodos.indexOf(n), 1),
    },
    execCommand: exec,
  });
  return { exec, nodos };
}

afterEach(() => vi.unstubAllGlobals());

describe("copiarTexto", () => {
  it("usa el portapapeles asíncrono cuando responde", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { exec } = entorno(writeText, true);
    await copiarTexto("/ruta/proyecto.pulso");
    expect(writeText).toHaveBeenCalledWith("/ruta/proyecto.pulso");
    expect(exec).not.toHaveBeenCalled();
  });

  it("si Electron niega el permiso, copia con execCommand y limpia el textarea", async () => {
    const { exec, nodos } = entorno(() => Promise.reject(new Error("Write permission denied.")), true);
    await copiarTexto("abc");
    expect(exec).toHaveBeenCalledWith("copy");
    expect(nodos).toHaveLength(0);
  });

  it("sin portapapeles asíncrono, va directo a execCommand", async () => {
    const { exec } = entorno(null, true);
    await copiarTexto("abc");
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("si tampoco execCommand copia, lanza en vez de fingir", async () => {
    const { nodos } = entorno(() => Promise.reject(new Error("denegado")), false);
    await expect(copiarTexto("abc")).rejects.toThrow();
    expect(nodos).toHaveLength(0);
  });
});
