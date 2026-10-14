// Modelo puro de las páginas de una encuesta SurveyMonkey en la importación.
//
// Una página de SurveyMonkey se importa como una sección del formulario. Aquí
// viven el tipo de la página, los conteos (preguntas de SurveyMonkey y campos
// del formulario) y la traducción a las preguntas que la lógica visual puede
// usar como origen o destino de un salto.

import type { SurveyMonkeyQuestion } from "../../../api/multiIntegrado";
import type { VisualLogicPage, VisualLogicQuestion } from "./RuleWizard";

export type PageEntry = {
  id: string;
  pageId: string;
  title?: string;
  label?: string;
  rangeLabel?: string;
  notes?: string[];
  questionDetails?: Array<{
    name: string;
    heading: string | null;
    family: string | null;
    subtype: string | null;
    choices?: Array<{ code: string; label: string }>;
    children?: Array<{
      name: string;
      heading: string | null;
      type: string | null;
      list_name: string | null;
    }>;
  }>;
  questions: string[];
};

export const newPageId = () => Math.random().toString(36).slice(2, 9);

// Expande rangos tipo "Q25-Q31" a la lista completa ["Q25","Q26","Q27","Q28","Q29","Q30","Q31"].
// Reconoce el prefijo (Q/P/q/p) + parte numérica con o sin padding y mantiene
// el padding del lado izquierdo para construir cada elemento.
function expandRange(token: string): string[] | null {
  // Acepta "Q25-Q31", "p25-p31" y también "Q25-31".
  const match = token.match(/^([QPqp])(\d+)\s*[-–]\s*(?:[QPqp])?(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const startStr = match[2];
  const endStr = match[3];
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const pad = startStr.length;
  const out: string[] = [];
  for (let n = start; n <= end; n++) {
    out.push(`${prefix}${String(n).padStart(pad, "0")}`);
  }
  return out;
}

// Parsea el contenido libre de un textbox de preguntas, expandiendo rangos.
// Acepta tanto "Q25-Q31" como "Q24, Q25-Q28, Q30".
export function parseQuestionList(text: string): string[] {
  const tokens = text.split(",").map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const range = expandRange(t);
    if (range) out.push(...range);
    else out.push(t);
  }
  return out;
}

export function pagesToRecord(entries: PageEntry[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of entries) {
    if (!e.pageId.trim()) continue;
    out[e.pageId.trim()] = pageQuestionNames(e);
  }
  return out;
}

export function pageLabelsToRecord(entries: PageEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  entries.forEach((e, idx) => {
    const pageId = e.pageId.trim();
    if (!pageId) return;
    const label = (e.label || buildPageLabel(e, idx)).trim();
    if (label) out[pageId] = label;
  });
  return out;
}

export function buildPageLabel(entry: PageEntry, index?: number): string {
  const canonical = typeof index === "number" ? `Pag${index + 1}` : "";
  const title = entry.title?.trim() || `Página ${entry.pageId}`;
  const range = entry.rangeLabel || questionRangeLabel(pageQuestionNames(entry));
  const detail = range ? `${title} (${range})` : title;
  return canonical ? `${canonical} - ${detail}` : detail;
}

export function pageQuestionNames(entry: PageEntry): string[] {
  const direct = entry.questions.map((q) => q.trim()).filter(Boolean);
  if (direct.length > 0) return direct;
  return (entry.questionDetails ?? [])
    .map((q) => q.name.trim())
    .filter(Boolean);
}

export function pageXlsformVariableCount(entry: PageEntry): number {
  const details = entry.questionDetails ?? [];
  if (!details.length) return pageQuestionNames(entry).length;
  return details.reduce((sum, q) => sum + (q.children?.length ? q.children.length : 1), 0);
}

export function questionRangeLabel(questions: string[]): string {
  const clean = questions.map((q) => q.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return displayQuestionRef(clean[0]);
  return `${displayQuestionRef(clean[0])}-${displayQuestionRef(clean[clean.length - 1])}`;
}

export function displayQuestionRef(q: string): string {
  const match = q.match(/^[qp]0*(\d+)(.*)$/i);
  if (!match) return q;
  return `p${Number(match[1])}${match[2] ?? ""}`;
}

export function displayOriginalQuestionRef(q: string): string {
  return q.replace(/^([QP])0+(\d+)(.*)$/i, (_, p: string, n: string, rest: string) => `${p.toUpperCase()}${Number(n)}${rest ?? ""}`);
}

export function apiInfoToQuestions(pages: PageEntry[]): SurveyMonkeyQuestion[] {
  return pages.flatMap((page) =>
    (page.questionDetails ?? []).map((q) => ({
      name: q.name,
      name_raw: q.name,
      group: q.name.toLowerCase(),
      label: q.heading,
      kind: [q.family, q.subtype].filter(Boolean).join("/") || "surveymonkey_api",
      choices: (q.choices ?? []).map((c) => ({ code: c.code, label: c.label })),
    })),
  );
}

function isSelectOneType(type: string | null | undefined): boolean {
  return /^select_one(?:\s|$)/i.test((type ?? "").trim());
}

export function visualQuestionsFromPages(pages: PageEntry[]): VisualLogicQuestion[] {
  return pages.flatMap((page) =>
    (page.questionDetails ?? []).flatMap((q) => {
      const choices = (q.choices ?? []).map((choice, idx) => ({
        name: choice.code,
        label: choice.label,
        index: idx + 1,
      }));
      if (!choices.length) return [];

      const family = (q.family ?? "").toLowerCase();
      if (family === "single_choice") {
        return [{
          ref: q.name,
          label: `${displayQuestionRef(q.name)}: ${q.heading ?? q.name}`,
          choices,
        }];
      }

      // SurveyMonkey modela algunas escalas/matrices de una sola fila como
      // `matrix`, pero el XLSForm las convierte en una variable select_one
      // normal (p17, p32, ...). Esas variables tambien deben poder originar
      // logica visual.
      return (q.children ?? [])
        .filter((child) => child.name && isSelectOneType(child.type))
        .map((child) => ({
          ref: child.name,
          label: `${displayQuestionRef(child.name)}: ${child.heading ?? q.heading ?? child.name}`,
          choices,
        }));
    }),
  );
}

export function visualPagesFromEntries(pages: PageEntry[]): VisualLogicPage[] {
  return pages.map((page, idx) => ({
    pageId: page.pageId,
    label: `Pag${idx + 1}${page.title ? `: ${page.title}` : ""}`,
    questions: (page.questionDetails ?? []).flatMap((q) => {
      const base = [{ ref: q.name, label: `${displayQuestionRef(q.name)}: ${q.heading ?? q.name}` }];
      const children = (q.children ?? []).map((child) => ({
        ref: child.name,
        label: `${displayQuestionRef(child.name)}: ${child.heading ?? child.name}`,
      }));
      return children.length ? children : base;
    }),
  }));
}

export function shouldShowManualPageQuestionsInput(page: Pick<PageEntry, "questionDetails">): boolean {
  return !page.questionDetails;
}

/** Campos del formulario de todas las páginas: una matriz aporta un campo por fila. */
export function totalCamposFormulario(pages: PageEntry[]): number {
  return pages.reduce((sum, p) => sum + pageXlsformVariableCount(p), 0);
}
