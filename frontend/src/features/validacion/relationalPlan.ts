// =============================================================================
// Plan relacional del repeat (Validación v2, Fase 4 del ADR 0030).
//
// Presenta la validación de un grupo repeat condicionado como UN instrumento
// con base relacionada — la familia "coherencia relacional del repeat":
//   RC1 · cardinalidad condicionada  (nº filas hija == count-selected(SM))
//   RC3 · integridad referencial     (_parent_index existe en la madre)
//   RC4 · unicidad del roster        (current_code único por submission)
//   RC5 · correspondencia roster↔selección ({roster} == {marcados})
// más el marcador transversal "requiere roster externo (pulldata)".
//
// Este módulo concentra la LÓGICA PURA (normalizadores + clasificación) para
// que los `.tsx` solo presenten y para poder testear la agrupación con vitest
// (patrón territorialSummaryModel / repeatIdentity).
//
// De dónde salen los datos:
//   - El backend anota cada regla del `plan_preview` con los flags relacionales
//     (endpoint POST /api/validacion/v2/instrumento/plan → ver
//     validacion_relational_surface.R) y expone un `relational_summary` para el
//     encabezado de la familia.
//   - El resultado de auditoría (`resumen_tabla`) NO trae esos flags, así que
//     también los DERIVAMOS de los campos de cada regla (tipo_regla /
//     subtipo_semantico / issue_code / tabla). Así el panel se arma aunque el
//     plan no se haya reconstruido en esta sesión (degradación con gracia).
// =============================================================================

// -----------------------------------------------------------------------------
// Helpers defensivos (payload R: NA/null/strings/números llegan de varias
// formas — safeNum-style, ver trampas conocidas del frontend).
// -----------------------------------------------------------------------------
export function relStr(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "NA" || trimmed === "NaN") return null;
    return trimmed;
  }
  return null;
}

function relBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    return t === "true" || t === "1";
  }
  return false;
}

function relInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return 0;
}

export function relStrList(value: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = relStr(v);
    if (s !== null) out.push(s);
  };
  if (Array.isArray(value)) value.forEach(push);
  else push(value);
  // Únicos preservando orden.
  return Array.from(new Set(out));
}

export function relRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// -----------------------------------------------------------------------------
// Tipos del contrato del backend.
// -----------------------------------------------------------------------------

/** Un repeat con su conductor de correspondencia (del `relational_summary`). */
export type RelationalRepeatSpec = {
  repeatGroup: string;
  /** select_multiple cuya selección gobierna la cardinalidad/correspondencia. */
  smConductor: string | null;
  /** calculate de identidad del roster (p.ej. current_code). */
  identityVar: string | null;
  /** expresión cruda de `repeat_count` (p.ej. "count-selected(${services})"). */
  repeatCount: string | null;
};

/** Resumen relacional para el encabezado de la familia. */
export type RelationalSummary = {
  nRelational: number;
  nRequiresExternalDataset: number;
  repeatGroups: string[];
  externalDatasets: string[];
  repeats: RelationalRepeatSpec[];
};

/** Flags relacionales por regla (inline en cada fila de `plan_preview`). */
export type RelationalRuleMeta = {
  relational: boolean;
  repeatGroup: string | null;
  dependsOnChildBase: boolean;
  requiresExternalDataset: boolean;
  externalDatasets: string[];
  rosterSubtype: string | null;
};

/** Familia fina de la regla relacional (para orden/copy/destaque). */
export type RelationalKind =
  | "cardinality" // RC1
  | "correspondence" // RC5
  | "referential" // RC3
  | "uniqueness" // RC4
  | "other";

/** Info relacional resuelta (plan-meta autoritativo ∪ derivación del resumen). */
export type RelationalRuleInfo = {
  relational: boolean;
  kind: RelationalKind;
  repeatGroup: string | null;
  dependsOnChildBase: boolean;
  requiresExternalDataset: boolean;
  externalDatasets: string[];
  rosterSubtype: string | null;
  /** La base hija no está presente ahora mismo (issue `sin_datos_repeat`). */
  childBaseMissing: boolean;
};

// -----------------------------------------------------------------------------
// Normalizadores defensivos.
// -----------------------------------------------------------------------------

