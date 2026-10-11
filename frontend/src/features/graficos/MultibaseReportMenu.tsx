import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Archive, CheckCircle2, ChevronDown, Download, LayoutGrid, Loader2 } from "../../vendor/lucide-react";
import {
  apiGraficosConsolidadoPreflight,
  apiGraficosPptAll,
  downloadUrl,
  type GraficosConsolidadoPreflight,
} from "../../api/client";
import { JobProgress } from "../../components/JobProgress";
import { useSession } from "../../lib/SessionContext";
import { processingBaseScopePresentation } from "../procesamiento/baseScopeModel";
import { flushGraficosConfigIfHydrated } from "./configSnapshot";
import {
  multibaseReportMenuPresentation,
  sharedReportPendingRequirements,
  type SharedReportPreflightStatus,
} from "./multibaseReportMenuModel";

type ExportResult = {
  ok: true;
  file_id: string;
  filename?: string;
  size: number;
  n_slides: number;
};

type ExportAllResult = {
  ok: true;
  file_id: string;
  filename?: string;
  size: number;
  n_bases: number;
  bases: Array<{ nombre: string; filename: string; n_slides: number }>;
  /** Arreglos y advertencias del motor, ya ordenados y con la base de cada lámina (`.graficos_avisos_job`). Ausente
   *  en backends viejos. */
  avisos?: string[];
};

/**
 * El paquete por bases usa la config GUARDADA de cada base (`apiGraficosPptAll`), así que primero se guarda lo que el
 * editor tenga pendiente. El flush respeta el alcance hidratado (A7-1 H1): con el informe compartido abierto guarda el
 * borrador compartido y no toca la config de ninguna base. Si el guardado falla, el paquete no se lanza.
 */
export async function iniciarPaqueteBases(deps: {
  flush: () => Promise<boolean>;
  pptAll: () => Promise<{ job_id: string }>;
}): Promise<string> {
  await deps.flush();
  const result = await deps.pptAll();
  return result.job_id;
}

export function avisosDelPaquete(result: ExportResult | ExportAllResult): string[] {
  const avisos = "avisos" in result && Array.isArray(result.avisos) ? result.avisos : [];
  return avisos.filter((aviso): aviso is string => typeof aviso === "string" && aviso.trim() !== "");
}

export function AvisosPaqueteBases({ avisos }: { avisos: readonly string[] }) {
  if (!avisos.length) return null;
  return (
    <div className="pulso-multibase-reports-preflight" data-tone="blocked" role="status">
      <span aria-hidden="true"><AlertTriangle size={14} /></span>
      <div>
        <strong>{avisos.length === 1 ? "1 aviso del paquete" : `${avisos.length} avisos del paquete`}</strong>
        <ul className="pulso-multibase-reports-blockers">
          {avisos.map((aviso, indice) => <li key={`${indice}-${aviso}`}>{aviso}</li>)}
        </ul>
      </div>
    </div>
  );
}

type GroupJob = { kind: "ppt_all"; id: string };

