import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Plus,
  X,
  Trash2,
  Cloud,
  Check,
  KeyRound,
  Search,
  ShieldCheck,
} from "lucide-react";
import { IconBranching, IconChecklist } from "../../../lib/icons";
import {
  apiXlsformEditorImportSurveyMonkeyWithLogic,
  apiXlsformEditorSmFetchSurveyInfo,
  apiXlsformEditorSmListSurveys,
  apiXlsformEditorSmCheckToken,
  apiXlsformEditorSmTokenLoad,
  apiXlsformEditorSmTokenSave,
  apiXlsformEditorSmTokenClear,
  type SurveyMonkeyQuestion,
  type SurveyMonkeyListItem,
  type SurveyMonkeyTokenInfo,
  type SurveyMonkeyVisualLogicRule,
  type EditorPayloadWithHallazgos,
} from "../../../api/client";
import { compileVisualLogicRules, RuleWizard, type VisualLogicPage, type VisualLogicQuestion } from "./RuleWizard";

// Modal de importación SurveyMonkey. El flujo principal usa solo la API:
//   1. Conecta token + encuesta.
//   2. Prosecnur trae páginas, preguntas, opciones, required y validations.
//   3. Si hay saltos, el usuario pega UNA regla, revisa la interpretación y confirma.

type PageEntry = {
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

const newId = () => Math.random().toString(36).slice(2, 9);

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
function parseQuestionList(text: string): string[] {
  const tokens = text.split(",").map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const range = expandRange(t);
    if (range) out.push(...range);
    else out.push(t);
  }
  return out;
}

function pagesToRecord(entries: PageEntry[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of entries) {
    if (!e.pageId.trim()) continue;
    out[e.pageId.trim()] = pageQuestionNames(e);
  }
  return out;
}

function pageLabelsToRecord(entries: PageEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  entries.forEach((e, idx) => {
    const pageId = e.pageId.trim();
    if (!pageId) return;
    const label = (e.label || buildPageLabel(e, idx)).trim();
    if (label) out[pageId] = label;
  });
  return out;
}

function buildPageLabel(entry: PageEntry, index?: number): string {
  const canonical = typeof index === "number" ? `Pag${index + 1}` : "";
  const title = entry.title?.trim() || `Página ${entry.pageId}`;
  const range = entry.rangeLabel || questionRangeLabel(pageQuestionNames(entry));
  const detail = range ? `${title} (${range})` : title;
  return canonical ? `${canonical} - ${detail}` : detail;
}

function pageQuestionNames(entry: PageEntry): string[] {
  const direct = entry.questions.map((q) => q.trim()).filter(Boolean);
  if (direct.length > 0) return direct;
  return (entry.questionDetails ?? [])
    .map((q) => q.name.trim())
    .filter(Boolean);
}

function pageXlsformVariableCount(entry: PageEntry): number {
  const details = entry.questionDetails ?? [];
  if (!details.length) return pageQuestionNames(entry).length;
  return details.reduce((sum, q) => sum + (q.children?.length ? q.children.length : 1), 0);
}

