import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
} from "lucide-react";
import { IconConditionalLogic, IconChecklist } from "../../../lib/icons";
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
  type SurveyMonkeyTokenState,
  type SurveyMonkeyTokenInfo,
  type SurveyMonkeyVisualLogicRule,
  type ChoiceCodeMap,
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

const EMPTY_SM_TOKEN_STATE: SurveyMonkeyTokenState = {
  ok: true,
  has_token: false,
  masked_token: "",
  persisted: false,
  ephemeral: false,
};

export function surveyMonkeyTokenUiState(tokenState: SurveyMonkeyTokenState, currentInput: string) {
  const hasInput = currentInput.trim().length > 0;
  const hasStoredToken = tokenState.has_token;
  return {
    inputValue: currentInput,
    hasUsableToken: hasInput || hasStoredToken,
    displayMask: hasInput ? "nuevo token pendiente" : tokenState.masked_token,
    storageLabel: hasInput
      ? "se guardará al usarlo"
      : tokenState.persisted
        ? "cifrado en este equipo"
        : tokenState.ephemeral
          ? "solo esta sesión"
          : "",
  };
}

const newId = () => Math.random().toString(36).slice(2, 9);

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function smSurveyTitle(item: SurveyMonkeyListItem) {
  return item.nickname || item.title || item.id;
}