export function MultibaseReportMenu() {
  const navigate = useNavigate();
  const { state, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<GroupJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<SharedReportPreflightStatus>("idle");
  const [preflight, setPreflight] = useState<GraficosConsolidadoPreflight | null>(null);
  const [error, setError] = useState("");
  const [allBases, setAllBases] = useState<{ fileId: string; filename: string; avisos: string[] } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const preflightRequestRef = useRef(0);
  const visible = processingBaseScopePresentation(
    state?.estudio_processing_mode,
    state?.n_bases,
  ).showSharedReports;
  const busy = Boolean(job) || starting;
  const presentation = multibaseReportMenuPresentation(preflightStatus, preflight, busy);
  const pendingRequirements = sharedReportPendingRequirements(preflight);

  const loadPreflight = useCallback(async () => {
    const requestId = preflightRequestRef.current + 1;
    preflightRequestRef.current = requestId;
    setPreflightStatus("loading");
    try {
      const result = await apiGraficosConsolidadoPreflight();
      if (preflightRequestRef.current !== requestId) return;
      setPreflight(result);
      setPreflightStatus(result.ready ? "ready" : "blocked");
    } catch (cause) {
      if (preflightRequestRef.current !== requestId) return;
      setPreflight(null);
      setPreflightStatus("error");
      setError(cause instanceof Error ? cause.message : "No se pudo comprobar el informe compartido.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && visible) void loadPreflight();
  }, [loadPreflight, open, visible]);

  useEffect(() => {
    setAllBases(null);
    setError("");
    setStarting(false);
    setPreflight(null);
    setPreflightStatus("idle");
    preflightRequestRef.current += 1;
  }, [state?.session_id]);

  if (!visible) return null;

  function configureConsolidated() {
    if (presentation.sharedConfigureDisabled) return;
    setOpen(false);
    navigate("/graficos?scope=consolidado");
  }

  async function startAllBases() {
    if (presentation.packageDisabled) return;
    setError("");
    setStarting(true);
    try {
      const jobId = await iniciarPaqueteBases({ flush: flushGraficosConfigIfHydrated, pptAll: apiGraficosPptAll });
      setJob({ kind: "ppt_all", id: jobId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar el paquete por bases.");
    } finally {
      setStarting(false);
    }
  }

  function onDone(result: ExportResult | ExportAllResult) {
    setAllBases({
      fileId: result.file_id,
      filename: result.filename ?? "reportes_por_base.zip",
      avisos: avisosDelPaquete(result),
    });
    setJob(null);
    void refresh();
  }

  return (
    <div className={`pulso-multibase-reports${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="pulso-multibase-reports-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Entregables del conjunto de bases"
        title="Entregables que reúnen las bases independientes"
      >
        {busy ? <Loader2 size={14} className="pulso-spin" /> : <LayoutGrid size={14} />}
        <span>Conjunto</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="pulso-multibase-reports-popover" role="dialog" aria-label="Reportes del conjunto de bases">
          <div className="pulso-multibase-reports-head">
            <span aria-hidden="true"><LayoutGrid size={15} /></span>
            <div>
              <strong>Reportes del conjunto</strong>
              <small>{state?.n_bases ?? 0} bases independientes</small>
            </div>
          </div>

          <div className="pulso-multibase-reports-preflight" data-tone={presentation.tone} role="status">
            <span aria-hidden="true">
              {presentation.tone === "ready" ? <CheckCircle2 size={14} /> : presentation.tone === "blocked" ? <AlertTriangle size={14} /> : <Loader2 size={14} className="pulso-spin" />}
            </span>
            <div>
              <strong>{presentation.tone === "ready" ? "Listo para componer" : presentation.tone === "blocked" ? "Revisión requerida" : "Comprobando informe"}</strong>
              <small>{presentation.detail}</small>
            </div>
          </div>

          {preflightStatus === "blocked" && pendingRequirements.length ? (
            <ul className="pulso-multibase-reports-blockers is-detailed">
              {pendingRequirements.map((requirement) => (
                <li key={requirement.base}>
                  <strong>{requirement.actor}</strong>
                  <span>{requirement.detail}</span>
                </li>
              ))}
            </ul>
          ) : preflightStatus === "blocked" && preflight?.blockers.length ? (
            <ul className="pulso-multibase-reports-blockers">
              {preflight.blockers.slice(0, 3).map((blocker) => (
                <li key={`${blocker.code}-${blocker.message}`}>{blocker.message}</li>
              ))}
            </ul>
          ) : null}

          <button type="button" className="pulso-multibase-report-option" onClick={configureConsolidated} disabled={presentation.sharedConfigureDisabled}>
            <span aria-hidden="true"><LayoutGrid size={15} /></span>
            <span>
              <strong>Configurar informe compartido</strong>
              <small>Edita láminas con el catálogo de todas las fuentes</small>
            </span>
          </button>
          <button type="button" className="pulso-multibase-report-option" onClick={() => void startAllBases()} disabled={presentation.packageDisabled}>
            <span aria-hidden="true"><Archive size={15} /></span>
            <span>
              <strong>Archivos por base</strong>
              <small>ZIP con un PPTX independiente por base</small>
            </span>
          </button>

          {job && (
            <JobProgress<ExportResult | ExportAllResult>
              label="Empaquetando bases"
              jobId={job.id}
              onDone={onDone}
              onError={(message) => { setError(message); setJob(null); }}
              onCancelled={() => setJob(null)}
            />
          )}

          {error && <div className="pulso-multibase-reports-error" role="alert">{error}</div>}
          {allBases && (
            <div className="pulso-multibase-reports-files">
              <a href={downloadUrl(allBases.fileId)}><Download size={12} /> {allBases.filename}</a>
              <AvisosPaqueteBases avisos={allBases.avisos} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
