import { describe, expect, test } from "vitest";

import { esTitular, filasDelRol, repartoPorRol } from "./filasPorRol";

const fila = (code: string, rol?: string) => ({ operational_code: code, sample_role: rol });

describe("el reparto por rol de la tabla de avance", () => {
  const filas = [
    fila("CH 1", "titular"), fila("CH 2"), fila("R 1.1", "chain_reserve"),
    fila("R 1.2", "chain_reserve"), fila("R 9.9", "extra_reserve_pool"),
  ];

  test("el rol vacío cuenta como titular, que es como lo escribe el plan", () => {
    expect(esTitular(fila("CH 2"))).toBe(true);
    expect(esTitular(fila("CH 3", "   "))).toBe(true);
    expect(esTitular(fila("R 1.1", "chain_reserve"))).toBe(false);
  });

  test("cuenta titulares y reservas de lo que LLEGÓ", () => {
    const r = repartoPorRol(filas, 1392);
    expect(r.titulares).toBe(2);
    expect(r.reservas).toBe(3);
    expect(r.recibidas).toBe(5);
  });

  test("publica lo que el motor NO mandó, que es lo que ningún filtro puede traer", () => {
    // El defecto que abrió esto: la tabla se lee como un censo. Sin esta cifra,
    // quien la recorre entera cree haber visto el plan.
    expect(repartoPorRol(filas, 1392).restantes).toBe(1387);
  });

  test("si el total declarado es menor que lo recibido no publica un negativo", () => {
    expect(repartoPorRol(filas, 3).restantes).toBe(0);
  });

  test("sin total declarado no inventa un recorte", () => {
    const r = repartoPorRol(filas, Number.NaN);
    expect(r.restantes).toBe(0);
    expect(r.total).toBe(5);
  });

  test("filtra sin reordenar: el orden del motor es lo que promete el subtítulo", () => {
    const orden = ["R 1.1", "CH 1", "R 1.2", "CH 2"].map((c) =>
      c.startsWith("R") ? fila(c, "chain_reserve") : fila(c));
    expect(filasDelRol(orden, "titular").map((f) => f.operational_code)).toEqual(["CH 1", "CH 2"]);
    expect(filasDelRol(orden, "reserva").map((f) => f.operational_code)).toEqual(["R 1.1", "R 1.2"]);
    expect(filasDelRol(orden, "todos")).toBe(orden);
  });

  test("la reserva adicional cuenta como reserva, no como titular", () => {
    expect(filasDelRol(filas, "reserva").map((f) => f.operational_code))
      .toEqual(["R 1.1", "R 1.2", "R 9.9"]);
  });
});
