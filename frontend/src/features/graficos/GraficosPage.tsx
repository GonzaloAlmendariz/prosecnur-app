import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BarChart2, CheckCircle2, Database, FileSpreadsheet } from "lucide-react";
import {
  apiGraficosPpt,
  apiGraficosPptConsolidado,
  apiGraficosConsolidadoPreflight,
  apiGraficosWord,
  apiGraficosValidar,
  type GraficosConsolidadoPreflight,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { graficosBodyLoadingLabel, graficosBodyState } from "./graficosBodyState";
import { avisoDeclaracionAplicada, estadoDeclaracionAplicada } from "./declaracionAplicada";
import { getEquivalencias } from "../../api/equivalencias";
import { JobProgress } from "../../components/JobProgress";
import { PageFrame } from "../../components/PageFrame";
import { ChromeSlotPortal } from "../../app/ModuleChromeSlots";
import { ChromeBaseSelector } from "../../components/ChromeBaseSelector";
import { usePlanStore, type GraficosConfig } from "./store";
import { useGraficosAutosave } from "./useGraficosAutosave";
import { useGraficosShortcuts } from "./useGraficosShortcuts";
import { ShortcutsModal } from "./ShortcutsModal";
import { humanizeGraficosExportError, HumanizedError } from "./humanizeExportError";
import { GraficosHeader } from "./GraficosHeader";
import { EditorShell } from "./v2/shell/EditorShell";
import { useShortcutsV2 } from "./v2/shortcuts/useShortcutsV2";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { GraficosReportScopeProvider, parseGraficosReportScope } from "./reportScope";
import { shouldSeedSharedPlan } from "./sharedPlanSeed";
import {
  sharedReportPendingRequirements,
  type SharedReportPreflightStatus,
} from "./multibaseReportMenuModel";
import { GraficosLibrariesHost } from "./GraficosLibrariesHost";

type ExportResult = {
  ok: true; file_id: string; filename?: string; size: number; n_slides: number;
  /** Arreglos automáticos que el motor aplicó al renderizar. Ausente en
   *  backends viejos. Ver `.pulso_aviso()` en el motor. */
  avisos?: string[];
};
export default function GraficosPage() {
  const location = useLocation();
  const reportScope = parseGraficosReportScope(location.search);
  const isSharedReport = reportScope === "consolidated";
  const { state, refresh } = useSession();
  const plan = usePlanStore((s) => s.plan);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const hydrated = usePlanStore((s) => s.hydrated);
  const hydrationRetrying = usePlanStore((s) => s.hydrationRetrying);
  const equivalenciasRevision = usePlanStore((s) => s.equivalenciasRevision);
  // Declaración de ahora, para contrastarla con la que armó el mazo. Sólo se
  // pide cuando el plan salió de ahí: un proyecto que armó sus diapositivas a mano no
  // tiene por qué pagar la consulta ni ver el aviso.
  const [declaracionActual, setDeclaracionActual] = useState<{ revision: string; declarada: boolean } | null>(null);
  useEffect(() => {
    if (!equivalenciasRevision) { setDeclaracionActual(null); return; }
    let cancelado = false;
    void (async () => {
      try {
        const est = await getEquivalencias();
        if (!cancelado) setDeclaracionActual({ revision: est.revision ?? "", declarada: Boolean(est.declarada) });
      } catch {
        // Sin respuesta no se afirma nada: callar es preferible a avisar de un
        // desfase que no se pudo comprobar.
        if (!cancelado) setDeclaracionActual(null);
      }
    })();
    return () => { cancelado = true; };
  }, [equivalenciasRevision]);

  const avisoDeclaracion = declaracionActual
    ? avisoDeclaracionAplicada(estadoDeclaracionAplicada({
        revisionAplicada: equivalenciasRevision,
        revisionActual: declaracionActual.revision,
        declarada: declaracionActual.declarada,
      }))
    : "";

  // Autosave: hidrata al montar + guarda debounced 2s en cada cambio.
  const { saveConsolidatedNow, consolidatedDraftRevision, seedConsolidatedPlan } =
    useGraficosAutosave(reportScope);
  const dirty = usePlanStore((s) => s.dirty);
  // Atajos: Cmd/Ctrl+Z (undo), +Shift+Z (redo), +D (duplicar), ? (ayuda).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useGraficosShortcuts({ onOpenHelp: () => setShortcutsOpen(true) });
  // Atajos V2: J/K (nav), / (búsqueda), V/T (modo), 1-4 (tabs)
  useShortcutsV2();

  const [busyValidating, setBusyValidating] = useState("");
  const [error, setError] = useState<HumanizedError | null>(null);
  const [warns, setWarns] = useState<string[]>([]);
  const select = usePlanStore((s) => s.select);
  // Avisos del motor tras el último export. Se limpian al empezar otro.
  const [avisosDelMotor, setAvisosDelMotor] = useState<string[]>([]);
  const [pptFileId, setPptFileId] = useState<string | null>(null);
  const [docxFileId, setDocxFileId] = useState<string | null>(null);
  const [pptFilename, setPptFilename] = useState<string | null>(null);
  const [docxFilename, setDocxFilename] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<{ kind: "ppt" | "word"; id: string } | null>(null);
  const [sharedPreflight, setSharedPreflight] = useState<GraficosConsolidadoPreflight | null>(null);
  const [sharedPreflightStatus, setSharedPreflightStatus] = useState<SharedReportPreflightStatus>("idle");
  const [sharedPreflightError, setSharedPreflightError] = useState("");
  const seededRef = useRef(false);
  const [seededSlideCount, setSeededSlideCount] = useState(0);

  const prepOk = !!state?.analitica_prep_ok;
  // La precedencia vive en `graficosBodyState`, no aquí: el estado «todavía no
  // hidrató» es inalcanzable desde el navegador una vez hidratado, así que la
  // decisión se prueba como función pura.
  const bodyState = graficosBodyState({ hydrated, hydrationRetrying, isSharedReport, prepOk });
  const sharedReady = sharedPreflightStatus === "ready" && sharedPreflight?.ready === true;
  const canExport = (isSharedReport ? sharedReady : prepOk) && plan.slides.length > 0 && hydrated;
  const pendingSharedRequirements = sharedReportPendingRequirements(sharedPreflight);

  const loadSharedPreflight = useCallback(async () => {
    setSharedPreflightStatus("loading");
    setSharedPreflightError("");
    try {
      // includePlan: el editor siembra sus diapositivas con este mismo plan, así el
      // conteo que promete el menú del conjunto y lo que aparece en el lienzo
      // salen del único cálculo que ya se paga aquí.
      const result = await apiGraficosConsolidadoPreflight({ includePlan: true });
      setSharedPreflight(result);
      setSharedPreflightStatus(result.ready ? "ready" : "blocked");
      return result;
    } catch (cause) {
      setSharedPreflight(null);
      setSharedPreflightStatus("error");
      setSharedPreflightError(cause instanceof Error ? cause.message : "No se pudo comprobar el informe compartido.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isSharedReport) return;
    void loadSharedPreflight();
    const reload = () => { void loadSharedPreflight(); };
    window.addEventListener("pulso:session-changed", reload);
    return () => window.removeEventListener("pulso:session-changed", reload);
  }, [isSharedReport, loadSharedPreflight, state?.session_id]);
  // Siembra del informe compartido: si el borrador nunca se guardó y el plan
  // está vacío, el lienzo aterriza con las diapositivas que el preflight propuso en
  // vez del estado "Sin slides aún" que contradecía al menú del conjunto.
  useEffect(() => {
    const suggested = sharedPreflight?.plan;
    const suggestedSlides = Array.isArray(suggested?.slides) ? suggested.slides : [];
    if (!shouldSeedSharedPlan({
      scope: reportScope,
      hydrated,
      dirty,
      draftRevision: consolidatedDraftRevision,
      currentSlideCount: plan.slides.length,
      suggestedSlideCount: suggestedSlides.length,
      alreadySeeded: seededRef.current,
    })) return;
    seededRef.current = true;
    seedConsolidatedPlan(suggested as GraficosConfig["plan"]);
    setSeededSlideCount(suggestedSlides.length);
  }, [
    consolidatedDraftRevision, dirty, hydrated, plan.slides.length,
    reportScope, seedConsolidatedPlan, sharedPreflight,
  ]);

  // Una sesión nueva estrena su propio borrador: la semilla vuelve a estar
  // disponible.
  useEffect(() => {
    seededRef.current = false;
    setSeededSlideCount(0);
  }, [state?.session_id, reportScope]);

  useEffect(() => {
    function onActiveBaseChanged() {
      setPptFileId(null);
      setDocxFileId(null);
      setPptFilename(null);
      setDocxFilename(null);
      setError(null);
      setWarns([]);
    }
    window.addEventListener("pulso:active-base-changed", onActiveBaseChanged);
    return () => window.removeEventListener("pulso:active-base-changed", onActiveBaseChanged);
  }, [reportScope]);

  async function onExport(kind: "ppt" | "word") {
    if (isSharedReport && kind === "word") return;
    setError(null); setWarns([]); setBusyValidating(`validando ${kind}…`);
    try {
      if (isSharedReport) {
        const readiness = await loadSharedPreflight();
        if (!readiness?.ready) {
          setError({
            message: "El informe compartido todavía no está listo para exportarse.",
            hint: "Puedes seguir configurando sus diapositivas. Completa y aprueba cada base en Analítica, luego vuelve a comprobar.",
          });
          return;
        }
      }
      const v = await apiGraficosValidar(plan);
      setWarns(v.warnings);
      if (!v.ok) {
        setError(humanizeGraficosExportError(v.errors.join("; "), plan));
        return;
      }
      const config = buildGraficosConfigFromStore();
      const sharedRevision = isSharedReport
        ? await saveConsolidatedNow(config)
        : null;
      const out = isSharedReport
        ? await apiGraficosPptConsolidado(presets, sharedRevision ?? undefined)
        : kind === "ppt"
          ? await apiGraficosPpt(plan, presets, wPresets, config)
          : await apiGraficosWord(plan, presets, wPresets, config);
      setExportJob({ kind, id: out.job_id });
    } catch (e: unknown) {
      setError(humanizeGraficosExportError((e as Error).message, plan));
    } finally {
      setBusyValidating("");
    }
  }

  function onExportDone(data: ExportResult) {
    if (!exportJob) return;
    // El motor toma decisiones automáticas al renderizar —achica la letra del
    // eje cuando no cabe, apaga el Top 2 Box en una escala de dos categorías—
    // y hasta ahora no las contaba. Quien declaró 14 pt y vio 9,5 creía
    // haberse equivocado.
    setAvisosDelMotor(Array.isArray(data.avisos) ? data.avisos.filter(Boolean) : []);
    if (exportJob.kind === "ppt") {
      setPptFileId(data.file_id);
      setPptFilename(data.filename ?? null);
    } else if (exportJob.kind === "word") {
      setDocxFileId(data.file_id);
      setDocxFilename(data.filename ?? null);
    }
    setExportJob(null);
    void refresh();
  }

  function onExportError(message: string) {
    setError(humanizeGraficosExportError(message, plan));
    setExportJob(null);
    setAvisosDelMotor([]);
  }

  function onExportCancelled() {
    setExportJob(null);
  }

  return (
    <GraficosReportScopeProvider scope={reportScope}>
    <>
    <PageFrame
      title="Fase 5 - Reportes gráficos"
      lead={isSharedReport
        ? "Informe compartido editable con el catálogo de todas las fuentes."
        : "Editor bloque por bloque con autoguardado y exportación PPT/Word."}
      className="pulso-graficos-frame"
      headerMode="sr-only"
      bodyMode="fill"
      auditReady={hydrated && (!isSharedReport || ["ready", "blocked"].includes(sharedPreflightStatus))
        ? isSharedReport ? "graficos-consolidado" : "graficos"
        : false}
      resetScrollKey={`${state?.active_base ?? ""}:${reportScope}`}
      toolbar={
        <>
          {!isSharedReport && !prepOk && (
            <Alert kind="warn">
              Primero prepara los datos en <strong>4. Analítica</strong>. La exportación se activa cuando la base queda lista para generar reportes.
            </Alert>
          )}

          {isSharedReport && sharedPreflightStatus === "loading" && (
            <Alert kind="info">Comprobando las aprobaciones de todas las bases…</Alert>
          )}

          {isSharedReport && seededSlideCount > 0 && !dirty && (
            <Alert kind="info">
              {seededSlideCount} diapositivas compuestas desde {sharedPreflight?.source_order.length ?? 0} bases
              aprobadas. Todavía no se guardan: quedan fijadas al editar o exportar.
            </Alert>
          )}

          {isSharedReport && sharedPreflightStatus === "blocked" && (
            <Alert kind="warn">
              <div className="pulso-graficos-shared-gate">
                <div>
                  <strong>Puedes diseñar el informe, pero todavía no exportarlo.</strong>
                  <span>
                    {pendingSharedRequirements.length
                      ? pendingSharedRequirements.map((item) => `${item.actor}: ${item.detail}`).join(" · ")
                      : sharedPreflight?.blockers.map((blocker) => blocker.message).join(" · ")}
                  </span>
                </div>
                <div className="pulso-graficos-shared-gate-actions">
                  <Link to="/analitica">Completar bases en Analítica</Link>
                  <button type="button" className="pulso-secondary" onClick={() => void loadSharedPreflight()}>
                    Volver a comprobar
                  </button>
                </div>
              </div>
            </Alert>
          )}

          {isSharedReport && sharedPreflightStatus === "error" && (
            <Alert kind="error">
              {sharedPreflightError || "No se pudo comprobar el informe compartido."}{" "}
              <button type="button" className="pulso-secondary" onClick={() => void loadSharedPreflight()}>
                Reintentar
              </button>
            </Alert>
          )}

          <GraficosHeader
            onExportPpt={() => onExport("ppt")}
            onExportWord={() => onExport("word")}
            pptFileId={pptFileId}
            docxFileId={docxFileId}
            pptFilename={pptFilename}
            docxFilename={docxFilename}
            exportBusy={!!busyValidating || !!exportJob}
            exportJobKind={exportJob?.kind ?? null}
            canExport={canExport}
            prepReady={prepOk}
            reportScope={reportScope}
          />

          {exportJob && (
            <JobProgress<ExportResult>
              label={
                exportJob.kind === "ppt"
                  ? isSharedReport ? "Exportando informe compartido" : "Exportando PPT"
                  : "Exportando Word"
              }
              jobId={exportJob.id}
              onDone={onExportDone}
              onError={onExportError}
              onCancelled={onExportCancelled}
            />
          )}

          {avisosDelMotor.length > 0 && (
            <Alert kind="info">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <strong>
                  {avisosDelMotor.length === 1
                    ? "El motor ajustó algo al renderizar"
                    : `El motor ajustó ${avisosDelMotor.length} cosas al renderizar`}
                </strong>
                {avisosDelMotor.map((a, i) => <span key={i}>{a}</span>)}
              </div>
            </Alert>
          )}

          {avisoDeclaracion && <Alert kind="warn">{avisoDeclaracion}</Alert>}

          {busyValidating && <Alert kind="info">{busyValidating}</Alert>}
          {warns.length > 0 && <Alert kind="warn">{warns.join(" · ")}</Alert>}
          {error && (
            <Alert kind="error">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong>{error.message}</strong>
                {error.hint && (
                  <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>
                    {error.hint}
                  </div>
                )}
                {error.slideRef && (
                  <button
                    type="button"
                    onClick={() => {
                      if (error.slideRef) select(error.slideRef.id);
                      setError(null);
                    }}
                    style={{
                      alignSelf: "flex-start",
                      fontSize: 11, padding: "4px 10px",
                      border: "1px solid var(--pulso-danger-fg)",
                      borderRadius: 5,
                      background: "white", color: "var(--pulso-danger-fg)",
                      cursor: "pointer",
                    }}
                  >
                    Ir al slide "{error.slideRef.label}"
                  </button>
                )}
              </div>
            </Alert>
          )}
        </>
      }
    >
      {/* Selector de base en la banda del shell. Todas las secciones de
          Procesamiento lo llevan menos Carga, que en su lugar tiene el control de
          multibase porque es donde se dan de alta.
          En el informe compartido no aparece: ese informe es de TODAS las bases a
          la vez, así que elegir una activa no significaría nada. */}
      {!isSharedReport && (
        <ChromeSlotPortal zona="contexto">
          <ChromeBaseSelector />
        </ChromeSlotPortal>
      )}

      {bodyState === "cargando" || bodyState === "reintentando" ? (
        <LoadingBlock label={graficosBodyLoadingLabel(bodyState)} />
      ) : bodyState === "editor" ? (
        <GraficosLibrariesHost>
          <EditorShell />
        </GraficosLibrariesHost>
      ) : (
        <GraficosPrepBlocked />
      )}
    </PageFrame>

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
    </GraficosReportScopeProvider>
  );
}

function GraficosPrepBlocked() {
  const prepSteps = [
    {
      Icon: Database,
      label: "Preparar base",
      detail: "Consolida etiquetas, variables recodificadas y cortes.",
    },
    {
      Icon: BarChart2,
      label: "Construir gráficos",
      detail: "Vuelve aquí para elegir modelos, variables y estilos.",
    },
    {
      Icon: FileSpreadsheet,
      label: "Exportar reporte",
      detail: "Habilita PPT editable y Word narrativo.",
    },
  ];

  return (
    <div className="pulso-graficos-blocked">
      <section className="pulso-graficos-prep-card" aria-label="Gráficos pendientes de Analítica">
        <div className="pulso-graficos-prep-copy">
          <span className="pulso-graficos-prep-eyebrow">Requisito de datos</span>
          <h2>Prepara la base para graficar</h2>
          <p>
            El generador usa la base preparada para leer etiquetas, recodificaciones y cortes sin modificar tus respuestas originales.
          </p>

          <div className="pulso-graficos-prep-actions">
            <Link className="pulso-graficos-prep-cta" to="/analitica">
              Preparar en Analítica
              <ArrowRight size={15} />
            </Link>
            <span>
              <CheckCircle2 size={13} />
              Proceso local y reversible
            </span>
          </div>
        </div>

        <div className="pulso-graficos-prep-panel" aria-label="Flujo para habilitar gráficos">
          {prepSteps.map(({ Icon, label, detail }, index) => (
            <div className="pulso-graficos-prep-step" key={label}>
              <span className="pulso-graficos-prep-step-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="pulso-graficos-prep-step-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="pulso-graficos-prep-step-copy">
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
