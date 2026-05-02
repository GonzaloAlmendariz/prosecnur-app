import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Plus,
  X,
  Trash2,
  ClipboardPaste,
  Cloud,
  Check,
  KeyRound,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  apiXlsformEditorSavMeta,
  apiXlsformEditorImportSurveyMonkeyWithLogic,
  apiXlsformEditorSmFetchSurveyInfo,
  apiXlsformEditorSmListSurveys,
  apiXlsformEditorSmCheckToken,
  apiXlsformEditorSmTokenLoad,
  apiXlsformEditorSmTokenSave,
  apiXlsformEditorSmTokenClear,
  type SurveyMonkeyMeta,
  type SurveyMonkeyQuestion,
  type SurveyMonkeyListItem,
  type SurveyMonkeyTokenInfo,
  type EditorPayloadWithHallazgos,
} from "../../../api/client";
import { RuleWizard } from "./RuleWizard";

// Modal de importación SurveyMonkey. El flujo principal usa solo la API:
//   1. Conecta token + encuesta.
//   2. Pulso trae páginas, preguntas, opciones, required y validations.
//   3. Opcionalmente el usuario pega/arma reglas de salto manuales.

type RuleAction =
  | { kind: "hide_question"; target: string }
  | { kind: "hide_page"; pageId: string }
  | { kind: "end_survey" };

type Rule = {
  id: string;
  whenVar: string; // "Q4" — referencia natural del usuario
  whenOp: "eq" | "ne" | "in" | "not_in";
  whenCodes: string[]; // códigos resueltos (e.g. ["C6"], ["1","2"]) o literales
  actions: RuleAction[];
};

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
  }>;
  questions: string[];
};

const OP_LABELS: Record<Rule["whenOp"], string> = {
  eq: "es igual a",
  ne: "no es",
  in: "está en",
  not_in: "no está en",
};

const newId = () => Math.random().toString(36).slice(2, 9);

// Convierte la estructura interna a sintaxis textual del parser.
function ruleToText(r: Rule): string {
  if (!r.whenVar || r.whenCodes.length === 0 || r.actions.length === 0) return "";
  const codesPart =
    r.whenOp === "eq" || r.whenOp === "ne"
      ? r.whenCodes[0]
      : `[${r.whenCodes.join(", ")}]`;
  const opSym = { eq: "=", ne: "!=", in: "IN", not_in: "NOT IN" }[r.whenOp];
  const cond = `${r.whenVar} ${opSym} ${codesPart}`;
  const actions = r.actions
    .map((a) =>
      a.kind === "end_survey"
        ? "Fin de la encuesta"
        : a.kind === "hide_page"
          ? `Ocultar Pág. ${a.pageId}`
          : `Ocultar ${a.target}`,
    )
    .join(", ");
  return `${cond} => ${actions}.`;
}

// Expande rangos tipo "Q25-Q31" a la lista completa ["Q25","Q26","Q27","Q28","Q29","Q30","Q31"].
// Reconoce el prefijo (Q/P/q/p) + parte numérica con o sin padding y mantiene
// el padding del lado izquierdo para construir cada elemento.
function expandRange(token: string): string[] | null {
  const m = token.match(/^([QPqp])(\d+)\s*[-–]\s*\2?(\d+)$/);
  // Acepta "Q25-Q31" y también "Q25-31"
  const m2 = token.match(/^([QPqp])(\d+)\s*[-–]\s*(\d+)$/);
  const match = m ?? m2;
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
  for (const e of entries) {
    const pageId = e.pageId.trim();
    if (!pageId) continue;
    const label = (e.label || buildPageLabel(e)).trim();
    if (label) out[pageId] = label;
  }
  return out;
}

function buildPageLabel(entry: PageEntry): string {
  const title = entry.title?.trim() || `Página ${entry.pageId}`;
  const range = entry.rangeLabel || questionRangeLabel(pageQuestionNames(entry));
  return range ? `${title} (${range})` : title;
}

function pageQuestionNames(entry: PageEntry): string[] {
  const direct = entry.questions.map((q) => q.trim()).filter(Boolean);
  if (direct.length > 0) return direct;
  return (entry.questionDetails ?? [])
    .map((q) => q.name.trim())
    .filter(Boolean);
}

