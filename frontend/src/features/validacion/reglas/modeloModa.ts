/**
 * "Valor distinto al habitual en su grupo" (tipo `moda_en_grupo`,
 * `api/R/reglas_custom_moda_grupo.R`): los parámetros como los espera el motor,
 * su validación (los mismos límites que el esquema R), las preguntas que lee y
 * lo que se lee de un caso o de la lectura del conteo previo. Qué casos marca y
 * sus cifras salen del motor; aquí no se compara ningún valor.
 */
import type { EjemploDeModa, LecturaDeModa, ResumenDeModa } from "../../../api/modaDeGrupo";
import { formatoConteo } from "../../../lib/formatoNumero";
import { nullableNumber } from "./modeloRegla";

/** Los mismos valores por defecto que el motor (`.REGLA_MODA_*_DEFECTO`). */
export const APOYO_MIN_POR_DEFECTO = 60;
export const N_MIN_POR_DEFECTO = 5;

function pregunta(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** La pregunta cuyo valor se compara y la que define el grupo. */
export function preguntasDeModa(params: Record<string, unknown>): { valor: string; grupo: string } {
  return { valor: pregunta(params.valor), grupo: pregunta(params.grupo) };
}

/** Las preguntas que lee la regla, la revisada (valor) primero (`.regla_moda_variables()`). */
export function variablesDeModa(params: Record<string, unknown>): string[] {
  const { valor, grupo } = preguntasDeModa(params);
  return Array.from(new Set([valor, grupo].filter(Boolean)));
}

/** Los parámetros que se guardan. Un umbral sin escribir se guarda con su valor por defecto. */
export function paramsDeModa(params: Record<string, unknown>): Record<string, unknown> {
  const { valor, grupo } = preguntasDeModa(params);
  return {
    grupo,
    valor,
    apoyo_min: nullableNumber(params.apoyo_min) ?? APOYO_MIN_POR_DEFECTO,
    n_min: nullableNumber(params.n_min) ?? N_MIN_POR_DEFECTO,
  };
}

function escrito(x: unknown): boolean {
  return x !== undefined && x !== null && String(x).trim() !== "";
}

/** El primer problema, o "" si se puede guardar (`.regla_moda_validar()`). */
export function validarModa(params: Record<string, unknown>): string {
  const { valor, grupo } = preguntasDeModa(params);
  if (!grupo || !valor) return "Elige la variable que forma el grupo y la variable a revisar.";
  if (grupo === valor) return "La variable del grupo y la variable a revisar deben ser distintas.";
  const apoyo = nullableNumber(params.apoyo_min);
  if (escrito(params.apoyo_min) && (apoyo === null || apoyo < 1 || apoyo > 100)) return "El valor más común debe reunir entre 1 y 100 % del grupo.";
  const n = nullableNumber(params.n_min);
  if (escrito(params.n_min) && (n === null || !Number.isInteger(n) || n < 2)) return "El mínimo de casos por grupo es un número entero desde 2.";
  return "";
}

/** La causa de un caso marcado, la del motor: "Ubigeo 150133 en Comas; en ese grupo el valor más común es 150110 (41 de 45 casos).". */
export function causaDeModa(r: ResumenDeModa): string {
  return r.causa ?? "Sin causa";
}

function casos(n: number): string {
  return `${formatoConteo(n)} ${n === 1 ? "caso" : "casos"}`;
}

function grupos(n: number): string {
  return `${formatoConteo(n)} ${n === 1 ? "grupo" : "grupos"}`;
}

/** "En Rímac, 174 de 184 casos tienen 150128 como ubigeo; se marcan los 10 que tienen otro valor." */
export function textoDeEjemploDeModa(e: EjemploDeModa): string {
  const como = e.valorRotulo ? ` como ${e.valorRotulo}` : "";
  const valor = e.valorRotulo ? e.moda : `el valor ${e.moda}`;
  const marca = e.nMarcadas === 1 ? "se marca el que tiene otro valor" : `se marcan los ${formatoConteo(e.nMarcadas)} que tienen otro valor`;
  return `En ${e.grupo}, ${formatoConteo(e.nModa)} de ${formatoConteo(e.nGrupo)} casos tienen ${valor}${como}; ${marca}.`;
}

/**
 * La lectura bajo la cifra, sobre las filas que evalúa la auditoría: cuántos
 * casos coinciden con el valor más común de su grupo, cuántos no y cuántos
 * quedan sin revisar, con la razón de cada grupo que no se revisa.
 */
export function textoDeLecturaDeModa(l: LecturaDeModa): string[] {
  const n = (x: number | null) => x ?? 0;
  const apoyo = formatoConteo(l.apoyoMin ?? APOYO_MIN_POR_DEFECTO);
  const minimo = l.nMin ?? N_MIN_POR_DEFECTO;
  const lineas = [
    `${casos(n(l.nOk))} ${n(l.nOk) === 1 ? "coincide" : "coinciden"} con el valor más común de su grupo y ${formatoConteo(n(l.nMarcadas))} no ${n(l.nMarcadas) === 1 ? "coincide" : "coinciden"}, en ${grupos(n(l.nGruposEvaluables))} revisados.`,
  ];
  if (l.ejemplo) lineas.push(textoDeEjemploDeModa(l.ejemplo));
  const sinRevisar: string[] = [];
  if (n(l.nGrupoChico)) {
    sinRevisar.push(`${casos(n(l.nGrupoChico))} en ${grupos(n(l.nGruposChicos))} de menos de ${formatoConteo(minimo)} casos`);
  }
  if (n(l.nEmpate)) {
    sinRevisar.push(`${casos(n(l.nEmpate))} en ${grupos(n(l.nGruposEmpate))} con empate entre dos valores`);
  }
  if (n(l.nSinApoyo)) {
    sinRevisar.push(`${casos(n(l.nSinApoyo))} en ${grupos(n(l.nGruposSinApoyo))} donde ningún valor llega al ${apoyo} %`);
  }
  if (sinRevisar.length) lineas.push(`Grupos que no se revisan: ${sinRevisar.join("; ")}.`);
  if (n(l.nSinDatos)) {
    lineas.push(`${casos(n(l.nSinDatos))} sin grupo o sin valor, que esta regla no revisa.`);
  }
  return lineas;
}
