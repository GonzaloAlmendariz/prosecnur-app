import { useCallback, useEffect, useState } from "react";
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
import { JobProgress } from "../../components/JobProgress";
import { PageFrame } from "../../components/PageFrame";
import { usePlanStore } from "./store";
import { useGraficosAutosave } from "./useGraficosAutosave";
import { useGraficosShortcuts } from "./useGraficosShortcuts";
import { ShortcutsModal } from "./ShortcutsModal";
import { humanizeGraficosExportError, HumanizedError } from "./humanizeExportError";
import { GraficosHeader } from "./GraficosHeader";
import { EditorShell } from "./v2/shell/EditorShell";
import { useShortcutsV2 } from "./v2/shortcuts/useShortcutsV2";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { GraficosReportScopeProvider, parseGraficosReportScope } from "./reportScope";
import {
  sharedReportPendingRequirements,
  type SharedReportPreflightStatus,
} from "./multibaseReportMenuModel";

type ExportResult = { ok: true; file_id: string; filename?: string; size: number; n_slides: number };
export default function GraficosPage() {
  const location = useLocation();
  const reportScope = parseGraficosReportScope(location.search);
  const isSharedReport = reportScope === "consolidated";
  const { state, refresh } = useSession();
  const plan = usePlanStore((s) => s.plan);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const hydrated = usePlanStore((s) => s.hydrated);

  // Autosave: hidrata al montar + guarda debounced 2s en cada cambio.
  const { saveConsolidatedNow } = useGraficosAutosave(reportScope);
  // Atajos: Cmd/Ctrl+Z (undo), +Shift+Z (redo), +D (duplicar), ? (ayuda).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useGraficosShortcuts({ onOpenHelp: () => setShortcutsOpen(true) });
  // Atajos V2: J/K (nav), / (búsqueda), V/T (modo), 1-4 (tabs)
  useShortcutsV2();

  const [busyValidating, setBusyValidating] = useState("");
  const [error, setError] = useState<HumanizedError | null>(null);
  const [warns, setWarns] = useState<string[]>([]);
  const select = usePlanStore((s) => s.select);
  const [pptFileId, setPptFileId] = useState<string | null>(null);
  const [docxFileId, setDocxFileId] = useState<string | null>(null);
  const [pptFilename, setPptFilename] = useState<string | null>(null);
  const [docxFilename, setDocxFilename] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<{ kind: "ppt" | "word"; id: string } | null>(null);
  const [sharedPreflight, setSharedPreflight] = useState<GraficosConsolidadoPreflight | null>(null);
  const [sharedPreflightStatus, setSharedPreflightStatus] = useState<SharedReportPreflightStatus>("idle");
  const [sharedPreflightError, setSharedPreflightError] = useState("");

  const prepOk = !!state?.analitica_prep_ok;
  const sharedReady = sharedPreflightStatus === "ready" && sharedPreflight?.ready === true;
  const canExport = (isSharedReport ? sharedReady : prepOk) && plan.slides.length > 0 && hydrated;
  const pendingSharedRequirements = sharedReportPendingRequirements(sharedPreflight);

  const loadSharedPreflight = useCallback(async () => {
    setSharedPreflightStatus("loading");
    setSharedPreflightError("");
    try {
      const result = await apiGraficosConsolidadoPreflight();
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
            hint: "Puedes seguir configurando sus láminas. Completa y aprueba cada base en Analítica, luego vuelve a comprobar.",
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
      {isSharedReport || prepOk ? (
        <EditorShell />
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