function smSurveyMatchesQuery(item: SurveyMonkeyListItem, query: string) {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeSearch([item.id, item.title, item.nickname ?? ""].join(" "));
  return tokens.every((token) => haystack.includes(token));
}

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
    surveyMonkeyChoiceCodeMaps?: ChoiceCodeMap[];
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
  const [choiceCodeMaps, setChoiceCodeMaps] = useState<ChoiceCodeMap[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Vía 3: auto-completar mapeo de páginas desde la API SurveyMonkey
  const [smSurveyId, setSmSurveyId] = useState("");
  const [smToken, setSmToken] = useState<string>("");
  const [smTokenState, setSmTokenState] = useState<SurveyMonkeyTokenState>(EMPTY_SM_TOKEN_STATE);
  const [smFetching, setSmFetching] = useState(false);
  const [smApiSuccess, setSmApiSuccess] = useState<string | null>(null);
  const [smApiError, setSmApiError] = useState<string | null>(null);
  const [smFetchedSurveyId, setSmFetchedSurveyId] = useState<string | null>(null);
  const [smSurveyList, setSmSurveyList] = useState<SurveyMonkeyListItem[] | null>(null);
  const [smSurveyMeta, setSmSurveyMeta] = useState<{
    totalRecent: number;
    months: number;
    fromCache: boolean;
    cacheStatus: string;
    fetchedAt: string | null;
  } | null>(null);
  const [smListing, setSmListing] = useState(false);
  const [smTokenStatus, setSmTokenStatus] = useState<SurveyMonkeyTokenInfo | null>(null);
  const [smRememberToken, setSmRememberToken] = useState<boolean>(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [visualPending, setVisualPending] = useState(false);

  function applySmTokenState(next: SurveyMonkeyTokenState) {
    setSmTokenState(next);
    if (next.has_token) setSmRememberToken(next.persisted);
  }

  // Cargar solo estado/máscara del token guardado. El backend nunca devuelve
  // el secreto en texto plano.
  useEffect(() => {
    let cancelled = false;
    apiXlsformEditorSmTokenLoad()
      .then(async (r) => {
        if (cancelled) return;
        applySmTokenState(r);
        if (r.has_token) {
          // Auto-verificar contra GET /users/me para mostrar al usuario que
          // su token sigue vivo (o avisarle si fue revocado).
          try {
            const info = await apiXlsformEditorSmCheckToken();
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
    setSmSurveyMeta(null);
  }

  async function ensureSmTokenReady(message: string): Promise<boolean> {
    const tokenInput = smToken.trim();
    if (tokenInput) {
      try {
        const state = await apiXlsformEditorSmTokenSave(tokenInput, { persist: smRememberToken });
        applySmTokenState(state);
        setSmToken("");
        return state.has_token;
      } catch (e) {
        setSmApiError(String((e as Error)?.message ?? e));
        return false;
      }
    }
    if (smTokenState.has_token) return true;
    setSmApiError(message);
    return false;
  }

  async function handleTokenBlur() {
    const tokenInput = smToken.trim();
    if (!tokenInput) return;
    try {
      const state = await apiXlsformEditorSmTokenSave(tokenInput, { persist: smRememberToken });
      applySmTokenState(state);
      setSmToken("");
    } catch {
      // si falla guardar, el usuario puede volver a intentar; no es fatal.
    }
  }
  async function handleRememberToggle(next: boolean) {
    setSmRememberToken(next);
    try {
      const tokenInput = smToken.trim();
      if (tokenInput) {
        const state = await apiXlsformEditorSmTokenSave(tokenInput, { persist: next });
        applySmTokenState(state);
        setSmToken("");
      } else if (next && smTokenState.ephemeral) {
        setSmRememberToken(false);
        setSmApiError("Para recordar este token en el equipo, vuelve a pegarlo y marca la casilla antes de usarlo.");
      } else if (!next && smTokenState.has_token) {
        applySmTokenState(await apiXlsformEditorSmTokenClear());
      }
    } catch {
      // ignore
    }
  }
  async function handleForgetToken() {
    setSmToken("");
    setSmTokenState(EMPTY_SM_TOKEN_STATE);
    setSmTokenStatus(null);
    setSmSurveyList(null);
    setSmSurveyMeta(null);
    setSmApiSuccess(null);
    setSmApiError(null);
    try {
      applySmTokenState(await apiXlsformEditorSmTokenClear());
    } catch {
      // ignore
    }
  }
  async function verifyToken() {
    if (!(await ensureSmTokenReady("Necesitas el token de la API para probar la conexión."))) return;
    setSmTokenStatus(null);
    try {
      const info = await apiXlsformEditorSmCheckToken();
      setSmTokenStatus(info);
    } catch (e) {
      setSmTokenStatus({ ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  async function listSurveysFromSm(forceRefresh = false) {
    if (!(await ensureSmTokenReady("Necesitas el token de la API para listar tus surveys."))) return;
    setSmListing(true);
    setSmApiError(null);
    setSmApiSuccess(null);
    try {
      const result = await apiXlsformEditorSmListSurveys(500, 6, { forceRefresh });
      setSmSurveyList(result.surveys);
      setSmSurveyMeta({
        totalRecent: result.total_recent,
        months: result.months,
        fromCache: result.from_cache,
        cacheStatus: result.cache_status,
        fetchedAt: result.catalog_fetched_at,
      });
      if (result.surveys.length === 0) {
        setSmApiError(`No encontré encuestas modificadas en los últimos ${result.months} meses.`);
      } else if (result.refresh_error && result.from_cache) {
        setSmApiError(`SurveyMonkey no respondió ahora; estoy usando el catálogo local. ${result.refresh_error}`);
      }
    } catch (e) {
      setSmApiError(String((e as Error)?.message ?? e));
    } finally {
      setSmListing(false);
    }
  }

  async function fetchFromSmApi() {
    if (!smSurveyId.trim()) {
      setSmApiError("Necesitas el Survey ID de la encuesta.");
      return;
    }
    if (!(await ensureSmTokenReady("Necesitas el token de la API para conectar la encuesta."))) return;
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
      setChoiceCodeMaps([]);
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
  const overrideCount = Object.keys(choiceOrderOverrides).length;

  function openReview() {
    if (visualPending) {
      setError("Confirma o descarta la lógica visual pendiente antes de revisar la importación final.");
      return;
    }
    setReviewChecked(false);
    setReviewOpen(true);
  }

  async function handleApply() {
    if (!smFetchedSurveyId) {
      setError("Conecta SurveyMonkey antes de importar. El XLSForm se crea solo desde la API.");
      return;
    }
    if (!(await ensureSmTokenReady("Necesitas el token de la API para importar desde SurveyMonkey."))) {
      setError("Conecta SurveyMonkey antes de importar. El backend necesita un token guardado para esta sesión.");
      return;
    }
    if (visualPending) {
      setError("Hay lógica visual pendiente de confirmar. Confírmala o descártala antes de importar.");
      setReviewOpen(false);
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
        { survey_id: smFetchedSurveyId },
        choiceOrderOverrides,
        choiceCodeMaps,
      );
      onComplete({
        ...result,
        surveyMonkeyRules: wizardRules,
        surveyMonkeyVisualRules: visualRules,
        surveyMonkeyChoiceOverrides: choiceOrderOverrides,
        surveyMonkeyChoiceCodeMaps: choiceCodeMaps,
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
        // Modal full-screen: debe ir por encima del chrome del módulo
        // (`.pulso-page-frame-toolbar` es z-index 1000). Con 200 el toolbar
        // se colaba. Mismo criterio que el overlay del mapa / ContextLens.
        zIndex: 1400,
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

        <div style={{ padding: 20, overflowY: "auto", flex: 1, minHeight: "var(--pulso-operational-min-dialog-body, 240px)", fontSize: 14 }}>
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
                tokenState={smTokenState}
                connectedSurveyId={smFetchedSurveyId}
                fetching={smFetching}
                listing={smListing}
                successMessage={smApiSuccess}
                errorMessage={smApiError}
                surveyList={smSurveyList}
                surveyMeta={smSurveyMeta}
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
                      <IconConditionalLogic size={12} /> {totalLogicCount} salto{totalLogicCount === 1 ? "" : "s"}
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
                  onVisualPendingChange={setVisualPending}
                  overrides={choiceOrderOverrides}
                  choiceCodeMaps={choiceCodeMaps}
                  onOverridesChange={(nextOverrides, nextMaps) => {
                    setChoiceOrderOverrides(nextOverrides);
                    if (nextMaps) setChoiceCodeMaps(nextMaps);
                  }}
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
              onClick={openReview}
              disabled={submitting || loading || !smFetchedSurveyId || visualPending}
              style={{
                background: smFetchedSurveyId && !visualPending ? "var(--pulso-accent, #2563eb)" : "#cbd5e1",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: submitting || loading || !smFetchedSurveyId || visualPending ? "not-allowed" : "pointer",
                opacity: submitting || loading || !smFetchedSurveyId || visualPending ? 0.65 : 1,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {submitting ? "Importando…" : "Revisar importación"}
            </button>
          </div>
        </footer>

        {reviewOpen ? (
          <FinalImportReviewModal
            surveyId={smFetchedSurveyId ?? ""}
            sectionCount={pages.length}
            questionCount={apiQuestions.length}
            visualRuleCount={visualActionCount}
            advancedRuleCount={wizardRules.length}
            overrideCount={overrideCount}
            checked={reviewChecked}
            submitting={submitting}
            onCheckedChange={setReviewChecked}
            onCancel={() => {
              if (submitting) return;
              setReviewOpen(false);
            }}
            onConfirm={handleApply}
          />
        ) : null}
      </div>
    </div>
  );
}

function FinalImportReviewModal({
  surveyId,
  sectionCount,
  questionCount,
  visualRuleCount,
  advancedRuleCount,
  overrideCount,
  checked,
  submitting,
  onCheckedChange,
  onCancel,
  onConfirm,
}: {
  surveyId: string;
  sectionCount: number;
  questionCount: number;
  visualRuleCount: number;
  advancedRuleCount: number;
  overrideCount: number;
  checked: boolean;
  submitting: boolean;
  onCheckedChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const totalRules = visualRuleCount + advancedRuleCount;
  const rows = [
    ["Encuesta", surveyId || "Sin Survey ID"],
    ["Secciones", String(sectionCount)],
    ["Preguntas", String(questionCount)],
    ["Reglas", `${totalRules} (${visualRuleCount} visuales, ${advancedRuleCount} avanzadas)`],
    ["Overrides", String(overrideCount)],
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sm-final-review-title"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 4,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 12,
          background: "white",
          boxShadow: "var(--pulso-shadow-high)",
          border: "1px solid var(--pulso-border, #e5e7eb)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--pulso-border, #e5e7eb)", background: "#f8fafc" }}>
          <h3 id="sm-final-review-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
            Revisión final
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            Al importar se crearán secciones, preguntas, opciones, validaciones y reglas en el XLSForm actual.
          </p>
        </div>
        <div style={{ padding: 18, display: "grid", gap: 14, maxHeight: "min(520px, calc(100dvh - 180px))", minHeight: "var(--pulso-operational-min-dialog-body, 240px)", overflowY: "auto" }}>
          <div style={{ display: "grid", gap: 7 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 10, fontSize: 13 }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>{label}</span>
                <strong style={{ color: "#0f172a", overflowWrap: "anywhere" }}>{value}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, padding: 12, border: "1px solid #fde68a", borderRadius: 8, background: "#fffbeb", color: "#92400e", fontSize: 12, lineHeight: 1.45 }}>
            <AlertTriangle size={16} style={{ flex: "0 0 auto", marginTop: 1 }} />
            <span>Revisa bien la lógica antes de continuar. Estos cambios se aplican juntos al formulario y, si están mal, obligan a rehacer pasos avanzados.</span>
          </div>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
            <input
              type="checkbox"
              checked={checked}
              disabled={submitting}
              onChange={(event) => onCheckedChange(event.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>Confirmo que revisé páginas, preguntas y lógica de ramificación antes de aplicar la importación.</span>
          </label>
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--pulso-border, #e5e7eb)", display: "flex", justifyContent: "flex-end", gap: 10, background: "#f9fafb" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{ border: "1px solid var(--pulso-border, #e5e7eb)", background: "white", borderRadius: 6, padding: "8px 12px", cursor: submitting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}
          >
            Volver a revisar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!checked || submitting}
            style={{ border: "none", background: checked ? "#16a34a" : "#cbd5e1", color: "white", borderRadius: 6, padding: "8px 14px", cursor: checked && !submitting ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 800 }}
          >
            {submitting ? "Importando..." : "Aplicar importación"}
          </button>
        </div>
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
      icon: <IconConditionalLogic size={13} />,
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
  tokenState,
  connectedSurveyId,
  fetching,
  listing,
  successMessage,
  errorMessage,
  surveyList,
  surveyMeta,
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
  tokenState: SurveyMonkeyTokenState;
  connectedSurveyId: string | null;
  fetching: boolean;
  listing: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  surveyList: SurveyMonkeyListItem[] | null;
  surveyMeta: {
    totalRecent: number;
    months: number;
    fromCache: boolean;
    cacheStatus: string;
    fetchedAt: string | null;
  } | null;
  tokenStatus: SurveyMonkeyTokenInfo | null;
  rememberToken: boolean;
  onSurveyIdChange: (s: string) => void;
  onTokenChange: (s: string) => void;
  onTokenBlur: () => void;
  onRememberToggle: (b: boolean) => void;
  onVerifyToken: () => void;
  onForgetToken: () => void;
  onFetch: () => void;
  onList: (forceRefresh?: boolean) => void;
}) {
  const tokenUi = surveyMonkeyTokenUiState(tokenState, token);
  const [expanded, setExpanded] = useState(true);
  const [surveyQuery, setSurveyQuery] = useState("");
  const isReady = Boolean(successMessage && connectedSurveyId);
  const visibleSurveys = useMemo(
    () => (surveyList ?? []).filter((item) => smSurveyMatchesQuery(item, surveyQuery)),
    [surveyList, surveyQuery],
  );
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
            placeholder={tokenState.has_token ? "Token guardado en backend" : "Token de SurveyMonkey"}
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
            disabled={!tokenUi.hasUsableToken || fetching || listing}
            title="Comprueba que Prosecnur puede leer tus encuestas"
            style={{
              background: "transparent",
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: !tokenUi.hasUsableToken ? "not-allowed" : "pointer",
              opacity: !tokenUi.hasUsableToken ? 0.6 : 1,
            }}
          >
            Probar conexión
          </button>
          <button
            type="button"
            onClick={() => onList(false)}
            disabled={listing || fetching || !tokenUi.hasUsableToken}
            title="Muestra tus encuestas recientes para elegir una sin copiar IDs"
            style={{
              background: "transparent",
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: listing || fetching || !tokenUi.hasUsableToken ? "not-allowed" : "pointer",
              opacity: listing || fetching || !tokenUi.hasUsableToken ? 0.6 : 1,
            }}
          >
            {listing ? "Buscando…" : "Buscar mis encuestas"}
          </button>
          {surveyList && surveyList.length > 0 ? (
            <button
              type="button"
              onClick={() => onList(true)}
              disabled={listing || fetching || !tokenUi.hasUsableToken}
              title="Vuelve a consultar SurveyMonkey y reemplaza el catálogo local"
              style={{
                background: "transparent",
                border: "1px solid var(--pulso-border, #e5e7eb)",
                borderRadius: 4,
                padding: "6px 12px",
                fontSize: 12,
                cursor: listing || fetching || !tokenUi.hasUsableToken ? "not-allowed" : "pointer",
                opacity: listing || fetching || !tokenUi.hasUsableToken ? 0.6 : 1,
              }}
            >
              Actualizar lista
            </button>
          ) : null}
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
        {tokenUi.hasUsableToken ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
            <span>
              Token activo <code style={{ fontFamily: "ui-monospace, monospace", background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>{tokenUi.displayMask}</code>
              {tokenUi.storageLabel ? ` · ${tokenUi.storageLabel}` : ""}
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
              title="Borra el token guardado en backend para esta sesión y el archivo cifrado local"
            >
              Quitar
            </button>
          </div>
        ) : null}

        {surveyList && surveyList.length > 0 ? (
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <div className="pulso-sm-survey-picker">
              <label className="pulso-sm-search">
                <Search size={14} />
                <input
                  value={surveyQuery}
                  onChange={(e) => setSurveyQuery(e.target.value)}
                  placeholder="Filtrar por nombre o ID"
                  disabled={fetching}
                />
              </label>
              <div className="pulso-sm-list-caption" style={{ justifySelf: "end", marginTop: 0 }}>
                {visibleSurveys.length} de {surveyMeta?.totalRecent ?? surveyList.length} encuestas modificadas en los últimos {surveyMeta?.months ?? 6} meses
                {surveyMeta?.fromCache ? " · catálogo local" : surveyMeta ? " · actualizado" : ""}
              </div>
            </div>
            <div className="pulso-sm-survey-list" aria-label="Encuestas SurveyMonkey">
              {visibleSurveys.map((item) => {
                const selected = item.id === surveyId.trim();
                const title = smSurveyTitle(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pulso-sm-survey-card${selected ? " is-selected" : ""}`}
                    onClick={() => onSurveyIdChange(item.id)}
                    disabled={fetching}
                    title={title}
                    aria-pressed={selected}
                  >
                    <span>
                      <strong>{title}</strong>
                      <small>{item.id}{item.date_modified ? ` · ${item.date_modified.slice(0, 10)}` : ""}</small>
                    </span>
                    <em>{selected ? "Seleccionada" : "Seleccionar"}</em>
                  </button>
                );
              })}
              {!visibleSurveys.length && (
                <div className="pulso-sm-empty">No hay coincidencias con el filtro actual.</div>
              )}
            </div>
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
            disabled={fetching || !surveyId.trim() || !tokenUi.hasUsableToken}
            style={{
              background: "var(--pulso-accent, #2563eb)",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: fetching || !surveyId.trim() || !tokenUi.hasUsableToken ? "not-allowed" : "pointer",
              opacity: fetching || !surveyId.trim() || !tokenUi.hasUsableToken ? 0.6 : 1,
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
                    {shouldShowManualPageQuestionsInput(p) ? (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: "block", marginBottom: 3, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
                        Preguntas SM para lógica de página (manual avanzado)
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
                    ) : null}
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
