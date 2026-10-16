import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "../../../vendor/lucide-react";
import { IconConditionalLogic } from "../../../lib/icons";
import {
  apiXlsformEditorImportSurveyMonkeyWithLogic,
  type ChoiceCodeMap,
} from "../../../api/xlsformEditor";
import {
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
  type SurveyMonkeyDefinition,
  type XlsformFueraDelFormularioItem,
  type SurveyMonkeyVisualLogicRule,
  type EditorPayloadWithHallazgos,
} from "../../../api/multiIntegrado";
import type { SmSugerenciaLogica } from "../../../api/xlsformSmSugerencias";
import { compileVisualLogicRules, RuleWizard } from "./RuleWizard";
import { apiCampanaSugerir, type CampanaSugerencia } from "../../../api/xlsformCampanas";
import { CampanaComplementariaPanel } from "./CampanaComplementariaPanel";
import { textoCobertura } from "./campanaComplementariaModel";
import { leerIdEncuesta } from "./surveyMonkeySurveySearch";
import {
  apiInfoToQuestions,
  newPageId,
  pageLabelsToRecord,
  pagesToRecord,
  totalCamposFormulario,
  visualPagesFromEntries,
  visualQuestionsFromPages,
  type PageEntry,
} from "./smImportPages";
import { EMPTY_SM_TOKEN_STATE, surveyMonkeyTokenUiState } from "./smTokenUi";
import {
  aplicarSugerenciaFinDeEncuesta,
  estadoConexionSm,
  sugerenciaYaAplicada,
} from "./smImportModel";
import { FinalImportReviewModal } from "./SmImportResumen";
import { SmImportFlowSummary } from "./SmImportFlowSummary";
import { SmConexionSection, type SmEncuestaCargada } from "./SmConexionSection";
import { SmPageMapEditor } from "./SmPageMapEditor";
import { SmLogicaSugerencias } from "./SmLogicaSugerencias";
import { useSmSugerenciasLogica } from "./useSmSugerenciasLogica";
import type { SmSurveyMeta } from "./SmSurveyPicker";
import "../styles/xf-surveymonkey-dialog.css";
import "../styles/xfSmImport";

// Modal de importación SurveyMonkey. El flujo usa sólo la API:
//   1. Conecta el token y elige la encuesta.
//   2. Prosecnur trae páginas, preguntas, opciones, obligatoriedad y validaciones.
//   3. La API no trae los saltos: se agregan en la lógica visual (o se aplica
//      la sugerencia del consentimiento) y se revisa el resumen antes de crear.

// Compatibilidad: estos nombres se importaban desde aquí.
export { FinalImportReviewModal } from "./SmImportResumen";
export { surveyMonkeyTokenUiState } from "./smTokenUi";
export {
  shouldShowManualPageQuestionsInput,
  visualPagesFromEntries,
  visualQuestionsFromPages,
} from "./smImportPages";

/** Sugerencia de campaña (ADR 0101): aviso o declaración ya en curso. */
type EstadoCampanaSugerida = {
  surveyId: string;
  sugerencia: CampanaSugerencia;
  declarando: boolean;
};

