// Auxiliares puros del editor (posición de pregunta, lógica de SurveyMonkey, mapas de códigos, límites de sección).
// Extraídos de XlsformEditorPage.tsx — refactor puro, revamp 2026-10-16.

import { apiXlsformEditorSmInterpretRule, type ChoiceCodeMap, type SurveyMonkeyVisualLogicRule } from "../../../api/client";
import { type ConfirmedRule } from "../shell/RuleWizard";
import { type SurveyMonkeyLogicPackWarning } from "../shell/surveyMonkeyLogicPack";
import type { BuilderNode, BuilderStructure, XlsformEditorWorkbook } from "../types";
import { cloneWorkbook } from "../parsing/sheetUtils";
import { previewKindLabel } from "../parsing/buildIndex";
import { type SectionBoundaryState } from "../canvas/FocusedWorkspace";

export function computeQuestionPosition(
  structure: BuilderStructure,
  rowIndex: number,
): number | undefined {
  let count = 0;
  for (const n of structure.outline) {
    if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") {
      count += 1;
    }
    if (n.rowIndex === rowIndex) {
      if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") return count;
      return undefined;
    }
  }
  return undefined;
}

export function workbookWithSurveyMonkeyLogic(
  workbook: XlsformEditorWorkbook,
  advancedRules: ConfirmedRule[],
  visualRules: SurveyMonkeyVisualLogicRule[],
  choiceOrderOverrides: Record<string, string[]>,
  choiceCodeMaps: ChoiceCodeMap[] = workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
): XlsformEditorWorkbook {
  const next = cloneWorkbook(workbook);
  const overrides = Object.fromEntries(
    Object.entries(choiceOrderOverrides).map(([key, labels]) => [key, [...labels]]),
  );
  const resolvedChoiceCodeMaps = choiceCodeMapsWithOverrides(next, overrides, choiceCodeMaps);
  next.surveyMonkeyLogic = advancedRules.length || visualRules.length || Object.keys(overrides).length || resolvedChoiceCodeMaps.length
    ? {
        rules: advancedRules.map((rule) => ({ ...rule })),
        advanced_rules: advancedRules.map((rule) => ({ ...rule })),
        visual_rules: visualRules.map((rule) => ({
          ...rule,
          choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
        })),
        choice_order_overrides: overrides,
        choice_code_maps: cloneChoiceCodeMaps(resolvedChoiceCodeMaps),
      }
    : null;
  return next;
}

export async function refreshSurveyMonkeyAdvancedRules(
  rules: ConfirmedRule[],
  workbook: XlsformEditorWorkbook,
  choiceOrderOverrides: Record<string, string[]>,
): Promise<ConfirmedRule[]> {
  if (!rules.length) return rules;
  return Promise.all(rules.map(async (rule) => {
    try {
      const interp = await apiXlsformEditorSmInterpretRule(rule.texto, {
        workbook,
        choice_order_overrides: choiceOrderOverrides,
        choice_code_maps: workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
      });
      if (!interp.ok) return rule;
      return {
        ...rule,
        texto_humano: interp.texto_humano,
        kobo_expr: interp.resolucion.kobo_expr,
      };
    } catch {
      return rule;
    }
  }));
}

export function extractExistingKoboLogic(workbook: XlsformEditorWorkbook | null) {
  if (!workbook) return [];
  const nameIdx = workbook.survey.columns.indexOf("name");
  const labelIdx = workbook.survey.columns.indexOf("label");
  const relIdx = workbook.survey.columns.indexOf("relevant");
  if (nameIdx < 0 || relIdx < 0) return [];
  return workbook.survey.rows
    .map((row) => ({
      name: row[nameIdx] ?? "",
      label: labelIdx >= 0 ? row[labelIdx] ?? "" : "",
      relevant: row[relIdx] ?? "",
    }))
    .filter((item) => item.name && item.relevant.trim())
    .slice(0, 80);
}

export function visualActionCountForFooter(rules: SurveyMonkeyVisualLogicRule[]) {
  return rules.reduce((sum, rule) => sum + rule.choices.filter((choice) => choice.action.kind !== "none").length, 0);
}

export function actionSignature(choice: SurveyMonkeyVisualLogicRule["choices"][number]) {
  return JSON.stringify({ choiceName: choice.choiceName, action: choice.action });
}

export function mergeAdvancedLogicRules(current: ConfirmedRule[], incoming: ConfirmedRule[]) {
  const seen = new Set(current.map((rule) => rule.texto.trim()));
  const merged = [...current];
  for (const rule of incoming) {
    const key = rule.texto.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(rule);
  }
  return merged;
}

