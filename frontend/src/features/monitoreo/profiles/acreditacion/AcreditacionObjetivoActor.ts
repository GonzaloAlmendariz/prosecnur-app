import type { MonitoreoGoal, MonitoreoGoalObjetivo } from "../../../../api/client";

/**
 * Objetivo declarado por actor.
 *
 * El "meta" de un estudio de acreditación es un **mínimo a llegar** y es un
 * instrumento interno: al alcanzarlo el estudio se cubre. Pero lo que se
 * persigue de verdad depende del actor y del acuerdo con el cliente — que
 * normalmente quiere barrer todo el universo, sobre todo cuando es chico, y
 * solo se conforma con el mínimo cuando el universo es grande y no se puede
 * barrer.
 *
 * Antes de esto la UI asumía una sola lectura: estampaba "Meta cubierta" en
 * verde y `BRECHA 0` sobre actores con universo por trabajar. En acrconta eso
 * daba por cerrados a Administrativos (15/16), Docentes (52/53) y Estudiantes
 * (173/180) — a 1, 1 y 7 respuestas de barrer todo.
 */

/**
 * Universo hasta el cual se asume barrido total mientras nadie declare otra
 * cosa. Por encima, el mínimo suele ser el acuerdo real.
 *
 * No es una constante metodológica sino un default de lectura: siempre se
 * puede declarar lo contrario, y la declaración manda.
 */
export const ACREDITACION_UNIVERSO_BARRIBLE = 200;

export type AcreditacionObjetivoLectura = {
  objetivo: MonitoreoGoalObjetivo;
  /** `true` cuando nadie lo declaró y se está infiriendo por tamaño. */
  sugerido: boolean;
  /** Efectivas que faltan para el objetivo vigente. `null` si no hay referencia. */
  faltan: number | null;
  /** El objetivo vigente ya está cumplido. */
  cumplido: boolean;
  /** Denominador contra el que se mide la barra, según el objetivo. */
  denominador: number | null;
  /** Avance contra el denominador del objetivo, 0-100. */
  avancePct: number | null;
  /** Trabajo que queda sobre el universo, independientemente del objetivo. */
  universoPendiente: number;
  /** El mínimo interno ya está cubierto (siempre se calcula, sea o no el objetivo). */
  minimoCubierto: boolean;
};

export function acreditacionObjetivoSugerido(universo: number): MonitoreoGoalObjetivo {
  return universo > 0 && universo <= ACREDITACION_UNIVERSO_BARRIBLE ? "barrido" : "minimo";
}

function normalizarObjetivo(value: unknown): MonitoreoGoalObjetivo | null {
  return value === "barrido" || value === "minimo" ? value : null;
}

function pct(part: number, total: number | null) {
  if (!total || total <= 0) return null;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

/**
 * Resuelve cómo leer un actor: qué objetivo rige, cuánto falta para él y
 * cuánto queda del universo pase lo que pase.
 */
export function acreditacionLecturaObjetivo({
  universo,
  efectivas,
  minimo,
  objetivoDeclarado,
}: {
  universo: number;
  efectivas: number;
  minimo: number | null;
  objetivoDeclarado?: unknown;
}): AcreditacionObjetivoLectura {
  const universoLimpio = Math.max(0, Math.round(universo) || 0);
  const efectivasLimpias = Math.max(0, Math.round(efectivas) || 0);
  const minimoLimpio = minimo != null && Number.isFinite(minimo) ? Math.max(0, Math.round(minimo)) : null;

  const declarado = normalizarObjetivo(objetivoDeclarado);
  // Sin universo no hay barrido posible, aunque alguien lo declare.
  const objetivo: MonitoreoGoalObjetivo = declarado && !(declarado === "barrido" && universoLimpio <= 0)
    ? declarado
    : acreditacionObjetivoSugerido(universoLimpio);

  const denominador = objetivo === "barrido"
    ? (universoLimpio || null)
    : (minimoLimpio ?? (universoLimpio || null));

  const faltan = denominador != null ? Math.max(0, denominador - efectivasLimpias) : null;
  const universoPendiente = Math.max(0, universoLimpio - efectivasLimpias);

  return {
    objetivo,
    sugerido: declarado == null,
    faltan,
    cumplido: faltan != null ? faltan <= 0 : false,
    denominador,
    avancePct: pct(efectivasLimpias, denominador),
    universoPendiente,
    minimoCubierto: minimoLimpio != null ? efectivasLimpias >= minimoLimpio : false,
  };
}

/** Titular del actor según el objetivo vigente. Nunca esconde la otra lectura. */
export function acreditacionTitularObjetivo(lectura: AcreditacionObjetivoLectura, minimo: number | null, efectivas: number) {
  if (lectura.objetivo === "barrido") {
    if (lectura.faltan == null) return "Sin universo declarado";
    return lectura.faltan > 0
      ? `Faltan ${lectura.faltan} de ${lectura.denominador}`
      : `Universo cubierto (${lectura.denominador})`;
  }
  if (minimo == null) return "Mínimo sin definir";
  const pctMinimo = minimo > 0 ? Math.round((efectivas / minimo) * 100) : null;
  return lectura.faltan && lectura.faltan > 0
    ? `Faltan ${lectura.faltan} para el mínimo ${minimo}`
    : `Mínimo ${minimo} · ${efectivas} logradas${pctMinimo != null ? ` (${pctMinimo}%)` : ""}`;
}

/** Encuentra el objetivo declarado para un actor dentro de las metas del estudio. */
export function acreditacionObjetivoDeGoals(goals: MonitoreoGoal[] = [], actor: string): MonitoreoGoalObjetivo | null {
  const clave = String(actor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (!clave) return null;
  const hit = goals.find((goal) => Object.values(goal.filters ?? {}).some((value) => (
    String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim() === clave
  )));
  return normalizarObjetivo(hit?.objetivo);
}