function questionRangeLabel(questions: string[]): string {
  const clean = questions.map((q) => q.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return displayQuestionRef(clean[0]);
  return `${displayQuestionRef(clean[0])}-${displayQuestionRef(clean[clean.length - 1])}`;
}

function displayQuestionRef(q: string): string {
  const match = q.match(/^[qp]0*(\d+)(.*)$/i);
  if (!match) return q;
  return `p${Number(match[1])}${match[2] ?? ""}`;
}

function displayOriginalQuestionRef(q: string): string {
  return q.replace(/^([QP])0+(\d+)(.*)$/i, (_, p: string, n: string, rest: string) => `${p.toUpperCase()}${Number(n)}${rest ?? ""}`);
}

function apiInfoToQuestions(pages: PageEntry[]): SurveyMonkeyQuestion[] {
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

function visualQuestionsFromPages(pages: PageEntry[]): VisualLogicQuestion[] {
  return pages.flatMap((page) =>
    (page.questionDetails ?? [])
      .filter((q) => (q.family ?? "").toLowerCase() === "single_choice" && (q.choices?.length ?? 0) > 0)
      .map((q) => ({
        ref: q.name,
        label: `${displayQuestionRef(q.name)}: ${q.heading ?? q.name}`,
        choices: (q.choices ?? []).map((choice, idx) => ({
          name: choice.code,
          label: choice.label,
          index: idx + 1,
        })),
      })),
  );
}

function visualPagesFromEntries(pages: PageEntry[]): VisualLogicPage[] {
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

export function ImportSurveyMonkeyDialog({
  fileId,
  fileName,
  onCancel,
  onComplete,
}: {
  fileId?: string | null;
  fileName: string;
  onCancel: () => void;
  onComplete: (payload: EditorPayloadWithHallazgos & {
    surveyMonkeyRules?: import("./RuleWizard").ConfirmedRule[];
    surveyMonkeyVisualRules?: SurveyMonkeyVisualLogicRule[];
    surveyMonkeyChoiceOverrides?: Record<string, string[]>;
  }) => void;
}) {
  const [apiQuestions, setApiQuestions] = useState<SurveyMonkeyQuestion[]>([]);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [wizardRules, setWizardRules] = useState<import("./RuleWizard").ConfirmedRule[]>([]);
  const [visualRules, setVisualRules] = useState<SurveyMonkeyVisualLogicRule[]>([]);
  // Override del orden de choices por pregunta. Key = posición global de la
  // pregunta como string ("27" para Q27); value = labels en el orden que el
  // usuario quiere. Persiste mientras el dialog está abierto y viaja al
  // endpoint de import junto con las reglas.
  const [choiceOrderOverrides, setChoiceOrderOverrides] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  // Vía 3: auto-completar mapeo de páginas desde la API SurveyMonkey
  const [smSurveyId, setSmSurveyId] = useState("");
  const [smToken, setSmToken] = useState<string>("");
  const [smFetching, setSmFetching] = useState(false);
  const [smApiSuccess, setSmApiSuccess] = useState<string | null>(null);
  const [smApiError, setSmApiError] = useState<string | null>(null);
  const [smFetchedSurveyId, setSmFetchedSurveyId] = useState<string | null>(null);
  const [smSurveyList, setSmSurveyList] = useState<SurveyMonkeyListItem[] | null>(null);
  const [smListing, setSmListing] = useState(false);
  const [smTokenStatus, setSmTokenStatus] = useState<SurveyMonkeyTokenInfo | null>(null);
  const [smRememberToken, setSmRememberToken] = useState<boolean>(true);

  // Cargar token previamente guardado (cifrado en disco por el backend).
  useEffect(() => {
    let cancelled = false;
    apiXlsformEditorSmTokenLoad()
      .then(async (r) => {
        if (cancelled) return;
        if (r.has_token && r.token) {
          setSmToken(r.token);
          setSmRememberToken(true);
          // Auto-verificar contra GET /users/me para mostrar al usuario que
          // su token sigue vivo (o avisarle si fue revocado).
          try {
            const info = await apiXlsformEditorSmCheckToken(r.token);
            if (!cancelled) setSmTokenStatus(info);
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // ignore: backend no disponible o error de I/O — el usuario podrá
        // pegar el token manualmente.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleTokenChange(next: string) {
    setSmToken(next);
    setSmTokenStatus(null);
    setSmFetchedSurveyId(null);
  }
  async function handleTokenBlur() {
    // Al salir del input, persistir si el toggle está on.
    if (smRememberToken) {
      try {
        await apiXlsformEditorSmTokenSave(smToken);
      } catch {
        // si falla guardar, el flujo sigue sin persistencia; no es fatal.
      }
    }
  }
  async function handleRememberToggle(next: boolean) {
    setSmRememberToken(next);
    try {
      if (next) await apiXlsformEditorSmTokenSave(smToken);
      else await apiXlsformEditorSmTokenClear();
    } catch {
      // ignore
    }
  }
  async function handleForgetToken() {
    setSmToken("");
    setSmTokenStatus(null);
    setSmSurveyList(null);
    setSmApiSuccess(null);
    setSmApiError(null);
    try {
      await apiXlsformEditorSmTokenClear();
    } catch {
      // ignore
    }
  }
  async function verifyToken() {
    if (!smToken.trim()) return;
    setSmTokenStatus(null);
    try {
      const info = await apiXlsformEditorSmCheckToken(smToken.trim());
      setSmTokenStatus(info);
    } catch (e) {
      setSmTokenStatus({ ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  async function listSurveysFromSm() {
    if (!smToken.trim()) {
      setSmApiError("Necesitas el token de la API para listar tus surveys.");
      return;
    }
    setSmListing(true);
    setSmApiError(null);
    setSmApiSuccess(null);
    try {
      const result = await apiXlsformEditorSmListSurveys(smToken.trim());
      setSmSurveyList(result.surveys);
      if (result.surveys.length === 0) {
        setSmApiError("Tu cuenta no tiene surveys (o el token no tiene permiso para listarlos).");
      }
    } catch (e) {
      setSmApiError(String((e as Error)?.message ?? e));
    } finally {
      setSmListing(false);
    }
  }

  async function fetchFromSmApi() {
    if (!smSurveyId.trim() || !smToken.trim()) {
      setSmApiError("Necesitas el Survey ID y el token de la API.");
      return;
    }
    // Tolerancia: si el usuario pega una URL completa de SurveyMonkey,
    // intentamos extraer el ID numérico. Acepta /analyze/123456789,
    // /design/123456789, /summary/123456789, etc.
    let cleanedId = smSurveyId.trim();
    const urlMatch = cleanedId.match(/surveymonkey\.com\/[^/]+\/(\d{6,12})(?:[?/#]|$)/i);
    if (urlMatch) {
      cleanedId = urlMatch[1];
      setSmSurveyId(cleanedId);
    } else if (/^https?:\/\//i.test(cleanedId)) {
      setSmApiError(
        "La URL que pegaste no contiene un Survey ID numérico (necesito un número de 9-10 dígitos, no un session token tipo 'sm=...'). Abre el cuestionario específico en SurveyMonkey y copia el número de la URL.",
      );
      return;
    }
    setSmFetching(true);
    setSmApiError(null);
    setSmApiSuccess(null);
    setSmFetchedSurveyId(null);
    try {
      const info = await apiXlsformEditorSmFetchSurveyInfo(
        fileId ?? null,
        cleanedId,
        smToken.trim(),
      );
      // Reemplaza el mapeo de páginas con el de la API, conservando títulos
      // legibles para que el usuario no tenga que leer solo Q0013-Q0014.
      const newPages: PageEntry[] = info.pages.length > 0
        ? info.pages.map((p) => ({
            id: newId(),
            pageId: p.page_id,
            title: p.title ?? undefined,
            label: p.label,
            rangeLabel: p.range_label,
            notes: p.notes,
            questionDetails: p.question_details,
            questions: p.questions,
          }))
        : Object.entries(info.paginas).map(
            ([pageId, qs]) => ({ id: newId(), pageId, questions: qs }),
          );
      newPages.sort((a, b) => Number(a.pageId) - Number(b.pageId));
      setPages(newPages);
      setApiQuestions(apiInfoToQuestions(newPages));
      setVisualRules([]);
      setSmFetchedSurveyId(cleanedId);
      setSmApiSuccess(
        `${info.summary.title ?? "Survey"} · ${info.summary.n_paginas} secciones · ${info.summary.n_preguntas} preguntas mapeadas` +
          (info.summary.n_required > 0 || info.summary.n_validation > 0
            ? ` (la API también trae ${info.summary.n_required} required y ${info.summary.n_validation} validations — se aplicarán al XLSForm en el siguiente paso)`
            : ""),
      );
    } catch (e) {
      setSmApiError(String((e as Error)?.message ?? e));
    } finally {
      setSmFetching(false);
    }
  }

  // Escape para cancelar — pero solo si no hay progreso. Si el usuario ya
  // armó páginas o reglas, confirma antes de cerrar para no tirar trabajo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const hasProgress =
        pages.length > 0 ||
        wizardRules.length > 0 ||
        visualRules.length > 0;
      if (!hasProgress || window.confirm("¿Cerrar y descartar lo configurado?")) {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, pages, wizardRules, visualRules]);

  const reglasText = [
    compileVisualLogicRules(visualRules),
    wizardRules.map((r) => r.texto).join("\n"),
  ].filter((part) => part.trim()).join("\n");
  const visualActionCount = visualRules.reduce(
    (sum, rule) => sum + rule.choices.filter((choice) => choice.action.kind !== "none").length,
    0,
  );
  const totalLogicCount = visualActionCount + wizardRules.length;

  async function handleApply() {
    if (!smFetchedSurveyId || !smToken.trim()) {
      setError("Conecta SurveyMonkey antes de importar. El XLSForm se crea solo desde la API.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiXlsformEditorImportSurveyMonkeyWithLogic(
        fileId ?? null,
        reglasText,
        pagesToRecord(pages),
        pageLabelsToRecord(pages),
        "es",
        { survey_id: smFetchedSurveyId, token: smToken.trim() },
        choiceOrderOverrides,
      );
      onComplete({
        ...result,
        surveyMonkeyRules: wizardRules,
        surveyMonkeyVisualRules: visualRules,
        surveyMonkeyChoiceOverrides: choiceOrderOverrides,
      });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setSubmitting(false);
    }
  }

  function addPage() {
    setPages((p) => [...p, { id: newId(), pageId: "", questions: [] }]);
  }
  function removePage(id: string) {
    setPages((p) => p.filter((x) => x.id !== id));
  }
  function updatePage(id: string, patch: Partial<PageEntry>) {
    setPages((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sm-import-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {/* Sin onClick={onCancel} en el backdrop — un click accidental no debe
          tirar el progreso del usuario. Solo se cierra con la X o Escape. */}
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "90vh",
          background: "white",
          borderRadius: 12,
          boxShadow: "var(--pulso-shadow-high)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 id="sm-import-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Importar desde SurveyMonkey
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--pulso-muted, #6b7280)" }}>
              {fileName}
              {apiQuestions.length ? ` · ${apiQuestions.length} preguntas desde API` : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={20} />
          </button>
        </header>

        <div style={{ padding: 20, overflowY: "auto", flex: 1, fontSize: 14 }}>
          {loading ? (
            <p style={{ color: "var(--pulso-muted, #6b7280)" }}>Preparando importador…</p>
          ) : error ? (
            <div
              style={{
                padding: 12,
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : (
            <>
              <ImportFlowSummary
                connected={Boolean(smFetchedSurveyId)}
                sectionCount={pages.length}
                questionCount={apiQuestions.length}
                ruleCount={totalLogicCount}
              />

              <SmApiSection
                surveyId={smSurveyId}
                token={smToken}
                connectedSurveyId={smFetchedSurveyId}
                fetching={smFetching}
                listing={smListing}
                successMessage={smApiSuccess}
                errorMessage={smApiError}
                surveyList={smSurveyList}
                tokenStatus={smTokenStatus}
                rememberToken={smRememberToken}
                onSurveyIdChange={(next) => {
                  setSmSurveyId(next);
                  setSmFetchedSurveyId(null);
                }}
                onTokenChange={handleTokenChange}
                onTokenBlur={handleTokenBlur}
                onRememberToggle={handleRememberToggle}
                onVerifyToken={verifyToken}
                onForgetToken={handleForgetToken}
                onFetch={fetchFromSmApi}
                onList={listSurveysFromSm}
              />

              {!smFetchedSurveyId ? (
                <div style={{ marginBottom: 16, padding: 12, border: "1px solid #fde68a", borderRadius: 8, background: "#fffbeb", color: "#92400e", fontSize: 12, lineHeight: 1.45 }}>
                  Conecta una encuesta para importar estructura, secciones, opciones, etiquetas y lógica desde la API. Las respuestas `.sav` se adaptan después al XLSForm normalizado.
                </div>
              ) : null}

              <PageMapEditor pages={pages} onAdd={addPage} onRemove={removePage} onUpdate={updatePage} />

              <section
                style={{
                  marginTop: 24,
                  border: "1px solid var(--pulso-border, #e5e7eb)",
                  borderRadius: 10,
                  background: "#ffffff",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--pulso-border, #e5e7eb)", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Lógica SurveyMonkey</h3>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--pulso-muted, #6b7280)", lineHeight: 1.45 }}>
                        Revisa la lógica como en la pestaña Lógica. Si tienes lógica de ramificación avanzada, pégala abajo para traducirla.
                      </p>
                    </div>
                    <span
                      style={{
                        flex: "0 0 auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 9px",
                        borderRadius: 999,
                        border: "1px solid #dbeafe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <IconBranching size={12} /> {totalLogicCount} salto{totalLogicCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  {!smFetchedSurveyId ? (
                    <div style={{ marginBottom: 12, padding: 10, border: "1px solid #fde68a", borderRadius: 8, background: "#fffbeb", color: "#92400e", fontSize: 12, lineHeight: 1.45 }}>
                      Conecta SurveyMonkey primero para que el intérprete resuelva etiquetas, páginas y opciones con precisión.
                    </div>
                  ) : null}
                <RuleWizard
                  surveyId={smFetchedSurveyId ?? ""}
                  token={smToken.trim()}
                  paginas={pagesToRecord(pages)}
                  paginasLabels={pageLabelsToRecord(pages)}
                  confirmed={wizardRules}
                  visualRules={visualRules}
                  visualQuestions={visualQuestionsFromPages(pages)}
                  visualPages={visualPagesFromEntries(pages)}
                  onAdd={(r) => setWizardRules((prev) => [...prev, r])}
                  onUpdate={(id, rule) => setWizardRules((prev) => prev.map((x) => x.id === id ? rule : x))}
                  onRemove={(id) => setWizardRules((prev) => prev.filter((x) => x.id !== id))}
                  onClearAll={() => setWizardRules([])}
                  onVisualRulesChange={setVisualRules}
                  overrides={choiceOrderOverrides}
                  onOverridesChange={setChoiceOrderOverrides}
                />
                </div>
              </section>
            </>
          )}
        </div>

        <footer
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "#f9fafb",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              background: "transparent",
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            Cancelar
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleApply}
              disabled={submitting || loading || !smFetchedSurveyId}
              style={{
                background: smFetchedSurveyId ? "var(--pulso-accent, #2563eb)" : "#cbd5e1",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: submitting || loading || !smFetchedSurveyId ? "not-allowed" : "pointer",
                opacity: submitting || loading || !smFetchedSurveyId ? 0.65 : 1,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {submitting ? "Importando…" : "Importar con SurveyMonkey"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ImportFlowSummary({
  connected,
  sectionCount,
  questionCount,
  ruleCount,
}: {
  connected: boolean;
  sectionCount: number;
  questionCount: number;
  ruleCount: number;
}) {
  const items = [
    {
      label: "Conexión",
      value: connected ? "Lista" : "Pendiente",
      done: connected,
      icon: <Cloud size={13} />,
    },
    {
      label: "Secciones",
      value: sectionCount > 0 ? `${sectionCount}` : "Sin cargar",
      done: sectionCount > 0,
      icon: <Search size={13} />,
    },
    {
      label: "Preguntas",
      value: questionCount > 0 ? `${questionCount}` : "Sin cargar",
      done: questionCount > 0,
      icon: <ShieldCheck size={13} />,
    },
    {
      label: "Saltos",
      value: ruleCount > 0 ? `${ruleCount}` : "Opcional",
      done: true,
      icon: <IconBranching size={13} />,
    },
  ];

  return (
    <div
      style={{
        margin: "0 0 16px",
        padding: 12,
        border: "1px solid #dbeafe",
        borderRadius: 10,
        background: "#f8fbff",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${item.done ? "#bfdbfe" : "#e5e7eb"}`,
              background: item.done ? "#eff6ff" : "#ffffff",
              color: item.done ? "#1e3a8a" : "var(--pulso-muted, #6b7280)",
            }}
          >
            <span style={{ display: "inline-flex", flex: "0 0 auto", color: item.done ? "#2563eb" : "#94a3b8" }}>
              {item.done && item.label !== "Saltos" ? <Check size={13} /> : item.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 10, lineHeight: 1.1, color: "var(--pulso-muted, #6b7280)" }}>
                {item.label}
              </span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.value}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmApiSection({
  surveyId,
  token,
  connectedSurveyId,
  fetching,
  listing,
  successMessage,
  errorMessage,
  surveyList,
  tokenStatus,
  rememberToken,
  onSurveyIdChange,
  onTokenChange,
  onTokenBlur,
  onRememberToggle,
  onVerifyToken,
  onForgetToken,
  onFetch,
  onList,
}: {
  surveyId: string;
  token: string;
  connectedSurveyId: string | null;
  fetching: boolean;
  listing: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  surveyList: SurveyMonkeyListItem[] | null;
  tokenStatus: SurveyMonkeyTokenInfo | null;
  rememberToken: boolean;
  onSurveyIdChange: (s: string) => void;
  onTokenChange: (s: string) => void;
  onTokenBlur: () => void;
  onRememberToggle: (b: boolean) => void;
  onVerifyToken: () => void;
  onForgetToken: () => void;
  onFetch: () => void;
  onList: () => void;
}) {
  // Mostrar los últimos 6 chars del token cargado como hint visual — útil
  // cuando el usuario regenera el token en SM y quiere confirmar que pegó
  // el nuevo, no el viejo cacheado.
  const tokenSuffix = token.length > 6 ? `…${token.slice(-6)}` : token;
  const [expanded, setExpanded] = useState(true);
  const isReady = Boolean(successMessage && connectedSurveyId);
  return (
    <details
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
      style={{
        marginBottom: 16,
        border: "1px solid var(--pulso-border, #e5e7eb)",
        borderRadius: 8,
        background: isReady ? "#f0fdf4" : "#ffffff",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "12px 14px",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          listStyle: "none",
        }}
      >
        <Cloud size={15} />
        <span>Conectar formulario original de SurveyMonkey</span>
        {isReady ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, color: "#166534", fontSize: 12 }}>
            <Check size={14} /> Listo
          </span>
        ) : (
          <span style={{ marginLeft: "auto", color: "#92400e", fontSize: 12 }}>Necesario</span>
        )}
      </summary>
      <div style={{ padding: "0 14px 14px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--pulso-muted, #6b7280)", lineHeight: 1.5 }}>
          Esto trae la estructura original de la encuesta: tipos de pregunta, secciones, orden, opciones,
          obligatoriedad y validaciones.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
          <StepHint icon={<KeyRound size={14} />} title="1. Conecta" text="Pega tu token una vez. Puede quedar guardado en este equipo." />
          <StepHint icon={<Search size={14} />} title="2. Elige" text="Lista tus encuestas o pega el enlace del cuestionario." />
          <StepHint icon={<IconChecklist size={14} />} title="3. Completa" text="Prosecnur rellena secciones y catálogos automáticamente." />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="password"
            value={token}
            placeholder="Token de SurveyMonkey"
            onChange={(e) => onTokenChange(e.target.value)}
            onBlur={onTokenBlur}
            disabled={fetching || listing}
            style={{
              flex: "1 1 240px",
              padding: 6,
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 4,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={onVerifyToken}
            disabled={!token.trim() || fetching || listing}
            title="Comprueba que Prosecnur puede leer tus encuestas"
            style={{
              background: "transparent",
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: !token.trim() ? "not-allowed" : "pointer",
              opacity: !token.trim() ? 0.6 : 1,
            }}
          >
            Probar conexión
          </button>
          <button
            type="button"
            onClick={onList}
            disabled={listing || fetching || !token.trim()}
            title="Muestra tus encuestas recientes para elegir una sin copiar IDs"
            style={{
              background: "transparent",
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: listing || fetching || !token.trim() ? "not-allowed" : "pointer",
              opacity: listing || fetching || !token.trim() ? 0.6 : 1,
            }}
          >
            {listing ? "Buscando…" : "Buscar mis encuestas"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--pulso-muted, #6b7280)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={rememberToken}
              onChange={(e) => onRememberToggle(e.target.checked)}
              style={{ margin: 0 }}
            />
            Recordar en este equipo
            <span title="Se guarda cifrado en disco local.">(cifrado)</span>
          </label>
          <TokenStatusBadge status={tokenStatus} />
        </div>
        {token ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
            <span>
              Token activo <code style={{ fontFamily: "ui-monospace, monospace", background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>{tokenSuffix}</code>
            </span>
            <button
              type="button"
              onClick={onForgetToken}
              style={{
                background: "transparent",
                border: "none",
                color: "#dc2626",
                cursor: "pointer",
                fontSize: 11,
                textDecoration: "underline",
                padding: 0,
              }}
              title="Borra el token cargado y el archivo cifrado en disco"
            >
              Quitar
            </button>
          </div>
        ) : null}

        {surveyList && surveyList.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#374151", fontWeight: 500 }}>
              Encuesta encontrada
            </label>
            <select
              value={surveyId}
              onChange={(e) => onSurveyIdChange(e.target.value)}
              disabled={fetching}
              style={{
                width: "100%",
                padding: 6,
                border: "1px solid var(--pulso-border, #e5e7eb)",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <option value="">Elige la encuesta a importar…</option>
              {surveyList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.id}){s.date_modified ? ` · mod ${s.date_modified.slice(0, 10)}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="text"
            value={surveyId}
            placeholder="Pega el enlace de SurveyMonkey o el ID de la encuesta"
            onChange={(e) => onSurveyIdChange(e.target.value)}
            disabled={fetching}
            style={{
              flex: "1 1 280px",
              padding: 6,
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={onFetch}
            disabled={fetching || !surveyId.trim() || !token.trim()}
            style={{
              background: "var(--pulso-accent, #2563eb)",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: fetching || !surveyId.trim() || !token.trim() ? "not-allowed" : "pointer",
              opacity: fetching || !surveyId.trim() || !token.trim() ? 0.6 : 1,
            }}
          >
            {fetching ? "Conectando…" : "Usar esta encuesta"}
          </button>
        </div>
        {successMessage ? (
          <div style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 6, fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ShieldCheck size={15} style={{ marginTop: 1, flex: "0 0 auto" }} />
            <span>{successMessage}. También se usarán los nombres reales de las opciones al importar.</span>
          </div>
        ) : null}
        {errorMessage ? (
          <div style={{ padding: 8, background: "#fef2f2", color: "#991b1b", borderRadius: 4, fontSize: 12 }}>
            {errorMessage}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function StepHint({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--pulso-border, #e5e7eb)",
        borderRadius: 8,
        padding: 10,
        background: "#f9fafb",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>
        <span style={{ color: "var(--pulso-accent, #2563eb)", display: "inline-flex" }}>{icon}</span>
        <span>{title}</span>
      </div>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.35, color: "var(--pulso-muted, #6b7280)" }}>{text}</p>
    </div>
  );
}

function TokenStatusBadge({ status }: { status: SurveyMonkeyTokenInfo | null }) {
  if (!status) return null;
  if (status.ok) {
    return (
      <span style={{ fontSize: 11, color: "#166534", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Check size={12} /> Conexión lista
        {status.n_surveys_visible != null && status.n_surveys_visible >= 0
          ? ` · ${status.n_surveys_visible} encuesta(s) visibles`
          : ""}
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, color: "#991b1b", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {status.status_code === 401 ? "No pude conectar. Revisa o genera un token nuevo." : status.error}
    </span>
  );
}

// Input controlado que mantiene su propio "raw text" mientras el usuario
// edita (para no expandir rangos a mitad de keystroke), pero se sincroniza
// con `value` externo cuando cambia desde afuera (ej. auto-completar
// desde la API). Commit ocurre en blur.
function PageQuestionsInput({
  value,
  onCommit,
}: {
  value: string[];
  onCommit: (qs: string[]) => void;
}) {
  const externalText = value.map(displayQuestionRef).join(", ");
  const [text, setText] = useState(externalText);
  // Sincronizar cuando `value` cambia desde fuera (no por edición local).
  useEffect(() => {
    setText(externalText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalText]);

  return (
    <input
      type="text"
      value={text}
      placeholder="Q24  o  Q25-Q31  o  Q24, Q26-Q28"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseQuestionList(text);
        // Si lo parseado difiere del valor actual, commit. Si los rangos
        // se expandieron, refrescamos el texto visible.
        const reformatted = parsed.join(", ");
        if (reformatted !== externalText) onCommit(parsed);
        if (reformatted !== text) setText(reformatted);
      }}
      style={{
        width: "100%",
        padding: 6,
        border: "1px solid var(--pulso-border, #e5e7eb)",
        borderRadius: 4,
        fontFamily: "ui-monospace, monospace",
      }}
    />
  );
}

function PageMapEditor({
  pages,
  onAdd,
  onRemove,
  onUpdate,
}: {
  pages: PageEntry[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PageEntry>) => void;
}) {
  const totalQuestions = pages.reduce((sum, p) => sum + pageQuestionNames(p).length, 0);
  const totalVariables = pages.reduce((sum, p) => sum + pageXlsformVariableCount(p), 0);
  return (
    <div>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Secciones de la encuesta</h3>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--pulso-muted, #6b7280)" }}>
        Prosecnur importará estas páginas como secciones del XLSForm. A la izquierda queda la página original
        de SurveyMonkey; en el encabezado ya ves el nombre final que aparecerá en el editor.
      </p>
      {pages.length > 0 ? (
        <div style={{ margin: "0 0 10px", display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#374151" }}>
          <span style={{ padding: "3px 8px", border: "1px solid #dbeafe", borderRadius: 999, background: "#eff6ff" }}>
            {pages.length} seccion{pages.length === 1 ? "" : "es"} a importar
          </span>
          <span style={{ padding: "3px 8px", border: "1px solid #dbeafe", borderRadius: 999, background: "#eff6ff" }}>
            {totalQuestions} pregunta{totalQuestions === 1 ? "" : "s"} mapeadas
          </span>
          <span style={{ padding: "3px 8px", border: "1px solid #dbeafe", borderRadius: 999, background: "#eff6ff" }}>
            {totalVariables} variable{totalVariables === 1 ? "" : "s"} XLSForm
          </span>
        </div>
      ) : null}

      {pages.length === 0 ? (
        <p style={{ margin: "8px 0", fontSize: 12, color: "var(--pulso-muted, #6b7280)", fontStyle: "italic" }}>
          Todavía no hay secciones cargadas. Puedes importar igual, o conectar SurveyMonkey arriba para completarlas.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {pages.map((p, idx) => {
            const label = buildPageLabel(p, idx);
            const sectionQuestions = p.questionDetails ?? [];
            const questionCount = pageQuestionNames(p).length;
            const variableCount = pageXlsformVariableCount(p);
            return (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--pulso-border, #e5e7eb)",
                  borderRadius: 8,
                  padding: 10,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 84, flex: "0 0 auto" }}>
                    <label style={{ display: "block", marginBottom: 3, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
                      Página SM
                    </label>
                    <input
                      type="text"
                      value={p.pageId}
                      placeholder="16"
                      onChange={(e) => onUpdate(p.id, { pageId: e.target.value, label: undefined })}
                      style={{ width: "100%", padding: 6, border: "1px solid var(--pulso-border, #e5e7eb)", borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflowWrap: "anywhere" }}>
                          {label}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
                          Se creará como <strong>Pag{idx + 1}</strong> con {questionCount} pregunta{questionCount === 1 ? "" : "s"} SM y {variableCount} variable{variableCount === 1 ? "" : "s"} XLSForm
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(p.id)}
                        aria-label="Eliminar página"
                        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flex: "0 0 auto" }}
                      >
                        <Trash2 size={14} color="#9ca3af" />
                      </button>
                    </div>
                    {sectionQuestions.length > 0 ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 4, maxHeight: 160, overflowY: "auto", paddingRight: 4 }}>
                        {sectionQuestions.map((q) => {
                          const children = q.children ?? [];
                          const isMatrix = children.length > 0;
                          return (
                            <div key={q.name} style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <strong>{displayQuestionRef(q.name)}</strong>
                                <span style={{ color: "var(--pulso-muted, #6b7280)" }}> ({displayOriginalQuestionRef(q.name)})</span>
                                {isMatrix ? (
                                  <span style={{ marginLeft: 6, color: "#1d4ed8", fontWeight: 600 }}>
                                    matriz: nota + {children.length} select_one hermanas
                                  </span>
                                ) : null}
                                {q.heading ? ` · ${q.heading}` : ""}
                              </div>
                              {isMatrix ? (
                                <div style={{ margin: "3px 0 2px 14px", display: "grid", gap: 2 }}>
                                  {children.map((child) => (
                                    <div
                                      key={child.name}
                                      style={{
                                        minWidth: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontSize: 11,
                                        color: "#4b5563",
                                      }}
                                    >
                                      <strong style={{ color: "#111827", fontFamily: "ui-monospace, monospace" }}>{child.name}</strong>
                                      <span
                                        style={{
                                          flex: "0 0 auto",
                                          padding: "1px 5px",
                                          border: "1px solid #bfdbfe",
                                          borderRadius: 999,
                                          background: "#eff6ff",
                                          color: "#1d4ed8",
                                          fontSize: 10,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {child.type ?? "select_one"}
                                      </span>
                                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {child.heading}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
                        Página informativa: no contiene preguntas exportables.
                      </div>
                    )}
                    {p.notes && p.notes.length > 0 ? (
                      <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: "#f9fafb", color: "#4b5563", fontSize: 11, lineHeight: 1.35 }}>
                        {p.notes[0]}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: "block", marginBottom: 3, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
                        Preguntas SM usadas para lógica de página
                      </label>
                      <PageQuestionsInput
                        value={p.questions}
                        onCommit={(qs) => onUpdate(p.id, {
                          questions: qs,
                          rangeLabel: questionRangeLabel(qs),
                          label: undefined,
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 8,
          background: "transparent",
          border: "1px dashed var(--pulso-border, #cbd5e1)",
          borderRadius: 6,
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--pulso-muted, #6b7280)",
        }}
      >
        <Plus size={14} />
        Agregar sección manualmente
      </button>
    </div>
  );
}
