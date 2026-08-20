/**
 * Por qué esta aula espera esas encuestas.
 *
 * Gonzalo: «el que monitorea tiene que saber por qué estamos asignando esa
 * validez a ese curso horario». La meta no es un número caído del cielo: el
 * cálculo de muestra la compone con tres factores que viajan en la misma fila.
 *
 *     elegibles × p_aplicada × rendimiento = efectivas esperadas
 *          24   ×    73 %    ×     69 %    =        12,1
 *
 * - **p_aplicada**: probabilidad de que el aula llegue a aplicarse, según el
 *   tipo de docente.
 * - **rendimiento**: lo que rinde un aula de ese tamaño, calibrado con el 2025.
 *
 * Aquí no se recalcula nada: los tres factores vienen dados y esto sólo los
 * pone en una frase. Recalcular sería tener dos fórmulas que se separan.
 */

type Fila = Readonly<Record<string, unknown>>;

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type PorQueEsaMeta = {
  elegibles: number;
  pAplicada: number;
  rendimiento: number;
  meta: number;
  /** Los tipos de docente del aula, ya separados. */
  docentes: string[];
  /** `true` si el aula tiene más de un docente: la tasa es la del más restrictivo. */
  variosDocentes: boolean;
};

/**
 * Los tipos de docente de un aula.
 *
 * Vienen en un solo campo separados por «|» cuando el aula tiene dos docentes:
 * «DOCENTE ORDINARIO - PRINCIPAL | DOCENTE CONTRATADO - CONTRATADO». **Se parte
 * por «|» y nunca por « - »**, que es el separador INTERNO de cada tipo: partir
 * por el guion convertiría un docente en dos.
 */
export function tiposDeDocente(valor: unknown): string[] {
  return String(valor ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `null` cuando la fila no trae con qué explicar la meta. */
export function porQueEsaMeta(fila: Fila): PorQueEsaMeta | null {
  const elegibles = num(fila.eligible_n);
  const pAplicada = num(fila.p_aplicada_ref);
  const rendimiento = num(fila.rendimiento_ref);
  const meta = num(fila.expected_valid);
  if (elegibles === null || pAplicada === null || rendimiento === null || meta === null) return null;
  if (elegibles <= 0 || pAplicada <= 0 || rendimiento <= 0) return null;
  const docentes = tiposDeDocente(fila.teacher_type);
  return {
    elegibles, pAplicada, rendimiento, meta,
    docentes,
    variosDocentes: docentes.length > 1,
  };
}
