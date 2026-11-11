/**
 * Modelo puro de "Reglas del formulario": la fila compacta de cada regla del
 * resultado, su nombre visible, su clasificación y el motivo de las que no se
 * evaluaron. Salió sin cambios de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6).
 */
import type { RuleDetailInput } from "../components/RuleDetailPanel";
import type { ReglaLike, VariableHoverData } from "../components/v2";
import { relationalKindCopy, relRecord, relStr, relStrList, resolveRelationalInfo, type RelationalRuleInfo, type RelationalRowSignals } from "../relationalPlan";

// -----------------------------------------------------------------------------
export type CompactRuleRowBase = {
  id: string;
  nombre: string;
  displayName: string;
  tipo: string | null;
  seccion: string | null;
  porcentaje: number | null;
  nInconsistencias: number | null;
  variables: Array<{ key: string; label: string | null }>;
  estadoDinamico: string | null;
  issueCode: string | null;
  detalle: string | null;
  // Señales relacionales (Fase 4): derivadas del resumen para clasificar la
  // familia "coherencia relacional del repeat" sin depender del plan_preview.
  tipoRegla: string | null;
  rosterSubtype: string | null;
  categoriaUx: string | null;
  tabla: string | null;
  targetVar: string | null;
  // Narrativa enriquecida (para el panel de detalle + diagrama de flujo).
  presentation: ReglaLike["presentation"];
  variableRoles: ReglaLike["variable_roles"];
};

export type CompactRuleRow = CompactRuleRowBase & {
  relationalInfo: RelationalRuleInfo;
};

// Un `calculate` que jala su valor de un listado externo vía `pulldata()` no es
// una regla de validación ni "modo experto": es un campo pre-llenado desde un
// roster externo, no revisable sin ese dato. El backend ya lo marca con
// `categoria_ux="roster_externo"` / issue_code `requires_external_dataset`; aquí
// lo detectamos para darle su propio grupo y etiqueta ("Campo pull data").
export function isPullDataRow(row: CompactRuleRow): boolean {
  return (
    row.issueCode === "requires_external_dataset" ||
    row.categoriaUx === "roster_externo" ||
    row.relationalInfo.requiresExternalDataset === true
  );
}

// Señales de una fila (compacta) para clasificarla relacionalmente.
export function relationalSignalsFromRow(row: CompactRuleRowBase): RelationalRowSignals {
  return {
    tipoRegla: row.tipoRegla,
    rosterSubtype: row.rosterSubtype,
    categoriaUx: row.categoriaUx,
    tabla: row.tabla,
    issueCode: row.issueCode,
    targetVar: row.targetVar,
    variables: row.variables.map((v) => v.key),
  };
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(value);
}

export function normalizeCompactRuleRow(row: Record<string, unknown>): CompactRuleRow | null {
  const id = typeof row.id_regla === "string" ? row.id_regla : "";
  if (!id) return null;
  const variablePairs = [
    {
      key: typeof row.variable_1 === "string" ? row.variable_1 : "",
      label: typeof row.variable_1_etiqueta === "string" ? row.variable_1_etiqueta : null,
    },
    {
      key: typeof row.variable_2 === "string" ? row.variable_2 : "",
      label: typeof row.variable_2_etiqueta === "string" ? row.variable_2_etiqueta : null,
    },
    {
      key: typeof row.variable_3 === "string" ? row.variable_3 : "",
      label: typeof row.variable_3_etiqueta === "string" ? row.variable_3_etiqueta : null,
    },
  ].filter((item) => item.key);

  const presentation = relRecord(row.presentation);
  const variableRoles = relRecord(row.variable_roles);
  const base: CompactRuleRowBase = {
    id,
    nombre: typeof row.nombre_regla === "string" ? row.nombre_regla : id,
    displayName: typeof row.nombre_regla === "string" ? row.nombre_regla : id,
    tipo: typeof row.tipo_observacion === "string" ? row.tipo_observacion : null,
    seccion: typeof row.seccion === "string" ? row.seccion : null,
    porcentaje: typeof row.porcentaje === "number" ? row.porcentaje : null,
    nInconsistencias: typeof row.n_inconsistencias === "number" ? row.n_inconsistencias : null,
    variables: variablePairs,
    estadoDinamico: typeof row.estado_dinamico === "string" ? row.estado_dinamico : null,
    issueCode: typeof row.issue_code === "string" ? row.issue_code : null,
    detalle: typeof row.detalle === "string" ? row.detalle : null,
    tipoRegla: typeof row.tipo_regla === "string" ? row.tipo_regla : null,
    rosterSubtype: presentation ? relStr(presentation.subtipo_semantico) : null,
    categoriaUx: typeof row.categoria_ux === "string" ? row.categoria_ux : null,
    tabla: typeof row.tabla === "string" ? row.tabla : null,
    targetVar: variableRoles ? relStr(variableRoles.target) : null,
    presentation: parsePresentation(presentation),
    variableRoles: parseVariableRoles(variableRoles),
  };
  return {
    ...base,
    // Derivado (sin plan_preview); en `compactRules` se re-resuelve con la
    // metadata autoritativa del plan cuando está capturada.
    relationalInfo: resolveRelationalInfo(relationalSignalsFromRow(base)),
  };
}

