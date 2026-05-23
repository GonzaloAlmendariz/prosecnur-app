import type {
  ChoiceCodeMap,
  SurveyMonkeyVisualLogicAction,
  SurveyMonkeyVisualLogicRule,
} from "../../../api/client";
import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../types";

export const SURVEY_MONKEY_LOGIC_PACK_KIND = "pulso.surveymonkey.logic_pack";
export const SURVEY_MONKEY_LOGIC_PACK_VERSION = 1;

export type SurveyMonkeyAdvancedLogicRule = {
  id: string;
  texto: string;
  texto_humano: string;
  kobo_expr?: string;
};

export type SurveyMonkeyLogicPackWarning = {
  severity: "info" | "warn";
  message: string;
};

type LogicPackChoiceSignature = {
  name: string;
  label: string;
  index: number;
};

type LogicPackQuestionSignature = {
  ref: string;
  label: string;
  pageId?: string;
  pageLabel?: string;
  choices: LogicPackChoiceSignature[];
};

type LogicPackPageSignature = {
  pageId: string;
  label: string;
  questionRefs: string[];
};

export type SurveyMonkeyLogicPackSignature = {
  questions: LogicPackQuestionSignature[];
  pages: LogicPackPageSignature[];
};

export type SurveyMonkeyLogicPack = {
  kind: typeof SURVEY_MONKEY_LOGIC_PACK_KIND;
  version: typeof SURVEY_MONKEY_LOGIC_PACK_VERSION;
  exported_at: string;
  source: {
    name: string | null;
    question_count: number;
    page_count: number;
  };
  advanced_rules: SurveyMonkeyAdvancedLogicRule[];
  visual_rules: SurveyMonkeyVisualLogicRule[];
  choice_order_overrides: Record<string, string[]>;
  choice_code_maps: ChoiceCodeMap[];
  signature: SurveyMonkeyLogicPackSignature;
};

export type ImportSurveyMonkeyLogicPackResult = {
  advanced_rules: SurveyMonkeyAdvancedLogicRule[];
  visual_rules: SurveyMonkeyVisualLogicRule[];
  choice_order_overrides: Record<string, string[]>;
  choice_code_maps: ChoiceCodeMap[];
  warnings: SurveyMonkeyLogicPackWarning[];
};

function cell(row: string[], columns: string[], name: string): string {
  const idx = columns.indexOf(name);
  return idx >= 0 ? row[idx] ?? "" : "";
}

