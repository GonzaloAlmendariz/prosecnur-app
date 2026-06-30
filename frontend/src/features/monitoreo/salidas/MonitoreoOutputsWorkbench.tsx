import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
  Table2,
  Upload,
  UsersRound,
} from "lucide-react";
import {
  apiEstudioActiveBaseSet,
  apiEstudioGet,
  apiJobStatus,
  apiMonitoreoClientReportPdf,
  apiMonitoreoPublicationEvidencePack,
  apiMonitoreoPublicationPreflight,
  apiMonitoreoPublicationSheetsPublish,
  apiMonitoreoProductionReportPdf,
  apiMonitoreoTerritorialOperationalPackageReview,
  apiUpload,
  monitoreoClientReportPdfDownloadUrl,
  monitoreoProductionReportPdfDownloadUrl,
  type EstudioBase,
  type EstudioPayload,
  type JobSnapshot,
  type MonitoreoConfig,
  type MonitoreoDeliverablesPreflight,
  type MonitoreoLastSheetsPublication,
  type MonitoreoPublicationEvidencePackResult,
  type MonitoreoTerritorialOperationalPackageReviewResult,
} from "../../../api/client";
import { useOptionalSession } from "../../../lib/SessionContext";
import "./outputsWorkbench.css";

type OutputAudience = "client" | "internal";
type OutputFamily = "acreditacion" | "territorial";
type PublicationStatus = {
  kind: "idle" | "checking" | "publishing" | "success" | "error";
  message: string;
  detail?: string;
};
type EvidencePackStatus = {
  kind: "idle" | "generating" | "ready" | "warnings" | "blocked" | "error";
  message: string;
  detail?: string;
};
type OperationalPackageUpload = {
  fileId: string;
  filename: string;
  size?: number;
};
export type EvidencePackHighlight = {
  kind: "operational_request" | "operational_status" | "publication_decision";
  label: string;
  detail: string;
};
export type EvidencePackFileLink = {
  key: "operational_package_request_csv" | "operational_package_request" | "operational_package_status" | "publication_decision";
  label: string;
  downloadUrl: string;
};
export type OperationalPackageStatus = {
  kind: "idle" | "reviewing" | "missing" | "applicable" | "ready" | "blocked" | "error";
  message: string;
  detail?: string;
};
type ProcessingHandoffStatus = {
  kind: "idle" | "loading" | "ready" | "empty" | "setting" | "success" | "error";
  message: string;
  detail?: string;
};
type ProcessingBaseOption = Pick<
  EstudioBase,
  "nombre" | "source_alias" | "source_title" | "source_channel" | "source_kind" | "survey_id" | "n_filas" | "n_columnas"
>;

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