export function getTargetVariableKey(variables: Array<string | null | undefined>) {
  const first = variables.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof first === "string" ? first.trim() : null;
}

export function buildDisplayRuleName(nombre: string, targetKey: string | null, disambiguate: boolean) {
  const base = nombre.trim() || "Regla sin nombre";
  if (!disambiguate || !targetKey) return base;
  if (base.toLowerCase().includes(`[${targetKey.toLowerCase()}]`)) return base;
  return `${base} [${targetKey}]`;
}

// ----------------------------------------------------------------------------
// Adaptadores a los componentes v2 (RuleNarrative, hovercards de variable).
// ----------------------------------------------------------------------------

// Mapea un CompactRuleRow al shape ReglaLike que consume RuleNarrative.
// Los labels por variable se pasan por separado al `labelLookup` de
// RuleNarrative (ver `buildRowHoverLookup` + labelLookup inline).
export function compactRowToRule(row: CompactRuleRow): ReglaLike {
  const variables = row.variables.map((v) => v.key);
  const target = variables[0] ?? null;
  return {
    id: row.id,
    nombre: row.displayName,
    tipo_observacion: row.tipo ?? null,
    fuente: "instrumento",
    categoria_ux: row.tipo ?? null,
    variables,
    variable_roles: target ? { target } : null,
    n_casos: row.nInconsistencias ?? null,
    porcentaje: row.porcentaje ?? null,
  };
}

// Normaliza el bloque `presentation` del resumen a la forma de ReglaLike.
export function parsePresentation(rec: Record<string, unknown> | null): ReglaLike["presentation"] {
  if (!rec) return null;
  return {
    subtipo_semantico: relStr(rec.subtipo_semantico),
    gate_humano: relStr(rec.gate_humano),
    detalle_condicion: relStr(rec.detalle_condicion),
    nombre_humano: relStr(rec.nombre_humano),
    nombre_tecnico: relStr(rec.nombre_tecnico),
    objetivo: relStr(rec.objetivo),
  };
}

// Normaliza `variable_roles` (target puede venir como string o lista).
export function parseVariableRoles(rec: Record<string, unknown> | null): ReglaLike["variable_roles"] {
  if (!rec) return null;
  const target = relStrList(rec.target);
  const drivers = relStrList(rec.drivers);
  const compare = relStrList(rec.compare);
  const gate = relStrList(rec.gate);
  if (!target.length && !drivers.length && !compare.length && !gate.length) return null;
  return {
    target: target.length ? target : null,
    drivers: drivers.length ? drivers : null,
    compare: compare.length ? compare : null,
    gate: gate.length ? gate : null,
  };
}

// Arma el input del RuleDetailPanel a partir de una fila compacta. No depende
// del drill: sirve para cualquier tipo de regla, evaluada o no.
export function buildRuleDetailInput(row: CompactRuleRow): RuleDetailInput {
  const variables = row.variables.map((v) => v.key);
  const labelByKey = new Map(row.variables.map((v) => [v.key, v.label] as const));
  const regla: ReglaLike = {
    id: row.id,
    nombre: row.presentation?.nombre_humano ?? row.displayName,
    tipo_regla: row.tipoRegla,
    tipo_observacion: row.tipo,
    fuente: "instrumento",
    categoria_ux: row.categoriaUx,
    objetivo: row.presentation?.objetivo ?? null,
    variables,
    variable_roles: row.variableRoles,
    presentation: row.presentation,
    n_casos: row.nInconsistencias ?? null,
    porcentaje: row.porcentaje ?? null,
  };
  return {
    regla,
    displayName: row.displayName,
    estadoDinamico: row.estadoDinamico,
    issueCode: row.issueCode,
    detalle: row.detalle,
    nInconsistencias: row.nInconsistencias,
    porcentaje: row.porcentaje,
    requiresExternalDataset: isPullDataRow(row),
    relationalConditionCopy: row.relationalInfo.relational
      ? relationalKindCopy(row.relationalInfo.kind)
      : null,
    seccion: row.seccion,
    labelLookup: (v: string) => labelByKey.get(v) ?? null,
  };
}

