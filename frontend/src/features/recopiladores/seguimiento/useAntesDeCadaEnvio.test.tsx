// @vitest-environment happy-dom
// "Antes de cada envío": un latido al abrir el proyecto; con la opción
// encendida, uno cada dos minutos, y si el backend lanza la actualización se
// sigue su trabajo. Apagada o deshabilitada (modo público, sin proyecto), nada.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const latidos = vi.fn();
const seguidos = vi.fn();

vi.mock("../../../api/mailSeguimiento", () => ({
  apiAntesDeEnvio: () => latidos(),
  apiSeguimiento: vi.fn(),
}));
vi.mock("../correos/mailchimpTrabajo", () => ({
  esperarTrabajo: (id: string) => { seguidos(id); return Promise.resolve({ ok: true }); },
}));

const { useAntesDeCadaEnvio, LATIDO_MS } = await import("./useAntesDeCadaEnvio");
const { useSeguimientoStore } = await import("./store");

function Probador({ habilitado }: { habilitado: boolean }) {
  useAntesDeCadaEnvio({ habilitado, sesion: "sid-1" });
  return null;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  latidos.mockReset();
  seguidos.mockReset();
  useSeguimientoStore.getState().reset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

async function montar(habilitado: boolean) {
  await act(async () => { root.render(<Probador habilitado={habilitado} />); });
  await act(async () => { await Promise.resolve(); });
}

describe("antes de cada envío", () => {
  test("apagada: un solo latido al abrir y ninguno después", async () => {
    latidos.mockResolvedValue({ activo: false, lanzado: false, job_id: "", proximo: null, minutos: null });
    await montar(true);
    expect(latidos).toHaveBeenCalledTimes(1);
    expect(useSeguimientoStore.getState().fondo.activo).toBe(false);
    await act(async () => { vi.advanceTimersByTime(LATIDO_MS * 3); });
    expect(latidos).toHaveBeenCalledTimes(1);
  });

  test("encendida: late cada dos minutos y sigue el trabajo que se lanza", async () => {
    latidos.mockResolvedValue({ activo: true, lanzado: false, job_id: "", proximo: null, minutos: 30 });
    await montar(true);
    expect(latidos).toHaveBeenCalledTimes(1);
    latidos.mockResolvedValue({ activo: true, lanzado: true, job_id: "j7", proximo: null, minutos: 30 });
    await act(async () => { vi.advanceTimersByTime(LATIDO_MS); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(latidos).toHaveBeenCalledTimes(2);
    expect(seguidos).toHaveBeenCalledWith("j7");
  });

  test("deshabilitada (modo público o sin proyecto): no late", async () => {
    latidos.mockResolvedValue({ activo: true, lanzado: false });
    await montar(false);
    await act(async () => { vi.advanceTimersByTime(LATIDO_MS * 2); });
    expect(latidos).not.toHaveBeenCalled();
  });

  test("un latido que falla se dice y no detiene los siguientes", async () => {
    latidos.mockRejectedValueOnce(new Error("Sin conexión con Mailchimp."));
    await montar(true);
    expect(useSeguimientoStore.getState().fondo.error).toBe("Sin conexión con Mailchimp.");
  });
});