function formatBytes(value?: number) {
  if (!Number.isFinite(value)) return "";
  const n = Number(value);
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
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

function productionCopyForFamily(family: OutputFamily) {
  if (family === "territorial") {
    return {
      eyebrow: "Producción",
      title: "Producción por encuestador",
      detail: "Resumen por apellido y detalle de UMP completadas por responsable.",
      button: "Generar PDF de producción",
      progress: "Generando PDF de producción",
      ready: "PDF de producción listo para descargar.",
      download: "Descargar producción",
    };
  }
  return {
    eyebrow: "Producción",
    title: "Producción por responsable",
    detail: "Resumen por apellido y detalle de producción telefónica por responsable.",
    button: "Generar PDF de producción",
    progress: "Generando PDF de producción",
    ready: "PDF de producción listo para descargar.",
    download: "Descargar producción",
  };
}

function productionPdfTitleSeed(family: OutputFamily, defaultTitle: string, routeLabel: string) {
  const cleanTitle = (defaultTitle || "").trim();
  const cleanRoute = (routeLabel || "").trim();
  const generic = /^(reporte[-\s]?monitoreo|reporte[-\s]?territorial|territorial|acreditaci[oó]n)$/i;
  const base = cleanTitle && !generic.test(cleanTitle) ? cleanTitle : cleanRoute;
  const fallback = family === "territorial" ? "monitoreo territorial" : "monitoreo de acreditación";
  return `Producción - ${base && !generic.test(base) ? base : fallback}`;
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
  if (status.kind === "checking") return "Revisión";
  if (status.kind === "publishing") return "Publicando";
  if (status.kind === "error") return "Error";
  if (status.kind === "success" || ready) return "Publicada";
  return "Pendiente";
}

function preflightHeading(preflight?: MonitoreoDeliverablesPreflight | null) {
  if (!preflight) return "Validación";
  if (preflight.status === "blocked") return "Validación bloqueada";
  if (preflight.status === "warnings") return "Validación con advertencias";
  return "Validación lista";
}

function preflightDetail(preflight?: MonitoreoDeliverablesPreflight | null) {
  if (!preflight) return "";
  const blocking = preflight.scorecard?.blocking_count ?? preflight.blocking_issues?.length ?? 0;
  const warnings = preflight.scorecard?.warning_count ?? preflight.warnings?.length ?? 0;
  return `${Math.round(Number(preflight.score) || 0)}/100 · ${blocking} bloqueos · ${warnings} advertencias`;
}

function preflightIssues(preflight?: MonitoreoDeliverablesPreflight | null) {
  if (!preflight) return [];
  return [...(preflight.blocking_issues ?? []), ...(preflight.warnings ?? [])].slice(0, 3);
}

function normalizedText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function processingBaseLabel(base?: ProcessingBaseOption | null) {
  if (!base) return "";
  return base.source_alias || base.source_title || base.nombre;
}

function processingBaseDetail(base?: ProcessingBaseOption | null) {
  if (!base) return "";
  return [
    base.n_filas != null ? `${fmt(base.n_filas)} filas` : "",
    base.n_columnas != null ? `${fmt(base.n_columnas)} cols` : "",
    base.source_channel || "",
  ].filter(Boolean).join(" · ");
}

function chooseProcessingBase(estudio: EstudioPayload | null, family: OutputFamily, routeLabel: string, defaultTitle: string) {
  if (!estudio?.bases) return "";
  const bases = Object.values(estudio.bases);
  if (!bases.length) return "";
  const active = String(estudio.active_base || "");
  const terms = [routeLabel, defaultTitle, family].map(normalizedText).filter(Boolean);
  const matched = bases.find((base) => {
    const haystack = normalizedText([
      base.nombre,
      base.source_alias || "",
      base.source_title || "",
      base.source_kind || "",
      base.survey_id || "",
    ].join(" "));
    return terms.some((term) => term && haystack.includes(term));
  });
  return matched?.nombre || active || bases[0]?.nombre || "";
}

function emptyEvidencePackStatuses(): Record<OutputAudience, EvidencePackStatus> {
  return {
    client: { kind: "idle", message: "" },
    internal: { kind: "idle", message: "" },
  };
}

export function monitoreoEvidencePackHighlights(result?: MonitoreoPublicationEvidencePackResult | null): EvidencePackHighlight[] {
  const pack = result?.evidence_pack;
  if (!pack) return [];
  const highlights: EvidencePackHighlight[] = [];
  if (pack.operational_package_request_csv || pack.operational_package_request) {
    highlights.push({
      kind: "operational_request",
      label: "Solicitud de payload operacional",
      detail: "CSV/JSON para completar UMP o tachas pendientes; no aplica cambios ni muta .pulso.",
    });
  }
  if (pack.operational_package_status) {
    highlights.push({
      kind: "operational_status",
      label: "Diagnóstico operacional",
      detail: "Resume cobertura, filas listas y bloqueos del paquete territorial.",
    });
  }
  if (pack.publication_decision) {
    highlights.push({
      kind: "publication_decision",
      label: "Decisión de publicación",
      detail: "Indica si la salida está lista, requiere revisión o queda bloqueada.",
    });
  }
  return highlights;
}

export function monitoreoEvidencePackFileLinks(result?: MonitoreoPublicationEvidencePackResult | null): EvidencePackFileLink[] {
  const files = result?.files;
  if (!files) return [];
  return [
    {
      key: "operational_package_request_csv" as const,
      label: "Request CSV",
      downloadUrl: files.operational_package_request_csv?.download_url ?? "",
    },
    {
      key: "operational_package_request" as const,
      label: "Request JSON",
      downloadUrl: files.operational_package_request?.download_url ?? "",
    },
    {
      key: "operational_package_status" as const,
      label: "Diagnóstico",
      downloadUrl: files.operational_package_status?.download_url ?? "",
    },
    {
      key: "publication_decision" as const,
      label: "Decisión",
      downloadUrl: files.publication_decision?.download_url ?? "",
    },
  ].filter((item) => item.downloadUrl);
}

export function monitoreoOperationalPackageReviewSource(
  upload?: Pick<OperationalPackageUpload, "filename"> | null,
  referenceUpload?: Pick<OperationalPackageUpload, "filename"> | null,
  fallback = "Referencia territorial validada",
) {
  const filename = String(upload?.filename ?? "").trim();
  const referenceFilename = String(referenceUpload?.filename ?? "").trim();
  if (filename && referenceFilename) return `Paquete cargado: ${filename}; referencia: ${referenceFilename}`;
  if (filename) return `Paquete cargado: ${filename}`;
  if (referenceFilename) return `Referencia cargada: ${referenceFilename}`;
  return fallback;
}

export function monitoreoOperationalPackageReviewForPublication(
  result?: MonitoreoTerritorialOperationalPackageReviewResult | null,
) {
  return result?.review ?? result ?? undefined;
}

export function monitoreoOperationalPackageDetail(result?: MonitoreoTerritorialOperationalPackageReviewResult | null) {
  const coverage = result?.review?.coverage;
  if (!coverage) return "";
  const applicationPlan = result?.review?.application_plan ?? result?.application_plan;
  const reviewStatus = result?.review?.status ?? result?.status;
  const safeToApply = result?.review?.safe_to_apply ?? result?.safe_to_apply;
  const blocksPublication = result?.review?.blocks_publication ?? result?.blocks_publication;
  const publicationReady = result?.review?.publication_ready ?? result?.publication_ready;
  const missingUmps = Array.isArray(coverage.missing_ump_items) ? coverage.missing_ump_items.length : 0;
  const missingTachas = Number(coverage.missing_tachas ?? 0);
  const incompleteRows = Number(coverage.incomplete_rows ?? 0);
  const applyBlockedRows = Number(applicationPlan?.blocked_rows ?? 0);
  const payloadReady = applicationPlan?.payload_ready === true;
  const payloadLabel = payloadReady
    ? reviewStatus === "review_ready" && safeToApply === true
      ? publicationReady === true || (publicationReady == null && blocksPublication !== true)
        ? "payload publicable listo"
        : "payload aplicable; falta aplicar/revalidar"
      : "payload parcial listo"
    : "";
  return [
    `${fmt(missingUmps)} UMP faltantes`,
    `${fmt(missingTachas)} tachas faltantes`,
    `${fmt(incompleteRows)} filas incompletas`,
    applyBlockedRows > 0 ? `${fmt(applyBlockedRows)} filas sin payload aplicable` : "",
    payloadLabel,
  ].filter(Boolean).join(" · ");
}

export function monitoreoOperationalPackageApplyBlocked(result: MonitoreoTerritorialOperationalPackageReviewResult) {
  const applicationPlan = result.review?.application_plan ?? result.application_plan;
  return result.status === "review_ready" &&
    applicationPlan?.payload_ready === false &&
    Number(applicationPlan.blocked_rows ?? 0) > 0;
}

export function monitoreoOperationalPackageStatusKind(result: MonitoreoTerritorialOperationalPackageReviewResult): OperationalPackageStatus["kind"] {
  if (result.status === "missing_package") return "missing";
  if (result.status === "blocked" || monitoreoOperationalPackageApplyBlocked(result)) return "blocked";
  if (result.status === "review_ready") {
    const safeToApply = result.review?.safe_to_apply ?? result.safe_to_apply;
    const blocksPublication = result.review?.blocks_publication ?? result.blocks_publication;
    const publicationReady = result.review?.publication_ready ?? result.publication_ready;
    if (publicationReady === true || (publicationReady == null && safeToApply === true && blocksPublication !== true)) return "ready";
    if (safeToApply === true) return "applicable";
    return "blocked";
  }
  return "blocked";
}

export function monitoreoOperationalPackageMessage(result: MonitoreoTerritorialOperationalPackageReviewResult, kind: OperationalPackageStatus["kind"]) {
  if (kind === "ready") return "Paquete aplicado y revalidado; la salida puede continuar a publicación.";
  if (kind === "applicable") return "Paquete aplicable; falta aplicar y revalidar antes de publicar.";
  if (kind === "missing") return "Falta el paquete operacional validado.";
  if (monitoreoOperationalPackageApplyBlocked(result)) return "Paquete revisable, pero faltan campos para aplicar con seguridad.";
  if ((result.review?.application_plan ?? result.application_plan)?.payload_ready === true) {
    return "Paquete parcial con payload listo, pero faltan filas críticas.";
  }
  return "Paquete operacional incompleto para revisión.";
}

function JobStatusLine({
  jobId,
  label,
  onDone,
  onError,
  onCancelled,
  onProgress,
}: {
  jobId: string | null;
  label: string;
  onDone: () => void;
  onError: (message: string) => void;
  onCancelled: () => void;
  onProgress?: (progress: number | null) => void;
}) {
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const callbacksRef = useRef({ onDone, onError, onCancelled, onProgress });

  useEffect(() => {
    callbacksRef.current = { onDone, onError, onCancelled, onProgress };
  }, [onCancelled, onDone, onError, onProgress]);

  useEffect(() => {
    if (!jobId) {
      setSnapshot(null);
      callbacksRef.current.onProgress?.(null);
      return undefined;
    }
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const next = await apiJobStatus(jobId);
        if (cancelled) return;
        setSnapshot(next);
        const nextProgress = next.progress && "percent" in next.progress
          ? Number(next.progress.percent)
          : null;
        callbacksRef.current.onProgress?.(Number.isFinite(nextProgress) ? nextProgress : null);
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
  const navigate = useNavigate();
  const session = useOptionalSession();
  const copy = copyForFamily(family);
  const productionCopy = productionCopyForFamily(family);
  const productionDefaultTitle = useMemo(
    () => productionPdfTitleSeed(family, defaultTitle, routeLabel),
    [defaultTitle, family, routeLabel],
  );
  const [includeTargets, setIncludeTargets] = useState(false);
  const [activeAudience, setActiveAudience] = useState<OutputAudience>("client");
  const [internalConfirmed, setInternalConfirmed] = useState(false);
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [productionPdfJobId, setProductionPdfJobId] = useState<string | null>(null);
  const [productionPdfProgress, setProductionPdfProgress] = useState<number | null>(null);
  const [productionPdfReady, setProductionPdfReady] = useState(false);
  const [productionPdfMessage, setProductionPdfMessage] = useState("");
  const [productionPdfError, setProductionPdfError] = useState("");
  const [productionPdfTitle, setProductionPdfTitle] = useState(productionDefaultTitle);
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [processingBase, setProcessingBase] = useState("");
  const [processingStatus, setProcessingStatus] = useState<ProcessingHandoffStatus>({
    kind: "idle",
    message: "",
  });
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
  const [preflights, setPreflights] = useState<Record<OutputAudience, MonitoreoDeliverablesPreflight | null>>({
    client: null,
    internal: null,
  });
  const [evidencePacks, setEvidencePacks] = useState<Record<OutputAudience, MonitoreoPublicationEvidencePackResult | null>>({
    client: null,
    internal: null,
  });
  const [evidenceStatuses, setEvidenceStatuses] = useState<Record<OutputAudience, EvidencePackStatus>>(() => emptyEvidencePackStatuses());
  const [operationalReview, setOperationalReview] = useState<MonitoreoTerritorialOperationalPackageReviewResult | null>(null);
  const [operationalReviewStatus, setOperationalReviewStatus] = useState<OperationalPackageStatus>({ kind: "idle", message: "" });
  const [operationalPackageUpload, setOperationalPackageUpload] = useState<OperationalPackageUpload | null>(null);
  const [operationalDriftUpload, setOperationalDriftUpload] = useState<OperationalPackageUpload | null>(null);
  const [publishing, setPublishing] = useState<OutputAudience | null>(null);
  const [preflighting, setPreflighting] = useState<OutputAudience | null>(null);
  const [evidencePacking, setEvidencePacking] = useState<OutputAudience | null>(null);
  const [reviewingOperationalPackage, setReviewingOperationalPackage] = useState(false);
  const [uploadingOperationalPackage, setUploadingOperationalPackage] = useState(false);
  const [uploadingOperationalDrift, setUploadingOperationalDrift] = useState(false);
  const seedRef = useRef("");
  const sessionBasesSignature = (session?.state?.bases_nombres ?? []).join("|");
  const sessionBaseOptions = useMemo<ProcessingBaseOption[]>(
    () => (session?.state?.bases_nombres ?? []).map((nombre) => ({
      nombre,
      n_filas: null,
      n_columnas: null,
    })),
    [sessionBasesSignature],
  );
  const sessionProcessingBase = session?.state?.active_base || sessionBaseOptions[0]?.nombre || "";

  useEffect(() => {
    const seed = [
      family,
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
    setPreflights({ client: null, internal: null });
    setEvidencePacks({ client: null, internal: null });
    setEvidenceStatuses(emptyEvidencePackStatuses());
    setOperationalReview(null);
    setOperationalReviewStatus({ kind: "idle", message: "" });
    setOperationalPackageUpload(null);
    setOperationalDriftUpload(null);
    setProductionPdfTitle(productionDefaultTitle);
  }, [clientInitial, defaultTitle, family, internalInitial, productionDefaultTitle, routeLabel]);

  useEffect(() => {
    let cancelled = false;
    if (sessionProcessingBase) {
      setProcessingBase(sessionProcessingBase);
      setProcessingStatus({ kind: "ready", message: "Base disponible para abrir Procesamiento." });
    } else if (session?.state && Number(session.state.n_bases ?? 0) === 0) {
      setProcessingStatus({ kind: "empty", message: "Procesamiento no tiene bases cargadas." });
    } else {
      setProcessingStatus({ kind: "loading", message: "Leyendo bases de Procesamiento..." });
    }
    apiEstudioGet()
      .then((payload) => {
        if (cancelled) return;
        setEstudio(payload);
        const nextBase = chooseProcessingBase(payload, family, routeLabel, defaultTitle);
        setProcessingBase(nextBase || sessionProcessingBase);
        setProcessingStatus({
          kind: nextBase || sessionProcessingBase ? "ready" : "empty",
          message: nextBase || sessionProcessingBase ? "Base disponible para abrir Procesamiento." : "Procesamiento no tiene bases cargadas.",
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setProcessingStatus({ kind: "error", message: (e as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [defaultTitle, family, routeLabel, session?.state, sessionProcessingBase]);

  const activeTarget = spreadsheetIds[activeAudience] ?? "";
  const activePublished = published[activeAudience];
  const activeReady = Boolean(
    normalizeSpreadsheetTarget(activeTarget) &&
    normalizeSpreadsheetTarget(activeTarget) === normalizeSpreadsheetTarget(activePublished?.spreadsheetId),
  );
  const activeUrl = spreadsheetUrl(activeTarget);
  const activeStatus = statuses[activeAudience];
  const activePreflight = preflights[activeAudience];
  const activeEvidencePack = evidencePacks[activeAudience];
  const activeEvidenceStatus = evidenceStatuses[activeAudience];
  const activeEvidenceHighlights = monitoreoEvidencePackHighlights(activeEvidencePack);
  const activeEvidenceFiles = monitoreoEvidencePackFileLinks(activeEvidencePack);
  const showOperationalPackageReview = family === "territorial" && activeAudience === "internal";
  const operationalBusy = reviewingOperationalPackage || uploadingOperationalPackage || uploadingOperationalDrift;
  const canGeneratePdf = hasSnapshot && nRows > 0 && !pdfJobId;
  const canGenerateProductionPdf = hasSnapshot && nRows > 0 && !productionPdfJobId;
  const canPreflightSheets = hasSnapshot &&
    Boolean(activeTarget.trim()) &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy;
  const canPublishSheets = hasSnapshot &&
    Boolean(activeTarget.trim()) &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy &&
    (activeAudience === "client" || internalConfirmed);
  const canGenerateEvidencePack = hasSnapshot &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy &&
    (activeAudience === "client" || internalConfirmed);
  const canUploadOperationalPackage = showOperationalPackageReview &&
    hasSnapshot &&
    internalConfirmed &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy;
  const canUploadOperationalDrift = showOperationalPackageReview &&
    hasSnapshot &&
    internalConfirmed &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy;
  const canReviewOperationalPackage = showOperationalPackageReview &&
    hasSnapshot &&
    internalConfirmed &&
    Boolean(operationalDriftUpload) &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy;
  const processingBases = useMemo<ProcessingBaseOption[]>(() => {
    const loaded = Object.values(estudio?.bases ?? {});
    return loaded.length ? loaded : sessionBaseOptions;
  }, [estudio, sessionBaseOptions]);
  const selectedProcessingBase = processingBases.find((base) => base.nombre === processingBase) ?? null;
  const processingBusy = processingStatus.kind === "loading" || processingStatus.kind === "setting";

  const publicationOperationalEvidence = (audience: OutputAudience) => (
    family === "territorial" && audience === "internal"
      ? {
          ...(operationalDriftUpload ? { referenceDriftFileId: operationalDriftUpload.fileId } : {}),
          ...(operationalReview ? { operationalPackageReview: monitoreoOperationalPackageReviewForPublication(operationalReview) } : {}),
        }
      : {}
  );

  const updateStatus = (audience: OutputAudience, status: PublicationStatus) => {
    setStatuses((current) => ({ ...current, [audience]: status }));
  };

  const requestPreflight = async (audience: OutputAudience) => {
    const target = spreadsheetIds[audience] ?? "";
    if (!hasSnapshot || !target.trim()) return null;
    setPreflighting(audience);
    try {
      const result = await apiMonitoreoPublicationPreflight(target.trim(), {
        audience,
        includeTargets,
        confirmedFullData: audience === "internal" ? internalConfirmed : undefined,
        ...publicationOperationalEvidence(audience),
        ...(config ? { config } : {}),
      });
      setPreflights((current) => ({ ...current, [audience]: result.preflight }));
      return result.preflight;
    } catch (e) {
      updateStatus(audience, { kind: "error", message: (e as Error).message });
      return null;
    } finally {
      setPreflighting(null);
    }
  };

  const reviewPreflight = async () => {
    if (!canPreflightSheets) return;
    const audience = activeAudience;
    updateStatus(audience, { kind: "checking", message: `Validando salida ${audienceLabel(audience).toLowerCase()}...` });
    const preflight = await requestPreflight(audience);
    if (!preflight) return;
    if (preflight.status === "blocked") {
      updateStatus(audience, { kind: "error", message: "Validación bloqueada. Revisa los bloqueos antes de publicar." });
    } else if (preflight.status === "warnings") {
      updateStatus(audience, { kind: "idle", message: "Validación con advertencias. La publicación queda bajo revisión." });
    } else {
      updateStatus(audience, { kind: "idle", message: "Validación lista para publicar." });
    }
  };

  const generateEvidencePack = async () => {
    if (!canGenerateEvidencePack) return;
    const audience = activeAudience;
    setEvidencePacking(audience);
    setEvidencePacks((current) => ({ ...current, [audience]: null }));
    setEvidenceStatuses((current) => ({
      ...current,
      [audience]: { kind: "generating", message: `Generando soporte ${audienceLabel(audience).toLowerCase()}...` },
    }));
    try {
      const result = await apiMonitoreoPublicationEvidencePack(activeTarget.trim(), {
        audience,
        includeTargets,
        confirmedFullData: audience === "internal" ? internalConfirmed : undefined,
        ...publicationOperationalEvidence(audience),
        ...(config ? { config } : {}),
      });
      const preflightStatus = result.preflight?.status ?? "ready";
      const statusKind: EvidencePackStatus["kind"] = preflightStatus === "blocked"
        ? "blocked"
        : preflightStatus === "warnings"
          ? "warnings"
          : "ready";
      setPreflights((current) => ({ ...current, [audience]: result.preflight }));
      setEvidencePacks((current) => ({ ...current, [audience]: result }));
      setEvidenceStatuses((current) => ({
        ...current,
        [audience]: {
          kind: statusKind,
        message: statusKind === "blocked"
          ? "Soporte generado con validación bloqueada."
          : statusKind === "warnings"
            ? "Soporte generado con advertencias."
            : "Soporte de publicación listo.",
          detail: [result.filename, formatBytes(result.size)].filter(Boolean).join(" · "),
        },
      }));
    } catch (e) {
      setEvidenceStatuses((current) => ({
        ...current,
        [audience]: { kind: "error", message: (e as Error).message },
      }));
    } finally {
      setEvidencePacking(null);
    }
  };

  const uploadOperationalPackage = async (file?: File | null) => {
    if (!file || !canUploadOperationalPackage) return;
    setUploadingOperationalPackage(true);
    setOperationalReview(null);
    setOperationalReviewStatus({ kind: "idle", message: "" });
    try {
      const meta = await apiUpload(file, "monitoreo_operational_package");
      setOperationalPackageUpload({
        fileId: meta.file_id,
        filename: meta.original_name || file.name,
        size: meta.size,
      });
    } catch (e) {
      setOperationalReviewStatus({
        kind: "error",
        message: (e as Error).message,
      });
    } finally {
      setUploadingOperationalPackage(false);
    }
  };

  const uploadOperationalDrift = async (file?: File | null) => {
    if (!file || !canUploadOperationalDrift) return;
    setUploadingOperationalDrift(true);
    setOperationalReview(null);
    setOperationalReviewStatus({ kind: "idle", message: "" });
    try {
      const meta = await apiUpload(file, "monitoreo_reference_drift");
      setOperationalDriftUpload({
        fileId: meta.file_id,
        filename: meta.original_name || file.name,
        size: meta.size,
      });
    } catch (e) {
      setOperationalReviewStatus({
        kind: "error",
        message: (e as Error).message,
      });
    } finally {
      setUploadingOperationalDrift(false);
    }
  };

  const reviewOperationalPackage = async () => {
    if (!canReviewOperationalPackage) return;
    setReviewingOperationalPackage(true);
    setOperationalReview(null);
    setOperationalReviewStatus({
      kind: "reviewing",
      message: "Validando paquete operacional territorial...",
    });
    try {
      const result = await apiMonitoreoTerritorialOperationalPackageReview({
        ...(operationalPackageUpload ? { packageFileId: operationalPackageUpload.fileId } : {}),
        ...(operationalDriftUpload ? { driftFileId: operationalDriftUpload.fileId } : {}),
        source: monitoreoOperationalPackageReviewSource(operationalPackageUpload, operationalDriftUpload),
        cut: syncedAt || "",
        project: defaultTitle || routeLabel,
        ...(config ? { config } : {}),
      });
      const statusKind = monitoreoOperationalPackageStatusKind(result);
      setOperationalReview(result);
      setOperationalReviewStatus({
        kind: statusKind,
        message: monitoreoOperationalPackageMessage(result, statusKind),
        detail: monitoreoOperationalPackageDetail(result),
      });
    } catch (e) {
      setOperationalReviewStatus({
        kind: "error",
        message: (e as Error).message,
      });
    } finally {
      setReviewingOperationalPackage(false);
    }
  };

  const generatePdf = async () => {
    if (!canGeneratePdf) return;
    setPdfReady(false);
    setPdfProgress(3);
    setPdfMessage("");
    setPdfError("");
    try {
      const start = await apiMonitoreoClientReportPdf({ includeTargets, ...(config ? { config } : {}) });
      setPdfJobId(start.job_id);
    } catch (e) {
      setPdfProgress(null);
      setPdfError((e as Error).message);
    }
  };

  const generateProductionPdf = async () => {
    if (!canGenerateProductionPdf) return;
    setProductionPdfReady(false);
    setProductionPdfProgress(3);
    setProductionPdfMessage("");
    setProductionPdfError("");
    try {
      const title = productionPdfTitle.trim() || productionDefaultTitle;
      const start = await apiMonitoreoProductionReportPdf({
        includeTargets,
        title,
        ...(config ? { config } : {}),
      });
      setProductionPdfJobId(start.job_id);
    } catch (e) {
      setProductionPdfProgress(null);
      setProductionPdfError((e as Error).message);
    }
  };

  const openProcessing = async () => {
    if (!processingBase) {
      navigate("/carga");
      return;
    }
    setProcessingStatus({
      kind: "setting",
      message: `Activando ${processingBaseLabel(selectedProcessingBase) || processingBase}...`,
    });
    try {
      await apiEstudioActiveBaseSet(processingBase);
      setProcessingStatus({
        kind: "success",
        message: "Base activa lista en Procesamiento.",
        detail: processingBaseDetail(selectedProcessingBase),
      });
      window.dispatchEvent(new CustomEvent("pulso:project-status-changed"));
      navigate("/procesamiento");
    } catch (e) {
      setProcessingStatus({ kind: "error", message: (e as Error).message });
    }
  };

  const publishSheets = async () => {
    if (!canPublishSheets) return;
    const audience = activeAudience;
    setPublishing(audience);
    updateStatus(audience, { kind: "checking", message: `Validando salida ${audienceLabel(audience).toLowerCase()}...` });
    try {
      const preflight = await requestPreflight(audience);
      if (!preflight) return;
      if (preflight.status === "blocked") {
        updateStatus(audience, { kind: "error", message: "Validación bloqueada. No se publicó en Sheets." });
        return;
      }
      updateStatus(audience, { kind: "publishing", message: `Actualizando Sheets ${audienceLabel(audience).toLowerCase()}...` });
      const out = await apiMonitoreoPublicationSheetsPublish(activeTarget.trim(), {
        audience,
        includeTargets,
        confirmedFullData: audience === "internal" ? internalConfirmed : undefined,
        ...publicationOperationalEvidence(audience),
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
  const pdfButtonProgress = pdfJobId ? Math.max(8, Math.min(100, pdfProgress ?? 35)) : pdfReady ? 100 : 0;
  const productionPdfButtonProgress = productionPdfJobId
    ? Math.max(8, Math.min(100, productionPdfProgress ?? 35))
    : productionPdfReady
      ? 100
      : 0;
  const publishRunning = publishing === activeAudience || preflighting === activeAudience;
  const publishProgress = publishRunning
    ? activeStatus.kind === "publishing"
      ? 72
      : 34
    : activeStatus.kind === "success"
      ? 100
      : 0;
  const publishButtonLabel = publishRunning
    ? activeStatus.kind === "publishing"
      ? `Publicando Sheets ${audienceLabel(activeAudience).toLowerCase()}`
      : `Validando salida ${audienceLabel(activeAudience).toLowerCase()}`
    : activeReady
      ? `Actualizar Sheets ${audienceLabel(activeAudience).toLowerCase()}`
      : `Publicar Sheets ${audienceLabel(activeAudience).toLowerCase()}`;
  const processingBaseName = processingStatus.kind === "loading"
    ? "Leyendo bases..."
    : processingBaseLabel(selectedProcessingBase) || "Sin base de procesamiento";
  const processingBaseMeta = processingStatus.kind === "loading"
    ? "Preparando puente con Procesamiento."
    : processingBaseDetail(selectedProcessingBase) || "Carga una base antes de continuar.";
  const operationalFiles = [
    { key: "template", label: "Plantilla", file: operationalReview?.files?.template },
    { key: "review_csv", label: "Revisión CSV", file: operationalReview?.files?.review_csv },
    { key: "report_json", label: "Reporte JSON", file: operationalReview?.files?.report_json },
    { key: "report_md", label: "Reporte MD", file: operationalReview?.files?.report_md },
  ].filter((item) => item.file?.download_url);

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
                  onChange={(event) => {
                    setIncludeTargets(event.target.checked);
                    setPreflights({ client: null, internal: null });
                    setEvidencePacks({ client: null, internal: null });
                    setEvidenceStatuses(emptyEvidencePackStatuses());
                  }}
              disabled={!hasSnapshot || Boolean(pdfJobId) || Boolean(productionPdfJobId) || Boolean(publishing) || Boolean(preflighting) || Boolean(evidencePacking) || operationalBusy}
            />
            <span>Incluir metas</span>
          </label>
        ) : null}
      </header>

      <div className="mon-outputs-grid">
        <div className="mon-outputs-side-stack">
          <article className="mon-outputs-card mon-outputs-card--pdf">
            <div className="mon-outputs-card__head">
              <span>{copy.eyebrow}</span>
              <strong>{copy.title}</strong>
              <small>{copy.detail}</small>
            </div>
            {!hasSnapshot ? (
              <div className="mon-outputs-alert is-error"><AlertTriangle size={14} /> Sincroniza un corte antes de generar el PDF.</div>
            ) : null}
            <button
              type="button"
              className={`mon-outputs-primary mon-outputs-action-progress${pdfJobId ? " is-running" : ""}${pdfReady ? " is-complete" : ""}`}
              onClick={() => { void generatePdf(); }}
              disabled={!canGeneratePdf}
              style={{ "--mon-output-action-progress": `${pdfButtonProgress}%` } as CSSProperties}
            >
              {pdfJobId ? <Loader2 size={14} className="pulso-spin" /> : pdfReady ? <CheckCircle2 size={14} /> : <Download size={14} />}
              {pdfJobId ? copy.progress : pdfReady ? copy.ready : copy.button}
            </button>
            <JobStatusLine
              jobId={pdfJobId}
              label={copy.progress}
              onProgress={setPdfProgress}
              onDone={() => {
                setPdfJobId(null);
                setPdfProgress(100);
                setPdfReady(true);
                setPdfMessage(copy.ready);
              }}
              onError={(message) => {
                setPdfJobId(null);
                setPdfProgress(null);
                setPdfError(message);
              }}
              onCancelled={() => {
                setPdfJobId(null);
                setPdfProgress(null);
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

          <article className="mon-outputs-card mon-outputs-card--production">
            <div className="mon-outputs-card__head">
              <span><UsersRound size={14} /> {productionCopy.eyebrow}</span>
              <strong>{productionCopy.title}</strong>
              <small>{productionCopy.detail}</small>
            </div>
            <div className="mon-outputs-production-tags" aria-label="Contenido del reporte de producción">
              <span>Orden por apellido</span>
              <span>Detalle por responsable</span>
            </div>
            <label className="mon-outputs-field mon-outputs-production-title">
              <span>Título del PDF</span>
              <input
                type="text"
                value={productionPdfTitle}
                maxLength={140}
                placeholder={productionDefaultTitle}
                disabled={Boolean(productionPdfJobId)}
                onChange={(event) => setProductionPdfTitle(event.target.value)}
              />
              <small>Se usará en la portada y en el encabezado del reporte.</small>
            </label>
            {!hasSnapshot ? (
              <div className="mon-outputs-alert is-error"><AlertTriangle size={14} /> Sincroniza un corte antes de generar producción.</div>
            ) : null}
            <button
              type="button"
              className={`mon-outputs-primary mon-outputs-action-progress${productionPdfJobId ? " is-running" : ""}${productionPdfReady ? " is-complete" : ""}`}
              onClick={() => { void generateProductionPdf(); }}
              disabled={!canGenerateProductionPdf}
              style={{ "--mon-output-action-progress": `${productionPdfButtonProgress}%` } as CSSProperties}
            >
              {productionPdfJobId ? <Loader2 size={14} className="pulso-spin" /> : productionPdfReady ? <CheckCircle2 size={14} /> : <UsersRound size={14} />}
              {productionPdfJobId ? productionCopy.progress : productionPdfReady ? productionCopy.ready : productionCopy.button}
            </button>
            <JobStatusLine
              jobId={productionPdfJobId}
              label={productionCopy.progress}
              onProgress={setProductionPdfProgress}
              onDone={() => {
                setProductionPdfJobId(null);
                setProductionPdfProgress(100);
                setProductionPdfReady(true);
                setProductionPdfMessage(productionCopy.ready);
              }}
              onError={(message) => {
                setProductionPdfJobId(null);
                setProductionPdfProgress(null);
                setProductionPdfError(message);
              }}
              onCancelled={() => {
                setProductionPdfJobId(null);
                setProductionPdfProgress(null);
                setProductionPdfMessage("Generación cancelada.");
              }}
            />
            {productionPdfError ? <div className="mon-outputs-alert is-error"><AlertTriangle size={14} /> {productionPdfError}</div> : null}
            {productionPdfMessage ? <div className="mon-outputs-alert is-info"><CheckCircle2 size={14} /> {productionPdfMessage}</div> : null}
            {productionPdfReady ? (
              <a className="mon-outputs-download" href={monitoreoProductionReportPdfDownloadUrl()} download>
                <Download size={14} />
                {productionCopy.download}
              </a>
            ) : null}
          </article>

          <article className="mon-outputs-card mon-outputs-card--processing">
            <div className="mon-outputs-card__head">
              <span><Database size={14} /> Base final del corte</span>
              <strong>Procesamiento</strong>
              <small>{hasSnapshot ? snapshotHint : "Esperando corte sincronizado"}</small>
            </div>
            {processingBases.length > 1 ? (
              <label className="mon-outputs-field">
                <span>Base activa</span>
                <select
                  value={processingBase}
                  onChange={(event) => {
                    setProcessingBase(event.target.value);
                    setProcessingStatus({ kind: "ready", message: "Base disponible para abrir Procesamiento." });
                  }}
                  disabled={processingStatus.kind === "loading" || processingStatus.kind === "setting"}
                >
                  {processingBases.map((base) => (
                    <option key={base.nombre} value={base.nombre}>
                      {processingBaseLabel(base)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="mon-outputs-processing-base">
                <span><Database size={14} /></span>
                <div>
                  <strong>{processingBaseName}</strong>
                  <small>{processingBaseMeta}</small>
                </div>
              </div>
            )}
            <div className={`mon-outputs-status is-${processingStatus.kind}`} role="status" aria-live="polite">
              <span>{processingStatus.message || "Base lista para activar."}</span>
              {processingStatus.detail ? <small>{processingStatus.detail}</small> : null}
            </div>
            <button
              type="button"
              className="mon-outputs-processing-link"
              onClick={() => { void openProcessing(); }}
              disabled={processingBusy}
            >
              {processingBusy ? <Loader2 size={14} className="pulso-spin" /> : <ArrowRight size={14} />}
              {processingBusy ? "Preparando puente" : processingBase ? "Abrir en Procesamiento" : "Abrir Carga"}
            </button>
          </article>
        </div>

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
                  onChange={(event) => {
                    setInternalConfirmed(event.target.checked);
                    setPreflights((current) => ({ ...current, internal: null }));
                    setEvidencePacks((current) => ({ ...current, internal: null }));
                    setEvidenceStatuses((current) => ({ ...current, internal: { kind: "idle", message: "" } }));
                    setOperationalReview(null);
                    setOperationalReviewStatus({ kind: "idle", message: "" });
                    setOperationalPackageUpload(null);
                    setOperationalDriftUpload(null);
                  }}
                  disabled={Boolean(publishing) || Boolean(preflighting) || Boolean(evidencePacking) || operationalBusy}
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
                  setPreflights((current) => ({ ...current, [activeAudience]: null }));
                  setEvidencePacks((current) => ({ ...current, [activeAudience]: null }));
                  setEvidenceStatuses((current) => ({ ...current, [activeAudience]: { kind: "idle", message: "" } }));
                }}
                disabled={Boolean(publishing) || Boolean(preflighting) || Boolean(evidencePacking) || operationalBusy}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </label>
            {activePreflight || preflighting === activeAudience ? (
              <div className={`mon-outputs-preflight is-${preflighting === activeAudience ? "checking" : activePreflight?.status ?? "idle"}`}>
                <div className="mon-outputs-preflight__summary">
                  <span>
                    {preflighting === activeAudience ? <Loader2 size={14} className="pulso-spin" /> : activePreflight?.status === "blocked" ? <ShieldAlert size={14} /> : activePreflight?.status === "warnings" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  </span>
                  <div>
                    <strong>{preflighting === activeAudience ? "Validando salida" : preflightHeading(activePreflight)}</strong>
                    <small>{preflighting === activeAudience ? "Revisando contrato de publicación..." : preflightDetail(activePreflight)}</small>
                  </div>
                </div>
                {preflightIssues(activePreflight).length ? (
                  <ul>
                    {preflightIssues(activePreflight).map((issue) => (
                      <li key={`${issue.code}-${issue.message}`}>
                        <strong>{issue.code}</strong>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {activeEvidenceStatus.kind !== "idle" || activeEvidencePack ? (
              <div className={`mon-outputs-evidence is-${activeEvidenceStatus.kind}`} role="status" aria-live="polite">
                <div className="mon-outputs-evidence__summary">
                  <span>
                    {evidencePacking === activeAudience
                      ? <Loader2 size={14} className="pulso-spin" />
                      : activeEvidenceStatus.kind === "blocked"
                        ? <ShieldAlert size={14} />
                        : activeEvidenceStatus.kind === "warnings"
                          ? <AlertTriangle size={14} />
                          : activeEvidenceStatus.kind === "error"
                            ? <AlertTriangle size={14} />
                            : <Archive size={14} />}
                  </span>
                  <div>
                    <strong>Soporte de publicación</strong>
                    <small>{activeEvidenceStatus.message}</small>
                    {activeEvidenceStatus.detail ? <small>{activeEvidenceStatus.detail}</small> : null}
                    {activeEvidenceHighlights.length ? (
                      <div className="mon-outputs-evidence__highlights" aria-label="Contenido clave del soporte de publicación">
                        {activeEvidenceHighlights.map((item) => (
                          <small key={item.kind}>
                            <strong>{item.label}:</strong> {item.detail}
                          </small>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {activeEvidencePack?.download_url ? (
                  <a className="mon-outputs-download" href={activeEvidencePack.download_url} download>
                    <Download size={14} />
                    Descargar evidencia
                  </a>
                ) : null}
                {activeEvidenceFiles.length ? (
                  <div className="mon-outputs-evidence__files" aria-label="Archivos directos del soporte de publicación">
                    {activeEvidenceFiles.map((item) => (
                      <a key={item.key} className="mon-outputs-download" href={item.downloadUrl} download>
                        <Download size={14} />
                        {item.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showOperationalPackageReview ? (
              <>
                <div className={`mon-outputs-operational-upload${operationalDriftUpload ? " is-ready" : ""}${uploadingOperationalDrift ? " is-uploading" : ""}`}>
                  <div className="mon-outputs-operational-upload__copy">
                    <span>{uploadingOperationalDrift ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}</span>
                    <div>
                      <strong>Drift / referencia validada</strong>
                      <small>
                        {operationalDriftUpload
                          ? [operationalDriftUpload.filename, formatBytes(operationalDriftUpload.size)].filter(Boolean).join(" · ")
                          : "CSV/XLSX requerido para contrastar el paquete."}
                      </small>
                    </div>
                  </div>
                  <label className="mon-outputs-upload-button" aria-disabled={!canUploadOperationalDrift}>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      disabled={!canUploadOperationalDrift}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        void uploadOperationalDrift(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    {uploadingOperationalDrift ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}
                    {operationalDriftUpload ? "Reemplazar referencia" : "Cargar referencia"}
                  </label>
                </div>
                <div className={`mon-outputs-operational-upload${operationalPackageUpload ? " is-ready" : ""}${uploadingOperationalPackage ? " is-uploading" : ""}`}>
                  <div className="mon-outputs-operational-upload__copy">
                    <span>{uploadingOperationalPackage ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}</span>
                    <div>
                      <strong>Paquete operacional completado</strong>
                      <small>
                        {operationalPackageUpload
                          ? [operationalPackageUpload.filename, formatBytes(operationalPackageUpload.size)].filter(Boolean).join(" · ")
                          : "CSV/XLSX para revisar contra el drift validado."}
                      </small>
                    </div>
                  </div>
                  <label className="mon-outputs-upload-button" aria-disabled={!canUploadOperationalPackage}>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      disabled={!canUploadOperationalPackage}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        void uploadOperationalPackage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    {uploadingOperationalPackage ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}
                    {operationalPackageUpload ? "Reemplazar archivo" : "Cargar CSV/XLSX"}
                  </label>
                </div>
              </>
            ) : null}
            {showOperationalPackageReview && (operationalReviewStatus.kind !== "idle" || operationalReview) ? (
              <div className={`mon-outputs-operational is-${operationalReviewStatus.kind}`} role="status" aria-live="polite">
                <div className="mon-outputs-operational__summary">
                  <span>
                    {reviewingOperationalPackage
                      ? <Loader2 size={14} className="pulso-spin" />
                      : operationalReviewStatus.kind === "ready"
                        ? <CheckCircle2 size={14} />
                        : operationalReviewStatus.kind === "applicable"
                          ? <AlertTriangle size={14} />
                        : operationalReviewStatus.kind === "error"
                          ? <AlertTriangle size={14} />
                          : <ShieldAlert size={14} />}
                  </span>
                  <div>
                    <strong>Paquete operacional territorial</strong>
                    <small>{operationalReviewStatus.message}</small>
                    {operationalReviewStatus.detail ? <small>{operationalReviewStatus.detail}</small> : null}
                    <small>Solo revisión; no modifica .pulso.</small>
                  </div>
                </div>
                {operationalFiles.length ? (
                  <div className="mon-outputs-operational__files" aria-label="Archivos del paquete operacional">
                    {operationalFiles.map((item) => (
                      <a key={item.key} className="mon-outputs-download" href={item.file?.download_url} download>
                        <Download size={14} />
                        {item.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mon-outputs-sheets-actions mon-outputs-sheets-actions--primary">
              <button
                type="button"
                className={`mon-outputs-publish-button mon-outputs-action-progress${publishRunning ? " is-running" : ""}${activeStatus.kind === "success" ? " is-complete" : ""}`}
                onClick={() => { void publishSheets(); }}
                disabled={!canPublishSheets}
                style={{ "--mon-output-action-progress": `${publishProgress}%` } as CSSProperties}
              >
                {publishing === activeAudience ? <Loader2 size={14} className="pulso-spin" /> : <Table2 size={14} />}
                {publishButtonLabel}
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
            <details className="mon-outputs-diagnostics">
              <summary>
                <span><ShieldAlert size={14} /> Validación y soporte</span>
                <small>Opcional para revisión interna</small>
              </summary>
              <div className="mon-outputs-sheets-actions mon-outputs-sheets-actions--diagnostics">
                {showOperationalPackageReview ? (
                  <button type="button" className="mon-outputs-secondary" onClick={() => { void reviewOperationalPackage(); }} disabled={!canReviewOperationalPackage}>
                    {reviewingOperationalPackage ? <Loader2 size={14} className="pulso-spin" /> : <ShieldAlert size={14} />}
                    Validar paquete territorial
                  </button>
                ) : null}
                <button type="button" className="mon-outputs-secondary" onClick={() => { void reviewPreflight(); }} disabled={!canPreflightSheets}>
                  {preflighting === activeAudience ? <Loader2 size={14} className="pulso-spin" /> : <ShieldAlert size={14} />}
                  Validar salida
                </button>
                <button type="button" className="mon-outputs-secondary" onClick={() => { void generateEvidencePack(); }} disabled={!canGenerateEvidencePack}>
                  {evidencePacking === activeAudience ? <Loader2 size={14} className="pulso-spin" /> : <Archive size={14} />}
                  Descargar soporte
                </button>
              </div>
            </details>
          </div>
        </article>
      </div>
    </section>
  );
}
