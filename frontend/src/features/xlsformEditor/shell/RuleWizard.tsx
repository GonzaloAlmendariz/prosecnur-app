import { useEffect, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Check, RotateCcw, X } from "lucide-react";
import {
  apiXlsformEditorSmInterpretRule,
  type RuleInterpretation,
  type SurveyMonkeyVisualLogicAction,
  type SurveyMonkeyVisualLogicRule,
  type XlsformEditorWorkbook,
} from "../../../api/client";

// Wizard paso-a-paso para reglas de skip logic. El usuario pega UNA regla,
// Prosecnur la interpreta (resuelve labels desde la API SM), muestra el
// resumen en lenguaje humano + diagrama, y el usuario confirma o descarta.
// Las reglas confirmadas se acumulan en una lista y se aplican al final
// pegándolas como texto al endpoint principal de import.

export type ConfirmedRule = {
  id: string;
  texto: string;
  texto_humano: string;
  kobo_expr?: string;
};

export type VisualLogicChoice = {
  name: string;
  label: string;
  index: number;
};

export type VisualLogicQuestion = {
  ref: string;
  label: string;
  choices: VisualLogicChoice[];
};

export type VisualLogicPage = {
  pageId: string;
  label: string;
  questions: Array<{ ref: string; label: string }>;
};

const newId = () => Math.random().toString(36).slice(2, 9);

// Extrae el número de Q{N} (ej. "Q27" → "27"). Devuelve "" si la regla
// todavía no fue interpretada o el formato es inesperado.
function extractWhenVarKey(when_var: string | undefined): string {
  if (!when_var) return "";
  const m = /^[QPqp](\d+)$/.exec(when_var);
  return m ? m[1] : "";
}

function splitSmRuleText(text: string): { condition: string; actions: string } {
  const parts = text.split(/=>|entonces|then/i);
  if (parts.length < 2) return { condition: text.trim() || "—", actions: "—" };
  return {
    condition: parts[0].trim() || "—",
    actions: parts.slice(1).join("=>").trim() || "—",
  };
}

function displayRef(ref: string): string {
  const match = ref.match(/^[pq]0*(\d+)(.*)$/i);
  if (!match) return ref;
  return `p${Number(match[1])}${match[2] ?? ""}`;
}

function ruleRef(ref: string): string {
  const match = ref.match(/^[pq]0*(\d+)(.*)$/i);
  if (!match) return ref.toUpperCase();
  return `P${Number(match[1])}${match[2] ?? ""}`;
}

function actionLabel(action: SurveyMonkeyVisualLogicAction): string {
  if (action.kind === "none") return "Sin salto";
  if (action.kind === "end") return "Termina encuesta";
  if (action.kind === "page_top") return `Saltará a ${action.pageLabel || `Pag${action.pageId}`}`;
  return `Saltará a ${displayRef(action.targetRef)}`;
}

function compileVisualRuleLine(rule: SurveyMonkeyVisualLogicRule, choice: SurveyMonkeyVisualLogicRule["choices"][number]): string | null {
  if (choice.action.kind === "none") return null;
  const condition = `${ruleRef(rule.variableRef)} = C${choice.choiceIndex}`;
  if (choice.action.kind === "end") return `${condition} => Fin de encuesta.`;
  if (choice.action.kind === "page_top") return `${condition} => Pasar a Pág. ${choice.action.pageId}.`;
  return `${condition} => Pasar a ${ruleRef(choice.action.targetRef)}.`;
}

export function compileVisualLogicRules(rules: SurveyMonkeyVisualLogicRule[]): string {
  const lines: string[] = [];
  for (const rule of rules) {
    for (const choice of rule.choices) {
      const line = compileVisualRuleLine(rule, choice);
      if (line) lines.push(line);
    }
  }
  return lines.join("\n");
}

function visualRuleHasActions(rule: SurveyMonkeyVisualLogicRule): boolean {
  return rule.choices.some((choice) => choice.action.kind !== "none");
}

function visualActionCount(rules: SurveyMonkeyVisualLogicRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.choices.filter((choice) => choice.action.kind !== "none").length, 0);
}

function cell(row: string[], columns: string[], name: string): string {
  const idx = columns.indexOf(name);
  return idx >= 0 ? row[idx] ?? "" : "";
}