// Hover lookup para variables: sólo tiene el label por fila (no hay drill
// cargado). Suficiente para el listado — el ContextLens abre con datos
// completos al hacer click.
export function buildRowHoverLookup(
  row: CompactRuleRow,
): (varName: string) => VariableHoverData | undefined {
  const byKey = new Map<string, string | null>();
  for (const v of row.variables) byKey.set(v.key, v.label);
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    const label = byKey.get(varName) ?? null;
    if (!label) return undefined;
    return { label, seccion: row.seccion ?? null };
  };
}

// ----------------------------------------------------------------------------
// Sección con las 3 subsecciones de reglas (con casos / no aplicables / no
// evaluadas). Cada subsección se oculta si no tiene reglas.
export type Groups = {
  relacionales: CompactRuleRow[];
  conCasos: CompactRuleRow[];
  desalineadas: CompactRuleRow[];
  noAplicables: CompactRuleRow[];
  noEvaluadas: CompactRuleRow[];
  pullData: CompactRuleRow[];
  okSinCasos: CompactRuleRow[];
};

export function describeRuleReason(row: CompactRuleRow): { badge: string; explanation: string } {
  // Regla relacional cuya base hija aún no está presente: no es "faltan
  // columnas", se evalúa al cargar la base de respuestas repetidas (Fase 4).
  if (row.issueCode === "sin_datos_repeat") {
    return {
      badge: "Respuestas repetidas pendientes",
      explanation:
        "Coherencia de las filas repetidas: se evalúa al cargar la base de respuestas repetidas (aún no hay registros de esa sección en esta base).",
    };
  }
  // Regla que depende de un roster externo precargado vía pulldata: badge
  // propio, distinto del "Modo experto" (sintaxis no soportada) (Fase 4).
  if (row.issueCode === "requires_external_dataset" || row.relationalInfo.requiresExternalDataset) {
    const datasets = row.relationalInfo.externalDatasets.filter((d) => d.length > 0);
    const listado = datasets.length
      ? datasets.map((d) => `"${d}"`).join(", ")
      : "un listado externo";
    return {
      badge: "Campo pull data",
      explanation: `Se jala de ${listado} por el teléfono.`,
    };
  }
  if (row.estadoDinamico === "no_aplicable") {
    if (row.issueCode === "missing_columns") {
      const detalle = row.detalle ?? "";
      const cols = detalle.match(/Columnas ausentes: ([^|]+)/)?.[1]?.trim();
      return {
        badge: "No aplica",
        explanation: cols
          ? `Faltan columnas en la data: ${cols}.`
          : "La columna que la regla evalúa no está en la data exportada.",
      };
    }
    return { badge: "No aplica", explanation: row.detalle ?? "Regla no aplicable a esta base." };
  }
  if (row.estadoDinamico === "no_evaluada") {
    if (row.issueCode === "odk_raw") {
      return {
        badge: "Modo experto",
        explanation:
          "Constraint con sintaxis ODK avanzada que el evaluador no traduce automáticamente. Revísala manualmente o promuévela a criterio de revisión.",
      };
    }
    if (row.issueCode === "missing_collection_date") {
      return {
        badge: "Falta fecha de captura",
        explanation:
          "La regla depende de today() pero la data no tiene una columna de fecha utilizable.",
      };
    }
    return { badge: "No evaluada", explanation: row.detalle ?? "El evaluador no pudo correr esta regla." };
  }
  if (row.estadoDinamico === "incorrecta_ejecucion") {
    return {
      badge: "Error de ejecución",
      explanation: row.detalle ?? "La regla falló al evaluarse — revisa la expresión.",
    };
  }
  if (row.estadoDinamico === "desalineada") {
    return {
      badge: "Desalineada",
      explanation:
        row.detalle ??
        "La regla compara contra un valor que no existe en los datos — probable desfase de versión del instrumento.",
    };
  }
  return { badge: row.estadoDinamico ?? "—", explanation: row.detalle ?? "" };
}
