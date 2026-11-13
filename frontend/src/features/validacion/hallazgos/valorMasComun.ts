/**
 * El valor más común del grupo en "Valor distinto del más frecuente" (ítem 49).
 * El motor lo dice en la causa de cada caso (`validacion_enunciado_hallazgo.R`):
 * "Ubigeo 150133 en Comas; en ese grupo el valor más común es 150110 (9 de 10
 * casos)." Aquí se lee ese texto para que la tabla lo muestre como columna.
 */

/** La columna del valor más común del grupo; no es una pregunta de la base. */
export const CLAVE_VALOR_MAS_COMUN = "moda:comun";
export const SUBTIPO_MODA = "moda_en_grupo";

export type ValorMasComun = { valor: string; n: number; k: number };

export function valorMasComun(choque: string | null | undefined): ValorMasComun | null {
  const m = /en ese grupo el valor más común es (.+) \((\d+) de (\d+) casos?\)\.?$/.exec(choque?.trim() ?? "");
  return m ? { valor: m[1], n: Number(m[2]), k: Number(m[3]) } : null;
}

/** Lo que va en la celda: "150110 (9 de 10 casos)". */
export function rotuloDeValorMasComun(v: ValorMasComun): string {
  return `${v.valor} (${v.n} de ${v.k} ${v.k === 1 ? "caso" : "casos"})`;
}

/** Separa "150110 (9 de 10 casos)" en el valor y su peso; otro texto: solo el valor. */
export function partesDeValorMasComun(texto: string | undefined): { valor: string; peso: string | null } {
  const m = /^(.+) \((\d+ de \d+ casos?)\)$/.exec(texto ?? "");
  return m ? { valor: m[1], peso: m[2] } : { valor: texto ?? "Sin dato", peso: null };
}