export function mergeVisualLogicRules(
  current: SurveyMonkeyVisualLogicRule[],
  incoming: SurveyMonkeyVisualLogicRule[],
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const merged = current.map((rule) => ({
    ...rule,
    choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
  }));
  for (const rule of incoming) {
    const existing = merged.find((item) => item.variableRef === rule.variableRef);
    if (!existing) {
      merged.push({
        ...rule,
        choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
      });
      continue;
    }
    const seen = new Set(existing.choices.map(actionSignature));
    for (const choice of rule.choices) {
      const sameChoice = existing.choices.find((item) => item.choiceName === choice.choiceName);
      const sig = actionSignature(choice);
      if (seen.has(sig)) continue;
      if (sameChoice && JSON.stringify(sameChoice.action) !== JSON.stringify(choice.action)) {
        warnings.push({
          severity: "warn",
          message: `La opción "${choice.choiceLabel}" en ${rule.variableLabel} ya tenía otro salto; se conservó el existente.`,
        });
        continue;
      }
      seen.add(sig);
      existing.choices.push({ ...choice, action: { ...choice.action } });
    }
  }
  return merged;
}

export function cloneChoiceCodeMaps(maps: ChoiceCodeMap[] | undefined | null): ChoiceCodeMap[] {
  return (maps ?? []).map((map) => ({
    ...map,
    mappings: map.mappings.map((item) => ({ ...item })),
  }));
}

export function normalizeChoiceMapLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function questionKeyFromVariable(ref: string) {
  const match = ref.match(/^[pq]0*(\d+)/i);
  return match ? String(Number(match[1])) : "";
}

export function choiceCodeMapsWithOverrides(
  workbook: XlsformEditorWorkbook,
  overrides: Record<string, string[]>,
  maps: ChoiceCodeMap[] | undefined | null,
): ChoiceCodeMap[] {
  const out = cloneChoiceCodeMaps(maps);
  const existingKeys = new Set(out.map((map) => questionKeyFromVariable(map.variable)).filter(Boolean));
  const surveyCols = workbook.survey.columns;
  const choiceCols = workbook.choices.columns;
  const nameIdx = surveyCols.indexOf("name");
  const typeIdx = surveyCols.indexOf("type");
  const labelIdx = surveyCols.indexOf("label::es") >= 0 ? surveyCols.indexOf("label::es") : surveyCols.indexOf("label");
  const listIdx = choiceCols.indexOf("list_name");
  const choiceNameIdx = choiceCols.indexOf("name");
  const choiceLabelIdx = choiceCols.indexOf("label::es") >= 0 ? choiceCols.indexOf("label::es") : choiceCols.indexOf("label");
  if (nameIdx < 0 || typeIdx < 0 || listIdx < 0 || choiceNameIdx < 0) return out;

  for (const [qKey, labels] of Object.entries(overrides)) {
    if (!labels.length || existingKeys.has(qKey)) continue;
    const surveyRow = workbook.survey.rows.find((row) => questionKeyFromVariable(row[nameIdx] ?? "") === qKey);
    if (!surveyRow) continue;
    const typeRaw = surveyRow[typeIdx] ?? "";
    const typeMatch = typeRaw.match(/^(select_one|select_multiple)\s+(\S+)/i);
    if (!typeMatch) continue;
    const listName = typeMatch[2];
    const choices = workbook.choices.rows
      .filter((row) => (row[listIdx] ?? "") === listName)
      .map((row) => ({
        name: row[choiceNameIdx] ?? "",
        label: (choiceLabelIdx >= 0 ? row[choiceLabelIdx] ?? "" : "") || row[choiceNameIdx] || "",
      }));
    if (!choices.length) continue;
    const choicesByLabel = new Map<string, typeof choices>();
    for (const choice of choices) {
      const key = normalizeChoiceMapLabel(choice.label);
      const arr = choicesByLabel.get(key) ?? [];
      arr.push(choice);
      choicesByLabel.set(key, arr);
    }
    const mappings = labels.map((label, index) => {
      const key = normalizeChoiceMapLabel(label);
      const queue = choicesByLabel.get(key) ?? [];
      const matched = queue.shift();
      if (queue.length) choicesByLabel.set(key, queue);
      else choicesByLabel.delete(key);
      return {
        source_code: String(index + 1),
        source_column: "",
        source_label: label,
        xls_code: matched?.name ?? String(index + 1),
        xls_label: matched?.label ?? label,
        match: matched ? "manual_editor" : "manual_editor_fallback",
      };
    });
    out.push({
      variable: surveyRow[nameIdx] ?? `p${qKey}`,
      label: labelIdx >= 0 ? surveyRow[labelIdx] ?? surveyRow[nameIdx] ?? `p${qKey}` : surveyRow[nameIdx] ?? `p${qKey}`,
      type: typeMatch[1].toLowerCase() === "select_multiple" ? "select_multiple" : "select_one",
      list_name: listName,
      status: "manual_editor",
      high_confidence: true,
      requires_confirmation: false,
      mappings,
    });
    existingKeys.add(qKey);
  }
  return out;
}

