import type { CalcMuestraAulasState } from "../../../../api/client";

export type FrameIntegrityStatus = "consistent" | "unverifiable" | "inconsistent";

export type FrameIntegrity = {
  status: FrameIntegrityStatus;
  projections: {
    owner: number | null;
    perfil: number | null;
    audit: number | null;
    exploracion: number | null;
  };
  /** Conteo canónico del owner ejecutado; null mientras el frame no sea consistente. */
  marcoAulas: number | null;
};

function singleton(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? singleton(value[0]) : value;
}

/** Convierte una proyección escalar sin confundir un cero real con ausencia. */
function projectionNumber(value: unknown): number | null {
  const scalar = singleton(value);
  if (typeof scalar === "number") return Number.isFinite(scalar) ? scalar : null;
  if (typeof scalar !== "string") return null;
  const trimmed = scalar.trim();
  if (!trimmed || trimmed === "NA") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> | null {
  const candidate = singleton(value);
  return candidate != null && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null;
}

function auditRecordProjection(candidate: unknown): { matched: boolean; value: number | null } {
  const row = record(candidate);
  if (!row) return { matched: false, value: null };
  const metrics = Array.isArray(row.metric) ? row.metric : [row.metric];
  const values = Array.isArray(row.value) ? row.value : [row.value];
  const index = metrics.findIndex((metric) => String(singleton(metric) ?? "").trim() === "classroom_included_n");
  if (index < 0) return { matched: false, value: null };
  return {
    matched: true,
    value: projectionNumber(values.length === 1 ? values[0] : values[index]),
  };
}

function auditProjection(frame: CalcMuestraAulasState["frame"] | null | undefined): number | null {
  const audit = (frame as unknown as Record<string, unknown> | null | undefined)?.audit;
  if (Array.isArray(audit)) {
    for (const candidate of audit) {
      const projection = auditRecordProjection(candidate);
      if (projection.matched) return projection.value;
    }
    return null;
  }
  return auditRecordProjection(audit).value;
}

/** `included` legacy solo se acepta cuando representa un booleano sin duda. */
function includedFlag(value: unknown): boolean | null {
  const scalar = singleton(value);
  if (typeof scalar === "boolean") return scalar;
  if (typeof scalar === "number") {
    if (scalar === 1) return true;
    if (scalar === 0) return false;
    return null;
  }
  if (typeof scalar !== "string") return null;
  const text = scalar.trim().toLocaleLowerCase("es");
  if (["true", "t", "1", "yes", "y", "si", "sí"].includes(text)) return true;
  if (["false", "f", "0", "no", "n"].includes(text)) return false;
  return null;
}

function includedProjection(values: unknown[]): number | null {
  let included = 0;
  for (const value of values) {
    const flag = includedFlag(value);
    if (flag == null) return null;
    if (flag) included += 1;
  }
  return included;
}

/**
 * Owner canónico: normaliza filas, objeto-de-arrays y objeto singleton. En
 * todos los casos cada `included` debe representar un booleano sin duda.
 */
function ownerProjection(frame: CalcMuestraAulasState["frame"] | null | undefined): number | null {
  const raw = (frame as unknown as Record<string, unknown> | null | undefined)?.aula_frame;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return 0;
    if (raw.length === 1) {
      const singletonRow = record(raw[0]);
      if (singletonRow && Array.isArray(singletonRow.included)) {
        return includedProjection(singletonRow.included);
      }
    }
    const flags: unknown[] = [];
    for (const candidate of raw) {
      const row = record(candidate);
      if (!row) return null;
      flags.push(row.included);
    }
    return includedProjection(flags);
  }

  const columnar = record(raw);
  if (!columnar || !Object.prototype.hasOwnProperty.call(columnar, "included")) return null;
  if (Array.isArray(columnar.included)) return includedProjection(columnar.included);
  return includedProjection([columnar.included]);
}

function nestedProjection(frame: CalcMuestraAulasState["frame"] | null | undefined) {
  const frameRecord = record(frame);
  const perfil = record(frameRecord?.perfil);
  const exploracion = record(frameRecord?.exploracion);
  const totales = record(exploracion?.totales);
  return {
    perfil: projectionNumber(perfil?.marco_aulas),
    exploracion: projectionNumber(totales?.ch_elegibles),
  };
}

/**
 * Deriva el conteo ejecutado exclusivamente de `aula_frame.included` y lo
 * contrasta con perfil, audit y radiografía serializados del mismo frame.
 */
export function frameIntegrity(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
): FrameIntegrity {
  const nested = nestedProjection(frame);
  const projections = {
    owner: ownerProjection(frame),
    perfil: nested.perfil,
    audit: auditProjection(frame),
    exploracion: nested.exploracion,
  };
  const available = Object.values(projections).filter((value): value is number => value !== null);
  const status: FrameIntegrityStatus =
    available.some((value) => value !== available[0])
      ? "inconsistent"
      : projections.owner == null || projections.exploracion == null
        ? "unverifiable"
        : "consistent";

  return {
    status,
    projections,
    marcoAulas: status === "consistent" ? projections.owner : null,
  };
}

/**
 * ¿El marco llegó a construirse alguna vez?
 *
 * `Boolean(frame)` no sirve: en un proyecto recién creado el backend serializa
 * el marco ausente como **objeto vacío**, no como `null`. Medido sobre un
 * `.pulso` nuevo, `state.aulas.frame` llega como `{}`.
 *
 * Con `Boolean(frame)` ese `{}` cuenta como marco construido, y entonces
 * `frameIntegrity` —que clasifica «sin proyecciones» como `unverifiable`—
 * hace que la pantalla diga «El marco ejecutado no es verificable contra su
 * radiografía. Reconstruye el marco…» a alguien que **nunca lo construyó**.
 * Pide rehacer algo que no existe y esconde el mensaje correcto, que ya estaba
 * escrito más abajo en la misma cadena: «Aún no has construido el marco».
 *
 * Ausencia y no-verificabilidad son cosas distintas y llevan a acciones
 * distintas: una se resuelve calculando por primera vez, la otra reconstruyendo.
 * El hash es la marca de que hubo una construcción real.
 */
export function marcoFueConstruido(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
): boolean {
  const hash = (frame as { frame_hash?: unknown } | null | undefined)?.frame_hash;
  return typeof hash === "string" && hash.trim().length > 0;
}

/**
 * Nota bajo los KPIs de elegibles: en qué estado está el marco y qué hacer.
 *
 * Vive aquí y no dentro de la cabecera porque la distinción que resuelve es la
 * misma que gobierna `marcoFueConstruido`, y porque una decisión que se toma
 * mirando tres estados merece poder probarse sin montar el componente entero.
 *
 * `null` significa que no hay nada que advertir: el marco está construido y
 * cuadra con su radiografía.
 */
export function notaEstadoDelMarco(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
): string | null {
  if (!marcoFueConstruido(frame)) return "sin construir · calcula elegibles";
  const { status } = frameIntegrity(frame);
  if (status === "inconsistent") return "frame incoherente · reconstruye";
  if (status === "unverifiable") return "frame no verificable · reconstruye";
  return null;
}