/**
 * Normaliza `relational_summary`. Devuelve `null` cuando no hay nada relacional
 * que mostrar (el encabezado se oculta limpio en instrumentos sin repeat).
 */
export function normalizeRelationalSummary(raw: unknown): RelationalSummary | null {
  const rec = relRecord(raw);
  if (!rec) return null;

  const repeatsRaw = Array.isArray(rec.repeats) ? rec.repeats : [];
  const repeats: RelationalRepeatSpec[] = [];
  for (const entry of repeatsRaw) {
    const r = relRecord(entry);
    if (!r) continue;
    const group = relStr(r.repeat_group);
    if (!group) continue;
    repeats.push({
      repeatGroup: group,
      smConductor: relStr(r.sm_conductor),
      identityVar: relStr(r.identity_var),
      repeatCount: relStr(r.repeat_count),
    });
  }

  const summary: RelationalSummary = {
    nRelational: relInt(rec.n_relational),
    nRequiresExternalDataset: relInt(rec.n_requires_external_dataset),
    repeatGroups: relStrList(rec.repeat_groups),
    externalDatasets: relStrList(rec.external_datasets),
    repeats,
  };

  if (
    summary.nRelational === 0 &&
    summary.nRequiresExternalDataset === 0 &&
    summary.repeats.length === 0 &&
    summary.repeatGroups.length === 0
  ) {
    return null;
  }
  return summary;
}

/** Normaliza los flags relacionales inline de una fila de `plan_preview`. */
export function normalizeRelationalRuleMeta(raw: unknown): RelationalRuleMeta {
  const rec = relRecord(raw) ?? {};
  return {
    relational: relBool(rec.relational),
    repeatGroup: relStr(rec.repeat_group),
    dependsOnChildBase: relBool(rec.depends_on_child_base),
    requiresExternalDataset: relBool(rec.requires_external_dataset),
    externalDatasets: relStrList(rec.external_datasets),
    rosterSubtype: relStr(rec.roster_subtype),
  };
}

/** ID de una fila del plan (preview usa `ID` mayúscula; toleramos alternativas). */
export function relationalRowId(row: Record<string, unknown>): string | null {
  return relStr(row.ID) ?? relStr(row.id) ?? relStr(row.id_regla);
}

/**
 * Mapa `id_regla → RelationalRuleMeta` a partir del `plan_preview`. Se captura
 * al construir el plan; el resultado de auditoría lo consulta por id.
 */
export function buildRelationalMetaMap(
  planPreview: ReadonlyArray<Record<string, unknown>> | null | undefined,
): Map<string, RelationalRuleMeta> {
  const map = new Map<string, RelationalRuleMeta>();
  if (!planPreview) return map;
  for (const row of planPreview) {
    const id = relationalRowId(row);
    if (!id) continue;
    map.set(id, normalizeRelationalRuleMeta(row));
  }
  return map;
}

// -----------------------------------------------------------------------------
// Clasificación derivada (desde los campos del `resumen_tabla`).
// -----------------------------------------------------------------------------

/** Señales de una regla necesarias para clasificarla relacionalmente. */
export type RelationalRowSignals = {
  tipoRegla: string | null; // tipo_regla del bundle
  rosterSubtype: string | null; // presentation.subtipo_semantico
  categoriaUx: string | null; // categoria_ux
  tabla: string | null;
  issueCode: string | null;
  targetVar: string | null; // variable_roles.target
  variables: string[]; // claves de variable de la regla
};

const NON_REPEAT_TABLE = new Set(["", "principal"]);

function tablaIsChild(tabla: string | null): boolean {
  return !!tabla && !NON_REPEAT_TABLE.has(tabla);
}

function isRosterUniqueness(variables: string[]): boolean {
  return variables.some((v) => v === "current_code" || v === "_parent_index");
}

