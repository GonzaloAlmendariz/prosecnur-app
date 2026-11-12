import { afterEach, describe, expect, test, vi } from "vitest";

import { apiFetch } from "./core";
import {
  esFalloDeRed,
  leerEstadoDelMotor,
  notificarFallo,
  notificarRespuesta,
  reiniciarEstadoDelMotor,
  respuestaSinMotor,
  suscribirEstadoDelMotor,
} from "./motorDisponible";

const conTipo = (status: number, tipo: string | null) =>
  new Response(status === 204 ? null : "", { status, headers: tipo ? { "Content-Type": tipo } : {} });

afterEach(() => {
  reiniciarEstadoDelMotor();
  vi.unstubAllGlobals();
});

describe("qué cuenta como motor sin respuesta", () => {
  test("el error de red del navegador, en Chrome, Firefox y Safari", () => {
    expect(esFalloDeRed(new TypeError("Failed to fetch"))).toBe(true);
    expect(esFalloDeRed(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(esFalloDeRed(new TypeError("Load failed"))).toBe(true);
  });

  test("ni un AbortError ni un TypeError de código cuentan", () => {
    expect(esFalloDeRed(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(esFalloDeRed(new TypeError("x is not a function"))).toBe(false);
    expect(esFalloDeRed(new Error("Failed to fetch"))).toBe(false);
  });

  test("el 500 vacío del proxy de Vite y los 502 a 504; no un error JSON del motor", () => {
    expect(respuestaSinMotor(conTipo(500, "text/plain"))).toBe(true);
    expect(respuestaSinMotor(conTipo(502, null))).toBe(true);
    expect(respuestaSinMotor(conTipo(504, "text/html"))).toBe(true);
    expect(respuestaSinMotor(conTipo(500, "application/json"))).toBe(false);
    expect(respuestaSinMotor(conTipo(404, "text/plain"))).toBe(false);
    expect(respuestaSinMotor(conTipo(200, "application/json"))).toBe(false);
  });
});

describe("el estado avisa solo cuando cambia", () => {
  test("cae con un fallo de red, conserva la hora de inicio y vuelve con cualquier respuesta", () => {
    const oyente = vi.fn();
    const quitar = suscribirEstadoDelMotor(oyente);
    notificarFallo(new TypeError("Failed to fetch"), 1000);
    notificarFallo(new TypeError("Failed to fetch"), 5000);
    expect(leerEstadoDelMotor()).toEqual({ sinRespuesta: true, desde: 1000 });
    expect(oyente).toHaveBeenCalledTimes(1);
    notificarRespuesta(conTipo(500, "application/json"));
    expect(leerEstadoDelMotor()).toEqual({ sinRespuesta: false, desde: null });
    expect(oyente).toHaveBeenCalledTimes(2);
    quitar();
  });

  test("una respuesta sin status (doble de prueba) no cambia nada", () => {
    notificarFallo(new TypeError("Failed to fetch"));
    notificarRespuesta({} as Response);
    expect(leerEstadoDelMotor().sinRespuesta).toBe(true);
  });
});

describe("apiFetch publica el estado", () => {
  test("un fetch que rechaza por red deja el motor sin respuesta y relanza el error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(apiFetch("/api/system/health")).rejects.toThrow("Failed to fetch");
    expect(leerEstadoDelMotor().sinRespuesta).toBe(true);
  });

  test("la respuesta siguiente lo devuelve a disponible", async () => {
    notificarFallo(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }))));
    const res = await apiFetch("/api/system/health");
    expect(res.status).toBe(200);
    expect(leerEstadoDelMotor().sinRespuesta).toBe(false);
  });
});
