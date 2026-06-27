import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
  Table2,
} from "lucide-react";
import {
  apiJobStatus,
  apiMonitoreoClientReportPdf,
  apiMonitoreoPublicationSheetsPublish,
  monitoreoClientReportPdfDownloadUrl,
  type JobSnapshot,
  type MonitoreoConfig,
  type MonitoreoLastSheetsPublication,
} from "../../../api/client";
import "./outputsWorkbench.css";

type OutputAudience = "client" | "internal";
type OutputFamily = "acreditacion" | "territorial";
type PublicationStatus = {
  kind: "idle" | "publishing" | "success" | "error";
  message: string;
  detail?: string;
};

export type MonitoreoOutputsWorkbenchProps = {
  family: OutputFamily;
  routeLabel: string;
  defaultTitle?: string;
  config?: Partial<MonitoreoConfig>;
  clientSheets?: MonitoreoLastSheetsPublication | null;
  internalSheets?: MonitoreoLastSheetsPublication | null;
  hasSnapshot: boolean;
  nRows: number;
  syncedAt?: string;
  includeTargetsSupported?: boolean;
  className?: string;
  onPublished?: () => void;
};

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeSpreadsheetTarget(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/\/spreadsheets\/d\/([^/?#]+)/i);
  return match?.[1] ?? raw;
}

function sheetsStateFromPublication(publication?: MonitoreoLastSheetsPublication | null) {
  if (!publication?.spreadsheet_id) return null;
  return {
    spreadsheetId: publication.spreadsheet_id,
    url: publication.spreadsheet_url || "",
    tabs: (publication.controlled_tabs ?? publication.tabs ?? []).map(String),
    updatedAt: publication.updated_at || "",
  };
}

function spreadsheetUrl(value = "") {
  const raw = normalizeSpreadsheetTarget(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(raw)}`;
}

function copyForFamily(family: OutputFamily) {
  if (family === "territorial") {
    return {
      eyebrow: "PDF territorial",
      title: "PDF de avance territorial",
      detail: "Mapa, avance y lectura territorial del corte activo.",
      button: "Generar PDF de avance",
      progress: "Generando PDF de avance",
      ready: "PDF de avance listo para descargar.",
      download: "Descargar PDF territorial",
      sheetsTitle: "Salidas territoriales a Sheets",
    };
  }
  return {
    eyebrow: "PDF ejecutivo",
    title: "PDF ejecutivo",
    detail: "Lectura ejecutiva del avance y respuestas del corte activo.",
    button: "Generar PDF ejecutivo",
    progress: "Generando PDF ejecutivo",
    ready: "PDF ejecutivo listo para descargar.",
    download: "Descargar PDF ejecutivo",
    sheetsTitle: "Salidas de acreditación a Sheets",
  };
}

function audienceLabel(audience: OutputAudience) {
  return audience === "client" ? "Cliente" : "Interno";
}

function audienceDetail(audience: OutputAudience) {
  return audience === "client"
    ? "Tablas ejecutivas para cliente, sin trazabilidad sensible."
    : "Tablas internas con datos operativos completos.";
}

function statusLabel(status: PublicationStatus, ready: boolean) {
  if (status.kind === "publishing") return "Publicando";
  if (status.kind === "error") return "Error";
  if (status.kind === "success" || ready) return "Publicada";
  return "Pendiente";
}

function JobStatusLine({
  jobId,
  label,
  onDone,
  onError,
  onCancelled,
}: {
  jobId: string | null;
  label: string;
  onDone: () => void;
  onError: (message: string) => void;
  onCancelled: () => void;
}) {
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const callbacksRef = useRef({ onDone, onError, onCancelled });

  useEffect(() => {
    callbacksRef.current = { onDone, onError, onCancelled };
  }, [onCancelled, onDone, onError]);

  useEffect(() => {
    if (!jobId) {
      setSnapshot(null);
      return undefined;
    }
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const next = await apiJobStatus(jobId);
        if (cancelled) return;
        setSnapshot(next);
        if (next.status === "done") {
          callbacksRef.current.onDone();
          return;
        }
        if (next.status === "error") {
          const message = typeof next.error === "string" && next.error ? next.error : "No se pudo generar el PDF.";
          callbacksRef.current.onError(message);
          return;
        }
        if (next.status === "cancelled") {
          callbacksRef.current.onCancelled();
          return;
        }
        timer = window.setTimeout(poll, 1200);
      } catch (e) {
        if (!cancelled) callbacksRef.current.onError((e as Error).message);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId]);

  if (!jobId) return null;
  const progress = snapshot?.progress && "percent" in snapshot.progress
    ? Number(snapshot.progress.percent)
    : null;
  const progressLabel = Number.isFinite(progress) ? `${Math.round(progress as number)}%` : "en curso";
  return (
    <div className="mon-outputs-job" role="status" aria-live="polite">
      <span><Loader2 size={14} className="pulso-spin" /> {label}</span>
      <strong>{progressLabel}</strong>
      <i style={{ "--mon-output-job-progress": `${Number.isFinite(progress) ? progress : 35}%` } as CSSProperties} />
    </div>
  );
}

export function MonitoreoOutputsWorkbench({
  family,
  routeLabel,
  defaultTitle = "",
  config,
  clientSheets,
  internalSheets,
  hasSnapshot,
  nRows,
  syncedAt,
  includeTargetsSupported = true,
  className = "",
  onPublished,
}: MonitoreoOutputsWorkbenchProps) {
  const copy = copyForFamily(family);
  const [includeTargets, setIncludeTargets] = useState(false);
  const [activeAudience, setActiveAudience] = useState<OutputAudience>("client");
  const [internalConfirmed, setInternalConfirmed] = useState(false);
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
  const clientInitial = useMemo(() => sheetsStateFromPublication(clientSheets), [clientSheets]);
  const internalInitial = useMemo(() => sheetsStateFromPublication(internalSheets), [internalSheets]);
  const [spreadsheetIds, setSpreadsheetIds] = useState<Record<OutputAudience, string>>({
    client: clientInitial?.spreadsheetId || "",
    internal: internalInitial?.spreadsheetId || "",
  });
  const [published, setPublished] = useState<Record<OutputAudience, ReturnType<typeof sheetsStateFromPublication>>>({
    client: clientInitial,
    internal: internalInitial,
  });
  const [statuses, setStatuses] = useState<Record<OutputAudience, PublicationStatus>>({
    client: { kind: "idle", message: "" },
    internal: { kind: "idle", message: "" },
  });
  const [publishing, setPublishing] = useState<OutputAudience | null>(null);
  const seedRef = useRef("");

  useEffect(() => {
    const seed = [
      routeLabel,
      defaultTitle,
      clientInitial?.spreadsheetId || "",
      internalInitial?.spreadsheetId || "",
    ].join("|");
    if (seedRef.current === seed) return;
    seedRef.current = seed;
    setPublished({ client: clientInitial, internal: internalInitial });
    setSpreadsheetIds({
      client: clientInitial?.spreadsheetId || "",
      internal: internalInitial?.spreadsheetId || "",
    });
    setStatuses({ client: { kind: "idle", message: "" }, internal: { kind: "idle", message: "" } });
  }, [clientInitial, defaultTitle, internalInitial, routeLabel]);

  const activeTarget = spreadsheetIds[activeAudience] ?? "";
  const activePublished = published[activeAudience];
  const activeReady = Boolean(
    normalizeSpreadsheetTarget(activeTarget) &&
    normalizeSpreadsheetTarget(activeTarget) === normalizeSpreadsheetTarget(activePublished?.spreadsheetId),
  );
  const activeUrl = spreadsheetUrl(activeTarget);
  const activeStatus = statuses[activeAudience];
  const canGeneratePdf = hasSnapshot && nRows > 0 && !pdfJobId;
  const canPublishSheets = hasSnapshot &&
    Boolean(activeTarget.trim()) &&
    !publishing &&
    (activeAudience === "client" || internalConfirmed);

  const updateStatus = (audience: OutputAudience, status: PublicationStatus) => {
    setStatuses((current) => ({ ...current, [audience]: status }));
  };

  const generatePdf = async () => {
    if (!canGeneratePdf) return;
    setPdfReady(false);
    setPdfMessage("");
    setPdfError("");
    try {
      const start = await apiMonitoreoClientReportPdf({ includeTargets, ...(config ? { config } : {}) });
      setPdfJobId(start.job_id);
    } catch (e) {
      setPdfError((e as Error).message);
    }
  };

  const publishSheets = async () => {
    if (!canPublishSheets) return;
    const audience = activeAudience;
    setPublishing(audience);
    updateStatus(audience, { kind: "publishing", message: `Actualizando Sheets ${audienceLabel(audience).toLowerCase()}...` });
    try {
      const out = await apiMonitoreoPublicationSheetsPublish(activeTarget.trim(), {
        audience,
        includeTargets,
        confirmedFullData: audience === "internal" ? internalConfirmed : undefined,
        ...(config ? { config } : {}),
      });
      const next = {
        spreadsheetId: out.spreadsheet_id,
        url: spreadsheetUrl(out.spreadsheet_id),
        tabs: (out.controlled_tabs ?? []).map(String),
        updatedAt: out.updated_at || "",
      };
      setPublished((current) => ({ ...current, [audience]: next }));
      setSpreadsheetIds((current) => ({ ...current, [audience]: out.spreadsheet_id }));
      updateStatus(audience, {
        kind: "success",
        message: next.tabs.length
          ? `${next.tabs.length} pestañas actualizadas.`
          : "Publicación enviada a Google Sheets.",
        detail: out.spreadsheet_id,
      });
      onPublished?.();
      window.dispatchEvent(new CustomEvent("pulso:project-status-changed"));
    } catch (e) {
      updateStatus(audience, { kind: "error", message: (e as Error).message });
    } finally {
      setPublishing(null);
    }
  };

  const snapshotHint = hasSnapshot
    ? `${fmt(nRows)} registros${syncedAt ? ` · corte ${formatDate(syncedAt)}` : ""}`
    : "Sin corte sincronizado";

  return (
    <section className={`mon-outputs-workbench ${className}`} aria-label="Salidas de monitoreo">
      <header className="mon-outputs-workbench__head">
        <div>
          <span><FileText size={15} /> Salidas del avance</span>
          <strong>{copy.sheetsTitle}</strong>
          <small>{snapshotHint}</small>
        </div>
        {includeTargetsSupported ? (
          <label className="mon-outputs-targets-toggle">
            <input
              type="checkbox"
              checked={includeTargets}
              onChange={(event) => setIncludeTargets(event.target.checked)}
              disabled={!hasSnapshot || Boolean(pdfJobId) || Boolean(publishing)}
            />
            <span>Incluir metas</span>
          </label>
        ) : null}
      </header>

      <div className="mon-outputs-grid">
        <article className="mon-outputs-card mon-outputs-card--pdf">
          <div className="mon-outputs-card__head">
            <span>{copy.eyebrow}</span>
            <strong>{copy.title}</strong>
            <small>{copy.detail}</small>
          </div>
          {!hasSnapshot ? (
            <div className="mon-outputs-alert is-error"><AlertTriangle size={14} /> Sincroniza un corte antes de generar el PDF.</div>
          ) : null}
          <button type="button" className="mon-outputs-primary" onClick={() => { void generatePdf(); }} disabled={!canGeneratePdf}>
            {pdfJobId ? <Loader2 size={14} className="pulso-spin" /> : <Download size={14} />}
            {copy.button}
          </button>
          <JobStatusLine
            jobId={pdfJobId}
            label={copy.progress}
            onDone={() => {
              setPdfJobId(null);
              setPdfReady(true);
              setPdfMessage(copy.ready);
            }}
            onError={(message) => {
              setPdfJobId(null);
              setPdfError(message);
            }}
            onCancelled={() => {
              setPdfJobId(null);
              setPdfMessage("Generación cancelada.");
            }}
          />
          {pdfError ? <div className="mon-outputs-alert is-error"><AlertTriangle size={14} /> {pdfError}</div> : null}
          {pdfMessage ? <div className="mon-outputs-alert is-info"><CheckCircle2 size={14} /> {pdfMessage}</div> : null}
          {pdfReady ? (
            <a className="mon-outputs-download" href={monitoreoClientReportPdfDownloadUrl()} download>
              <Download size={14} />
              {copy.download}
            </a>
          ) : null}
        </article>

        <article className="mon-outputs-card mon-outputs-card--sheets">
          <div className="mon-outputs-card__head">
            <span>Google Sheets</span>
            <strong>Cliente e interno</strong>
            <small>Las audiencias se publican por separado para preservar el alcance de cada salida.</small>
          </div>
          <div className="mon-outputs-audience-tabs" role="tablist" aria-label="Audiencia de salida">
            {(["client", "internal"] as const).map((audience) => {
              const ready = Boolean(published[audience]?.spreadsheetId);
              const status = statuses[audience];
              return (
                <button
                  key={audience}
                  type="button"
                  role="tab"
                  aria-selected={activeAudience === audience}
                  className={`is-${audience}${activeAudience === audience ? " is-active" : ""}${ready ? " is-ready" : ""}${status.kind === "error" ? " is-error" : ""}`}
                  onClick={() => setActiveAudience(audience)}
                >
                  <span>{audienceLabel(audience)}</span>
                  <strong>{statusLabel(status, ready)}</strong>
                </button>
              );
            })}
          </div>
          <div className={`mon-outputs-sheets-detail is-${activeAudience}`}>
            <div className="mon-outputs-audience-copy">
              <span>{activeAudience === "client" ? <Table2 size={14} /> : <ShieldAlert size={14} />}</span>
              <div>
                <strong>Sheets {audienceLabel(activeAudience).toLowerCase()}</strong>
                <small>{audienceDetail(activeAudience)}</small>
              </div>
            </div>
            {activeAudience === "internal" ? (
              <label className="mon-outputs-confirm">
                <input
                  type="checkbox"
                  checked={internalConfirmed}
                  onChange={(event) => setInternalConfirmed(event.target.checked)}
                  disabled={Boolean(publishing)}
                />
                <span>Confirmo que esta salida interna puede incluir datos personales, GPS, IDs y auditoría.</span>
              </label>
            ) : null}
            <label className="mon-outputs-field">
              <span>Spreadsheet destino</span>
              <input
                value={activeTarget}
                onChange={(event) => {
                  const next = event.target.value;
                  setSpreadsheetIds((current) => ({ ...current, [activeAudience]: next }));
                  updateStatus(activeAudience, { kind: "idle", message: "" });
                }}
                disabled={Boolean(publishing)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </label>
            <div className="mon-outputs-sheets-actions">
              <button type="button" onClick={() => { void publishSheets(); }} disabled={!canPublishSheets}>
                {publishing === activeAudience ? <Loader2 size={14} className="pulso-spin" /> : <Table2 size={14} />}
                {activeReady ? "Actualizar Sheets" : "Publicar Sheets"}
              </button>
              {activeUrl ? (
                <a href={activeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} />
                  Abrir spreadsheet
                </a>
              ) : null}
            </div>
            <div className={`mon-outputs-status is-${activeStatus.kind}`} role="status" aria-live="polite">
              <span>{activeStatus.message || (!hasSnapshot ? "Sincroniza un corte antes de publicar." : !activeTarget.trim() ? "Configura el spreadsheet destino." : activeAudience === "internal" && !internalConfirmed ? "Confirma la salida interna para habilitar la publicación." : activeReady ? "Publicación previa lista para actualizar." : "Lista para publicar.")}</span>
              {activePublished?.tabs.length ? <small>{activePublished.tabs.length} pestañas controladas</small> : null}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
