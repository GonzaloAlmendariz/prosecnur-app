import type {
  EstudioBase,
  SurveyMonkeySavBundleFileInspection,
  SurveyMonkeySavBundleInspection,
  SurveyMonkeySavBundleMissingRequiredPolicy,
} from "../../api/client";

export type SavBundleFileBaseMap = Record<string, string>;

export type SavBundleInspectionCredit = {
  policy: SurveyMonkeySavBundleMissingRequiredPolicy;
  fileBaseMap: SavBundleFileBaseMap;
  localFingerprint: string;
  backendFingerprint: string;
};

export type SavBundleMapValidation = {
  complete: boolean;
  duplicateBases: string[];
  unknownBases: string[];
};

export type SmSavBundleIssueGroup = {
  key: string;
  label: string;
  reason: string;
  variables: string[];
  notes: string[];
  tone: "warning" | "danger" | "neutral";
};

export type SavBundleRevisionView = {
  label: string;
  detail: string;
  tone: "success" | "warning" | "danger";
};

export function savBundleCleanFileBaseMap(fileBaseMap: SavBundleFileBaseMap): SavBundleFileBaseMap {
  return Object.fromEntries(
    Object.entries(fileBaseMap)
      .map(([entryName, baseName]) => [entryName.trim(), baseName.trim()] as const)
      .filter(([entryName, baseName]) => Boolean(entryName && baseName))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function savBundleContractFingerprint(
  policy: SurveyMonkeySavBundleMissingRequiredPolicy,
  fileBaseMap: SavBundleFileBaseMap,
): string {
  return JSON.stringify({
    missing_required_policy: policy,
    file_base_map: savBundleCleanFileBaseMap(fileBaseMap),
  });
}

export function savBundleResolvedFileBaseMap(
  inspection: SurveyMonkeySavBundleInspection,
  requestedMap: SavBundleFileBaseMap,
  validBaseNames: readonly string[],
): SavBundleFileBaseMap {
  const valid = new Set(validBaseNames);
  return Object.fromEntries(inspection.files.map((file) => {
    const requested = String(requestedMap[file.entry_name] ?? "").trim();
    const automatic = String(file.base_name ?? "").trim();
    const resolved = valid.has(requested) ? requested : valid.has(automatic) ? automatic : "";
    return [file.entry_name, resolved];
  }));
}

export function savBundleFileBaseMapValidation(
  files: readonly Pick<SurveyMonkeySavBundleFileInspection, "entry_name">[],
  fileBaseMap: SavBundleFileBaseMap,
  validBaseNames: readonly string[],
): SavBundleMapValidation {
  const valid = new Set(validBaseNames);
  const resolved = files.map((file) => String(fileBaseMap[file.entry_name] ?? "").trim());
  const counts = new Map<string, number>();
  for (const baseName of resolved.filter(Boolean)) {
    counts.set(baseName, (counts.get(baseName) ?? 0) + 1);
  }
  return {
    complete: files.length > 0 && resolved.every(Boolean),
    duplicateBases: [...counts.entries()].filter(([, count]) => count > 1).map(([baseName]) => baseName),
    unknownBases: [...new Set(resolved.filter((baseName) => baseName && !valid.has(baseName)))],
  };
}

export function savBundleInspectionIsStale(
  credit: SavBundleInspectionCredit | null,
  policy: SurveyMonkeySavBundleMissingRequiredPolicy,
  fileBaseMap: SavBundleFileBaseMap,
): boolean {
  if (!credit) return false;
  return credit.localFingerprint !== savBundleContractFingerprint(policy, fileBaseMap);
}

export function smSavBundleInspectionWarningCount(inspection?: SurveyMonkeySavBundleInspection | null) {
  if (!inspection) return 0;
  const fileWarnings = inspection.files.reduce((sum, file) => sum + file.warnings.length, 0);
  return inspection.warnings.length + fileWarnings;
}

export function smSavBundleInspectionCanImport(inspection?: SurveyMonkeySavBundleInspection | null) {
  return !!inspection && inspection.ok && inspection.n_matched > 0 && inspection.n_blocking === 0;
}

export function smSavBundleIssueGroups(file: SurveyMonkeySavBundleFileInspection): SmSavBundleIssueGroup[] {
  const groups: SmSavBundleIssueGroup[] = [];
  if (file.blocking || file.warnings.length) {
    groups.push({
      key: "warnings",
      label: file.blocking ? "Bloqueo de inspección" : "Advertencias de inspección",
      reason: file.blocking
        ? "El archivo no se puede aplicar hasta resolver esta condición."
        : "La importación puede continuar, pero conviene revisar estos avisos antes de reemplazar las respuestas.",
      variables: [],
      notes: file.warnings,
      tone: file.blocking ? "danger" : "warning",
    });
  }
  if (file.missing_variables.length) {
    groups.push({
      key: "missing",
      label: "Faltantes en SAV",
      reason: "El formulario vigente espera estas variables, pero no se encontró una columna equivalente en el SAV.",
      variables: file.missing_variables,
      notes: [],
      tone: "warning",
    });
  }
  if (file.blank_filled_variables.length) {
    groups.push({
      key: "blank-filled",
      label: "Rellenadas en blanco",
      reason: "La política de compatibilidad completa estas variables como columnas vacías y mantiene una advertencia visible.",
      variables: file.blank_filled_variables,
      notes: [],
      tone: "neutral",
    });
  }
  if (file.all_empty_variables.length) {
    groups.push({
      key: "all-empty",
      label: "Sin datos observados",
      reason: "La variable existe o fue reconocida, pero todas sus filas llegan vacías en este SAV.",
      variables: file.all_empty_variables,
      notes: [],
      tone: "warning",
    });
  }
  return groups;
}

export function smSavBundleVariableLabel(variable: string, lookup?: Map<string, string>) {
  return String(lookup?.get(variable) || "").replace(/\s+/g, " ").trim();
}

export function savBundleVariableLabelLookup(base?: Pick<EstudioBase, "xlsform_variables"> | null) {
  const lookup = new Map<string, string>();
  for (const item of base?.xlsform_variables ?? []) {
    const name = String(item.name || "").trim();
    if (!name || lookup.has(name)) continue;
    lookup.set(name, String(item.label || "").replace(/\s+/g, " ").trim());
  }
  return lookup;
}

export function smSavBundleVariableSummary(file: SurveyMonkeySavBundleFileInspection) {
  if (file.missing_variables.length) {
    const sample = file.missing_variables.slice(0, 4).join(", ");
    return `${file.missing_variables.length} faltante${file.missing_variables.length === 1 ? "" : "s"}${sample ? `: ${sample}${file.missing_variables.length > 4 ? ", ..." : ""}` : ""}`;
  }
  if (file.blank_filled_variables.length) {
    const sample = file.blank_filled_variables.slice(0, 4).join(", ");
    return `${file.blank_filled_variables.length} rellenada${file.blank_filled_variables.length === 1 ? "" : "s"} en blanco${sample ? `: ${sample}${file.blank_filled_variables.length > 4 ? ", ..." : ""}` : ""}`;
  }
  if (file.all_empty_variables.length) {
    const sample = file.all_empty_variables.slice(0, 4).join(", ");
    return `${file.all_empty_variables.length} sin datos observados${sample ? `: ${sample}${file.all_empty_variables.length > 4 ? ", ..." : ""}` : ""}`;
  }
  if (file.warnings.length) return `Revisar detalle: ${file.warnings[0]}`;
  return "Variables esperadas disponibles";
}

export function smSavBundleImpactLabel(file: SurveyMonkeySavBundleFileInspection) {
  const delta = file.change_plan?.impact?.rows_delta;
  const prefix = delta == null ? "" : delta > 0 ? `+${delta} filas · ` : `${delta} filas · `;
  return `${prefix}${file.n_output_columns} columnas finales`;
}

export function smSavBundleIssueLabel(file: SurveyMonkeySavBundleFileInspection) {
  if (file.blocking) return file.warnings[0] || "Archivo bloqueado";
  if (file.warnings.length) return file.warnings[0];
  return "Lista para actualizar";
}

export function savBundleRevisionIdShort(revisionId: string): string {
  const clean = revisionId.trim();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 8)}…${clean.slice(-4)}`;
}

export function savBundleRevisionView(file: SurveyMonkeySavBundleFileInspection): SavBundleRevisionView {
  const revision = file.instrument_revision;
  const revisionId = savBundleRevisionIdShort(revision.revision_id);
  if (revision.status === "pinned_healthy") {
    return {
      tone: "success",
      label: revisionId ? `Publicada · ${revisionId}` : "Revisión publicada",
      detail: "La base está fijada a una revisión publicada saludable.",
    };
  }
  if (revision.status === "legacy_unpinned") {
    return {
      tone: "warning",
      label: "Legacy sin pin",
      detail: revision.warning || "La base usa su XLSForm actual sin acreditar una revisión publicada.",
    };
  }
  return {
    tone: "danger",
    label: revisionId ? `Revisión bloqueada · ${revisionId}` : "Revisión bloqueada",
    detail: revision.reasons[0] || "La revisión publicada no pudo acreditarse.",
  };
}
