import { describe, expect, test } from "vitest";

import { causaDelError, CAUSA_ERROR_INTERNO, CAUSA_SIN_MOTOR, identificadorDelError } from "../../../components/errorPresentation";
import { franjaDeAuditoria, notaDelResultadoAnterior } from "./modeloFranjaDeAuditoria";

const INICIO = "2026-11-12T10:00:00Z";
const T = Date.parse(INICIO);

describe("franja de la auditoría en curso", () => {
  test("sin progreso del motor: el tiempo transcurrido y barra indeterminada", () => {
    expect(franjaDeAuditoria(INICIO, null, T + 14_000)).toEqual({ detalle: "Empezó hace 14 s.", porcentaje: null });
    expect(franjaDeAuditoria(INICIO, {}, T + 125_000)).toEqual({ detalle: "Empezó hace 2 min.", porcentaje: null });
  });

  test("con progreso publicado: el mensaje primero y el porcentaje", () => {
    expect(franjaDeAuditoria(INICIO, { message: "Regla 60 de 97", percent: 62 }, T + 14_000))
      .toEqual({ detalle: "Regla 60 de 97. Empezó hace 14 s.", porcentaje: 62 });
    expect(franjaDeAuditoria(INICIO, { current: 30, total: 120 }, T).porcentaje).toBe(25);
  });

  test("el 100 que jobs.R escribe al terminar no es avance", () => {
    expect(franjaDeAuditoria(INICIO, { phase: "done", percent: 100 }, T).porcentaje).toBeNull();
  });

  test("sin inicio legible no inventa el tiempo", () => {
    expect(franjaDeAuditoria(null, null, T)).toEqual({ detalle: null, porcentaje: null });
    expect(franjaDeAuditoria("ayer", null, T).detalle).toBeNull();
  });

  test("la nota fecha el resultado anterior cuando se conoce", () => {
    expect(notaDelResultadoAnterior("8 nov")).toBe("Abajo sigue el resultado del 8 nov, solo para leer.");
    expect(notaDelResultadoAnterior(null)).toBe("Abajo sigue el resultado anterior, solo para leer.");
  });
});

describe("causa de un error en llano", () => {
  test("el error de red del navegador es el motor que no respondió", () => {
    expect(causaDelError("Failed to fetch")).toBe(CAUSA_SIN_MOTOR);
    expect(causaDelError("Load failed")).toBe(CAUSA_SIN_MOTOR);
  });

  test("un E_INTERNAL se dice como error de la app y su referencia va aparte", () => {
    const m = "Error interno del servidor (ref. 7F3A21C4). · E_INTERNAL";
    expect(causaDelError(m)).toBe(CAUSA_ERROR_INTERNO);
    expect(identificadorDelError(m)).toBe("7F3A21C4");
  });

  test("los demás mensajes del motor pasan sin el código", () => {
    expect(causaDelError("La base Docentes no existe. · E_BASE_NOT_FOUND")).toBe("La base Docentes no existe.");
    expect(identificadorDelError("La base Docentes no existe.")).toBeUndefined();
  });
});
