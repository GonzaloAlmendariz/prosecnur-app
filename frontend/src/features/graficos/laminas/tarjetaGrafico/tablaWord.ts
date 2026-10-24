// Tabla de datos del radar entre públicos en el Word (decisión de Gonzalo, 2026-10-23): por defecto NO va; cuando va, es
// una tabla nativa de Word, centrada y encima del gráfico. Es una clave que sólo lee el Word —`overrides.word_tabla`— y
// NO hereda `tabla` (la del PPT). Solo se escribe cuando se aparta del default (apagada); si coincide, la clave se borra.

type Registro = Record<string, unknown>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});

export const CLAVE_TABLA_WORD = "word_tabla";
export const NOTA_TABLA_WORD = "Se inserta como tabla de Word, centrada y encima del gráfico";

/** Sólo el radar entre públicos lleva tabla de datos. */
export function aplicaTablaWord(graficador: string, args: Readonly<Registro>): boolean {
  return graficador === "p_radar" && args.modo === "publicos";
}

/** ¿Va la tabla en el Word? Apagada salvo que el gráfico diga `true`. */
export function leerTablaWord(args: Readonly<Registro>): boolean {
  return registro(args.overrides)[CLAVE_TABLA_WORD] === true;
}

/** Patch de args: escribe `word_tabla` sólo si se aparta del default (false); si coincide, la retira. */
export function patchTablaWord(args: Readonly<Registro>, incluir: boolean): Registro {
  const ov: Registro = { ...registro(args.overrides) };
  delete ov[CLAVE_TABLA_WORD];
  if (incluir) ov[CLAVE_TABLA_WORD] = true;
  return { overrides: Object.keys(ov).length ? ov : null };
}