function visualContextFromWorkbook(workbook?: XlsformEditorWorkbook | null): { questions: VisualLogicQuestion[]; pages: VisualLogicPage[] } {
  if (!workbook) return { questions: [], pages: [] };
  const surveyCols = workbook.survey.columns;
  const choiceCols = workbook.choices.columns;
  const choicesByList = new Map<string, VisualLogicChoice[]>();
  for (const row of workbook.choices.rows) {
    const listName = cell(row, choiceCols, "list_name");
    if (!listName) continue;
    const arr = choicesByList.get(listName) ?? [];
    arr.push({
      name: cell(row, choiceCols, "name"),
      label: cell(row, choiceCols, "label::es") || cell(row, choiceCols, "label") || cell(row, choiceCols, "name"),
      index: arr.length + 1,
    });
    choicesByList.set(listName, arr);
  }

  const questions: VisualLogicQuestion[] = [];
  const pages: VisualLogicPage[] = [];
  let currentPage: VisualLogicPage | null = null;
  const pageByName = new Map<string, VisualLogicPage>();

  for (const row of workbook.survey.rows) {
    const type = cell(row, surveyCols, "type");
    const name = cell(row, surveyCols, "name");
    const label = cell(row, surveyCols, "label::es") || cell(row, surveyCols, "label") || name;
    if (type === "begin_group") {
      const pageMatch = name.match(/(?:Pag|section_pag_?)(\d+)/i);
      const pageId = pageMatch ? String(Number(pageMatch[1])) : String(pages.length + 1);
      currentPage = {
        pageId,
        label: displayRef(name) || `Pag${pageId}`,
        questions: [],
      };
      pages.push(currentPage);
      pageByName.set(name, currentPage);
      continue;
    }
    if (type === "end_group") {
      currentPage = null;
      continue;
    }
    if (!name || type === "note" || type === "calculate") continue;
    const selectMatch = type.match(/^select_one\s+(\S+)/);
    const pageName = cell(row, surveyCols, "section");
    const page = currentPage ?? pageByName.get(pageName) ?? null;
    const target = { ref: name, label: `${displayRef(name)}: ${label}` };
    if (page) page.questions.push(target);
    if (!selectMatch) continue;
    const choices = choicesByList.get(selectMatch[1]) ?? [];
    if (!choices.length) continue;
    questions.push({
      ref: name,
      label: `${displayRef(name)}: ${label}`,
      choices,
    });
  }
  return { questions, pages };
}