export function choiceCodeMapKey(map: ChoiceCodeMap) {
  return map.variable.trim().toLowerCase();
}

export function mergeChoiceCodeMaps(
  current: ChoiceCodeMap[] | undefined | null,
  incoming: ChoiceCodeMap[] | undefined | null,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const merged = cloneChoiceCodeMaps(current);
  const byVariable = new Map(merged.map((map) => [choiceCodeMapKey(map), map]));

  for (const rawMap of incoming ?? []) {
    const map = cloneChoiceCodeMaps([rawMap])[0];
    if (!map) continue;
    const key = choiceCodeMapKey(map);
    const existing = byVariable.get(key);
    if (!existing) {
      merged.push(map);
      byVariable.set(key, map);
      continue;
    }

    const existingBySource = new Map(existing.mappings.map((item) => [item.source_code.trim(), item]));
    for (const item of map.mappings) {
      const sourceCode = item.source_code.trim();
      const currentItem = existingBySource.get(sourceCode);
      if (!currentItem) {
        existing.mappings.push({ ...item });
        existingBySource.set(sourceCode, item);
        continue;
      }
      if (
        currentItem.xls_code !== item.xls_code ||
        currentItem.xls_label !== item.xls_label ||
        currentItem.source_label !== item.source_label
      ) {
        warnings.push({
          severity: "warn",
          message: `El mapa interno ${map.variable} ${sourceCode} ya existía; se conservó el mapeo confirmado en este workbook.`,
        });
      }
    }
  }

  return merged;
}

export function sectionIdForRow(rowIndex: number): string {
  return `section-${rowIndex}`;
}

export function boundaryNodeLabel(node: BuilderNode | null | undefined): string {
  if (!node) return "la pieza";
  return node.label || node.name || previewKindLabel(node);
}

export function findNextSiblingAfterSection(
  structure: BuilderStructure | null,
  sectionRowIndex: number,
): BuilderNode | null {
  const node = structure?.byRow.get(sectionRowIndex);
  if (!structure || !node || (node.kind !== "section" && node.kind !== "repeat")) return null;
  const section = structure.sections.get(sectionIdForRow(sectionRowIndex));
  const span = structure.spans.get(sectionRowIndex);
  const end = section?.endRowIndex ?? span?.end ?? sectionRowIndex;
  return structure.outline.find(
    (entry) => entry.sectionId === node.sectionId && entry.rowIndex > end,
  ) ?? null;
}

export function findLastDirectChildInSection(
  structure: BuilderStructure | null,
  sectionRowIndex: number,
): BuilderNode | null {
  if (!structure) return null;
  const section = structure.sections.get(sectionIdForRow(sectionRowIndex));
  const span = structure.spans.get(sectionRowIndex);
  const end = section?.endRowIndex ?? span?.end ?? sectionRowIndex;
  const children = structure.outline.filter(
    (entry) =>
      entry.sectionId === sectionIdForRow(sectionRowIndex) &&
      entry.rowIndex > sectionRowIndex &&
      entry.rowIndex < end,
  );
  return children[children.length - 1] ?? null;
}

export function buildSectionBoundaryState(
  structure: BuilderStructure | null,
  node: BuilderNode | null,
): SectionBoundaryState | null {
  if (!structure || !node || (node.kind !== "section" && node.kind !== "repeat")) return null;
  const section = structure.sections.get(sectionIdForRow(node.rowIndex));
  if (!section) return null;
  const itemCount = section.itemCount;
  const next = findNextSiblingAfterSection(structure, node.rowIndex);
  const lastChild = findLastDirectChildInSection(structure, node.rowIndex);
  const closingType = node.kind === "repeat" ? "end_repeat" : "end_group";
  return {
    itemCount,
    closeLabel: itemCount > 0
      ? `${closingType} queda después de ${boundaryNodeLabel(lastChild)}`
      : `${closingType} queda justo después del título`,
    closeDetail: itemCount > 0
      ? "El cierre del XLSForm se mueve automáticamente con estos controles; no necesitas crear una fila manual en Hojas."
      : "El bloque está vacío: el cierre queda debajo del título y las piezas siguientes todavía están fuera.",
    nextLabel: next ? boundaryNodeLabel(next) : null,
    lastChildLabel: lastChild ? boundaryNodeLabel(lastChild) : null,
    canIncludeNext: Boolean(next),
    canReleaseLast: Boolean(lastChild),
  };
}
