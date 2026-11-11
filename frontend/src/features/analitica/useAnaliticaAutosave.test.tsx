// @vitest-environment happy-dom
/**
 * El autoguardado de Analítica no pierde un cambio hecho mientras un guardado
 * anterior está en vuelo: marca limpio solo si la config del store sigue
 * siendo la enviada, y el cambio nuevo sale en su propio POST.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Put = (config: unknown) => Promise<{ ok: true; saved_at: string }>;
const api = {
  get: vi.fn<() => Promise<{ ok: true; config: unknown }>>(),
  put: vi.fn<Put>(),
};
vi.mock("../../api/client", async (original) => ({
  ...(await original<typeof import("../../api/client")>()),
  apiAnaliticaConfigGet: () => api.get(),
  apiAnaliticaConfigPut: (config: unknown) => api.put(config),
}));
vi.mock("../../lib/SessionContext", () => ({ useSession: () => ({ sessionId: "sid-1", state: null, refresh: async () => undefined }) }));

let host: HTMLDivElement;
let root: Root;

async function montar() {
  const { useAnaliticaAutosave } = await import("./useAnaliticaAutosave");
  function Con() {
    useAnaliticaAutosave();
    return null;
  }
  await act(async () => { root.render(<Con />); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  api.get.mockReset().mockResolvedValue({ ok: true, config: {} });
  api.put.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("autoguardado de Analítica", () => {
  it("un cambio hecho con el POST anterior en vuelo sale en un segundo POST y nunca queda marcado como guardado antes", async () => {
    const { useAnaliticaStore } = await import("./store");
    await montar();
    expect(useAnaliticaStore.getState().hydrated).toBe(true);

    let soltarA: () => void = () => undefined;
    api.put.mockImplementationOnce(() => new Promise((r) => { soltarA = () => r({ ok: true, saved_at: "a" }); }));
    api.put.mockImplementation(async () => ({ ok: true, saved_at: "b" }));

    // Cambio A: a los 2 s sale su POST, que queda en vuelo.
    await act(async () => { useAnaliticaStore.getState().setFrecuencias({ orden: "desc" }); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(api.put).toHaveBeenCalledTimes(1);
    expect((api.put.mock.calls[0][0] as { frecuencias: { orden: string } }).frecuencias.orden).toBe("desc");

    // Cambio B mientras A está en vuelo; después A termina.
    await act(async () => { useAnaliticaStore.getState().setFrecuencias({ orden: "asc" }); });
    await act(async () => { soltarA(); await Promise.resolve(); await Promise.resolve(); });
    // B todavía no se guardó: no puede figurar como limpio.
    expect(useAnaliticaStore.getState().dirty).toBe(true);

    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(api.put).toHaveBeenCalledTimes(2);
    expect((api.put.mock.calls[1][0] as { frecuencias: { orden: string } }).frecuencias.orden).toBe("asc");
    expect(useAnaliticaStore.getState().dirty).toBe(false);
  });

  it("un guardado fallido deja la señal de error; Reintentar vuelve a guardar y el guardado bueno la limpia", async () => {
    const { useAnaliticaStore } = await import("./store");
    useAnaliticaStore.setState({ errorGuardado: null, reintentosGuardado: 0 });
    await montar();
    api.put.mockRejectedValueOnce(new Error("Sin conexión con el backend."));
    await act(async () => { useAnaliticaStore.getState().setFrecuencias({ orden: "desc" }); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(useAnaliticaStore.getState().errorGuardado).toBe("Sin conexión con el backend.");
    expect(useAnaliticaStore.getState().dirty).toBe(true);

    api.put.mockResolvedValue({ ok: true, saved_at: "b" });
    await act(async () => { useAnaliticaStore.getState().reintentarGuardado(); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(api.put).toHaveBeenCalledTimes(2);
    expect(useAnaliticaStore.getState().errorGuardado).toBeNull();
    expect(useAnaliticaStore.getState().dirty).toBe(false);
  });

  it("sin cambios durante el POST, queda limpio al terminar", async () => {
    const { useAnaliticaStore } = await import("./store");
    await montar();
    api.put.mockResolvedValue({ ok: true, saved_at: "a" });
    await act(async () => { useAnaliticaStore.getState().setFrecuencias({ mostrar_todo: false }); });
    expect(useAnaliticaStore.getState().dirty).toBe(true);
    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(useAnaliticaStore.getState().dirty).toBe(false);
  });
});