export function RuleWizard({
  surveyId,
  token,
  paginas,
  paginasLabels,
  workbook,
  confirmed,
  visualRules,
  visualQuestions,
  visualPages,
  existingKoboLogic = [],
  onAdd,
  onUpdate,
  onRemove,
  onClearAll,
  onVisualRulesChange,
  overrides,
  onOverridesChange,
}: {
  surveyId: string;
  token: string;
	  paginas: Record<string, string[]>;
	  paginasLabels: Record<string, string>;
  workbook?: XlsformEditorWorkbook | null;
  confirmed: ConfirmedRule[];
  visualRules: SurveyMonkeyVisualLogicRule[];
  visualQuestions?: VisualLogicQuestion[];
  visualPages?: VisualLogicPage[];
  existingKoboLogic?: Array<{ name: string; label: string; relevant: string }>;
  onAdd: (rule: ConfirmedRule) => void;
  onUpdate?: (id: string, rule: ConfirmedRule) => void;
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  onVisualRulesChange: (rules: SurveyMonkeyVisualLogicRule[]) => void;
  // Mapeo qref-string → labels en el orden que el usuario quiere asignar
  // a C1, C2, ... Persiste en el padre (ImportSurveyMonkeyDialog) para que
  // sobreviva al cierre del wizard y viaje al endpoint de import.
  overrides: Record<string, string[]>;
  onOverridesChange: (next: Record<string, string[]>) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [interp, setInterp] = useState<RuleInterpretation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workbookContext = visualContextFromWorkbook(workbook);
  const resolvedVisualQuestions = visualQuestions ?? workbookContext.questions;
  const resolvedVisualPages = visualPages ?? workbookContext.pages;

  async function callInterpret(text: string, ovr: Record<string, string[]>) {
    if (!text.trim()) return null;
    setBusy(true);
    setError(null);
    try {
      const r = await apiXlsformEditorSmInterpretRule(text.trim(), {
	        survey_id: surveyId,
	        token,
	        workbook: workbook ?? null,
	        paginas,
        paginas_labels: paginasLabels,
        choice_order_overrides: ovr,
      });
      if (!r.ok) {
        setError(r.error);
        setInterp(null);
        return null;
      }
      setInterp(r);
      return r;
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setInterp(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function interpret() {
    setInterp(null);
    await callInterpret(draft, overrides);
  }

  // Reordena la lista de labels para una pregunta dada. El usuario puede
  // mover varias opciones en la tabla; solo al aplicar el orden volvemos a
  // interpretar la regla.
  async function reorderChoices(qrefKey: string, nextLabels: string[]) {
    const nextOverrides = { ...overrides, [qrefKey]: nextLabels };
    onOverridesChange(nextOverrides);
    await callInterpret(draft, nextOverrides);
  }

  async function resetOrder(qrefKey: string) {
    const next = { ...overrides };
    delete next[qrefKey];
    onOverridesChange(next);
    await callInterpret(draft, next);
  }

  function confirm() {
    if (!interp || !interp.ok) return;
    const nextRule: ConfirmedRule = {
      id: editingId ?? newId(),
      texto: draft.trim(),
      texto_humano: interp.texto_humano,
      kobo_expr: interp.resolucion.kobo_expr,
    };
    if (editingId && onUpdate) onUpdate(editingId, nextRule);
    else onAdd(nextRule);
    setDraft("");
    setEditingId(null);
    setInterp(null);
    setError(null);
  }

  function discard() {
    setDraft("");
    setEditingId(null);
    setInterp(null);
    setError(null);
  }

  function editRule(rule: ConfirmedRule) {
    setDraft(rule.texto);
    setEditingId(rule.id);
    setInterp(null);
    setError(null);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SurveyMonkeyLogicWindow
        rules={visualRules}
        questions={resolvedVisualQuestions}
        pages={resolvedVisualPages}
        existingKoboLogic={existingKoboLogic}
        busy={busy}
        onRulesChange={onVisualRulesChange}
      />

      <section
        aria-label="Lógica de ramificación avanzada"
        style={{
          border: "1px solid var(--pulso-border, #dbe3ea)",
          borderRadius: 8,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 1px 0 rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--pulso-border, #dbe3ea)", background: "#fbfdff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0b2e63" }}>
                Lógica de ramificación avanzada
              </h3>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                Pega reglas copiables de SurveyMonkey cuando el salto no se pueda expresar con el selector visual.
              </p>
            </div>
            <span
              style={{
                flex: "0 0 auto",
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                color: "#0b2e63",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {confirmed.length} confirmada{confirmed.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ej: Q7 NOT IN [C4, C5, C6, C7] => Ocultar P8, Ocultar P9, Ocultar P10."
              rows={2}
              style={{
                flex: 1,
                padding: 10,
                border: "1px solid var(--pulso-border, #e5e7eb)",
                borderRadius: 6,
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={interpret}
              disabled={busy || !draft.trim()}
              style={{
                background: draft.trim() ? "var(--pulso-accent, #2563eb)" : "#cbd5e1",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "0 18px",
                cursor: busy || !draft.trim() ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 700,
                alignSelf: "stretch",
                minWidth: 110,
              }}
            >
              {busy ? "…" : "Interpretar"}
            </button>
          </div>
          {editingId ? (
            <div style={{ color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>
              Estás editando una regla confirmada. Interprétala y confirma para actualizarla.
            </div>
          ) : null}
          {error ? (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        {interp && interp.ok ? (
          <div style={{ padding: "0 16px 16px" }}>
            <InterpretationCard
              interp={interp}
              original={draft.trim()}
              busy={busy}
              hasOverride={Boolean(overrides[extractWhenVarKey(interp.regla_parseada.when_var)]?.length)}
              onConfirm={confirm}
              onDiscard={discard}
              onReorder={(nextLabels) => {
                const key = extractWhenVarKey(interp.regla_parseada.when_var);
                if (!key) return;
                void reorderChoices(key, nextLabels);
              }}
              onResetOrder={() => {
                const key = extractWhenVarKey(interp.regla_parseada.when_var);
                if (!key) return;
                void resetOrder(key);
              }}
            />
          </div>
        ) : null}

        <AdvancedConfirmedRulesList
          rules={confirmed}
          busy={busy}
          onEdit={editRule}
          onRemove={onRemove}
          onClearAll={onClearAll}
        />
      </section>
    </div>
  );
}

function AdvancedConfirmedRulesList({
  rules,
  busy,
  onEdit,
  onRemove,
  onClearAll,
}: {
  rules: ConfirmedRule[];
  busy: boolean;
  onEdit: (rule: ConfirmedRule) => void;
  onRemove: (id: string) => void;
  onClearAll?: () => void;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--pulso-border, #dbe3ea)", background: "#f8fafc", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", letterSpacing: 0 }}>
            Reglas avanzadas confirmadas
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: "#64748b" }}>
            Se aplicarán junto con la lógica visual cuando guardes los cambios.
          </div>
        </div>
        {rules.length > 0 && onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            disabled={busy}
            style={{
              border: "1px solid var(--pulso-border, #dbe3ea)",
              borderRadius: 6,
              background: "white",
              color: "#475569",
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Borrar todas
          </button>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--pulso-border, #dbe3ea)",
            borderRadius: 8,
            background: "white",
            color: "#64748b",
            padding: "14px 16px",
            fontSize: 13,
          }}
        >
          Todavía no hay reglas avanzadas confirmadas.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rules.map((rule, index) => {
            const parsed = splitSmRuleText(rule.texto);
            return (
              <div
                key={rule.id}
                style={{
                  border: "1px solid var(--pulso-border, #dbe3ea)",
                  borderRadius: 8,
                  background: "white",
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#0b2e63" }}>Regla {index + 1}</span>
                    <span style={{ padding: "2px 7px", borderRadius: 999, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontSize: 11, fontWeight: 800 }}>
                      Confirmada
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.45, marginBottom: 8 }}>
                    {rule.texto_humano}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 0.75fr) minmax(0, 1fr)",
                      gap: 8,
                      color: "#475569",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, marginBottom: 3 }}>Si la respuesta es...</div>
                      <div style={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>{parsed.condition}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, marginBottom: 3 }}>Entonces...</div>
                      <div style={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>{parsed.actions}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onEdit(rule)}
                    disabled={busy}
                    style={{
                      border: "1px solid var(--pulso-border, #dbe3ea)",
                      borderRadius: 6,
                      background: "white",
                      color: "#0b2e63",
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(rule.id)}
                    disabled={busy}
                    style={{
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      background: "#fff7f7",
                      color: "#991b1b",
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SurveyMonkeyLogicWindow({
  rules,
  questions,
  pages,
  existingKoboLogic,
  busy,
  onRulesChange,
}: {
  rules: SurveyMonkeyVisualLogicRule[];
  questions: VisualLogicQuestion[];
  pages: VisualLogicPage[];
  existingKoboLogic: Array<{ name: string; label: string; relevant: string }>;
  busy: boolean;
  onRulesChange: (rules: SurveyMonkeyVisualLogicRule[]) => void;
}) {
  const [selectedRef, setSelectedRef] = useState(rules[0]?.variableRef ?? questions[0]?.ref ?? "");
  const [draftRules, setDraftRules] = useState<SurveyMonkeyVisualLogicRule[]>(rules);
  const committedRulesSignature = JSON.stringify(rules);
  const draftRulesSignature = JSON.stringify(draftRules);
  const hasPendingVisualChanges = committedRulesSignature !== draftRulesSignature;
  const selectedQuestion = questions.find((q) => q.ref === selectedRef) ?? null;
  const selectedRule = draftRules.find((rule) => rule.variableRef === selectedRef) ?? null;
  const selectedChoices = selectedQuestion?.choices ?? [];

  useEffect(() => {
    if (!selectedRef && questions[0]) setSelectedRef(questions[0].ref);
    if (selectedRef && !questions.some((q) => q.ref === selectedRef)) {
      setSelectedRef(questions[0]?.ref ?? "");
    }
  }, [questions, selectedRef]);

  useEffect(() => {
    setDraftRules(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedRulesSignature]);

  function actionForChoice(choice: VisualLogicChoice): SurveyMonkeyVisualLogicAction {
    return selectedRule?.choices.find((c) => c.choiceName === choice.name)?.action ?? { kind: "none" };
  }

  function updateChoiceAction(choice: VisualLogicChoice, action: SurveyMonkeyVisualLogicAction) {
    if (!selectedQuestion) return;
    const baseChoices = selectedChoices.map((ch) => {
      const existing = selectedRule?.choices.find((c) => c.choiceName === ch.name);
      return {
        choiceName: ch.name,
        choiceLabel: ch.label,
        choiceIndex: ch.index,
        action: existing?.action ?? { kind: "none" as const },
      };
    });
    const nextRule: SurveyMonkeyVisualLogicRule = {
      id: selectedRule?.id ?? newId(),
      variableRef: selectedQuestion.ref,
      variableLabel: selectedQuestion.label,
      choices: baseChoices.map((ch) => ch.choiceName === choice.name ? { ...ch, action } : ch),
    };
    const kept = draftRules.filter((rule) => rule.variableRef !== selectedQuestion.ref);
    const nextRules = visualRuleHasActions(nextRule) ? [...kept, nextRule] : kept;
    setDraftRules(nextRules);
  }

  function clearSelectedRule() {
    if (!selectedRef) return;
    setDraftRules(draftRules.filter((rule) => rule.variableRef !== selectedRef));
  }

  function clearAllRules() {
    setDraftRules([]);
  }

  function appliedSummary(): string {
    const draftCount = visualActionCount(draftRules);
    if (hasPendingVisualChanges) {
      if (draftCount === 0) return "Cambios pendientes";
      return `${draftCount} salto${draftCount === 1 ? "" : "s"} pendiente${draftCount === 1 ? "" : "s"} de confirmar`;
    }
    const count = visualActionCount(rules);
    if (count === 0) return "Sin saltos configurados";
    return `${count} salto${count === 1 ? "" : "s"} listo${count === 1 ? "" : "s"} para aplicar`;
  }

  function confirmVisualRules() {
    onRulesChange(draftRules);
  }

  function discardVisualChanges() {
    setDraftRules(rules);
  }

  function editVisualRule(rule: SurveyMonkeyVisualLogicRule) {
    setSelectedRef(rule.variableRef);
  }

  function removeVisualRule(ruleId: string) {
    const nextRules = rules.filter((rule) => rule.id !== ruleId);
    setDraftRules(nextRules);
    onRulesChange(nextRules);
  }

  function visualRuleActions(rule: SurveyMonkeyVisualLogicRule) {
    return rule.choices.filter((choice) => choice.action.kind !== "none");
  }

  function nonTechnicalAppliedLabel(item: { name: string; label: string }) {
    return `${displayRef(item.name)}${item.label ? `: ${item.label}` : ""}`;
  }

  function pageQuestions(pageId: string) {
    return pages.find((page) => page.pageId === pageId)?.questions ?? [];
  }

  function defaultQuestionForPage(pageId: string) {
    return pageQuestions(pageId)[0] ?? null;
  }

  function makeAction(kind: string, current: SurveyMonkeyVisualLogicAction): SurveyMonkeyVisualLogicAction {
    if (kind === "none") return { kind: "none" };
    if (kind === "end") return { kind: "end" };
    const page = pages.find((p) => p.pageId === (current.kind === "page_top" || current.kind === "question" ? current.pageId : "")) ?? pages[0];
    if (!page) return { kind: "none" };
    if (kind === "page_top") return { kind: "page_top", pageId: page.pageId, pageLabel: page.label };
    const target = current.kind === "question" && current.targetRef
      ? pageQuestions(page.pageId).find((q) => q.ref === current.targetRef) ?? defaultQuestionForPage(page.pageId)
      : defaultQuestionForPage(page.pageId);
    if (!target) return { kind: "page_top", pageId: page.pageId, pageLabel: page.label };
    return {
      kind: "question",
      pageId: page.pageId,
      pageLabel: page.label,
      targetRef: target.ref,
      targetLabel: target.label,
    };
  }

  function updateActionPage(choice: VisualLogicChoice, current: SurveyMonkeyVisualLogicAction, pageId: string) {
    const page = pages.find((p) => p.pageId === pageId);
    if (!page) return;
    if (current.kind === "question") {
      const target = defaultQuestionForPage(page.pageId);
      updateChoiceAction(choice, target
        ? { kind: "question", pageId: page.pageId, pageLabel: page.label, targetRef: target.ref, targetLabel: target.label }
        : { kind: "page_top", pageId: page.pageId, pageLabel: page.label });
      return;
    }
    updateChoiceAction(choice, { kind: "page_top", pageId: page.pageId, pageLabel: page.label });
  }

  return (
    <section
      aria-label="Lógica de la pestaña Lógica de SurveyMonkey"
      style={{
        border: "1px solid var(--pulso-border, #dbe3ea)",
        borderRadius: 10,
        overflow: "hidden",
        background: "white",
        marginBottom: 14,
        boxShadow: "0 1px 0 rgba(15, 23, 42, 0.08)",
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--pulso-border, #dbe3ea)", background: "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0b2e63" }}>Lógica</h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
              Elige una pregunta y decide qué ocurre con cada respuesta. Prosecnur lo convierte al formulario al aplicar.
            </p>
          </div>
          <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>{appliedSummary()}</span>
        </div>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 800, color: "#475569" }}>
            Variable
          </label>
          <select
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value)}
            disabled={busy || questions.length === 0}
            style={{ ...logicInputStyle, maxWidth: 620 }}
          >
            {questions.length === 0 ? <option value="">No hay preguntas de selección única</option> : null}
            {questions.map((question) => (
              <option key={question.ref} value={question.ref}>{question.label}</option>
            ))}
          </select>
        </div>

        {selectedQuestion ? (
          <div style={{ border: "1px solid var(--pulso-border, #dbe3ea)", borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1.15fr) minmax(160px, 0.8fr)",
                gap: 10,
                padding: "10px 12px",
                background: "#f8fafc",
                borderBottom: "1px solid var(--pulso-border, #dbe3ea)",
                color: "#475569",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <div>Opción</div>
              <div>Entonces pasar a...</div>
              <div>Estado</div>
            </div>
            {selectedChoices.map((choice) => {
              const currentAction = actionForChoice(choice);
              const currentPageId = currentAction.kind === "page_top" || currentAction.kind === "question" ? currentAction.pageId : "";
              const questionOptions = currentAction.kind === "question" ? pageQuestions(currentAction.pageId) : [];
              return (
                <div
                  key={choice.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1.15fr) minmax(160px, 0.8fr)",
                    gap: 10,
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--pulso-border, #edf2f7)",
                    alignItems: "start",
                    background: currentAction.kind === "none" ? "white" : "#fbfdff",
                  }}
                >
                  <div style={{ color: "#0f172a", fontSize: 13, lineHeight: 1.35 }}>{choice.label}</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <select
                      value={currentAction.kind}
                      onChange={(e) => updateChoiceAction(choice, makeAction(e.target.value, currentAction))}
                      disabled={busy}
                      style={logicInputStyle}
                    >
                      <option value="none">Continuar normalmente</option>
                      <option value="page_top">Ir a una página</option>
                      <option value="question">Ir a una pregunta</option>
                      <option value="end">Fin de encuesta</option>
                    </select>
                    {currentAction.kind === "page_top" || currentAction.kind === "question" ? (
                      <select
                        value={currentPageId}
                        onChange={(e) => updateActionPage(choice, currentAction, e.target.value)}
                        disabled={busy || pages.length === 0}
                        style={logicInputStyle}
                      >
                        {pages.map((page) => (
                          <option key={page.pageId} value={page.pageId}>{page.label}</option>
                        ))}
                      </select>
                    ) : null}
                    {currentAction.kind === "question" ? (
                      <select
                        value={currentAction.targetRef}
                        onChange={(e) => {
                          const target = questionOptions.find((q) => q.ref === e.target.value);
                          if (!target) return;
                          updateChoiceAction(choice, {
                            kind: "question",
                            pageId: currentAction.pageId,
                            pageLabel: currentAction.pageLabel,
                            targetRef: target.ref,
                            targetLabel: target.label,
                          });
                        }}
                        disabled={busy || questionOptions.length === 0}
                        style={logicInputStyle}
                      >
                        {questionOptions.map((question) => (
                          <option key={question.ref} value={question.ref}>{question.label}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <div style={{ color: currentAction.kind === "none" ? "#64748b" : "#0b7a4b", fontSize: 12, fontWeight: 800, paddingTop: 9 }}>
                    {actionLabel(currentAction)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 14, border: "1px solid var(--pulso-border, #dbe3ea)", borderRadius: 8, color: "#64748b", fontSize: 13 }}>
            No hay preguntas de selección única disponibles para lógica visual.
          </div>
        )}

        {hasPendingVisualChanges ? (
          <div style={{ padding: "9px 11px", border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#0b2e63", fontSize: 12, fontWeight: 700 }}>
            Revisa los saltos y confirma esta lógica para dejarla lista.
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={clearSelectedRule}
            disabled={!selectedRule || busy}
            style={{
              border: "1px solid var(--pulso-border, #dbe3ea)",
              borderRadius: 6,
              background: "white",
              color: selectedRule ? "#475569" : "#94a3b8",
              padding: "7px 10px",
              fontWeight: 700,
              cursor: selectedRule && !busy ? "pointer" : "not-allowed",
            }}
          >
            Borrar esta lógica
          </button>
          <button
            type="button"
            onClick={clearAllRules}
            disabled={!draftRules.length || busy}
            style={{
              border: "1px solid var(--pulso-border, #dbe3ea)",
              borderRadius: 6,
              background: "white",
              color: draftRules.length ? "#475569" : "#94a3b8",
              padding: "7px 10px",
              fontWeight: 700,
              cursor: draftRules.length && !busy ? "pointer" : "not-allowed",
            }}
          >
            Borrar todo
          </button>
          {hasPendingVisualChanges ? (
            <button
              type="button"
              onClick={discardVisualChanges}
              disabled={busy}
              style={{
                border: "1px solid var(--pulso-border, #dbe3ea)",
                borderRadius: 6,
                background: "white",
                color: "#475569",
                padding: "7px 10px",
                fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Deshacer cambios
            </button>
          ) : null}
          <button
            type="button"
            onClick={confirmVisualRules}
            disabled={!hasPendingVisualChanges || busy}
            style={{
              border: "none",
              borderRadius: 6,
              background: hasPendingVisualChanges ? "#16a34a" : "#cbd5e1",
              color: "white",
              padding: "7px 12px",
              fontWeight: 900,
              cursor: hasPendingVisualChanges && !busy ? "pointer" : "not-allowed",
            }}
          >
            Confirmar lógica
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--pulso-border, #dbe3ea)", background: "#f8fafc", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", letterSpacing: 0 }}>
              Lógica visual confirmada
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: "#64748b" }}>
              Estos saltos ya están listos para aplicarse al formulario.
            </div>
          </div>
          <span
            style={{
              flex: "0 0 auto",
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid #bbf7d0",
              background: "#ecfdf5",
              color: "#166534",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {visualActionCount(rules)} salto{visualActionCount(rules) === 1 ? "" : "s"}
          </span>
        </div>

        {rules.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--pulso-border, #dbe3ea)",
              borderRadius: 8,
              background: "white",
              color: "#64748b",
              padding: "14px 16px",
              fontSize: 13,
            }}
          >
            Todavía no hay lógica visual confirmada.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rules.map((rule, index) => {
              const actions = visualRuleActions(rule);
              return (
                <div
                  key={rule.id}
                  style={{
                    border: "1px solid var(--pulso-border, #dbe3ea)",
                    borderRadius: 8,
                    background: "white",
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#0b2e63" }}>Regla visual {index + 1}</span>
                      <span style={{ padding: "2px 7px", borderRadius: 999, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontSize: 11, fontWeight: 800 }}>
                        Confirmada
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.45, marginBottom: 8, fontWeight: 800 }}>
                      {rule.variableLabel}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {actions.map((choice) => (
                        <div
                          key={choice.choiceName}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1fr)",
                            gap: 8,
                            color: "#475569",
                            fontSize: 12,
                          }}
                        >
                          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                            <strong style={{ color: "#334155" }}>{choice.choiceLabel}</strong>
                          </div>
                          <div style={{ minWidth: 0, overflowWrap: "anywhere", color: "#0b7a4b", fontWeight: 800 }}>
                            {actionLabel(choice.action)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => editVisualRule(rule)}
                      disabled={busy}
                      style={{
                        border: "1px solid var(--pulso-border, #dbe3ea)",
                        borderRadius: 6,
                        background: "white",
                        color: "#0b2e63",
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: busy ? "not-allowed" : "pointer",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeVisualRule(rule.id)}
                      disabled={busy}
                      style={{
                        border: "1px solid #fecaca",
                        borderRadius: 6,
                        background: "#fff7f7",
                        color: "#991b1b",
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: busy ? "not-allowed" : "pointer",
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {existingKoboLogic.length > 0 ? (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--pulso-border, #dbe3ea)", background: "#f8fafc" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 8 }}>
            Lógica ya aplicada ({existingKoboLogic.length})
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
            {existingKoboLogic.map((item) => (
              <div
                key={`${item.name}-${item.relevant}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 0.35fr) minmax(0, 1fr)",
                  gap: 8,
                  padding: "8px 10px",
                  border: "1px solid #dbeafe",
                  borderRadius: 6,
                  background: "white",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 800, color: "#0b2e63" }}>{displayRef(item.name)}</div>
                <div style={{ overflowWrap: "anywhere", color: "#334155" }}>
                  {nonTechnicalAppliedLabel(item)} ya tiene una condición aplicada.
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, color: "#64748b", fontSize: 11, lineHeight: 1.35 }}>
            Estas condiciones vienen del formulario actual y se mantienen al aplicar nuevas reglas.
          </div>
        </div>
      ) : null}
    </section>
  );
}

const logicInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--pulso-border, #dbe3ea)",
  borderRadius: 6,
  background: "white",
  padding: "9px 10px",
  fontSize: 13,
};

function InterpretationCard({
  interp,
  original,
  busy,
  hasOverride,
  onConfirm,
  onDiscard,
  onReorder,
  onResetOrder,
}: {
  interp: Extract<RuleInterpretation, { ok: true }>;
  original: string;
  busy: boolean;
  hasOverride: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
  onReorder: (nextLabels: string[]) => void;
  onResetOrder: () => void;
}) {
  const choices = interp.resolucion.choices_disponibles;
  const [draftChoices, setDraftChoices] = useState(choices);

  useEffect(() => {
    setDraftChoices(choices);
  }, [choices]);

  const hasPendingOrder = draftChoices.map((c) => c.label).join("\u0000") !== choices.map((c) => c.label).join("\u0000");

  function moveUp(idx: number) {
    if (idx <= 0) return;
    setDraftChoices((current) => {
      const next = [...current];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }
  function moveDown(idx: number) {
    if (idx >= draftChoices.length - 1) return;
    setDraftChoices((current) => {
      const next = [...current];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  }

  function applyOrder() {
    onReorder(draftChoices.map((c) => c.label));
  }

  const normalizedTargets = interp.diagrama.edges.map((edge) => edge.target_label);

  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: 14,
        background: "#fafafa",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            Interpretador de ramificación avanzada
          </h4>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
            Lo pegado viene del código copiable de SurveyMonkey. Revisa el resultado antes de confirmarlo.
          </p>
        </div>
        <span
          style={{
            flex: "0 0 auto",
            padding: "3px 8px",
            borderRadius: 999,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          XLSForm
        </span>
      </div>

      <p
        style={{
          margin: "0 0 12px",
          padding: 10,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--pulso-text, #1f2937)",
        }}
      >
        {interp.texto_humano}
      </p>

      <div style={{ padding: 10, background: "white", border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--pulso-muted, #6b7280)", marginBottom: 4, fontWeight: 700, letterSpacing: 0 }}>
          Como SurveyMonkey
        </div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.45, overflowWrap: "anywhere" }}>
          {original}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ padding: 10, background: "white", border: "1px solid #e5e7eb", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: "var(--pulso-muted, #6b7280)", marginBottom: 4 }}>
            Variable condicional
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflowWrap: "anywhere" }}>
            {interp.diagrama.origen.label}
          </div>
        </div>
        <div style={{ padding: 10, background: "white", border: "1px solid #e5e7eb", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: "var(--pulso-muted, #6b7280)", marginBottom: 4 }}>
            Variables afectadas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {normalizedTargets.map((target, i) => (
              <span
                key={`${target}-${i}`}
                style={{
                  padding: "3px 7px",
                  borderRadius: 999,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  fontSize: 11,
                  fontWeight: 600,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {target}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Diagrama simple: condición arriba, acciones abajo */}
      <div
        style={{
          padding: 12,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            background: "#dbeafe",
            border: "1px solid #93c5fd",
            borderRadius: 6,
            display: "inline-block",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {interp.diagrama.origen.label}
        </div>
        <div style={{ marginLeft: 18, marginTop: 6, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
          ↓ {interp.diagrama.origen.condicion}
        </div>
        <div style={{ marginLeft: 18, marginTop: 4 }}>
          {interp.diagrama.edges.map((edge, i) => (
            <div
              key={i}
              style={{
                marginTop: 4,
                padding: "6px 10px",
                background: "#fef3c7",
                border: "1px solid #fde047",
                borderRadius: 6,
                display: "inline-block",
                fontSize: 12,
                marginRight: 6,
              }}
            >
              {edge.action.includes("salto") ? "↷" : "⊘"} {edge.target_label} <span style={{ color: "var(--pulso-muted, #6b7280)" }}>({edge.action})</span>
            </div>
          ))}
        </div>
      </div>

      {interp.warnings.length > 0 ? (
        <div
          style={{
            padding: 8,
            background: "#fef3c7",
            border: "1px solid #fde047",
            borderRadius: 6,
            fontSize: 12,
            color: "#854d0e",
            marginBottom: 12,
          }}
        >
          <strong>Avisos:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {interp.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {choices.length > 0 ? (
        <details
          open={hasOverride}
          style={{ marginBottom: 12, fontSize: 12 }}
        >
          <summary
            style={{
              cursor: "pointer",
              padding: "6px 10px",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontWeight: 500,
              color: "var(--pulso-text, #1f2937)",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>
              Opciones disponibles ({choices.length})
              {hasOverride ? (
                <span style={{ marginLeft: 8, color: "#9333ea", fontSize: 11, fontWeight: 600 }}>
                  · orden personalizado
                </span>
              ) : null}
            </span>
            {hasOverride ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onResetOrder();
                }}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: "1px solid var(--pulso-border, #e5e7eb)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  cursor: busy ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--pulso-muted, #6b7280)",
                }}
              >
                <RotateCcw size={11} /> Restablecer
              </button>
            ) : null}
          </summary>
          <div
            style={{
              marginTop: 6,
              padding: "8px 12px",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--pulso-muted, #6b7280)", lineHeight: 1.4 }}>
              Si el orden no coincide con tu cuestionario, usa ↑ ↓ para corregirlo.
              La lógica se recalcula recién cuando aplicas el nuevo orden.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "var(--pulso-muted, #6b7280)", textAlign: "left" }}>
                  <th style={{ padding: "4px 6px", width: 50 }}>Código</th>
                  <th style={{ padding: "4px 6px" }}>Etiqueta</th>
                  <th style={{ padding: "4px 6px", width: 60 }}>Tipo</th>
                  <th style={{ padding: "4px 6px", width: 70, textAlign: "right" }}>Orden</th>
                </tr>
              </thead>
              <tbody>
                {draftChoices.map((ch, idx) => (
                  <tr key={`${ch.label}-${idx}`} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "4px 6px", fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>C{idx + 1}</td>
                    <td style={{ padding: "4px 6px" }}>{ch.label}</td>
                    <td style={{ padding: "4px 6px", color: "var(--pulso-muted, #6b7280)", fontStyle: (ch.is_other || ch.is_none) ? "italic" : "normal" }}>
                      {ch.is_other ? "otro" : ch.is_none ? "ninguna" : ""}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0 || busy}
                        aria-label="Subir"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--pulso-border, #e5e7eb)",
                          borderRadius: 4,
                          padding: "2px 4px",
                          marginRight: 2,
                          cursor: idx === 0 || busy ? "not-allowed" : "pointer",
                          opacity: idx === 0 ? 0.4 : 1,
                        }}
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === draftChoices.length - 1 || busy}
                        aria-label="Bajar"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--pulso-border, #e5e7eb)",
                          borderRadius: 4,
                          padding: "2px 4px",
                          cursor: idx === draftChoices.length - 1 || busy ? "not-allowed" : "pointer",
                          opacity: idx === draftChoices.length - 1 ? 0.4 : 1,
                        }}
                      >
                        <ArrowDown size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: hasPendingOrder ? "#92400e" : "var(--pulso-muted, #6b7280)" }}>
                {hasPendingOrder ? "Hay un orden pendiente por aplicar." : "La interpretación usa este orden."}
              </span>
              <button
                type="button"
                onClick={applyOrder}
                disabled={busy || !hasPendingOrder}
                style={{
                  background: hasPendingOrder ? "var(--pulso-accent, #2563eb)" : "#e5e7eb",
                  color: hasPendingOrder ? "white" : "#64748b",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: busy || !hasPendingOrder ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={12} /> Aplicar orden
              </button>
            </div>
          </div>
        </details>
      ) : null}

      <details style={{ marginBottom: 12, fontSize: 12 }}>
        <summary
          style={{
            cursor: "pointer",
            padding: "6px 10px",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            fontWeight: 600,
            color: "#475569",
            listStyle: "none",
          }}
        >
          Ver diagnóstico técnico
        </summary>
        <div
          style={{
            marginTop: 8,
            padding: 10,
            background: "#f8fafc",
            border: "1px solid #dbeafe",
            borderRadius: 6,
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            lineHeight: 1.45,
            overflowWrap: "anywhere",
            color: "#0f172a",
          }}
        >
          relevant = {interp.resolucion.kobo_expr || "(sin expresión)"}
        </div>
      </details>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          onClick={onDiscard}
          style={{
            background: "transparent",
            border: "1px solid var(--pulso-border, #e5e7eb)",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <X size={14} /> Descartar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Check size={14} /> Confirmar regla
        </button>
      </div>
    </div>
  );
}
