// El gráfico que resulta de cruzar dos variables, por par de tipos (E7/E8).
//
// Fila = la variable que se lee (`var_x`); columna = con qué se cruza (`var_y`).
// Los 25 nombres son los del contrato congelado con el motor
// (`explorador_cruces.R` devuelve el mismo texto en `cruce.grafico`): el
// selector los anticipa antes de pedir el cruce, así que no pueden divergir.

import type { TipoVariable } from "./tiposVariable";

export type TipoCruzable = Exclude<TipoVariable, "mixto">;

export const TIPOS_CRUZABLES: readonly TipoCruzable[] = ["so", "sm", "num", "fecha", "texto"];

export const GRAFICO_DEL_PAR: Readonly<Record<TipoCruzable, Readonly<Record<TipoCruzable, string>>>> = {
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
    texto: "Respuestas por opción marcada",
  },
  num: {
    so: "Cajas por categoría",
    sm: "Cajas por opción marcada",
    num: "Dispersión con tendencia",
    fecha: "Mediana por día",
    texto: "Respuestas ordenadas por valor",
  },
  fecha: {
    so: "Días por categoría",
    sm: "Días por opción marcada",
    num: "Fecha frente a la numérica",
    fecha: "Diferencia en días",
    texto: "Respuestas por día",
  },
  texto: {
    so: "Respuestas por categoría",
    sm: "Respuestas por opción marcada",
    num: "Respuestas por tramos",
    fecha: "Respuestas por día",
    texto: "Dos abiertas lado a lado",
  },
};

/** Nombre del gráfico del par, o null si alguno de los dos tipos no se cruza (mixto). */
export function graficoDelPar(tipoX: TipoVariable, tipoY: TipoVariable): string | null {
  if (tipoX === "mixto" || tipoY === "mixto") return null;
  return GRAFICO_DEL_PAR[tipoX][tipoY];
}
