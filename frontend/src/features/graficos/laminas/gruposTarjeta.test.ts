// H4: secciones de la tarjeta del gráfico, plegables, con Datos abierta por defecto.
import { describe, expect, test } from "vitest";
import { conSeccion, esSeccionTarjeta, ROTULO_INDICE, SECCIONES_TARJETA, seccionAbierta, TITULO_GRUPO } from "./gruposTarjeta";
import { destinoDeSeccion } from "./tarjetaGrafico/irASeccion";

describe("secciones de la tarjeta", () => {
  test("arranca abierta sólo Datos", () => {
    expect(SECCIONES_TARJETA.filter((s) => seccionAbierta({}, s))).toEqual(["datos"]);
  });
  test("conSeccion no crea un objeto nuevo si no cambia nada", () => {
    const vacio = {};
    expect(conSeccion(vacio, "datos", true)).toBe(vacio);
    expect(conSeccion(vacio, "cifras", true)).toEqual({ cifras: true });
    expect(seccionAbierta(conSeccion({}, "datos", false), "datos")).toBe(false);
  });
  test("cada sección tiene título y rótulo de una palabra en el índice", () => {
    for (const s of SECCIONES_TARJETA) {
      expect(TITULO_GRUPO[s]).toBeTruthy();
      expect(ROTULO_INDICE[s]).toMatch(/^\S+$/);
    }
    expect(esSeccionTarjeta("diferencias")).toBe(true);
    expect(esSeccionTarjeta("composicion")).toBe(false);
  });
  test("saltar deja la cabecera bajo el índice pegado", () => {
    // dueño en y=200 con 300 px ya recorridos; la sección está en y=900 en pantalla; índice de 40 px.
    expect(destinoDeSeccion(200, 300, 900, 40)).toBe(900 - 200 + 300 - 40 - 8);
    expect(destinoDeSeccion(200, 0, 210, 40)).toBe(0);
  });
});
