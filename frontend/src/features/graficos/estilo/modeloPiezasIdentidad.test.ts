import { describe, expect, test } from "vitest";
import { lineasDelDetalle, piezasIdentidad, type EntradaPiezas } from "./modeloPiezasIdentidad";

const BASE: EntradaPiezas = { lineaNombre: null, faltanColores: 0, conLogos: false, conLetra: false, nIconos: 0 };

describe("piezasIdentidad", () => {
  test("todo por defecto: palabra neutra, colores completos con check y el conteo de íconos", () => {
    const piezas = piezasIdentidad(BASE);
    expect(piezas.map((p) => p.clave)).toEqual(["linea", "colores", "logos", "letra", "iconos"]);
    expect(piezas.map((p) => p.estado)).toEqual([
      { tono: "neutro", texto: "Por defecto" },
      { tono: "listo", texto: "Completos" },
      { tono: "neutro", texto: "Por defecto" },
      { tono: "neutro", texto: "Por defecto" },
      { tono: "conteo", texto: "0" },
    ]);
    expect(piezas[0].detalle).toBe("Sin línea aplicada");
  });

  test("decisiones propias: check; colores que faltan: aviso con su cuenta", () => {
    const piezas = piezasIdentidad({ lineaNombre: "ACNUR · azul institucional", faltanColores: 13, conLogos: true, conLetra: true, nIconos: 4 });
    expect(piezas[0]).toMatchObject({ detalle: "ACNUR · azul institucional", estado: { tono: "listo", texto: "Aplicada" } });
    expect(piezas[1].estado).toEqual({ tono: "aviso", texto: "13 sin colores" });
    expect(piezas[2]).toMatchObject({ detalle: "Logos propios", estado: { tono: "listo" } });
    expect(piezas[3]).toMatchObject({ detalle: "Tamaño ajustado", estado: { tono: "listo" } });
    expect(piezas[4].estado).toEqual({ tono: "conteo", texto: "4" });
  });
});

describe("lineasDelDetalle", () => {
  test("una línea mientras todo cabe; dos si un nombre largo no cabe", () => {
    expect(lineasDelDetalle(piezasIdentidad(BASE))).toBe(1);
    expect(lineasDelDetalle(piezasIdentidad({ ...BASE, lineaNombre: "PUCP" }))).toBe(1);
    expect(lineasDelDetalle(piezasIdentidad({ ...BASE, lineaNombre: "ACNUR · azul institucional" }))).toBe(1);
    expect(lineasDelDetalle(piezasIdentidad({ ...BASE, lineaNombre: "Acreditación · informe institucional" }))).toBe(2);
    // Los detalles fijos caben siempre: «Objetivo y capítulos» es el más largo.
    expect(lineasDelDetalle(piezasIdentidad({ ...BASE, conLogos: true, conLetra: true }))).toBe(1);
  });
});
