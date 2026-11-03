// El gráfico que resulta de cruzar dos variables, por par de tipos (E7/E8).
//
// Fila = la variable que se lee (`var_x`); columna = con qué se cruza (`var_y`).
// Los 18 nombres son los del contrato congelado con el motor
// (`explorador_cruces.R` devuelve el mismo texto en `cruce.grafico`): el
// selector los anticipa antes de pedir el cruce, así que no pueden divergir.
// Una abierta sólo se cruza con una única (decisión de Gonzalo, 2026-11-03):
// los otros 7 pares con abierta valen null y el selector los deja atenuados.

import type { TipoVariable } from "./tiposVariable";

export type TipoCruzable = Exclude<TipoVariable, "mixto">;

export const TIPOS_CRUZABLES: readonly TipoCruzable[] = ["so", "sm", "num", "fecha", "texto"];

export const GRAFICO_DEL_PAR: Readonly<Record<TipoCruzable, Readonly<Record<TipoCruzable, string | null>>>> = {
  so: {
    so: "Tabla de calor",
    sm: "% que marca, por categoría",
    num: "Cajas por categoría",
    fecha: "Casos por día, apilados",
    texto: "Respuestas por categoría",
  },
  sm: {
    so: "% que marca cada opción, por categoría",
    sm: "Coocurrencia de opciones",
    num: "Cajas por opción marcada",
    fecha: "% que marca, por día",
    texto: null,
  },
  num: {
    so: "Cajas por categoría",
    sm: "Cajas por opción marcada",
    num: "Dispersión con tendencia",
    fecha: "Mediana por día",
    texto: null,
  },
  fecha: {
    so: "Días por categoría",
    sm: "Días por opción marcada",
    num: "Mediana por día",
    fecha: "Diferencia en días",
    texto: null,
  },
  texto: {
    so: "Respuestas por categoría",
    sm: null,
    num: null,
    fecha: null,
    texto: null,
  },
};

/** Nombre del gráfico del par, o null si el par no se cruza (un tipo mixto, o una abierta con algo que no es una única). */
export function graficoDelPar(tipoX: TipoVariable, tipoY: TipoVariable): string | null {
  if (tipoX === "mixto" || tipoY === "mixto") return null;
  return GRAFICO_DEL_PAR[tipoX][tipoY];
}

/** La limitación, dicha en una línea y sin proponer otro camino (comentario de Gonzalo en la maqueta, 2026-11-03). */
export const LIMITE_ABIERTA = "Una abierta se cruza sólo con una pregunta de selección única.";

/** Si el par no se ofrece porque una abierta sólo se cruza con una única. */
export function abiertaSinCruce(tipoX: TipoVariable, tipoY: TipoVariable): boolean {
  return (tipoX === "texto" || tipoY === "texto") && tipoX !== "mixto" && tipoY !== "mixto" && graficoDelPar(tipoX, tipoY) === null;
}
