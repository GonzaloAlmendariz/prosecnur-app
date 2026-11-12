// El recorrido de Ponderación (prototipo: `pp-pasos--serie`, plan 4.7: la
// ponderación es un recorrido por pasos): peso base, metas de la población,
// ajustes y efecto. Cada paso dice si está hecho según la config declarada y lo
// que devolvió el motor; el primero sin hacer es el actual. Aquí no se calcula
// ningún peso: solo se lee la config y la lectura del efecto.

import type { PonderacionConfig } from "../store";
import { origenPesoBase } from "../ponderacionConfigModel";
import type { LecturaDelEfecto } from "./calculoDePonderacion";
import { variablesQueAjustan } from "./cifrasDePonderacion";

export type ClaveDePaso = "peso-base" | "metas" | "ajustes" | "efecto";

/** `no-aplica`: con el peso tomado de una columna no hay metas, ajustes ni efecto que calcular. */
export type EstadoDePaso = "hecho" | "actual" | "pendiente" | "no-aplica";

export type PasoDePonderacion = {
  clave: ClaveDePaso;
  rotulo: string;
  estado: EstadoDePaso;
  /** Lo que el paso no dice a la vista: por qué no aplica o qué falta. */
  titulo?: string;
};

const ROTULOS: Record<ClaveDePaso, string> = {
  "peso-base": "Peso base",
  metas: "Metas de la población",
  ajustes: "Ajustes",
  efecto: "Efecto",
};

const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** El peso base está declarado: ninguno, una columna elegida o un estrato con su población. */
export function pesoBaseDeclarado(pond: PonderacionConfig): boolean {
  if (pond.modo === "columna") return Boolean(pond.peso_columna);
  const origen = origenPesoBase(pond);
  if (origen === "columna") return Boolean(pond.design?.peso_columna);
  if (origen === "estrato") {
    return Boolean(pond.design?.var) && Object.values(pond.design?.pop_sizes ?? {}).some(esNumero);
  }
  return true;
}

export function pasosDePonderacion(pond: PonderacionConfig, lectura: LecturaDelEfecto): PasoDePonderacion[] {
  const claves: ClaveDePaso[] = ["peso-base", "metas", "ajustes", "efecto"];
  // Apagada: nada se declara todavía y ningún paso es el actual.
  if (!pond.enabled) return claves.map((clave) => ({ clave, rotulo: ROTULOS[clave], estado: "pendiente" }));

  if (pond.modo === "columna") {
    const titulo = "No aplica: el peso se toma de una columna de la base.";
    return claves.map((clave) => clave === "peso-base"
      ? { clave, rotulo: ROTULOS[clave], estado: pesoBaseDeclarado(pond) ? "hecho" : "actual" }
      : { clave, rotulo: ROTULOS[clave], estado: "no-aplica", titulo });
  }

  // Un peso base declarado ya basta para calibrar: las metas son entonces opcionales.
  const conPesoBase = origenPesoBase(pond) !== "ninguno" && pesoBaseDeclarado(pond);
  const hechos: Record<ClaveDePaso, boolean> = {
    "peso-base": pesoBaseDeclarado(pond),
    metas: variablesQueAjustan(pond) > 0 || conPesoBase,
    // Los ajustes tienen valores por defecto; un cálculo detenido (imputación sobre su tope,
    // expansión sin total) se corrige en ellos.
    ajustes: lectura.tipo !== "error",
    efecto: lectura.tipo === "efecto",
  };
  const actual = claves.find((clave) => !hechos[clave]);
  return claves.map((clave) => ({
    clave,
    rotulo: ROTULOS[clave],
    estado: hechos[clave] ? "hecho" : clave === actual ? "actual" : "pendiente",
  }));
}
