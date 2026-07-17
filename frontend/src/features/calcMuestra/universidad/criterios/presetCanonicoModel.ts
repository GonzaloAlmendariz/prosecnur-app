/**
 * Plan PURO de precarga del preset canónico (criterios HST 2025) sobre el
 * BORRADOR de la suite de criterios. La `seleccionCanonica` del dominio
 * codifica las exclusiones de la reunión del diseño muestral (seminario,
 * tesis, asesorías, investigación, prácticas supervisadas, actividades
 * artísticas…); aquí solo se proyecta al borrador: NADA se confirma ni se
 * aplica — el flujo confirmar-por-variable de ADR 0035 se respeta y el marco
 * solo cambia al recalcular. Patrón territorialSummaryModel: función pura con
 * test; el .tsx solo presenta.
 */
import type {
  CriterioVariable,
  CriteriosCatalogo,
  CriteriosSeleccionMarco,
  CriterioSeleccion,
} from "../../../../api/client";
import { clavesDeVariable, seleccionCanonica, seleccionVariable } from "../../dominio";

export type PresetCanonicoItem = {
  variableId: string;
  label: string;
  /** Resumen legible de lo que precarga ("3 de 8 categorías", "≥ 18"). */
  detalle: string;
  /** true si la precarga deja un subconjunto propio (restringe el marco). */
  restringe: boolean;
};

export type PresetCanonicoPlan = {
  /** Borrador resultante: canónico sobre lo confirmado. NO confirma nada. */
  seleccion: CriteriosSeleccionMarco;
  /** Variables cuyo borrador difiere de lo confirmado (quedan pendientes). */
  pendientes: string[];
  /** Mini-lista de lo que se va a precargar, por variable del catálogo. */
  items: PresetCanonicoItem[];
};

/** Firma estable (claves ordenadas) para comparar selecciones lean. */
function firma(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(firma).join(",")}]`;
  if (x && typeof x === "object") {
    const rec = x as Record<string, unknown>;
    const keys = Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${k}:${firma(rec[k])}`).join(",")}}`;
  }
  return JSON.stringify(x) ?? "null";
}

/** Resumen legible de la selección canónica de UNA variable. */
function itemDe(variable: CriterioVariable, sel: CriterioSeleccion): PresetCanonicoItem {
  if (variable.kind === "numeric") {
    const t = sel.threshold;
    const detalle = !t
      ? "sin umbral (no filtra)"
      : t.op === ">="
        ? `≥ ${t.min ?? 0}`
        : t.op === "<="
          ? `≤ ${t.max ?? 0}`
          : `${t.min ?? 0} – ${t.max ?? 0}`;
    return { variableId: variable.id, label: variable.label, detalle, restringe: Boolean(t) };
  }
  if (variable.kind === "ordinal") {
    const total = (variable.values ?? []).length;
    const marcados = (sel.includeValues ?? []).length;
    const restringe = marcados > 0 && marcados < total;
    return {
      variableId: variable.id,
      label: variable.label,
      detalle: restringe ? `${marcados} de ${total} valores` : "todos los valores (no filtra)",
      restringe,
    };
  }
  const total = clavesDeVariable(variable).length;
  const marcadas = (sel.categories ?? []).length;
  const restringe = marcadas > 0 && marcadas < total;
  return {
    variableId: variable.id,
    label: variable.label,
    detalle: restringe ? `${marcadas} de ${total} categorías` : "todas las categorías (no filtra)",
    restringe,
  };
}

/**
 * Construye el plan de precarga: la selección canónica de cada variable del
 * catálogo (no-range) reemplaza su entrada en el BORRADOR; `courseLevelRanges`
 * y `minEligible` confirmados se preservan intactos. `pendientes` lista las
 * variables cuyo borrador quedará distinto de lo CONFIRMADO — son las que el
 * usuario deberá confirmar una a una (ADR 0035).
 */
export function planPresetCanonico(
  catalogo: CriteriosCatalogo | null | undefined,
  confirmada: CriteriosSeleccionMarco | null | undefined,
): PresetCanonicoPlan {
  const base: CriteriosSeleccionMarco = confirmada
    ? { ...confirmada, byVariable: { ...(confirmada.byVariable ?? {}) } }
    : { byVariable: {} };
  const canon = seleccionCanonica(catalogo);
  const pendientes: string[] = [];
  const items: PresetCanonicoItem[] = [];
  for (const variable of catalogo?.variables ?? []) {
    if (variable.kind === "range") continue; // usa courseLevelRanges (se preserva)
    const canonVar = canon.byVariable[variable.id];
    if (!canonVar) continue;
    base.byVariable[variable.id] = canonVar;
    const firmaCanon = firma(seleccionVariable(canon, variable.id));
    const firmaConfirmada = firma(seleccionVariable(confirmada, variable.id));
    if (firmaCanon !== firmaConfirmada) pendientes.push(variable.id);
    items.push(itemDe(variable, canonVar));
  }
  return { seleccion: base, pendientes, items };
}
