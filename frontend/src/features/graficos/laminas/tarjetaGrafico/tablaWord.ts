// Tabla de datos del radar entre públicos en el Word: una tabla nativa de Word, centrada y encima del gráfico. La regla es
// la del motor (`.radar_mb_word_tabla_procede`, graficos_radar_tabla.R): va si `word_tabla` es TRUE o si «Tabla de datos»
// la pone (Automática con radar o con líneas y puntos; Sí en cualquier forma). Gonzalo, 2026-10-28: «faltan las tablas en
// los gráficos comparativos de ejes, tanto en el PPT como en el Word». `word_tabla` es un argumento del gráfico (como
// `tabla`), no un override: el motor no lee `overrides.word_tabla`, y el patch lo retira si un plan viejo lo trae.

import { criteriosDelRadar, formaEfectivaRadar } from "../formaRadar";

type Registro = Record<string, unknown>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});

export const CLAVE_TABLA_WORD = "word_tabla";
export const NOTA_TABLA_WORD = "Se inserta como tabla de Word, centrada y encima del gráfico";
/** Por qué el interruptor no se puede apagar: la tabla la pone «Tabla de datos», que manda en los dos formatos. */
export const NOTA_TABLA_WORD_HEREDADA = 'Va porque "Tabla de datos" la pone; con "No" deja de ir también en el PPT';

/** Sólo el radar entre públicos lleva tabla de datos. */
export function aplicaTablaWord(graficador: string, args: Readonly<Registro>): boolean {
  return graficador === "p_radar" && args.modo === "publicos";
}

/** ¿La pone «Tabla de datos», sin la marca del Word? La misma regla que el PPT. */
export function tablaWordPorLaLamina(args: Readonly<Registro>): boolean {
  return formaEfectivaRadar({ forma: args.forma, fallback_pocos: args.fallback_pocos, tabla: args.tabla, nCriterios: criteriosDelRadar(args) }).conTabla;
}

/** ¿Va la tabla en el Word? Marcada (`word_tabla`), o porque «Tabla de datos» la pone. */
export function leerTablaWord(args: Readonly<Registro>): boolean {
  return args[CLAVE_TABLA_WORD] === true || tablaWordPorLaLamina(args);
}

/** Patch de args: `word_tabla = true` para ponerla sólo en el Word; `null` la retira. Borra la clave vieja de overrides. */
export function patchTablaWord(args: Readonly<Registro>, incluir: boolean): Registro {
  const patch: Registro = { [CLAVE_TABLA_WORD]: incluir ? true : null };
  const ov = registro(args.overrides);
  if (CLAVE_TABLA_WORD in ov) {
    const { [CLAVE_TABLA_WORD]: _vieja, ...resto } = ov;
    patch.overrides = Object.keys(resto).length ? resto : null;
  }
  return patch;
}
