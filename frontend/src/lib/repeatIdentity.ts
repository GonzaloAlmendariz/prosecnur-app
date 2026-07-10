// Identidad visual transversal de grupos repeat (ADR 0030 Fase 5).
//
// El naranja suave (`--pulso-repeat-*` en theme.css) es un MARCADOR SEMÁNTICO
// que significa SIEMPRE lo mismo: "esto pertenece a una estructura repetida
// (roster one-to-many)". No es un acento de familia/módulo. Este módulo
// concentra la LÓGICA PURA (detección, etiquetas, normalización y formato del
// grano) para que los componentes visuales (`RepeatBadge`, `RepeatGrainNote`)
// solo presenten y para que la misma semántica sea consistente en Carga,
// Analítica y cualquier otra superficie donde aparezca un repeat.

/**
 * Grano de una base hija repeat. El backend lo emite en
 * `/api/analitica/variables` (campo `grain`) desde
 * `attr(inst, "repeat_grain")`. Es `null` en bases no-repeat.
 *
 * `n_instancias` = filas de la base hija (1 fila = 1 registro del roster).
 * `n_personas`   = unidades del padre (`link_key`) únicas presentes en la hija.
 */
export type RepeatGrain = {
  kind: "instancia";
  n_instancias: number | null;
  n_personas: number | null;
  repeat_group: string;
  parent_base: string;
  nota: string;
};

/** `source_kind` con el que el backend registra una base hija repeat. */
export const REPEAT_SOURCE_KIND = "kobo_repeat";

/** Metadata mínima necesaria para reconocer una base hija repeat. */
export type RepeatBaseLike = {
  source_kind?: string | null;
  repeat_group?: string | null;
  parent_base?: string | null;
};

/**
 * Parsea un número que puede llegar de un payload R como number, string
 * ("668"), null, o `NA`/`NaN` (safeNum-style, ver trampas conocidas del
 * frontend). Devuelve `null` cuando no hay un número finito.
 */
export function safeRepeatNum(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "NA" || trimmed === "NaN") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * ¿La base es una hija repeat? Estructural (no acopla a `EstudioBase`) para
 * poder reutilizarse en cualquier superficie y testearse sin el tipo completo.
 */
export function isRepeatChildBase(base: RepeatBaseLike | null | undefined): boolean {
  return !!base && String(base.source_kind ?? "") === REPEAT_SOURCE_KIND;
}

/**
 * Etiqueta del badge de identidad repeat: "Repetible · <grupo>" cuando hay
 * grupo, o "Repetible" a secas. El texto es siempre estable para que el
 * naranja lea igual en toda la app.
 */
export function repeatBadgeLabel(repeatGroup?: string | null): string {
  const group = String(repeatGroup ?? "").trim();
  return group ? `Repetible · ${group}` : "Repetible";
}

/**
 * Normalizador defensivo del grano (patrón `normalizeGraficosShareInspect`).
 * Devuelve `null` cuando el payload no describe un grano de instancia
 * (base no-repeat, `null`, o forma inesperada). Nunca lanza.
 */
export function normalizeRepeatGrain(raw: unknown): RepeatGrain | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (String(record.kind ?? "") !== "instancia") return null;
  return {
    kind: "instancia",
    n_instancias: safeRepeatNum(record.n_instancias),
    n_personas: safeRepeatNum(record.n_personas),
    repeat_group: String(record.repeat_group ?? ""),
    parent_base: String(record.parent_base ?? ""),
    nota: String(record.nota ?? ""),
  };
}

export type RepeatGrainDisplay = {
  /** "N = 668 instancias de rep_servicios · 427 personas". */
  headline: string;
  /** Advertencia de clustering (grain.nota); "" si el backend no la envió. */
  caveat: string;
};

function formatCount(n: number, singular: string, plural: string): string {
  const noun = n === 1 ? singular : plural;
  return `${n.toLocaleString("es-PE")} ${noun}`;
}

/**
 * Formatea el grano para el banner del indicador. Devuelve `null` cuando el
 * grano no aporta ningún N (no hay nada útil que mostrar).
 */
export function formatRepeatGrain(grain: RepeatGrain | null | undefined): RepeatGrainDisplay | null {
  if (!grain) return null;
  const { n_instancias: nInst, n_personas: nPers } = grain;
  if (nInst == null && nPers == null) return null;
  const group = grain.repeat_group.trim();
  const parts: string[] = [];
  if (nInst != null) {
    const instancias = formatCount(nInst, "instancia", "instancias");
    parts.push(group ? `${instancias} de ${group}` : instancias);
  }
  if (nPers != null) {
    parts.push(formatCount(nPers, "persona", "personas"));
  }
  return { headline: `N = ${parts.join(" · ")}`, caveat: grain.nota.trim() };
}
