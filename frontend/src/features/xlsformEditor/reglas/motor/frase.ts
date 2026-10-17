// Construcción de frases en piezas: constructores, enumeraciones («a, b y c») y mayúscula de inicio de oración.
// Toda frase del motor se arma con estas piezas; ningún módulo concatena cadenas con etiquetas dentro.

import type { Pieza } from "../piezas";

export type Frase = Pieza[];

export const t = (texto: string): Pieza => ({ tipo: "texto", texto });
export const v = (texto: string): Pieza => ({ tipo: "valor", texto });

/** Une frases con comas y un conector final: «a, b y c», «a, b o c», «a, b ni c». */
export function enumerar(frases: Frase[], conector: "y" | "o" | "ni"): Frase {
  const out: Frase = [];
  frases.forEach((f, i) => {
    if (i > 0) out.push(t(i === frases.length - 1 ? conector : ","));
    out.push(...f);
  });
  return out;
}

/** Une frases con un separador fijo (« y », « o »). */
export function unir(frases: Frase[], conector: string): Frase {
  const out: Frase = [];
  frases.forEach((f, i) => {
    if (i > 0) out.push(t(conector));
    out.push(...f);
  });
  return out;
}

function conMayuscula(texto: string): string {
  return texto.replace(/^(\s*[«“(]?)(\p{Ll})/u, (_m, pre: string, letra: string) => pre + letra.toUpperCase());
}

/** Mayúscula al comienzo de la frase, si empieza con texto o valor («Hoy»). Las etiquetas no se tocan. */
export function capitalizar(frase: Frase): Frase {
  const [primera, ...resto] = frase;
  if (!primera || primera.tipo === "pregunta" || primera.tipo === "opcion") return frase;
  // Un valor sólo se capitaliza si es vocabulario del motor («hoy», «hace 30 días»), nunca un dato («none»).
  if (primera.tipo === "valor" && !/^(hoy|ahora|hace |dentro de )/.test(primera.texto)) return frase;
  return [{ tipo: primera.tipo, texto: conMayuscula(primera.texto) }, ...resto];
}

/** Minúscula al comienzo, para incrustar una frase capitalizada dentro de otra. */
export function enMinuscula(frase: Frase): Frase {
  const [primera, ...resto] = frase;
  if (!primera || primera.tipo !== "texto") return frase;
  return [t(primera.texto.replace(/^(\p{Lu})(?!\p{Lu})/u, (l) => l.toLowerCase())), ...resto];
}

/** Varias oraciones: cada una con mayúscula, separadas por punto. */
export function oraciones(frases: Frase[]): Frase {
  const out: Frase = [];
  frases.forEach((f, i) => {
    if (i > 0) out.push(t("."));
    out.push(...capitalizar(f));
  });
  return out;
}

/** Plural simple de una unidad: «1 opción», «3 opciones». */
export function cantidad(n: string, singular: string, plural: string): Pieza {
  return v(`${n} ${n === "1" ? singular : plural}`);
}
