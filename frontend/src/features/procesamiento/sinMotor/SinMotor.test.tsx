// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { notificarFallo, notificarRespuesta, reiniciarEstadoDelMotor } from "../../../api/motorDisponible";
import { GuardaDelMotor } from "./SinMotor";
import { esperaDelIntento, LATIDO_DEL_MOTOR_MS, seccionSinMotor, textoDeEspera } from "./modeloSinMotor";

describe("modelo de la vista sin motor", () => {
  test("los intentos se espacian y se quedan en 30 s", () => {
    expect([0, 1, 2, 3, 4, 9].map(esperaDelIntento)).toEqual([4, 8, 15, 30, 30, 30]);
  });

  test("la espera se dice en segundos y, al probar, en gerundio", () => {
    expect(textoDeEspera(4, false)).toBe("Reintenta en 4 s");
    expect(textoDeEspera(0, false)).toBe("Reintenta en 1 s");
    expect(textoDeEspera(3, true)).toBe("Reintentando");
  });

  test("la cabecera nombra la sección abierta", () => {
    expect(seccionSinMotor("/validacion")).toBe("Validación");
    expect(seccionSinMotor("/codificacion")).toBe("Codificación");
    expect(seccionSinMotor("/graficos")).toBe("Gráficos");
    expect(seccionSinMotor("/procesamiento")).toBe("Estado del estudio");
  });
});

describe("GuardaDelMotor", () => {
  let nodo: HTMLDivElement;
  let raiz: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    reiniciarEstadoDelMotor();
    // El Node del runner trae su propio localStorage sin métodos; `headers()` lo lee.
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    nodo = document.createElement("div");
    document.body.appendChild(nodo);
    raiz = createRoot(nodo);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    nodo.remove();
    reiniciarEstadoDelMotor();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const montar = () => act(() => {
    raiz.render(
      <MemoryRouter initialEntries={["/validacion?pestana=hallazgos"]}>
        <GuardaDelMotor><p>Sección</p></GuardaDelMotor>
      </MemoryRouter>,
    );
  });

  test("con la app quieta, el latido nota la caída y muestra el aviso", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetch);
    montar();
    expect(nodo.textContent).toContain("Sección");
    await act(async () => { await vi.advanceTimersByTimeAsync(LATIDO_DEL_MOTOR_MS); });
    expect(String(fetch.mock.calls[0]?.[0] ?? "")).toContain("/api/system/health");
    expect(nodo.textContent).not.toContain("Sección");
  });

  test("con el motor respondiendo deja la sección", () => {
    montar();
    expect(nodo.textContent).toContain("Sección");
    expect(nodo.querySelector('[data-audit-ready="procesamiento-sin-motor"]')).toBeNull();
  });

  test("sin motor cambia la sección por el aviso con causa, lo que no cambia y el reintento", () => {
    montar();
    act(() => notificarFallo(new TypeError("Failed to fetch")));
    expect(nodo.textContent).not.toContain("Sección");
    expect(nodo.querySelector('[data-audit-ready="procesamiento-sin-motor"]')).not.toBeNull();
    const texto = nodo.textContent ?? "";
    expect(texto).toContain("Se perdió la conexión con el motor de la app");
    expect(texto).toContain("El motor de cálculo dejó de responder.");
    expect(texto).toContain("Lo que ya estaba guardado en el proyecto no cambia.");
    expect(texto).toContain("Reintenta en 4 s");
    expect(texto).toContain("Validación");
    expect(texto).toContain("Sin conexión");
    expect(nodo.querySelector('[role="alert"]')).not.toBeNull();
    const boton = Array.from(nodo.querySelectorAll("button")).find((b) => b.textContent?.includes("Reintentar ahora"));
    expect(boton).toBeTruthy();
  });

  test("Reintentar ahora pide la salud del motor y, al responder, vuelve la sección", async () => {
    const fetch = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response('{"ok":true,"version":"1","prosecnur_version":"1","time":""}', {
      status: 200, headers: { "Content-Type": "application/json" },
    })));
    vi.stubGlobal("fetch", fetch);
    montar();
    act(() => notificarFallo(new TypeError("Failed to fetch")));
    const boton = Array.from(nodo.querySelectorAll("button")).find((b) => b.textContent?.includes("Reintentar ahora"))!;
    await act(async () => {
      boton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(String(fetch.mock.calls[0]?.[0] ?? "")).toContain("/api/system/health");
    expect(nodo.textContent).toContain("Sección");
  });

  test("solo, a los 4 s vuelve a probar; si falla espera 8", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetch);
    montar();
    act(() => notificarFallo(new TypeError("Failed to fetch")));
    for (let i = 0; i < 4; i += 1) {
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(nodo.textContent).toContain("Reintenta en 8 s");
    // Un error del motor (JSON) prueba que responde: vuelve la sección.
    act(() => notificarRespuesta(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })));
    expect(nodo.textContent).toContain("Sección");
  });
});