function normalizeLabel(value: string): string {
  return value
    .replace(/^[pq]0*\d+(?:_[a-z0-9_]+)?\s*:\s*/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:()[\]{}"'`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function labelTokens(value: string): Set<string> {
  const stop = new Set(["de", "del", "la", "el", "los", "las", "y", "o", "en", "que", "cual", "cuales", "su", "sus", "un", "una"]);
  return new Set(normalizeLabel(value).split(" ").filter((token) => token.length > 2 && !stop.has(token)));
}

function labelSimilarity(a: string, b: string): number {
  const aa = labelTokens(a);
  const bb = labelTokens(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  return intersection / new Set([...aa, ...bb]).size;
}

function canonicalRef(ref: string): string {
  const m = String(ref ?? "").match(/^[pq]0*(\d+)(.*)$/i);
  if (!m) return String(ref ?? "").trim().toLowerCase();
  return `p${Number(m[1])}${(m[2] ?? "").toLowerCase()}`;
}

function displayRef(ref: string): string {
  const m = canonicalRef(ref).match(/^p(\d+)(.*)$/);
  if (!m) return ref;
  return `p${Number(m[1])}${m[2] ?? ""}`;
}

function ruleRef(ref: string): string {
  const m = canonicalRef(ref).match(/^p(\d+)(.*)$/);
  if (!m) return String(ref ?? "").toUpperCase();
  return `P${Number(m[1])}${m[2] ?? ""}`;
}

function refNumber(ref: string): string | null {
  const m = canonicalRef(ref).match(/^p(\d+)/);
  return m ? String(Number(m[1])) : null;
}

function sheetRows(sheet: XlsformEditorSheet | null | undefined): string[][] {
  return sheet?.rows ?? [];
}

function selectListName(type: string): string {
  const m = String(type ?? "").match(/^select_(?:one|multiple)\s+(\S+)/);
  return m ? m[1] : "";
}

function findPageId(name: string): string {
  const m = String(name ?? "").match(/(?:Pag|section_pag_?)(\d+)/i);
  return m ? String(Number(m[1])) : "";
}

export function buildSurveyMonkeyLogicSignature(workbook: XlsformEditorWorkbook): SurveyMonkeyLogicPackSignature {
  const choicesByList = new Map<string, LogicPackChoiceSignature[]>();
  for (const row of sheetRows(workbook.choices)) {
    const listName = cell(row, workbook.choices.columns, "list_name");
    if (!listName) continue;
    const choices = choicesByList.get(listName) ?? [];
    choices.push({
      name: cell(row, workbook.choices.columns, "name"),
      label: cell(row, workbook.choices.columns, "label::es") || cell(row, workbook.choices.columns, "label") || cell(row, workbook.choices.columns, "name"),
      index: choices.length + 1,
    });
    choicesByList.set(listName, choices);
  }

  const pages: LogicPackPageSignature[] = [];
  const pageByName = new Map<string, LogicPackPageSignature>();
  const questions: LogicPackQuestionSignature[] = [];
  let currentPage: LogicPackPageSignature | null = null;

  for (const row of sheetRows(workbook.survey)) {
    const type = cell(row, workbook.survey.columns, "type");
    const name = cell(row, workbook.survey.columns, "name");
    const label = cell(row, workbook.survey.columns, "label::es") || cell(row, workbook.survey.columns, "label") || name;
    if (type === "begin_group") {
      const pageId = findPageId(name) || String(pages.length + 1);
      currentPage = {
        pageId,
        label: label || displayRef(name) || `Pag${pageId}`,
        questionRefs: [],
      };
      pages.push(currentPage);
      if (name) pageByName.set(name, currentPage);
      continue;
    }
    if (type === "end_group") {
      currentPage = null;
      continue;
    }
    if (!name || type === "note" || type === "calculate") continue;
    if (type === "begin_repeat" || type === "end_repeat" || type === "begin_group") continue;
    const pageName = cell(row, workbook.survey.columns, "section");
    const page = currentPage ?? pageByName.get(pageName) ?? null;
    const listName = selectListName(type);
    const question: LogicPackQuestionSignature = {
      ref: name,
      label,
      pageId: page?.pageId,
      pageLabel: page?.label,
      choices: listName ? [...(choicesByList.get(listName) ?? [])] : [],
    };
    questions.push(question);
    page?.questionRefs.push(name);
  }

  return { questions, pages };
}

function cloneVisualRules(rules: SurveyMonkeyVisualLogicRule[]): SurveyMonkeyVisualLogicRule[] {
  return rules.map((rule) => ({
    ...rule,
    choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
  }));
}

function cloneAdvancedRules(rules: SurveyMonkeyAdvancedLogicRule[]): SurveyMonkeyAdvancedLogicRule[] {
  return rules.map((rule) => ({ ...rule }));
}

function cloneChoiceCodeMaps(maps: ChoiceCodeMap[] | undefined | null): ChoiceCodeMap[] {
  return (maps ?? []).map((map) => ({
    ...map,
    mappings: map.mappings.map((item) => ({ ...item })),
  }));
}

export function buildSurveyMonkeyLogicPack({
  workbook,
  advancedRules,
  visualRules,
  choiceOrderOverrides,
  choiceCodeMaps,
  sourceName,
}: {
  workbook: XlsformEditorWorkbook;
  advancedRules: SurveyMonkeyAdvancedLogicRule[];
  visualRules: SurveyMonkeyVisualLogicRule[];
  choiceOrderOverrides: Record<string, string[]>;
  choiceCodeMaps?: ChoiceCodeMap[];
  sourceName?: string | null;
}): SurveyMonkeyLogicPack {
  const signature = buildSurveyMonkeyLogicSignature(workbook);
  return {
    kind: SURVEY_MONKEY_LOGIC_PACK_KIND,
    version: SURVEY_MONKEY_LOGIC_PACK_VERSION,
    exported_at: new Date().toISOString(),
    source: {
      name: sourceName ?? null,
      question_count: signature.questions.length,
      page_count: signature.pages.length,
    },
    advanced_rules: cloneAdvancedRules(advancedRules),
    visual_rules: cloneVisualRules(visualRules),
    choice_order_overrides: Object.fromEntries(
      Object.entries(choiceOrderOverrides).map(([key, labels]) => [key, [...labels]]),
    ),
    choice_code_maps: cloneChoiceCodeMaps(choiceCodeMaps),
    signature,
  };
}

function ensurePack(value: unknown): SurveyMonkeyLogicPack {
  if (!value || typeof value !== "object") {
    throw new Error("El archivo no contiene un paquete de lógica SurveyMonkey.");
  }
  const raw = value as Record<string, unknown>;
  if (raw.kind !== SURVEY_MONKEY_LOGIC_PACK_KIND) {
    throw new Error("El JSON no es un paquete de lógica SurveyMonkey de Pulso.");
  }
  if (Number(raw.version) !== SURVEY_MONKEY_LOGIC_PACK_VERSION) {
    throw new Error(`Versión de paquete no soportada: ${String(raw.version ?? "")}`);
  }
  return raw as SurveyMonkeyLogicPack;
}

function uniqueByLabel<T extends { label: string }>(items: T[], label: string): T | null {
  const norm = normalizeLabel(label);
  const matches = items.filter((item) => normalizeLabel(item.label) === norm);
  return matches.length === 1 ? matches[0] : null;
}

function bestFuzzyByLabel<T extends { label: string }>(items: T[], label: string): { item: T; score: number } | null {
  const scored = items
    .map((item) => ({ item, score: labelSimilarity(item.label, label) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const next = scored[1];
  if (!best || best.score < 0.55) return null;
  if (next && best.score - next.score < 0.08) return null;
  return best;
}

function mapQuestions(
  source: SurveyMonkeyLogicPackSignature,
  current: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const currentByRef = new Map(current.questions.map((q) => [canonicalRef(q.ref), q]));
  const out = new Map<string, LogicPackQuestionSignature>();

  for (const src of source.questions) {
    const exact = currentByRef.get(canonicalRef(src.ref));
    if (exact) {
      out.set(canonicalRef(src.ref), exact);
      continue;
    }
    const byLabel = uniqueByLabel(current.questions, src.label);
    if (byLabel) {
      out.set(canonicalRef(src.ref), byLabel);
      warnings.push({ severity: "info", message: `${displayRef(src.ref)} se emparejó por etiqueta con ${displayRef(byLabel.ref)}.` });
      continue;
    }
    const fuzzy = bestFuzzyByLabel(current.questions, src.label);
    if (fuzzy) {
      out.set(canonicalRef(src.ref), fuzzy.item);
      warnings.push({ severity: "info", message: `${displayRef(src.ref)} se emparejó por fraseo similar con ${displayRef(fuzzy.item.ref)}.` });
    }
  }

  return out;
}

function mapPages(
  source: SurveyMonkeyLogicPackSignature,
  current: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const currentById = new Map(current.pages.map((p) => [p.pageId, p]));
  const out = new Map<string, LogicPackPageSignature>();

  for (const src of source.pages) {
    const exact = currentById.get(src.pageId);
    if (exact) {
      out.set(src.pageId, exact);
      continue;
    }
    const byLabel = uniqueByLabel(current.pages, src.label);
    if (byLabel) {
      out.set(src.pageId, byLabel);
      warnings.push({ severity: "info", message: `La página ${src.label} se emparejó con ${byLabel.label}.` });
      continue;
    }
    const fuzzy = bestFuzzyByLabel(current.pages, src.label);
    if (fuzzy) {
      out.set(src.pageId, fuzzy.item);
      warnings.push({ severity: "info", message: `La página ${src.label} se emparejó por fraseo similar con ${fuzzy.item.label}.` });
    }
  }

  return out;
}

function findChoiceMatch(
  sourceChoice: LogicPackChoiceSignature,
  currentQuestion: LogicPackQuestionSignature,
) {
  const byName = currentQuestion.choices.find((choice) => choice.name === sourceChoice.name);
  if (byName) return byName;
  const byLabel = uniqueByLabel(currentQuestion.choices, sourceChoice.label);
  if (byLabel) return byLabel;
  return bestFuzzyByLabel(currentQuestion.choices, sourceChoice.label)?.item ?? null;
}

function currentPageForQuestion(currentSignature: SurveyMonkeyLogicPackSignature, question: LogicPackQuestionSignature) {
  if (question.pageId) return currentSignature.pages.find((page) => page.pageId === question.pageId) ?? null;
  return currentSignature.pages.find((page) => page.questionRefs.some((ref) => canonicalRef(ref) === canonicalRef(question.ref))) ?? null;
}

function findCompositeQuestionTarget(
  currentSignature: SurveyMonkeyLogicPackSignature,
  ref: string,
) {
  const base = canonicalRef(ref);
  if (!/^p\d+$/.test(base)) return null;
  const prefix = `${base}_`;
  return currentSignature.questions.find((q) => canonicalRef(q.ref).startsWith(prefix)) ?? null;
}

function remapAction(
  action: SurveyMonkeyVisualLogicAction,
  questionMap: Map<string, LogicPackQuestionSignature>,
  pageMap: Map<string, LogicPackPageSignature>,
  currentSignature: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
): SurveyMonkeyVisualLogicAction | null {
  if (action.kind === "none" || action.kind === "end") return { ...action };
  if (action.kind === "page_top") {
    const page = pageMap.get(action.pageId)
      ?? currentSignature.pages.find((p) => p.pageId === action.pageId)
      ?? uniqueByLabel(currentSignature.pages, action.pageLabel);
    if (!page) {
      warnings.push({ severity: "warn", message: `No se encontró la página destino "${action.pageLabel || action.pageId}".` });
      return null;
    }
    return { kind: "page_top", pageId: page.pageId, pageLabel: page.label };
  }

  let compositeFallback = false;
  const target = questionMap.get(canonicalRef(action.targetRef))
    ?? currentSignature.questions.find((q) => canonicalRef(q.ref) === canonicalRef(action.targetRef))
    ?? uniqueByLabel(currentSignature.questions, action.targetLabel)
    ?? (() => {
      const composite = findCompositeQuestionTarget(currentSignature, action.targetRef);
      compositeFallback = Boolean(composite);
      return composite;
    })();
  if (!target) {
    warnings.push({ severity: "warn", message: `No se encontró la pregunta destino "${action.targetLabel || action.targetRef}".` });
    return null;
  }
  if (compositeFallback) {
    warnings.push({
      severity: "info",
      message: `${displayRef(action.targetRef)} se emparejó con ${displayRef(target.ref)} como primera fila de una pregunta compuesta.`,
    });
  }
  const page = currentPageForQuestion(currentSignature, target)
    ?? pageMap.get(action.pageId)
    ?? currentSignature.pages.find((p) => p.pageId === action.pageId);
  return {
    kind: "question",
    pageId: page?.pageId ?? action.pageId,
    pageLabel: page?.label ?? action.pageLabel,
    targetRef: target.ref,
    targetLabel: `${displayRef(target.ref)}: ${target.label}`,
  };
}

function remapVisualRules(
  pack: SurveyMonkeyLogicPack,
  questionMap: Map<string, LogicPackQuestionSignature>,
  pageMap: Map<string, LogicPackPageSignature>,
  currentSignature: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const sourceByRef = new Map(pack.signature.questions.map((q) => [canonicalRef(q.ref), q]));
  const out: SurveyMonkeyVisualLogicRule[] = [];

  for (const rule of pack.visual_rules ?? []) {
    const sourceQuestion = sourceByRef.get(canonicalRef(rule.variableRef));
    const currentQuestion = questionMap.get(canonicalRef(rule.variableRef))
      ?? currentSignature.questions.find((q) => canonicalRef(q.ref) === canonicalRef(rule.variableRef));
    if (!sourceQuestion || !currentQuestion) {
      warnings.push({ severity: "warn", message: `No se pudo importar la regla visual de ${displayRef(rule.variableRef)}.` });
      continue;
    }

    const choices: SurveyMonkeyVisualLogicRule["choices"] = [];
    for (const choice of rule.choices) {
      if (choice.action.kind === "none") continue;
      const sourceChoice = sourceQuestion.choices.find((ch) => ch.name === choice.choiceName)
        ?? sourceQuestion.choices.find((ch) => ch.index === choice.choiceIndex)
        ?? { name: choice.choiceName, label: choice.choiceLabel, index: choice.choiceIndex };
      const currentChoice = findChoiceMatch(sourceChoice, currentQuestion);
      if (!currentChoice) {
        warnings.push({ severity: "warn", message: `No se encontró la opción "${choice.choiceLabel}" en ${displayRef(currentQuestion.ref)}.` });
        continue;
      }
      const action = remapAction(choice.action, questionMap, pageMap, currentSignature, warnings);
      if (!action || action.kind === "none") continue;
      choices.push({
        choiceName: currentChoice.name,
        choiceLabel: currentChoice.label,
        choiceIndex: currentChoice.index,
        action,
      });
    }

    if (choices.length) {
      out.push({
        id: rule.id || `import_${out.length + 1}`,
        variableRef: currentQuestion.ref,
        variableLabel: `${displayRef(currentQuestion.ref)}: ${currentQuestion.label}`,
        choices,
      });
    }
  }

  return out;
}

function remapAdvancedText(
  text: string,
  questionMap: Map<string, LogicPackQuestionSignature>,
  currentSignature: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const missing = new Set<string>();
  const next = text.replace(/\b[QPqp]0*(\d+)(_[A-Za-z0-9_]+)?\b/g, (match) => {
    const mapped = questionMap.get(canonicalRef(match)) ?? findCompositeQuestionTarget(currentSignature, match);
    if (!mapped) {
      missing.add(match);
      return match;
    }
    if (canonicalRef(mapped.ref) !== canonicalRef(match) && canonicalRef(mapped.ref).startsWith(`${canonicalRef(match)}_`)) {
      warnings.push({
        severity: "info",
        message: `${displayRef(match)} se emparejó con ${displayRef(mapped.ref)} como primera fila de una pregunta compuesta.`,
      });
    }
    return ruleRef(mapped.ref);
  });
  return { text: next, missing: [...missing] };
}

function remapAdvancedRules(
  pack: SurveyMonkeyLogicPack,
  questionMap: Map<string, LogicPackQuestionSignature>,
  currentSignature: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const out: SurveyMonkeyAdvancedLogicRule[] = [];
  for (const rule of pack.advanced_rules ?? []) {
    const remapped = remapAdvancedText(rule.texto, questionMap, currentSignature, warnings);
    if (remapped.missing.length) {
      warnings.push({
        severity: "warn",
        message: `No se importó una regla avanzada porque no se pudo emparejar ${remapped.missing.join(", ")}.`,
      });
      continue;
    }
    out.push({ ...rule, texto: remapped.text });
  }
  return out;
}

function remapChoiceOrderOverrides(
  pack: SurveyMonkeyLogicPack,
  questionMap: Map<string, LogicPackQuestionSignature>,
) {
  const sourceByNumber = new Map<string, LogicPackQuestionSignature>();
  for (const q of pack.signature.questions) {
    const n = refNumber(q.ref);
    if (n) sourceByNumber.set(n, q);
  }

  const out: Record<string, string[]> = {};
  for (const [sourceKey, labels] of Object.entries(pack.choice_order_overrides ?? {})) {
    const sourceQuestion = sourceByNumber.get(String(Number(sourceKey)));
    const currentQuestion = sourceQuestion ? questionMap.get(canonicalRef(sourceQuestion.ref)) : null;
    const currentKey = currentQuestion ? refNumber(currentQuestion.ref) : String(Number(sourceKey));
    if (!currentKey) continue;
    out[currentKey] = labels.map((label) => {
      if (!sourceQuestion || !currentQuestion) return label;
      const sourceChoice = sourceQuestion.choices.find((choice) => normalizeLabel(choice.label) === normalizeLabel(label));
      if (!sourceChoice) return label;
      return findChoiceMatch(sourceChoice, currentQuestion)?.label ?? label;
    });
  }
  return out;
}

function bestChoiceByExpectedLabel(
  currentQuestion: LogicPackQuestionSignature,
  expectedLabels: string[],
) {
  const labels = expectedLabels.map((label) => label.trim()).filter(Boolean);
  for (const label of labels) {
    const exact = uniqueByLabel(currentQuestion.choices, label);
    if (exact) return exact;
  }
  const fuzzy = labels
    .map((label) => bestFuzzyByLabel(currentQuestion.choices, label))
    .filter((match): match is { item: LogicPackChoiceSignature; score: number } => Boolean(match))
    .sort((a, b) => b.score - a.score)[0];
  return fuzzy?.item ?? null;
}

function remapChoiceCodeMaps(
  pack: SurveyMonkeyLogicPack,
  questionMap: Map<string, LogicPackQuestionSignature>,
  currentSignature: SurveyMonkeyLogicPackSignature,
  warnings: SurveyMonkeyLogicPackWarning[],
): ChoiceCodeMap[] {
  const out: ChoiceCodeMap[] = [];
  for (const map of pack.choice_code_maps ?? []) {
    const currentQuestion = questionMap.get(canonicalRef(map.variable))
      ?? currentSignature.questions.find((q) => canonicalRef(q.ref) === canonicalRef(map.variable));
    if (!currentQuestion) {
      warnings.push({
        severity: "warn",
        message: `No se pudo importar el mapa interno de opciones de ${displayRef(map.variable)}.`,
      });
      continue;
    }

    const mappings: ChoiceCodeMap["mappings"] = [];
    for (const item of map.mappings ?? []) {
      const expectedLabels = [item.xls_label, item.source_label].filter(Boolean);
      const byCode = currentQuestion.choices.find((choice) => choice.name === item.xls_code) ?? null;
      const byLabel = bestChoiceByExpectedLabel(currentQuestion, expectedLabels);
      const expectedLabel = expectedLabels[0] ?? "";
      const codeLooksSemantic = byCode && (!expectedLabel || labelSimilarity(byCode.label, expectedLabel) >= 0.55);
      const currentChoice = codeLooksSemantic ? byCode : byLabel;

      if (!currentChoice) {
        warnings.push({
          severity: "warn",
          message: `No se encontró la opción "${item.xls_label || item.source_label || item.source_code}" para mapear ${displayRef(currentQuestion.ref)}.`,
        });
        continue;
      }
      if (byCode && byLabel && byCode.name !== byLabel.name) {
        warnings.push({
          severity: "info",
          message: `${displayRef(currentQuestion.ref)} ${item.source_code} se ajustó por etiqueta a la opción "${byLabel.label}".`,
        });
      }

      mappings.push({
        ...item,
        xls_code: currentChoice.name,
        xls_label: currentChoice.label,
      });
    }

    if (!mappings.length) {
      warnings.push({
        severity: "warn",
        message: `El mapa interno de opciones de ${displayRef(currentQuestion.ref)} no se cargó porque ninguna opción coincidió.`,
      });
      continue;
    }

    out.push({
      ...map,
      variable: currentQuestion.ref,
      label: currentQuestion.label,
      mappings,
    });
  }
  return out;
}

export function importSurveyMonkeyLogicPack(
  value: unknown,
  workbook: XlsformEditorWorkbook,
): ImportSurveyMonkeyLogicPackResult {
  const pack = ensurePack(value);
  const warnings: SurveyMonkeyLogicPackWarning[] = [];
  const currentSignature = buildSurveyMonkeyLogicSignature(workbook);
  const sourceSignature = pack.signature ?? { questions: [], pages: [] };

  if (!sourceSignature.questions?.length) {
    warnings.push({ severity: "warn", message: "El paquete no trae firma de preguntas; se importará sin emparejamiento híbrido." });
  }

  const questionMap = mapQuestions(sourceSignature, currentSignature, warnings);
  const pageMap = mapPages(sourceSignature, currentSignature, warnings);
  const advanced_rules = remapAdvancedRules(pack, questionMap, currentSignature, warnings);
  const visual_rules = remapVisualRules(pack, questionMap, pageMap, currentSignature, warnings);
  const choice_order_overrides = remapChoiceOrderOverrides(pack, questionMap);
  const choice_code_maps = remapChoiceCodeMaps(pack, questionMap, currentSignature, warnings);

  const skippedVisual = (pack.visual_rules ?? []).length - visual_rules.length;
  if (skippedVisual > 0) {
    warnings.push({ severity: "warn", message: `${skippedVisual} regla(s) visual(es) no se cargaron completas por falta de coincidencias.` });
  }

  return {
    advanced_rules,
    visual_rules,
    choice_order_overrides,
    choice_code_maps,
    warnings,
  };
}
