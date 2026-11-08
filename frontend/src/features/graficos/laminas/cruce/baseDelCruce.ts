// «Dividir por» en la base de la pregunta (R7-1, R7-18), sin React. En un informe conjunto la pregunta del gráfico es de
// una base (estudiantes$p5). El render ignora el prefijo del cruce y lo resuelve en la base de la pregunta: un cruce
// escrito con otra base (docentes$p4) se dibuja bien si esa columna también existe en la base de la pregunta (un público
// hermano con la misma columna), y sólo falla si no existe. Por eso:
//   - el selector sólo ofrece la base de la pregunta;
//   - un cruce escrito con otra base cuya columna existe en la de la pregunta avisa (warning) y ofrece «Fijar base»;
//   - sólo si la columna no existe en la base de la pregunta es error y bloquea el export.
// Las bases se comparan sin mayúsculas, contra los nombres reales de las fuentes.

import { ARGS_CRUCE } from "./modeloGrupos";
import { valorDeCruce } from "../diferencias/modeloDiferencias";

/** Lo que se sabe de las preguntas del estudio: su base y su nombre (useVariables). */
export type VariableDeBase = { source: string; name: string };

/** La base de una referencia con prefijo (`estudiantes$p5` → `estudiantes`); null sin prefijo. */
export function baseDeRef(ref: string): string | null {
  const i = ref.indexOf("$");
  if (i <= 0) return null;
  return ref.slice(0, i).trim() || null;
}

const nombreDeRef = (ref: string) => ref.slice(ref.indexOf("$") + 1).trim();
const igual = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");

/** El nombre real de la base entre las fuentes del estudio (sin mayúsculas); el escrito si no hay una que case. */
export function baseReal(base: string, variables: readonly VariableDeBase[]): string {
  return variables.find((v) => igual(v.source, base))?.source ?? base;
}

/** La base de la pregunta del gráfico: la de `var`, o la que comparten todas sus `vars`; null si no hay una sola. */
export function baseDeLaPregunta(args: Readonly<Record<string, unknown>>, variables: readonly VariableDeBase[] = []): string | null {
  if (typeof args.var === "string" && args.var.trim()) {
    const b = baseDeRef(args.var.trim());
    return b ? baseReal(b, variables) : null;
  }
  if (!Array.isArray(args.vars) || args.vars.length === 0) return null;
  const bases = args.vars.map((v) => (typeof v === "string" ? baseDeRef(v.trim()) : null));
  if (bases.some((b) => b === null)) return null;
  const reales = new Set((bases as string[]).map((b) => baseReal(b, variables).toLocaleLowerCase("es")));
  return reales.size === 1 ? baseReal(bases[0] as string, variables) : null;
}

export type CruceEnOtraBase = {
  arg: string; cruce: string; baseCruce: string; basePregunta: string;
  /** La columna del cruce existe en la base de la pregunta: el render la lee ahí y la lámina sale bien. */
  existeEnBasePregunta: boolean;
};

/**
 * El cruce escrito con otra base que la pregunta; null si coinciden (sin mayúsculas), si falta alguna o si el cruce no
 * lleva prefijo. Sin las preguntas del estudio (aún no leídas) no se afirma que la columna falte.
 */
export function cruceEnOtraBase(args: Readonly<Record<string, unknown>>, variables: readonly VariableDeBase[] = []): CruceEnOtraBase | null {
  const basePregunta = baseDeLaPregunta(args, variables);
  if (!basePregunta) return null;
  for (const arg of ARGS_CRUCE) {
    const cruce = valorDeCruce(args[arg]);
    const escrita = cruce ? baseDeRef(cruce) : null;
    if (!escrita) continue;
    const baseCruce = baseReal(escrita, variables);
    if (igual(baseCruce, basePregunta)) continue;
    const nombre = nombreDeRef(cruce);
    const existeEnBasePregunta = variables.length === 0 || variables.some((v) => igual(v.source, basePregunta) && igual(v.name, nombre));
    return { arg, cruce, baseCruce, basePregunta, existeEnBasePregunta };
  }
  return null;
}

/** El texto del aviso, igual en la tarjeta y en Avisos. */
export function textoCruceEnOtraBase(c: CruceEnOtraBase): string {
  return c.existeEnBasePregunta
    ? `"Dividir por" está escrito con la base ${c.baseCruce}; la lámina lo lee en ${c.basePregunta}, la base de la pregunta.`
    : `"Dividir por" es de la base ${c.baseCruce} y no existe en ${c.basePregunta}, la base de la pregunta. Elige una pregunta de ${c.basePregunta} para dividir.`;
}

/** «Fijar base»: el patch que reescribe el prefijo del cruce a la base de la pregunta (lista si era lista). */
export function patchFijarBaseCruce(args: Readonly<Record<string, unknown>>, c: CruceEnOtraBase): Record<string, unknown> {
  const ref = `${c.basePregunta}$${nombreDeRef(c.cruce)}`;
  return { [c.arg]: Array.isArray(args[c.arg]) ? [ref] : ref };
}
