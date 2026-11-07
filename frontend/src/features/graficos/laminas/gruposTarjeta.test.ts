// H4: secciones de la tarjeta del gráfico, plegables, con Datos abierta por defecto. ADR 0135 §8: son tres para todos
// los graficadores (Datos, Cálculo y Aspecto) y cada campo de la lista blanca tiene la suya, declarada.
import { describe, expect, test } from "vitest";
import { camposDeLaListaBlanca } from "./argsDatosGrafico";
import {
  conSeccion, esSeccionTarjeta, grupoDeCampo, ROTULO_INDICE, SECCION_DE_CAMPO, SECCIONES_TARJETA, seccionAbierta, seccionDeClave, TITULO_GRUPO,
} from "./gruposTarjeta";
import { destinoDeSeccion } from "./tarjetaGrafico/irASeccion";

describe("secciones de la tarjeta", () => {
  test("arranca abierta sólo Datos", () => {
    expect(SECCIONES_TARJETA.filter((s) => seccionAbierta({}, s))).toEqual(["datos"]);
  });
  test("conSeccion no crea un objeto nuevo si no cambia nada", () => {
    const vacio = {};
    expect(conSeccion(vacio, "datos", true)).toBe(vacio);
    expect(conSeccion(vacio, "calculo", true)).toEqual({ calculo: true });
    expect(seccionAbierta(conSeccion({}, "datos", false), "datos")).toBe(false);
  });
  test("cada sección tiene título y rótulo de una palabra en el índice", () => {
    for (const s of SECCIONES_TARJETA) {
      expect(TITULO_GRUPO[s]).toBeTruthy();
      expect(ROTULO_INDICE[s]).toMatch(/^\S+$/);
    }
    expect(esSeccionTarjeta("aspecto")).toBe(true);
    expect(esSeccionTarjeta("diferencias")).toBe(false);
    expect(esSeccionTarjeta("composicion")).toBe(false);
  });
  test("son exactamente Datos, Cálculo y Aspecto", () => {
    expect(SECCIONES_TARJETA.map((s) => TITULO_GRUPO[s])).toEqual(["Datos", "Cálculo", "Aspecto"]);
  });
  test("cada campo de la lista blanca tiene su sección declarada", () => {
    const sinSeccion = camposDeLaListaBlanca().filter((c) => !Object.hasOwn(SECCION_DE_CAMPO, c));
    expect(sinSeccion).toEqual([]);
  });
  test("el mapa del ADR: orden y cifras a Aspecto; corte, indicador, redondeo y significancia a Cálculo; preguntas y cruce a Datos", () => {
    expect(["orden", "top_n", "mostrar_ceros", "pista_barras", "mostrar_brecha", "estilo", "base_en"].map(grupoDeCampo)).toEqual(Array(7).fill("aspecto"));
    expect(["corte", "corte_etiqueta", "alpha", "decimales", "valores_decimales", "referencia"].map(grupoDeCampo)).toEqual(Array(6).fill("calculo"));
    expect(["var", "vars", "cruce", "cruces", "grupos", "excluir_opciones", "universos"].map(grupoDeCampo)).toEqual(Array(7).fill("datos"));
  });
  test("las claves de las secciones anteriores llevan a la nueva", () => {
    expect(["orden", "cifras", "colores", "word", "diferencias", "datos", "x"].map(seccionDeClave)).toEqual([
      "aspecto", "aspecto", "aspecto", "aspecto", "calculo", "datos", null,
    ]);
  });
  test("saltar deja la cabecera bajo el índice pegado", () => {
    // dueño en y=200 con 300 px ya recorridos; la sección está en y=900 en pantalla; índice de 40 px.
    expect(destinoDeSeccion(200, 300, 900, 40)).toBe(900 - 200 + 300 - 40 - 8);
    expect(destinoDeSeccion(200, 0, 210, 40)).toBe(0);
  });
});
