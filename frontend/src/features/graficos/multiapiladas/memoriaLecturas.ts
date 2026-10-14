// G12 parte 2 (Gonzalo, 2026-10-13: «el cambiar entre uno y otro destruye todo lo avanzado»). Cada lectura de las
// multiapiladas (Preguntas, por grupos, Públicos por tema, Bloques) escribe los mismos args (`modo`, `vars`, `var`,
// `cruces`, `bloques`, `titulos_grupo`), así que ir y volver perdía temas, nombres y bloques. Aquí cada lectura guarda lo
// que tenía al dejarla y lo recupera al volver. Vive en el módulo (no en el componente): cerrar y abrir el editor no lo borra.

export const CLAVES_LECTURA = ["modo", "vars", "var", "cruces", "bloques", "titulos_grupo"] as const;
type Args = Readonly<Record<string, unknown>>;
type Memoria = Map<string, Map<string, Record<string, unknown>>>;

const memoria: Memoria = new Map();

/** Lo que define una lectura, copiado para que un cambio posterior no lo altere. */
export function fotoDeLectura(args: Args): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CLAVES_LECTURA) out[k] = args[k] === undefined ? null : JSON.parse(JSON.stringify(args[k]));
  return out;
}

/** Guarda la lectura que se deja. Una lectura vacía (sin preguntas ni bloques) no pisa una guardada con contenido. */
export function guardarLectura(clave: string, lectura: string, args: Args, m: Memoria = memoria): void {
  const foto = fotoDeLectura(args);
  const vacia = !tieneContenido(foto);
  const porLectura = m.get(clave) ?? new Map<string, Record<string, unknown>>();
  if (vacia && porLectura.has(lectura)) return;
  porLectura.set(lectura, foto);
  m.set(clave, porLectura);
}

/**
 * Lo que tenía esa lectura la última vez, o `null` si nunca se usó o si se dejó vacía. Una foto vacía no se restaura:
 * restaurarla borraba las preguntas de la lectura actual (mergeSlotArgsPatch borra cada clave en null), y un clic en
 * «Preguntas» después de armar «Públicos por tema» dejaba la lámina sin temas (2026-10-14).
 */
export function recuperarLectura(clave: string, lectura: string, m: Memoria = memoria): Record<string, unknown> | null {
  const foto = m.get(clave)?.get(lectura) ?? null;
  return foto && tieneContenido(foto) ? foto : null;
}

function tieneContenido(foto: Record<string, unknown>): boolean {
  const lleno = (v: unknown): boolean => Array.isArray(v) ? v.length > 0 : !!v && typeof v === "object" ? Object.keys(v as object).length > 0 : typeof v === "string" && v.trim() !== "";
  return lleno(foto.vars) || lleno(foto.var) || lleno(foto.bloques);
}
