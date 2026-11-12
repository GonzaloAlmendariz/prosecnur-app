// Etiquetas de Analítica › Datos: el borrador que el analista edita y lo que la
// config ya guarda. Puro, sin React. Salió de `panes/DataReviewPane.tsx`, que
// lo reexporta con los mismos nombres.

import type { DataReviewVariable } from "../../../api/analitica";
import type { SeccionConfig } from "../store";
import { opcionesEquivalentes, problemasDeEtiqueta } from "../panes/revisionEtiquetas/detectorEtiquetas";

export function dataReviewHasEditableOptions(variable: Pick<DataReviewVariable, "tipo_xlsform" | "opciones">) {
  const tipo = (variable.tipo_xlsform ?? "").trim().toLowerCase();
  return (tipo.startsWith("select_one") || tipo.startsWith("select_multiple")) && variable.opciones.length > 0;
}

export function dataReviewEffectiveVariableLabel(variable: DataReviewVariable, override?: string) {
  return override ?? (variable.label_actual || variable.label_original || variable.name);
}

export function dataReviewEffectiveOptionLabel(option: DataReviewVariable["opciones"][number], override?: string) {
  return override ?? (option.label || option.code);
}

export type DataReviewDraft = {
  variableLabels: Record<string, string>;
  valueLabels: Record<string, Record<string, string>>;
};

export function buildDataReviewDraft(
  variables: DataReviewVariable[],
  variableOverrides: Record<string, string> = {},
  valueOverrides: Record<string, Record<string, string>> = {},
): DataReviewDraft {
  const variableLabels: Record<string, string> = {};
  const valueLabels: Record<string, Record<string, string>> = {};
  for (const variable of variables) {
    variableLabels[variable.name] = dataReviewEffectiveVariableLabel(variable, variableOverrides[variable.name]);
    if (dataReviewHasEditableOptions(variable)) {
      valueLabels[variable.name] = {};
      const overrides = valueOverrides[variable.name] ?? {};
      for (const option of variable.opciones) {
        valueLabels[variable.name][option.code] = dataReviewEffectiveOptionLabel(option, overrides[option.code]);
      }
    }
  }
  return { variableLabels, valueLabels };
}

export function dataReviewDraftStatus(variables: DataReviewVariable[], draft: DataReviewDraft, baseline: DataReviewDraft) {
  let pendingCount = 0;
  let emptyCount = 0;
  for (const variable of variables) {
    const draftLabel = draft.variableLabels[variable.name] ?? "";
    const baselineLabel = baseline.variableLabels[variable.name] ?? "";
    if (draftLabel !== baselineLabel) pendingCount += 1;
    if (!draftLabel.trim()) emptyCount += 1;
    if (!dataReviewHasEditableOptions(variable)) continue;
    for (const option of variable.opciones) {
      const draftOption = draft.valueLabels[variable.name]?.[option.code] ?? "";
      const baselineOption = baseline.valueLabels[variable.name]?.[option.code] ?? "";
      if (draftOption !== baselineOption) pendingCount += 1;
      if (!draftOption.trim()) emptyCount += 1;
    }
  }
  return { pendingCount, emptyCount };
}

/** La variable tiene etiquetas del borrador sin confirmar: la suya o la de alguna opción. */
export function variablePorConfirmar(variable: DataReviewVariable, draft: DataReviewDraft, baseline: DataReviewDraft): boolean {
  return dataReviewDraftStatus([variable], draft, baseline).pendingCount > 0;
}

export type DataReviewSectionGroup = {
  id: string;
  name: string;
  hidden: boolean;
  manual?: boolean;
  synthetic: boolean;
  variables: DataReviewVariable[];
};

export function buildDataReviewSectionGroups(
  variables: DataReviewVariable[],
  sections: SeccionConfig[],
): DataReviewSectionGroup[] {
  const byName = new Map(variables.map((variable) => [variable.name, variable]));
  const assigned = new Set<string>();
  const groups: DataReviewSectionGroup[] = [];
  const groupByVariable = new Map<string, DataReviewSectionGroup>();
  const sortedSections = [...sections].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  for (const section of sortedSections) {
    const sectionVars = section.variables
      .map((name) => byName.get(name))
      .filter((variable): variable is DataReviewVariable => Boolean(variable));
    sectionVars.forEach((variable) => assigned.add(variable.name));
    if (sectionVars.length === 0) continue;
    const group = {
      id: section.id,
      name: section.nombre || section.id,
      hidden: Boolean(section.oculto),
      manual: section.manual,
      synthetic: false,
      variables: sectionVars,
    };
    groups.push(group);
    sectionVars.forEach((variable) => groupByVariable.set(variable.name, group));
  }

  for (const variable of variables) {
    if (assigned.has(variable.name)) continue;
    const parentGroup = variable.dummy_parent ? groupByVariable.get(variable.dummy_parent) : undefined;
    if (parentGroup) {
      parentGroup.variables.push(variable);
      assigned.add(variable.name);
      groupByVariable.set(variable.name, parentGroup);
      continue;
    }
    const configuredSection = groups.find(
      (group) => !group.synthetic && (group.name === variable.seccion || group.id === variable.seccion),
    );
    if (configuredSection) {
      configuredSection.variables.push(variable);
      assigned.add(variable.name);
      groupByVariable.set(variable.name, configuredSection);
      continue;
    }
    const fallbackName = variable.seccion || "General";
    const existing = groups.find((group) => group.synthetic && group.name === fallbackName);
    if (existing) {
      existing.variables.push(variable);
      groupByVariable.set(variable.name, existing);
    }
    else {
      const group = {
        id: `__fallback_${fallbackName}`,
        name: fallbackName,
        hidden: false,
        synthetic: true,
        variables: [variable],
      };
      groups.push(group);
      groupByVariable.set(variable.name, group);
    }
  }

  return groups;
}

/** Opciones con detalles de redacción (G18), contadas sin abrir el inspector. */
export function opcionesConDetalles(variable: DataReviewVariable, draftValueLabels: Record<string, Record<string, string>>) {
  if (!dataReviewHasEditableOptions(variable)) return 0;
  const etiqueta = (option: DataReviewVariable["opciones"][number]) =>
    draftValueLabels[variable.name]?.[option.code] ?? dataReviewEffectiveOptionLabel(option);
  const equivalentes = opcionesEquivalentes(variable.opciones.map((o) => ({ code: o.code, label: etiqueta(o) })));
  return variable.opciones.filter(
    (o) => problemasDeEtiqueta(etiqueta(o), { esOpcion: true }).length > 0 || equivalentes.has(o.code),
  ).length;
}

/** La variable tiene algo que restaurar: borrador distinto del guardado, o guardado distinto del original. */
export function variableTieneCambios(
  variable: DataReviewVariable,
  draftVariableLabels: Record<string, string>,
  draftValueLabels: Record<string, Record<string, string>>,
  baselineDraft: DataReviewDraft,
) {
  const original = dataReviewEffectiveVariableLabel(variable);
  const draft = draftVariableLabels[variable.name] ?? original;
  const baseline = baselineDraft.variableLabels[variable.name] ?? original;
  if (draft !== baseline || baseline !== original) return true;
  if (!dataReviewHasEditableOptions(variable)) return false;
  return variable.opciones.some((option) => {
    const originalOption = dataReviewEffectiveOptionLabel(option);
    const draftOption = draftValueLabels[variable.name]?.[option.code] ?? originalOption;
    const baselineOption = baselineDraft.valueLabels[variable.name]?.[option.code] ?? originalOption;
    return draftOption !== baselineOption || baselineOption !== originalOption;
  });
}
