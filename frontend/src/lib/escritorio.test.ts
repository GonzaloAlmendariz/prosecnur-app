import { afterEach, describe, expect, it, vi } from "vitest";

import { abrirArchivo, alTerminarDescarga, mostrarEnCarpeta } from "./escritorio";

// Puente de escritorio para las descargas sin diálogo (ADR 0133, fase 3). Sin
// jsdom en el repo: `window` se monta con vi.stubGlobal y, para el caso del
// navegador sin Electron, se deja sin definir o sin `prosecnurApi`.

type Descarga = { estado: string; nombre: string; ruta: string };

function conPuente(puente: Record<string, unknown>) {
  vi.stubGlobal("window", { prosecnurApi: puente });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RUTA_WINDOWS = "C:\\Users\\ana\\Downloads\\informe_2.xlsx";

describe("sin puente de escritorio (navegador)", () => {
  const entornos: Array<[string, () => void]> = [
    ["sin window", () => vi.stubGlobal("window", undefined)],
    ["window sin prosecnurApi", () => vi.stubGlobal("window", {})],
    // Un shell viejo cuyo preload aún no expone las funciones nuevas.
    ["prosecnurApi sin las funciones nuevas", () => conPuente({ getRecentProjects: vi.fn() })],
  ];

  for (const [nombre, montar] of entornos) {
    it(`${nombre}: mostrarEnCarpeta y abrirArchivo devuelven false sin lanzar`, async () => {
      montar();
      await expect(mostrarEnCarpeta(RUTA_WINDOWS)).resolves.toBe(false);
      await expect(abrirArchivo(RUTA_WINDOWS)).resolves.toBe(false);
    });

    it(`${nombre}: alTerminarDescarga devuelve una desuscripción no-op`, () => {
      montar();
      const cb = vi.fn();
      const desuscribir = alTerminarDescarga(cb);
      expect(typeof desuscribir).toBe("function");
      expect(() => desuscribir()).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });
  }
});

describe("con puente de escritorio", () => {
  it("mostrarEnCarpeta delega la ruta tal cual y devuelve true con { ok: true }", async () => {
    const mostrar = vi.fn().mockResolvedValue({ ok: true });
    conPuente({ mostrarEnCarpeta: mostrar });
    await expect(mostrarEnCarpeta(RUTA_WINDOWS)).resolves.toBe(true);
    expect(mostrar).toHaveBeenCalledTimes(1);
    expect(mostrar).toHaveBeenCalledWith(RUTA_WINDOWS);
  });

  it("abrirArchivo delega la ruta tal cual y devuelve true con { ok: true }", async () => {
    const abrir = vi.fn().mockResolvedValue({ ok: true });
    conPuente({ abrirArchivo: abrir });
    await expect(abrirArchivo("/Users/ana/Estudio/Entregables/base.sav")).resolves.toBe(true);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith("/Users/ana/Estudio/Entregables/base.sav");
  });

  it("mostrarEnCarpeta y abrirArchivo no llaman a la otra función del puente", async () => {
    const mostrar = vi.fn().mockResolvedValue({ ok: true });
    const abrir = vi.fn().mockResolvedValue({ ok: true });
    conPuente({ mostrarEnCarpeta: mostrar, abrirArchivo: abrir });
    await mostrarEnCarpeta(RUTA_WINDOWS);
    expect(abrir).not.toHaveBeenCalled();
    await abrirArchivo(RUTA_WINDOWS);
    expect(mostrar).toHaveBeenCalledTimes(1);
  });

  // true solo si el puente respondió exactamente { ok: true }: un rechazo de la
  // ruta en el main (`{ ok: false, motivo }`), una respuesta malformada o un
  // fallo del IPC devuelven false sin lanzar.
  const respuestasQueNoSonOk: Array<[string, () => Promise<unknown>]> = [
    ["{ ok: false, motivo }", () => Promise.resolve({ ok: false, motivo: "fuera de Descargas" })],
    ["undefined", () => Promise.resolve(undefined)],
    ["null", () => Promise.resolve(null)],
    ["true suelto", () => Promise.resolve(true)],
    ["{ ok: \"true\" }", () => Promise.resolve({ ok: "true" })],
    ["{ ok: 1 }", () => Promise.resolve({ ok: 1 })],
    ["promesa rechazada", () => Promise.reject(new Error("IPC caído"))],
  ];

  for (const [nombre, respuesta] of respuestasQueNoSonOk) {
    it(`devuelve false cuando el puente responde ${nombre}`, async () => {
      conPuente({
        mostrarEnCarpeta: vi.fn().mockImplementation(respuesta),
        abrirArchivo: vi.fn().mockImplementation(respuesta),
      });
      await expect(mostrarEnCarpeta(RUTA_WINDOWS)).resolves.toBe(false);
      await expect(abrirArchivo(RUTA_WINDOWS)).resolves.toBe(false);
    });
  }

  it("devuelve false si la función del puente lanza en sincrónico", async () => {
    conPuente({
      mostrarEnCarpeta: () => {
        throw new Error("contextBridge");
      },
      abrirArchivo: () => {
        throw new Error("contextBridge");
      },
    });
    await expect(mostrarEnCarpeta(RUTA_WINDOWS)).resolves.toBe(false);
    await expect(abrirArchivo(RUTA_WINDOWS)).resolves.toBe(false);
  });

  it("alTerminarDescarga entrega al callback lo que emite el puente", () => {
    let oyente: ((d: Descarga) => void) | undefined;
    const desuscribirPuente = vi.fn();
    const suscribir = vi.fn((cb: (d: Descarga) => void) => {
      oyente = cb;
      return desuscribirPuente;
    });
    conPuente({ onDescargaTerminada: suscribir });

    const cb = vi.fn();
    alTerminarDescarga(cb);
    expect(suscribir).toHaveBeenCalledTimes(1);
    expect(oyente).toBeTypeOf("function");

    const descarga: Descarga = { estado: "completed", nombre: "informe_2.xlsx", ruta: RUTA_WINDOWS };
    oyente?.(descarga);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(descarga);

    oyente?.({ estado: "interrupted", nombre: "mazo.pptx", ruta: "/Users/ana/Downloads/mazo.pptx" });
    expect(cb).toHaveBeenLastCalledWith({
      estado: "interrupted",
      nombre: "mazo.pptx",
      ruta: "/Users/ana/Downloads/mazo.pptx",
    });
  });

  it("la desuscripción de alTerminarDescarga llama a la del puente", () => {
    const desuscribirPuente = vi.fn();
    conPuente({ onDescargaTerminada: vi.fn(() => desuscribirPuente) });

    const desuscribir = alTerminarDescarga(vi.fn());
    expect(desuscribirPuente).not.toHaveBeenCalled();
    desuscribir();
    expect(desuscribirPuente).toHaveBeenCalledTimes(1);
  });
});