/** Deriva la familia fina de la regla a partir de sus señales. */
export function deriveRelationalKind(sig: RelationalRowSignals): RelationalKind {
  const tipo = sig.tipoRegla ?? "";
  const subtipo = sig.rosterSubtype ?? "";
  if (tipo === "repeat_length" || subtipo === "count") return "cardinality";
  if (subtipo === "relacional") {
    // RC3 vive en la hija (target `_parent_index` o tabla != principal);
    // RC5 vive en la madre sobre el select_multiple conductor.
    if (sig.targetVar === "_parent_index" || tablaIsChild(sig.tabla)) return "referential";
    return "correspondence";
  }
  if (tipo === "duplicate" && isRosterUniqueness(sig.variables)) return "uniqueness";
  return "other";
}

/**
 * Resuelve la info relacional de una regla combinando la derivación del
 * resumen con la metadata autoritativa del plan (cuando está disponible).
 */
export function resolveRelationalInfo(
  sig: RelationalRowSignals,
  planMeta?: RelationalRuleMeta | null,
): RelationalRuleInfo {
  const kind = deriveRelationalKind(sig);
  const childBaseMissing = sig.issueCode === "sin_datos_repeat";
  const derivedExternal =
    sig.issueCode === "requires_external_dataset" || sig.categoriaUx === "roster_externo";
  const derivedRepeatGroup = tablaIsChild(sig.tabla) ? sig.tabla : null;
  const derivedRelational = kind !== "other";

  if (!planMeta) {
    return {
      relational: derivedRelational,
      kind,
      repeatGroup: derivedRepeatGroup,
      dependsOnChildBase: derivedRelational,
      requiresExternalDataset: derivedExternal,
      externalDatasets: [],
      rosterSubtype: sig.rosterSubtype,
      childBaseMissing,
    };
  }

  return {
    relational: planMeta.relational || derivedRelational,
    kind,
    repeatGroup: planMeta.repeatGroup ?? derivedRepeatGroup,
    dependsOnChildBase: planMeta.dependsOnChildBase || derivedRelational,
    requiresExternalDataset: planMeta.requiresExternalDataset || derivedExternal,
    externalDatasets: planMeta.externalDatasets.length ? planMeta.externalDatasets : [],
    rosterSubtype: planMeta.rosterSubtype ?? sig.rosterSubtype,
    childBaseMissing,
  };
}

// -----------------------------------------------------------------------------
// Copy / etiquetas de presentación (español neutro).
// -----------------------------------------------------------------------------

export function relationalKindLabel(kind: RelationalKind): string {
  switch (kind) {
    case "cardinality":
      return "Cantidad de filas por persona";
    case "correspondence":
      return "Las filas coinciden con lo marcado";
    case "referential":
      return "Cada fila tiene su persona";
    case "uniqueness":
      return "Sin filas duplicadas";
    default:
      return "Coherencia de las filas repetidas";
  }
}

export function relationalKindCopy(kind: RelationalKind): string {
  switch (kind) {
    case "cardinality":
      return "Cada persona debe tener una fila por cada opción que marcó.";
    case "correspondence":
      return "Las filas repetidas de cada persona deben corresponder exactamente a las opciones que marcó.";
    case "referential":
      return "Cada fila repetida debe pertenecer a una persona registrada.";
    case "uniqueness":
      return "Cada respuesta repetida aparece una sola vez por persona.";
    default:
      return "Coherencia entre las personas y sus filas repetidas.";
  }
}

/** Etiqueta del badge "requiere un listado externo" (distinto de «Modo experto»). */
export function externalRosterBadgeLabel(datasets: string[]): string {
  const named = datasets.filter((d) => d.length > 0);
  if (named.length === 1) return `Requiere el listado externo «${named[0]}»`;
  if (named.length > 1) {
    return `Requiere los listados externos: ${named.map((d) => `«${d}»`).join(", ")}`;
  }
  return "Requiere un listado externo";
}

/**
 * Encabezado estructural de un repeat para la familia relacional. Describe la
 * ESTRUCTURA (no los conteos runtime, que no existen a nivel de plan):
 * "Una fila de «rep_servicios» por cada opción marcada en «services»".
 */
export function formatRelationalRepeatHeadline(spec: RelationalRepeatSpec): string {
  if (spec.smConductor) {
    return `Una fila de «${spec.repeatGroup}» por cada opción marcada en «${spec.smConductor}».`;
  }
  return `«${spec.repeatGroup}» — respuestas repetidas vinculadas a cada persona.`;
}
