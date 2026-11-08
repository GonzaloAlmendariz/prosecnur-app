// «Dividir por» en la base de la pregunta (R7-1), sin React. En un informe conjunto la pregunta del gráfico es de una base
// (estudiantes$p5) y el cruce tiene que ser de la misma: el motor divide las respuestas de esa base por otra pregunta de
// esa base. Un cruce de otra base (docentes$p4) dibuja un muro de códigos sin avisar. El selector sólo ofrece la base de
// la pregunta; un plan viejo que ya trae el cruce de otra base lleva aviso en la tarjeta y error que bloquea el export.

import { ARGS_CRUCE } from "./modeloGrupos";
import { valorDeCruce } from "../diferencias/modeloDiferencias";

/** La base de una referencia con prefijo (`estudiantes$p5` → `estudiantes`); null sin prefijo. */
export function baseDeRef(ref: string): string | null {
  const i = ref.indexOf("$");
  if (i <= 0) return null;
  return ref.slice(0, i).trim() || null;
}

/** La base de la pregunta del gráfico: la de `var`, o la que comparten todas sus `vars`; null si no hay una sola. */
export function baseDeLaPregunta(args: Readonly<Record<string, unknown>>): string | null {
  if (typeof args.var === "string" && args.var.trim()) return baseDeRef(args.var.trim());
  if (!Array.isArray(args.vars) || args.vars.length === 0) return null;
  const bases = new Set<string | null>(args.vars.map((v) => (typeof v === "string" ? baseDeRef(v.trim()) : null)));
  if (bases.size !== 1) return null;
  const [unica] = [...bases];
  return unica ?? null;
}

export type CruceEnOtraBase = { arg: string; cruce: string; baseCruce: string; basePregunta: string };

/** El cruce guardado de otra base que la pregunta; null si coinciden, si falta alguna o si el cruce no lleva prefijo
 *  (sin prefijo el motor lo lee en la base del gráfico). */
export function cruceEnOtraBase(args: Readonly<Record<string, unknown>>): CruceEnOtraBase | null {
  const basePregunta = baseDeLaPregunta(args);
  if (!basePregunta) return null;
  for (const arg of ARGS_CRUCE) {
    const cruce = valorDeCruce(args[arg]);
    const baseCruce = cruce ? baseDeRef(cruce) : null;
    if (baseCruce && baseCruce !== basePregunta) return { arg, cruce, baseCruce, basePregunta };
  }
  return null;
}

/** El texto del aviso, igual en la tarjeta y en Avisos. */
export function textoCruceEnOtraBase(c: CruceEnOtraBase): string {
  return `"Dividir por" es de la base ${c.baseCruce} y la pregunta de la base ${c.basePregunta}. Elige una pregunta de ${c.basePregunta} para dividir.`;
}