function questionRangeLabel(questions: string[]): string {
  const clean = questions.map((q) => q.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return displayQuestionRef(clean[0]);
  return `${displayQuestionRef(clean[0])}-${displayQuestionRef(clean[clean.length - 1])}`;
}

function displayQuestionRef(q: string): string {
  return q.replace(/^([QP])0+(\d+)$/i, (_, p: string, n: string) => `${p.toUpperCase()}${Number(n)}`);
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

export function ImportSurveyMonkeyDialog({
  fileId,
  fileName,
  onCancel,
  onComplete,
}: {
  fileId?: string | null;
  fileName: string;
  onCancel: () => void;
  onComplete: (payload: EditorPayloadWithHallazgos) => void;
}) {
  const [meta, setMeta] = useState<SurveyMonkeyMeta | null>(null);
  const [apiQuestions, setApiQuestions] = useState<SurveyMonkeyQuestion[]>([]);
  const [loading, setLoading] = useState(Boolean(fileId));
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  // 3 modos para definir reglas:
  //  - "wizard" (default): pegar UNA regla, ver interpretación + diagrama, confirmar.
  //  - "guided": builder visual con dropdowns y cards.
  //  - "bulk": textarea con múltiples reglas (avanzado).
  const [ruleMode, setRuleMode] = useState<"wizard" | "guided" | "bulk">("wizard");
  const [wizardRules, setWizardRules] = useState<import("./RuleWizard").ConfirmedRule[]>([]);
  // Override del orden de choices por pregunta. Key = posición global de la
  // pregunta como string ("27" para Q27); value = labels en el orden que el
  // usuario quiere. Persiste mientras el dialog está abierto y viaja al
  // endpoint de import junto con las reglas.
  const [choiceOrderOverrides, setChoiceOrderOverrides] = useState<Record<string, string[]>>({});
  const [pastedText, setPastedText] = useState("");
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

  // Cargar metadata del .sav solo en el flujo legacy. En el flujo principal
  // API-only, las preguntas se cargan desde SurveyMonkey.
  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      setMeta(null);
      return;
    }
    let cancelled = false;
    apiXlsformEditorSavMeta(fileId)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e?.message ?? e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // Escape para cancelar — pero solo si no hay progreso. Si el usuario ya
  // armó páginas o reglas, confirma antes de cerrar para no tirar trabajo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const hasProgress =
        pages.length > 0 ||
        rules.length > 0 ||
        wizardRules.length > 0 ||
        pastedText.trim().length > 0;
      if (!hasProgress || window.confirm("¿Cerrar y descartar lo configurado?")) {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, pages, rules, wizardRules, pastedText]);

  const questionByName = useMemo(() => {
    const m = new Map<string, SurveyMonkeyQuestion>();
    if (meta) for (const q of meta.preguntas) m.set(q.name, q);
    for (const q of apiQuestions) m.set(q.name, q);
    return m;
  }, [apiQuestions, meta]);

  const importQuestions = meta?.preguntas ?? apiQuestions;

  const reglasText = useMemo(() => {
    if (ruleMode === "bulk") return pastedText;
    if (ruleMode === "wizard") return wizardRules.map((r) => r.texto).join("\n");
    return rules
      .map(ruleToText)
      .filter((s) => s)
      .join("\n");
  }, [ruleMode, pastedText, rules, wizardRules]);

  async function handleApply(applyRules: boolean, includeApiEnhancements = true) {
    setSubmitting(true);
    setError(null);
    try {
      const reglas = applyRules ? reglasText : "";
      const paginas = includeApiEnhancements ? pagesToRecord(pages) : {};
      const paginasLabels = includeApiEnhancements ? pageLabelsToRecord(pages) : {};
      const result = await apiXlsformEditorImportSurveyMonkeyWithLogic(
        fileId ?? null,
        reglas,
        paginas,
        paginasLabels,
        "es",
        includeApiEnhancements && smFetchedSurveyId && smToken.trim()
          ? { survey_id: smFetchedSurveyId, token: smToken.trim() }
          : undefined,
        applyRules ? choiceOrderOverrides : {},
      );
      onComplete(result);
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

  function addRule() {
    setRules((r) => [
      ...r,
      { id: newId(), whenVar: "", whenOp: "eq", whenCodes: [], actions: [] },
    ]);
  }
  function removeRule(id: string) {
    setRules((r) => r.filter((x) => x.id !== id));
  }
  function updateRule(id: string, patch: Partial<Rule>) {
    setRules((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
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
          width: "min(900px, 100%)",
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
              {meta ? ` · ${meta.n_filas} respuestas · ${meta.preguntas.length} preguntas` : null}
              {!meta && apiQuestions.length ? ` · ${apiQuestions.length} preguntas` : null}
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
              <div
                style={{
                  margin: "0 0 16px",
                  padding: "12px 14px",
                  border: "1px solid #dbeafe",
                  borderRadius: 8,
                  background: "#eff6ff",
                  fontSize: 13,
                  color: "#1e3a8a",
                  lineHeight: 1.5,
                }}
              >
                <strong>Conecta SurveyMonkey:</strong> Pulso generará el XLSForm desde la API,
                usando la estructura real del cuestionario: secciones, textos, tipos de pregunta,
                opciones, obligatoriedad y validaciones.
              </div>

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
                  Conecta una encuesta arriba para generar un XLSForm fiel al formulario original. Sin API, Pulso tendría que adivinar tipos desde las respuestas del .sav y el resultado puede ser pobre.
                </div>
              ) : null}

              <PageMapEditor pages={pages} onAdd={addPage} onRemove={removePage} onUpdate={updatePage} />

              <div style={{ marginTop: 24, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Saltos de la encuesta</h3>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--pulso-muted, #6b7280)" }}>
                      Solo completa esta parte si SurveyMonkey ocultaba preguntas o terminaba la encuesta según una respuesta.
                    </p>
                  </div>
                </div>
                <div
                  role="tablist"
                  aria-label="Modo de definir reglas"
                  style={{
                    display: "inline-flex",
                    border: "1px solid var(--pulso-border)",
                    borderRadius: 6,
                    overflow: "hidden",
                    fontSize: 12,
                    background: "white",
                  }}
                >
                  {([
                    { key: "wizard" as const, label: "Asistente paso a paso", icon: <Sparkles size={13} /> },
                    { key: "guided" as const, label: "Formulario guiado", icon: <ListChecks size={13} /> },
                    { key: "bulk" as const, label: "Pegar todas (texto)", icon: <ClipboardPaste size={13} /> },
                  ]).map((opt) => {
                    const active = ruleMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setRuleMode(opt.key)}
                        style={{
                          background: active ? "var(--pulso-primary)" : "transparent",
                          color: active ? "white" : "var(--pulso-text)",
                          border: "none",
                          padding: "6px 12px",
                          cursor: "pointer",
                          fontWeight: active ? 500 : 400,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span aria-hidden="true" style={{ display: "inline-flex", color: active ? "white" : "var(--pulso-primary)" }}>
                          {opt.icon}
                        </span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {ruleMode === "wizard" ? (
                <RuleWizard
                  surveyId={smFetchedSurveyId ?? ""}
                  token={smToken.trim()}
                  paginas={pagesToRecord(pages)}
                  paginasLabels={pageLabelsToRecord(pages)}
                  confirmed={wizardRules}
                  onAdd={(r) => setWizardRules((prev) => [...prev, r])}
                  onRemove={(id) => setWizardRules((prev) => prev.filter((x) => x.id !== id))}
                  overrides={choiceOrderOverrides}
                  onOverridesChange={setChoiceOrderOverrides}
                />
              ) : ruleMode === "bulk" ? (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--pulso-muted, #6b7280)" }}>
                    Pega una regla por línea. Ejemplo: <code>Q4 = C6 =&gt; Ocultar Pág. 16.</code>{" "}
                    Útil cuando ya tienes varias reglas copiadas del constructor.
                  </p>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Q4 = C6 => Ocultar Pág. 16, Ocultar Pág. 17.\nQ24 IN ["Consultará", "No"] => Fin de la encuesta.`}
                    rows={8}
                    style={{
                      width: "100%",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 13,
                      padding: 10,
                      border: "1px solid var(--pulso-border, #e5e7eb)",
                      borderRadius: 6,
                      resize: "vertical",
                    }}
                  />
                </div>
              ) : (
                <RuleListEditor
                  rules={rules}
                  questions={importQuestions}
                  questionByName={questionByName}
                  pages={pages}
                  onAdd={addRule}
                  onRemove={removeRule}
                  onUpdate={updateRule}
                />
              )}
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
            {fileId ? (
              <button
                type="button"
                onClick={() => handleApply(false, false)}
                disabled={submitting || loading}
                style={{
                  background: "transparent",
                  border: "1px solid var(--pulso-border, #e5e7eb)",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: submitting || loading ? "not-allowed" : "pointer",
                  fontSize: 13,
                  color: "var(--pulso-muted, #6b7280)",
                }}
              >
                Importar solo con .sav
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => handleApply(Boolean(reglasText.trim()), true)}
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
          <StepHint icon={<Sparkles size={14} />} title="3. Completa" text="Pulso rellena secciones y catálogos automáticamente." />
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
            title="Comprueba que Pulso puede leer tus encuestas"
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
  return (
    <div>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Secciones de la encuesta</h3>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--pulso-muted, #6b7280)" }}>
        Si conectaste SurveyMonkey, esto se completa solo. Sirve para mantener juntas las preguntas
        de cada página y para aplicar reglas tipo "ocultar página".
      </p>

      {pages.length === 0 ? (
        <p style={{ margin: "8px 0", fontSize: 12, color: "var(--pulso-muted, #6b7280)", fontStyle: "italic" }}>
          Todavía no hay secciones cargadas. Puedes importar igual, o conectar SurveyMonkey arriba para completarlas.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {pages.map((p) => {
            const label = buildPageLabel(p);
            const firstQuestions = (p.questionDetails ?? []).slice(0, 3);
            const questionCount = pageQuestionNames(p).length;
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
                      Página
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
                          {questionCount} pregunta{questionCount === 1 ? "" : "s"} incluidas
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
                    {firstQuestions.length > 0 ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                        {firstQuestions.map((q) => (
                          <div key={q.name} style={{ fontSize: 11, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <strong>{displayQuestionRef(q.name)}</strong>{q.heading ? ` · ${q.heading}` : ""}
                          </div>
                        ))}
                        {(p.questionDetails?.length ?? 0) > firstQuestions.length ? (
                          <div style={{ fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
                            + {(p.questionDetails?.length ?? 0) - firstQuestions.length} más
                          </div>
                        ) : null}
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

function RuleListEditor({
  rules,
  questions,
  questionByName,
  pages,
  onAdd,
  onRemove,
  onUpdate,
}: {
  rules: Rule[];
  questions: SurveyMonkeyQuestion[];
  questionByName: Map<string, SurveyMonkeyQuestion>;
  pages: PageEntry[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Rule>) => void;
}) {
  return (
    <div>
      {rules.length === 0 ? (
        <p style={{ margin: "8px 0", fontSize: 12, color: "var(--pulso-muted, #6b7280)", fontStyle: "italic" }}>
          Sin reglas por ahora. Puedes importar así, o agregar una regla si la encuesta ocultaba preguntas según una respuesta.
        </p>
      ) : (
        rules.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            questions={questions}
            questionByName={questionByName}
            pages={pages}
            onChange={(patch) => onUpdate(r.id, patch)}
            onRemove={() => onRemove(r.id)}
          />
        ))
      )}
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 8,
          background: "transparent",
          border: "1px dashed var(--pulso-border, #cbd5e1)",
          borderRadius: 6,
          padding: "8px 14px",
          cursor: "pointer",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--pulso-muted, #6b7280)",
        }}
      >
        <Plus size={14} />
        Agregar salto
      </button>
    </div>
  );
}

function RuleCard({
  rule,
  questions,
  questionByName,
  pages,
  onChange,
  onRemove,
}: {
  rule: Rule;
  questions: SurveyMonkeyQuestion[];
  questionByName: Map<string, SurveyMonkeyQuestion>;
  pages: PageEntry[];
  onChange: (patch: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  const selected = rule.whenVar ? questionByName.get(rule.whenVar) : null;
  const isMulti = (rule.whenOp === "in" || rule.whenOp === "not_in");

  function toggleCode(code: string) {
    const has = rule.whenCodes.includes(code);
    if (has) onChange({ whenCodes: rule.whenCodes.filter((c) => c !== code) });
    else onChange({ whenCodes: isMulti ? [...rule.whenCodes, code] : [code] });
  }

  function setAction(idx: number, action: RuleAction) {
    const next = [...rule.actions];
    next[idx] = action;
    onChange({ actions: next });
  }
  function addAction() {
    onChange({ actions: [...rule.actions, { kind: "hide_question", target: "" }] });
  }
  function removeAction(idx: number) {
    onChange({ actions: rule.actions.filter((_, i) => i !== idx) });
  }

  return (
    <div
      style={{
        border: "1px solid var(--pulso-border, #e5e7eb)",
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>SI</strong>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar regla"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
        >
          <Trash2 size={14} color="#9ca3af" />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select
          value={rule.whenVar}
          onChange={(e) => onChange({ whenVar: e.target.value, whenCodes: [] })}
          style={{ padding: 6, border: "1px solid var(--pulso-border, #e5e7eb)", borderRadius: 4, minWidth: 120 }}
        >
          <option value="">Pregunta…</option>
          {questions.map((q) => (
            <option key={q.name} value={q.name}>
              {q.name}
            </option>
          ))}
        </select>
        <select
          value={rule.whenOp}
          onChange={(e) => onChange({ whenOp: e.target.value as Rule["whenOp"], whenCodes: [] })}
          style={{ padding: 6, border: "1px solid var(--pulso-border, #e5e7eb)", borderRadius: 4 }}
        >
          {(Object.keys(OP_LABELS) as Rule["whenOp"][]).map((op) => (
            <option key={op} value={op}>
              {OP_LABELS[op]}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div style={{ marginBottom: 12, padding: 8, background: "white", borderRadius: 4, fontSize: 12, color: "var(--pulso-muted, #6b7280)" }}>
          <em>{selected.label || "(sin etiqueta)"}</em>
        </div>
      ) : null}

      {selected && selected.choices.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--pulso-muted, #6b7280)", marginBottom: 6 }}>Valor(es):</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selected.choices.map((c, i) => {
              const ref = `C${i + 1}`;
              const checked = rule.whenCodes.includes(ref) || rule.whenCodes.includes(`"${c.label}"`);
              return (
                <label
                  key={c.code}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    background: checked ? "var(--pulso-accent-soft, #dbeafe)" : "white",
                    border: `1px solid ${checked ? "var(--pulso-accent, #2563eb)" : "var(--pulso-border, #e5e7eb)"}`,
                    borderRadius: 14,
                    fontSize: 12,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name={`rule-${rule.id}-codes`}
                    checked={checked}
                    onChange={() => toggleCode(ref)}
                    style={{ margin: 0 }}
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>
      ) : selected ? (
        <input
          type="text"
          placeholder="Valor (literal o C1, C2…)"
          value={rule.whenCodes.join(", ")}
          onChange={(e) => onChange({ whenCodes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          style={{
            width: "100%",
            padding: 6,
            border: "1px solid var(--pulso-border, #e5e7eb)",
            borderRadius: 4,
            marginBottom: 14,
            fontFamily: "ui-monospace, monospace",
          }}
        />
      ) : null}

      <div style={{ marginBottom: 6, fontSize: 13 }}>
        <strong>ENTONCES</strong>
      </div>
      {rule.actions.map((a, idx) => (
        <ActionRow
          key={idx}
          action={a}
          questions={questions}
          pages={pages}
          onChange={(next) => setAction(idx, next)}
          onRemove={() => removeAction(idx)}
        />
      ))}
      <button
        type="button"
        onClick={addAction}
        style={{
          background: "transparent",
          border: "1px dashed var(--pulso-border, #cbd5e1)",
          borderRadius: 4,
          padding: "4px 10px",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--pulso-muted, #6b7280)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Plus size={12} />
        Agregar acción
      </button>
    </div>
  );
}

function ActionRow({
  action,
  questions,
  pages,
  onChange,
  onRemove,
}: {
  action: RuleAction;
  questions: SurveyMonkeyQuestion[];
  pages: PageEntry[];
  onChange: (a: RuleAction) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
      <select
        value={action.kind}
        onChange={(e) => {
          const k = e.target.value as RuleAction["kind"];
          if (k === "end_survey") onChange({ kind: "end_survey" });
          else if (k === "hide_page") onChange({ kind: "hide_page", pageId: pages[0]?.pageId ?? "" });
          else onChange({ kind: "hide_question", target: questions[0]?.name ?? "" });
        }}
        style={{ padding: 6, border: "1px solid var(--pulso-border, #e5e7eb)", borderRadius: 4 }}
      >
        <option value="hide_question">Ocultar pregunta</option>
        <option value="hide_page">Ocultar sección (página)</option>
        <option value="end_survey">Ocultar todas las secciones siguientes (Fin)</option>
      </select>

      {action.kind === "hide_question" ? (
        <select
          value={action.target}
          onChange={(e) => onChange({ kind: "hide_question", target: e.target.value })}
          style={{ padding: 6, border: "1px solid var(--pulso-border, #e5e7eb)", borderRadius: 4 }}
        >
          <option value="">Pregunta…</option>
          {questions.map((q) => (
            <option key={q.name} value={q.name}>
              {q.name}
            </option>
          ))}
        </select>
      ) : action.kind === "hide_page" ? (
        <select
          value={action.pageId}
          onChange={(e) => onChange({ kind: "hide_page", pageId: e.target.value })}
          style={{ padding: 6, border: "1px solid var(--pulso-border, #e5e7eb)", borderRadius: 4 }}
        >
          <option value="">Página…</option>
          {pages.filter((p) => p.pageId.trim()).map((p) => (
            <option key={p.id} value={p.pageId}>
              {p.pageId}
            </option>
          ))}
        </select>
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar acción"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
      >
        <Trash2 size={12} color="#9ca3af" />
      </button>
    </div>
  );
}
