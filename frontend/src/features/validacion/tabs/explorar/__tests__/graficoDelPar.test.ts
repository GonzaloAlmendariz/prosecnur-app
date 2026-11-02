import { describe, expect, it } from "vitest";
import { GRAFICO_DEL_PAR, TIPOS_CRUZABLES, graficoDelPar } from "../graficoDelPar";

// Los 25 nombres del contrato congelado con el motor (checklist 2026-11-02, E7/E8).
// Si el motor o este módulo cambian uno, el selector anticipa un gráfico y se
// dibuja otro: por eso se listan aquí uno por uno y no se derivan.
const CONTRATO: [string, string, string][] = [
  ["so", "so", "Tabla de calor"],
  ["so", "sm", "% que marca, por categoría"],
  ["so", "num", "Cajas por categoría"],
  ["so", "fecha", "Casos por día, apilados"],
  ["so", "texto", "Respuestas por categoría"],
  ["sm", "so", "% que marca cada opción, por categoría"],
  ["sm", "sm", "Coocurrencia de opciones"],
  ["sm", "num", "Cajas por opción marcada"],
  ["sm", "fecha", "% que marca, por día"],
  ["sm", "texto", "Respuestas por opción marcada"],
  ["num", "so", "Cajas por categoría"],
  ["num", "sm", "Cajas por opción marcada"],
  ["num", "num", "Dispersión con tendencia"],
  ["num", "fecha", "Mediana por día"],
  ["num", "texto", "Respuestas ordenadas por valor"],
  ["fecha", "so", "Días por categoría"],
  ["fecha", "sm", "Días por opción marcada"],
  ["fecha", "num", "Fecha frente a la numérica"],
  ["fecha", "fecha", "Diferencia en días"],
  ["fecha", "texto", "Respuestas por día"],
  ["texto", "so", "Respuestas por categoría"],
  ["texto", "sm", "Respuestas por opción marcada"],
  ["texto", "num", "Respuestas por tramos"],
  ["texto", "fecha", "Respuestas por día"],
  ["texto", "texto", "Dos abiertas lado a lado"],
];

describe("graficoDelPar", () => {
  it.each(CONTRATO)("%s × %s → %s", (x, y, nombre) => {
    expect(graficoDelPar(x as never, y as never)).toBe(nombre);
  });

  it("la tabla cubre exactamente los 25 pares", () => {
    const pares = TIPOS_CRUZABLES.flatMap((x) => TIPOS_CRUZABLES.map((y) => `${x}×${y}`));
    expect(pares).toHaveLength(25);
    expect(Object.keys(GRAFICO_DEL_PAR).sort()).toEqual([...TIPOS_CRUZABLES].sort());
    for (const x of TIPOS_CRUZABLES) expect(Object.keys(GRAFICO_DEL_PAR[x]).sort()).toEqual([...TIPOS_CRUZABLES].sort());
  });

  it("un tipo mixto no anticipa gráfico", () => {
    expect(graficoDelPar("mixto", "so")).toBeNull();
    expect(graficoDelPar("so", "mixto")).toBeNull();
  });
});