export function ImportSurveyMonkeyDialog({
  fileId,
  onCancel,
  onComplete,
  onCampaignDeclared,
}: {
  fileId?: string | null;
  fileName: string;
  onCancel: () => void;
  /**
   * La encuesta se declaró como campaña de un formulario existente en vez de
   * importarse (ADR 0101). Sin él, el diálogo no ofrece esa salida.
   */
  onCampaignDeclared?: (declarada: { formId: string; formName: string }) => void;
  onComplete: (payload: EditorPayloadWithHallazgos & {
    surveyMonkeyRules?: import("./RuleWizard").ConfirmedRule[];
    surveyMonkeyVisualRules?: SurveyMonkeyVisualLogicRule[];
    surveyMonkeyChoiceOverrides?: Record<string, string[]>;
    surveyMonkeyChoiceCodeMaps?: ChoiceCodeMap[];
  }) => void;
}) {
  const [apiQuestions, setApiQuestions] = useState<SurveyMonkeyQuestion[]>([]);
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
  const [smEncuestaCargada, setSmEncuestaCargada] = useState<SmEncuestaCargada | null>(null);
  const [smApiError, setSmApiError] = useState<string | null>(null);
  const [smFetchedSurveyId, setSmFetchedSurveyId] = useState<string | null>(null);
  const [smDefinition, setSmDefinition] = useState<SurveyMonkeyDefinition | null>(null);
  const [smFueraDelFormulario, setSmFueraDelFormulario] = useState<XlsformFueraDelFormularioItem[]>([]);
  const [smSurveyList, setSmSurveyList] = useState<SurveyMonkeyListItem[] | null>(null);
  const [smSurveyMeta, setSmSurveyMeta] = useState<SmSurveyMeta | null>(null);
  const [smListing, setSmListing] = useState(false);
  const [smTokenStatus, setSmTokenStatus] = useState<SurveyMonkeyTokenInfo | null>(null);
  const [smProbando, setSmProbando] = useState(false);
  const [smRememberToken, setSmRememberToken] = useState<boolean>(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [visualPending, setVisualPending] = useState(false);
  const [campanaSugerida, setCampanaSugerida] = useState<EstadoCampanaSugerida | null>(null);
  // Sólo la última encuesta conectada puede sugerir: una respuesta tardía de
  // otra encuesta no debe aparecer sobre la actual.
  const sugerenciaPedidaRef = useRef<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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
          // Auto-verificar contra GET /users/me: el chip «Conexión» dice el
          // estado real desde que abre el diálogo (U4).
          setSmProbando(true);
          try {
            const info = await apiXlsformEditorSmCheckToken();
            if (!cancelled) setSmTokenStatus(info);
          } catch (e) {
            if (!cancelled) setSmTokenStatus({ ok: false, error: String((e as Error)?.message ?? e) });
          } finally {
            if (!cancelled) setSmProbando(false);
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
    setSmDefinition(null);
    setSmFueraDelFormulario([]);
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
    setSmEncuestaCargada(null);
    setSmApiError(null);
    setSmFetchedSurveyId(null);
    setSmDefinition(null);
    setSmFueraDelFormulario([]);
    try {
      applySmTokenState(await apiXlsformEditorSmTokenClear());
    } catch {
      // ignore
    }
  }
  async function verifyToken() {
    if (!(await ensureSmTokenReady("Necesitas el token de la API para probar la conexión."))) return;
    setSmTokenStatus(null);
    setSmProbando(true);
    try {
      const info = await apiXlsformEditorSmCheckToken();
      setSmTokenStatus(info);
    } catch (e) {
      setSmTokenStatus({ ok: false, error: String((e as Error)?.message ?? e) });
    } finally {
      setSmProbando(false);
    }
  }

  // Se activó otro perfil guardado desde el aviso de conexión (U2): se relee
  // el token activo y se vuelve a probar en el mismo lugar.
  async function handlePerfilActivado() {
    setSmApiError(null);
    setSmToken("");
    try {
      applySmTokenState(await apiXlsformEditorSmTokenLoad());
    } catch {
      // La prueba de abajo dirá si quedó usable.
    }
    await verifyToken();
  }

  async function listSurveysFromSm(forceRefresh = false) {
    if (!(await ensureSmTokenReady("Pega el token de SurveyMonkey para buscar tus encuestas."))) return;
    setSmListing(true);
    setSmApiError(null);
    setSmEncuestaCargada(null);
    try {
      const result = await apiXlsformEditorSmListSurveys(500, 6, { forceRefresh });
      setSmSurveyList(result.surveys);
      setSmSurveyMeta({
        totalRecent: result.total_recent,
        months: result.months,
        fromCache: result.from_cache,
      });
      if (result.surveys.length === 0) {
        setSmApiError(`No encontré encuestas modificadas en los últimos ${result.months} meses.`);
      } else if (result.refresh_error && result.from_cache) {
        setSmApiError("SurveyMonkey no respondió ahora: muestro la lista guardada en este equipo.");
      }
    } catch (e) {
      setSmApiError(String((e as Error)?.message ?? e));
    } finally {
      setSmListing(false);
    }
  }

  async function fetchFromSmApi() {
    if (!smSurveyId.trim()) {
      setSmApiError("Elige una encuesta o pega su enlace o ID.");
      return;
    }
    if (!(await ensureSmTokenReady("Pega el token de SurveyMonkey para cargar la encuesta."))) return;
    // Tolerancia: si el usuario pega una URL completa de SurveyMonkey,
    // intentamos extraer el ID numérico. Acepta /analyze/123456789,
    // /design/123456789, /summary/123456789, etc.
    const leido = leerIdEncuesta(smSurveyId);
    const cleanedId = leido.ok ? leido.id : "";
    if (leido.ok && cleanedId !== smSurveyId.trim()) {
      setSmSurveyId(cleanedId);
    } else if (!leido.ok) {
      setSmApiError(
        "Ese enlace no trae el ID de la encuesta. Abre la encuesta en SurveyMonkey (Diseñar o Analizar) y copia el enlace desde ahí, o pega el número de 9 a 10 dígitos.",
      );
      return;
    }
    setSmFetching(true);
    setSmApiError(null);
    setSmEncuestaCargada(null);
    setSmFetchedSurveyId(null);
    setSmDefinition(null);
    setSmFueraDelFormulario([]);
    setCampanaSugerida(null);
    sugerenciaPedidaRef.current = null;
    try {
      const info = await apiXlsformEditorSmFetchSurveyInfo(
        fileId ?? null,
        cleanedId,
      );
      // Reemplaza el mapeo de páginas con el de la API, conservando títulos
      // legibles para que el usuario no tenga que leer solo Q0013-Q0014.
      const newPages: PageEntry[] = info.pages.length > 0
        ? info.pages.map((p) => ({
            id: newPageId(),
            pageId: p.page_id,
            title: p.title ?? undefined,
            label: p.label,
            rangeLabel: p.range_label,
            notes: p.notes,
            questionDetails: p.question_details,
            questions: p.questions,
          }))
        : Object.entries(info.paginas).map(
            ([pageId, qs]) => ({ id: newPageId(), pageId, questions: qs }),
          );
      newPages.sort((a, b) => Number(a.pageId) - Number(b.pageId));
      setPages(newPages);
      setApiQuestions(apiInfoToQuestions(newPages));
      setVisualRules([]);
      setChoiceCodeMaps([]);
      setSmFetchedSurveyId(cleanedId);
      setSmDefinition(info.definition);
      setSmFueraDelFormulario(info.fuera_del_formulario);
      setSmEncuestaCargada({
        titulo: info.summary.title?.trim() || "Encuesta de SurveyMonkey",
        secciones: info.summary.n_paginas,
        preguntas: info.summary.n_preguntas,
        campos: totalCamposFormulario(newPages),
        obligatorias: info.summary.n_required,
        validaciones: info.summary.n_validation,
      });
      if (onCampaignDeclared) void consultarCampanaSugerida(cleanedId);
    } catch (e) {
      setSmApiError(String((e as Error)?.message ?? e));
    } finally {
      setSmFetching(false);
    }
  }

  // ¿La encuesta es una campaña de un formulario que ya existe? Un fallo aquí
  // no bloquea la importación: sin respuesta, el flujo sigue como siempre.
  async function consultarCampanaSugerida(surveyId: string) {
    sugerenciaPedidaRef.current = surveyId;
    try {
      const sugerencia = await apiCampanaSugerir(surveyId);
      if (sugerencia && sugerenciaPedidaRef.current === surveyId) {
        setCampanaSugerida({ surveyId, sugerencia, declarando: false });
      }
    } catch {
      // Sin sugerencia: se importa como formulario nuevo.
    }
  }

  const requestClose = useCallback(() => {
    const hasProgress = Boolean(
      smFetchedSurveyId
      || smSurveyId.trim()
      || pages.length > 0
      || wizardRules.length > 0
      || visualRules.length > 0,
    );
    if (!hasProgress || window.confirm("¿Cerrar y descartar lo configurado?")) {
      onCancel();
    }
  }, [onCancel, pages.length, smFetchedSurveyId, smSurveyId, visualRules.length, wizardRules.length]);

  // Un único sheet modal: Escape, Cancelar y la X pasan por la misma
  // protección de descarte. El foco se limita al sheet y vuelve al disparador.
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [requestClose]);

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
    if (!smDefinition?.sha256 || !smDefinition.translation_profile) {
      setError("No se pudo identificar la versión de la encuesta que revisaste. Vuelve a cargarla antes de crear el borrador.");
      return;
    }
    setError(null);
    setReviewChecked(false);
    setReviewOpen(true);
  }

  async function handleApply() {
    if (!smFetchedSurveyId) {
      setError("Carga la encuesta de SurveyMonkey antes de crear el borrador.");
      return;
    }
    if (!(await ensureSmTokenReady("Pega el token de SurveyMonkey para crear el borrador."))) {
      setError("Falta el token de SurveyMonkey para esta sesión: pégalo arriba y vuelve a intentar.");
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
        {
          survey_id: smFetchedSurveyId,
          expected_definition_sha256: smDefinition?.sha256,
          expected_translation_profile: smDefinition?.translation_profile,
        },
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
    setPages((p) => [...p, { id: newPageId(), pageId: "", questions: [] }]);
  }
  function removePage(id: string) {
    setPages((p) => p.filter((x) => x.id !== id));
  }
  function updatePage(id: string, patch: Partial<PageEntry>) {
    setPages((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  const visualQuestions = useMemo(() => visualQuestionsFromPages(pages), [pages]);
  const visualPages = useMemo(() => visualPagesFromEntries(pages), [pages]);
  const fieldCount = useMemo(() => totalCamposFormulario(pages), [pages]);
  const sugerencias = useSmSugerenciasLogica(smFetchedSurveyId);
  const sugerenciasPendientes = sugerencias.pendientes.filter(
    (s) => !sugerenciaYaAplicada(visualRules, visualQuestions, s),
  ).length;
  const conexion = estadoConexionSm({
    hasUsableToken: surveyMonkeyTokenUiState(smTokenState, smToken).hasUsableToken,
    tokenStatus: smTokenStatus,
    encuestaConectada: Boolean(smFetchedSurveyId),
    probando: smProbando,
  });
  const puedeRevisar = Boolean(smFetchedSurveyId) && !visualPending && !submitting;

  // «Aplicar» escribe en la misma lista de reglas visuales que edita la
  // ventana de lógica: la regla aparece ahí como si el analista la hubiera
  // marcado («Fin de encuesta» en las opciones que cortan) y se puede cambiar.
  function aplicarSugerencia(sugerencia: SmSugerenciaLogica): string | null {
    if (visualPending) {
      return "Confirma o descarta los cambios pendientes de la lógica visual antes de aplicarla.";
    }
    const resultado = aplicarSugerenciaFinDeEncuesta(visualRules, visualQuestions, sugerencia, newPageId);
    if (!resultado.ok) return resultado.motivo;
    setVisualRules(resultado.rules);
    return null;
  }

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sm-import-title"
      className="pulso-xf-smi-capa"
      // Modal a pantalla completa: cubre también el chrome global del editor.
      // Los menús del editor llegan a la capa 2300; este diálogo comparte esa
      // capa y, al montarse después, queda como superficie activa.
      style={{ zIndex: 2300 }}
    >
      {/* Sin cierre al hacer clic fuera: un clic accidental no debe tirar el
          progreso. Se cierra con la X, Cancelar o Escape. */}
      <div ref={sheetRef} className="pulso-xf-smi-hoja">
        <header className="pulso-xf-smi-cabecera">
          <div>
            <h2 id="sm-import-title">Traducir encuesta de SurveyMonkey</h2>
            <p>Crea un borrador editable a partir de la definición original de la encuesta.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="pulso-xf-smi-icono"
            onClick={requestClose}
            aria-label="Cerrar importación de SurveyMonkey"
          >
            <X size={20} aria-hidden />
          </button>
        </header>

        {/* Único dueño del scroll del diálogo: ninguna sección interna se
            desplaza por su cuenta. */}
        <div className="pulso-xf-smi-cuerpo" data-qa-scroll-owner="dialog">
          {error ? (
            <div className="pulso-xf-smi-error" role="alert">{error}</div>
          ) : null}
          {campanaSugerida?.declarando ? (
            <CampanaComplementariaPanel
              formId={campanaSugerida.sugerencia.form_id}
              formName={campanaSugerida.sugerencia.form_name}
              encuestaPrincipal={campanaSugerida.sugerencia.survey_id_principal || null}
              campanasDeclaradas={[]}
              surveyIdInicial={campanaSugerida.surveyId}
              elegirEncuesta={false}
              cancelarLabel="Volver a la importación"
              onCancelar={() => setCampanaSugerida({ ...campanaSugerida, declarando: false })}
              onDeclarada={() => onCampaignDeclared?.({
                formId: campanaSugerida.sugerencia.form_id,
                formName: campanaSugerida.sugerencia.form_name,
              })}
            />
          ) : reviewOpen ? (
            <FinalImportReviewModal
              surveyId={smFetchedSurveyId ?? ""}
              surveyTitle={smEncuestaCargada?.titulo}
              sectionCount={pages.length}
              questionCount={apiQuestions.length}
              fieldCount={fieldCount}
              visualRuleCount={visualActionCount}
              advancedRuleCount={wizardRules.length}
              overrideCount={overrideCount}
              pendingSuggestionCount={sugerenciasPendientes}
              fueraDelFormulario={smFueraDelFormulario}
              definitionSha256={smDefinition?.sha256}
              translationProfile={smDefinition?.translation_profile}
              checked={reviewChecked}
              submitting={submitting}
              onCheckedChange={setReviewChecked}
              onCancel={() => {
                if (submitting) return;
                setError(null);
                setReviewOpen(false);
              }}
              onConfirm={handleApply}
            />
          ) : (
            <>
              {campanaSugerida ? (
                <CampanaSugeridaAviso
                  sugerencia={campanaSugerida.sugerencia}
                  onDeclarar={() => setCampanaSugerida({ ...campanaSugerida, declarando: true })}
                  onImportarNuevo={() => setCampanaSugerida(null)}
                />
              ) : null}
              <SmImportFlowSummary
                conexion={conexion}
                sectionCount={pages.length}
                questionCount={apiQuestions.length}
                fieldCount={fieldCount}
                ruleCount={totalLogicCount}
                encuestaCargada={Boolean(smFetchedSurveyId)}
              />

              <SmConexionSection
                surveyId={smSurveyId}
                token={smToken}
                tokenState={smTokenState}
                connectedSurveyId={smFetchedSurveyId}
                fetching={smFetching}
                listing={smListing}
                probando={smProbando}
                encuestaCargada={smEncuestaCargada}
                errorMessage={smApiError}
                surveyList={smSurveyList}
                surveyMeta={smSurveyMeta}
                tokenStatus={smTokenStatus}
                rememberToken={smRememberToken}
                onSurveyIdChange={(next) => {
                  setSmSurveyId(next);
                  setSmFetchedSurveyId(null);
                  setSmDefinition(null);
    setSmFueraDelFormulario([]);
                  setSmEncuestaCargada(null);
                  setCampanaSugerida(null);
                  sugerenciaPedidaRef.current = null;
                }}
                onTokenChange={handleTokenChange}
                onTokenBlur={handleTokenBlur}
                onRememberToggle={handleRememberToggle}
                onVerifyToken={verifyToken}
                onForgetToken={handleForgetToken}
                onFetch={fetchFromSmApi}
                onList={listSurveysFromSm}
                onPerfilActivado={handlePerfilActivado}
              />

              <SmPageMapEditor pages={pages} onAdd={addPage} onRemove={removePage} onUpdate={updatePage} />

              <section className="pulso-xf-smi-bloque" aria-labelledby="sm-logica-titulo">
                <header className="pulso-xf-smi-bloque-cabecera">
                  <div>
                    <h3 id="sm-logica-titulo">Lógica SurveyMonkey</h3>
                    <p>Marca los saltos como en la pestaña Lógica, o pega reglas de ramificación para traducirlas.</p>
                  </div>
                  <span className={`pulso-xf-smi-sello${totalLogicCount > 0 ? " is-lista" : ""}`}>
                    <IconConditionalLogic size={12} aria-hidden />
                    {totalLogicCount > 0 ? `${totalLogicCount} ${totalLogicCount === 1 ? "salto" : "saltos"}` : "Sin saltos"}
                  </span>
                </header>
                {smFetchedSurveyId ? (
                  <SmLogicaSugerencias
                    estado={sugerencias.estado}
                    saltos={totalLogicCount}
                    questions={visualQuestions}
                    visualRules={visualRules}
                    visualPending={visualPending}
                    descartadas={sugerencias.descartadas}
                    onAplicar={aplicarSugerencia}
                    onDescartar={sugerencias.descartar}
                  />
                ) : (
                  <p className="pulso-xf-smi-nota">
                    Carga la encuesta primero: así la lógica reconoce sus secciones, preguntas y opciones.
                  </p>
                )}
                {/* Sin encuesta, la lógica sólo mostraría controles
                    deshabilitados: basta la línea de arriba. */}
                {smFetchedSurveyId ? <RuleWizard
                  surveyId={smFetchedSurveyId}
                  paginas={pagesToRecord(pages)}
                  paginasLabels={pageLabelsToRecord(pages)}
                  confirmed={wizardRules}
                  visualRules={visualRules}
                  visualQuestions={visualQuestions}
                  visualPages={visualPages}
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
                /> : null}
              </section>
            </>
          )}
        </div>

        {!reviewOpen && !campanaSugerida?.declarando ? (
          <footer className="pulso-xf-smi-pie">
            <button type="button" onClick={requestClose} disabled={submitting}>
              Cancelar
            </button>
            {visualPending ? (
              <span className="pulso-xf-smi-pie-nota">Confirma o descarta la lógica visual pendiente.</span>
            ) : null}
            <button
              type="button"
              className="pulso-primary"
              onClick={openReview}
              disabled={!puedeRevisar}
            >
              {submitting ? "Preparando…" : "Revisar borrador"}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );

  // El PageFrame y la barra global crean contextos de apilado propios. El
  // portal evita que el diálogo quede recortado o por debajo de ese chrome.
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}

export function CampanaSugeridaAviso({
  sugerencia,
  onDeclarar,
  onImportarNuevo,
}: {
  sugerencia: CampanaSugerencia;
  onDeclarar: () => void;
  onImportarNuevo: () => void;
}) {
  const cobertura = textoCobertura(sugerencia.cobertura, sugerencia.cobertura_texto)
    || `${sugerencia.n_emparejadas} de ${sugerencia.n_preguntas_base}`;
  return (
    <section className="pulso-xf-campana-sugerencia" role="region" aria-label="Posible campaña complementaria">
      <p>
        <strong>
          Esta encuesta comparte el {cobertura} de las preguntas de «{sugerencia.form_name}». ¿Es una
          campaña de ese formulario?
        </strong>
      </p>
      <p>
        Si lo es, agrégala como campaña: no ocupa un espacio de formulario y sus respuestas se leen
        con las preguntas del instrumento que ya tienes.
      </p>
      <div className="pulso-xf-campana-sugerencia-acciones">
        <button type="button" className="pulso-primary" onClick={onDeclarar}>
          Agregar como campaña de {sugerencia.form_name}
        </button>
        <button type="button" onClick={onImportarNuevo}>
          Importar como formulario nuevo
        </button>
      </div>
    </section>
  );
}
