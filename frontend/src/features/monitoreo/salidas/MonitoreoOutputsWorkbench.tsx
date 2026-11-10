import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
  Table2,
  Upload,
} from "lucide-react";
import {
  apiMonitoreoClientReportPdf,
  apiMonitoreoProcessingHandoffExport,
  apiMonitoreoPublicationEvidencePack,
  apiMonitoreoPublicationPreflight,
  apiMonitoreoPublicationSheetsPublish,
  apiMonitoreoProductionReportPdf,
  apiMonitoreoTerritorialOperationalPackageReview,
  apiUpload,
  type MonitoreoConfig,
  type MonitoreoDeliverablesPreflight,
  type MonitoreoLastSheetsPublication,
  type MonitoreoPortadaPdf,
  type MonitoreoProcessingHandoffResult,
  type MonitoreoProcessingHandoffUniverse,
  type MonitoreoPublicationEvidencePackResult,
  type MonitoreoTerritorialOperationalPackageReviewResult,
} from "../../../api/client";
import { apiMonitoreoPublicationSheetsRevisar } from "../../../api/monitoreoPublicarEnsayo";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { PANEL_REVISAR_PUBLICACION } from "../../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { formatoConteo, formatoDecimal } from "../../../lib/formatoNumero";
import { EnsayoPublicacionDialog, type EstadoEnsayo } from "./EnsayoPublicacionDialog";
import { Switch } from "../../../components/Switch";
import { readinessDeSalidas, type MonitoreoCorte } from "../corte/corteContract";
import { MonitoreoOutputsReadiness } from "./MonitoreoOutputsReadiness";
import { ArchivosSueltos } from "../entregas/ArchivosSueltos";
import { EntregaEnBloque } from "../entregas/EntregaEnBloque";
import { useEntrega } from "../entregas/useEntrega";
import { archivosDeLaEvidencia, archivosDeLaRevisionOperativa, plantillaDeLaRevisionOperativa } from "./archivosDeSalidas";
import { TarjetaPdfDeAvance } from "./TarjetaPdfDeAvance";
import { TarjetaProcesamiento } from "./TarjetaProcesamiento";
import { TarjetaProduccion } from "./TarjetaProduccion";
import "./outputsWorkbench.css";

type OutputAudience = "client" | "internal";
type OutputFamily = "acreditacion" | "territorial" | "telefonico" | "aulas";

/**
 * Qué PDF sabe emitir cada familia.
 *
 * La garantía vive acá y no en el call site a propósito: si el permiso
 * dependiera de que cada montaje recuerde pasar la prop, el primer montaje que
 * la olvide vuelve a ofrecer el documento equivocado.
 *
 * **`aulas.client` pasó a `true` el 2026-09-11.** Estaba en `false` porque
 * `.monitoreo_client_report_model_for_snapshot()` sólo ramificaba para
 * territorial y telefónico, así que cursos-horario caía al modelo de
 * acreditación y el botón habría entregado un documento con «actores» y
 * «encuestas» que ese perfil no tiene. Esa rama existe desde el 2026-08-27
 * (`build_monitoreo_aulas_report_model`) y el reporte se terminó el 2026-09-11:
 * el guard llevaba dos semanas protegiendo contra algo ya arreglado, y sólo se
 * vio al abrir la app y no encontrar la tarjeta.
 *
 * `aulas.production` sigue en `false`: el PDF de producción por aplicador es
 * otro reporte, y el motor de aulas no lo construye.
 */
export const PDF_POR_FAMILIA: Record<OutputFamily, { client: boolean; production: boolean }> = {
  acreditacion: { client: true, production: true },
  territorial: { client: true, production: true },
  telefonico: { client: true, production: true },
  aulas: { client: true, production: false },
};
type PublicationStatus = {
  kind: "idle" | "checking" | "publishing" | "success" | "error";
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
export type OperationalPackageStatus = {
  kind: "idle" | "reviewing" | "missing" | "applicable" | "ready" | "blocked" | "error";
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
  /**
   * Corte canónico. Reemplaza al par `hasSnapshot`/`nRows`: el conteo crudo del
   * snapshot habilitaba salidas de cliente con cero válidas, que es el hallazgo
   * P1 de la auditoría del 25-07-2026.
   */
  corte: MonitoreoCorte;
  syncedAt?: string;
  includeTargetsSupported?: boolean;
  /**
   * Override puntual de lo que `PDF_POR_FAMILIA` ya declara. Solo para un
   * montaje que necesite recortar más; el default por familia no depende de que
   * el call site recuerde pasarlo.
   */
  pdfSupport?: { client?: boolean; production?: boolean };
  className?: string;
  onPublished?: () => void;
  /**
   * Detalle bajo «Válidas» cuando el modo lee otra cifra. Sólo lo pasa el
   * telefónico («69 con cuota y 1 sin actor»); los demás modos no cambian.
   */
  notaDeValidas?: string;
  /** El embudo propio del perfil para el bloque de publicación (ver MonitoreoOutputsReadiness). */
  embudo?: ReactNode;
  /**
   * Cabecera como primera tarjeta de una ficha (§2a-bis del estándar de
   * Monitoreo): antetítulo sin píldora, el corte en una sola línea (los granos
   * ya van debajo, en el estado del corte) y «Incluir metas» como interruptor
   * simple. También quita el teñido de las tarjetas: el estado va en el borde
   * lateral y en su chip.
   *
   * Cierre de QA (2026-10-25): es la forma de los tres modos de Monitoreo
   * —telefónico, acreditación y territorial—, pasen o no la prop; el bloque
   * «Listo» teñido de verde, el antetítulo en píldora y el título truncado
   * eran de la forma anterior. Cursos-horario la conserva mientras su hoja
   * (`aulasMonitoreo.css`) no se revise con captura.
   */
  variante?: "ficha";
  /**
   * El rótulo de la pestaña («AVANCE / Salidas»), para que encabece esta
   * primera tarjeta en vez de flotar sobre ella sin contenedor (§2a-bis; QA
   * final, Territorial › Avance › Salidas). Con rótulo, el antetítulo propio
   * «Salidas del avance» sobra y no se pinta.
   */
  rotulo?: ReactNode;
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
  if (n >= 1024 * 1024) return `${formatoDecimal(n / (1024 * 1024), 1)} MB`;
  if (n >= 1024) return `${formatoConteo(n / 1024)} KB`;
  return `${formatoConteo(n)} B`;
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
      sheetsTitle: "Salidas territoriales a Sheets",
    };
  }
  if (family === "telefonico") {
    return {
      eyebrow: "PDF telefónico",
      title: "PDF de avance telefónico",
      detail: "Avance, ritmo diario y cuotas",
      button: "Generar PDF telefónico",
      sheetsTitle: "Salidas telefónicas a Sheets",
    };
  }
  if (family === "aulas") {
    return {
      eyebrow: "PDF de cursos-horario",
      title: "PDF de avance por cursos-horario",
      detail: "Aplicación por aula, cuotas y brechas del corte activo.",
      button: "Generar PDF de avance",
      sheetsTitle: "Salidas de cursos-horario a Sheets",
    };
  }
  return {
    eyebrow: "PDF ejecutivo",
    title: "PDF ejecutivo",
    detail: "Lectura ejecutiva del avance y respuestas del corte activo.",
    button: "Generar PDF ejecutivo",
    // Reúne Sheets, PDF ejecutivo y producción: no sólo «a Sheets».
    sheetsTitle: "Entregables del corte",
  };
}

function productionCopyForFamily(family: OutputFamily) {
  if (family === "territorial") {
    return {
      eyebrow: "Producción",
      title: "Producción por encuestador",
      detail: "Resumen por apellido y detalle de UMP completadas por responsable.",
      button: "Generar PDF de producción",
    };
  }
  if (family === "telefonico") {
    return {
      eyebrow: "Producción telefónica",
      title: "Producción por responsable",
      detail: "Por responsable, con sus estados de llamada",
      button: "Generar PDF de producción telefónica",
    };
  }
  if (family === "aulas") {
    return {
      eyebrow: "Producción",
      title: "Producción por responsable",
      detail: "Cursos-horario aplicados por responsable de campo y trazabilidad de la agenda.",
      button: "Generar PDF de producción",
    };
  }
  return {
    eyebrow: "Producción",
    title: "Producción por responsable",
    // Rama de acreditación: sin «telefónica», que el estudio puede ser sólo de correo (#21, 29/10).
    detail: "Respuestas del corte por responsable o recopilador, en orden alfabético.",
    button: "Generar PDF de producción",
  };
}

function productionPdfTitleSeed(family: OutputFamily, defaultTitle: string, routeLabel: string) {
  const cleanTitle = (defaultTitle || "").trim();
  const cleanRoute = (routeLabel || "").trim();
  const generic = /^(reporte[-\s]?monitoreo|reporte[-\s]?territorial|territorial|acreditaci[oó]n|telef[oó]nico|monitoreo telef[oó]nico|estudio de acreditaci[oó]n)$/i;
  const base = cleanTitle && !generic.test(cleanTitle) ? cleanTitle : cleanRoute;
  if (family === "telefonico") {
    return base && !generic.test(base) ? `Producción telefónica - ${base}` : "Producción telefónica";
  }
  const fallback = family === "territorial"
    ? "monitoreo territorial"
    : family === "aulas"
      ? "monitoreo de cursos-horario"
      : "monitoreo de acreditación";
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
  if (preflightHasOnlyColdPerformanceWarnings(preflight)) return "Validación lista, generación lenta";
  if (preflight.status === "warnings") return "Validación con advertencias";
  return "Validación lista";
}

function preflightDetail(preflight?: MonitoreoDeliverablesPreflight | null) {
  if (!preflight) return "";
  const blocking = preflight.scorecard?.blocking_count ?? preflight.blocking_issues?.length ?? 0;
  const warnings = preflight.scorecard?.warning_count ?? preflight.warnings?.length ?? 0;
  if (preflightHasOnlyColdPerformanceWarnings(preflight)) {
    return `${Math.round(Number(preflight.score) || 0)}/100, sin bloqueos, la generación en frío tardó más de lo esperado`;
  }
  return `${Math.round(Number(preflight.score) || 0)}/100, ${blocking} bloqueos, ${warnings} advertencias`;
}

export function preflightHasOnlyColdPerformanceWarnings(preflight?: MonitoreoDeliverablesPreflight | null) {
  if (!preflight || preflight.status !== "warnings") return false;
  const blocking = preflight.blocking_issues ?? [];
  const warnings = preflight.warnings ?? [];
  return blocking.length === 0 && warnings.length > 0 && warnings.every((issue) => issue.code === "cold_performance_over_threshold");
}

function preflightIssues(preflight?: MonitoreoDeliverablesPreflight | null) {
  if (!preflight) return [];
  return [...(preflight.blocking_issues ?? []), ...(preflight.warnings ?? [])]
    .map((issue) => issue.code === "cold_performance_over_threshold"
      ? {
          ...issue,
          message: "La generación en frío tardó más de lo esperado; no bloquea la publicación.",
        }
      : issue)
    .slice(0, 3);
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

export function monitoreoProcessingHandoffDetail(result?: MonitoreoProcessingHandoffResult | null) {
  const counts = result?.counts;
  if (!counts) return "";
  const statusLabel = (result?.included_statuses ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(" + ");
  return [
    `${fmt(counts.exported_rows ?? 0)} filas`,
    statusLabel ? `estatus ${statusLabel}` : "",
  ].filter(Boolean).join(", ");
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
  ].filter(Boolean).join(", ");
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

export function MonitoreoOutputsWorkbench({
  family,
  routeLabel,
  defaultTitle = "",
  config,
  clientSheets,
  internalSheets,
  corte,
  syncedAt,
  includeTargetsSupported = true,
  pdfSupport,
  className = "",
  onPublished,
  notaDeValidas,
  embudo,
  variante,
  rotulo,
}: MonitoreoOutputsWorkbenchProps) {
  const ficha = variante === "ficha" || family !== "aulas";
  const pdfDeLaFamilia = PDF_POR_FAMILIA[family] ?? { client: true, production: true };
  const ofreceClientPdf = pdfSupport?.client ?? pdfDeLaFamilia.client;
  // La portada existe en los renderizadores de aulas y telefónico
  // (`monitoreo_telefonico_avance_pdf.R`). Ofrecer sus campos en un perfil cuyo
  // PDF no la dibuja sería prometer un control que no hace nada.
  const ofrecePortada = ofreceClientPdf && (family === "aulas" || family === "telefonico");
  // **«Incluir metas» no hace nada en cursos-horario.** Su reporte se define
  // contra la cuota del diseño —«1.390 de 2.500», «faltan 1.110»— y apagarla lo
  // dejaría sin objeto, así que el motor ignora el parámetro. Ofrecer la casilla
  // igualmente es peor que no tenerla: quien la desmarca cree que ha cambiado
  // algo. En territorial y telefónico sí gobierna las secciones de cuotas.
  const ofreceMetasOpcionales = includeTargetsSupported && family !== "aulas";
  const ofreceProductionPdf = pdfSupport?.production ?? pdfDeLaFamilia.production;
  const hasSnapshot = corte.hasSnapshot;
  const nRows = corte.ingesta;
  const readiness = useMemo(() => readinessDeSalidas(corte), [corte]);
  // Las salidas de cliente exigen readiness completa. Las internas —producción,
  // evidencia, handoff a Procesamiento— siguen disponibles con snapshot: son
  // herramientas de diagnóstico del equipo, no entregables defendibles, y
  // apagarlas empujaría a exportar por fuera de la app.
  const salidaClienteHabilitada = readiness.puedePublicarCliente;
  const copy = copyForFamily(family);
  const productionCopy = productionCopyForFamily(family);
  const productionDefaultTitle = useMemo(
    () => productionPdfTitleSeed(family, defaultTitle, routeLabel),
    [defaultTitle, family, routeLabel],
  );

  const [includeTargets, setIncludeTargets] = useState(false);
  const [activeAudience, setActiveAudience] = useState<OutputAudience>("client");
  const [internalConfirmed, setInternalConfirmed] = useState(false);
  // Cada PDF y cada evidencia, en el contenedor del kit (ADR 0133, fase 5): el
  // job se sigue con su avance real y «Cancelar», y el archivo se entrega con
  // el nombre y la carpeta del motor. Una evidencia por audiencia, como antes.
  const pdf = useEntrega(copy.title, { formato: "pdf", articulo: "el" });
  const produccion = useEntrega(`PDF de ${productionCopy.title.charAt(0).toLowerCase()}${productionCopy.title.slice(1)}`, { formato: "pdf", articulo: "el" });
  const evidenciaCliente = useEntrega("Evidencia de publicación para el cliente", { formato: "zip", articulo: "la" });
  const evidenciaInterna = useEntrega("Evidencia de publicación interna", { formato: "zip", articulo: "la" });
  const evidencia: Record<OutputAudience, typeof evidenciaCliente> = { client: evidenciaCliente, internal: evidenciaInterna };
  const revision = useEntrega("Plantilla del paquete operativo", { formato: "csv", articulo: "la" });
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
  const [operationalReview, setOperationalReview] = useState<MonitoreoTerritorialOperationalPackageReviewResult | null>(null);
  const [operationalReviewStatus, setOperationalReviewStatus] = useState<OperationalPackageStatus>({ kind: "idle", message: "" });
  const [operationalPackageUpload, setOperationalPackageUpload] = useState<OperationalPackageUpload | null>(null);
  const [operationalDriftUpload, setOperationalDriftUpload] = useState<OperationalPackageUpload | null>(null);
  const [publishing, setPublishing] = useState<OutputAudience | null>(null);
  const [preflighting, setPreflighting] = useState<OutputAudience | null>(null);
  const evidencePacking: OutputAudience | null = evidenciaCliente.enCurso ? "client" : evidenciaInterna.enCurso ? "internal" : null;
  const reviewingOperationalPackage = revision.enCurso;
  const [uploadingOperationalPackage, setUploadingOperationalPackage] = useState(false);
  const [uploadingOperationalDrift, setUploadingOperationalDrift] = useState(false);
  const seedRef = useRef("");

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
    setOperationalReview(null);
    setOperationalReviewStatus({ kind: "idle", message: "" });
    setOperationalPackageUpload(null);
    setOperationalDriftUpload(null);
  }, [clientInitial, defaultTitle, family, internalInitial, routeLabel]);

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
  const activeEvidence = evidencia[activeAudience];
  const activeEvidenceHighlights = monitoreoEvidencePackHighlights(activeEvidencePack);
  const activeEvidenceFiles = archivosDeLaEvidencia(activeEvidencePack);
  const showOperationalPackageReview = family === "territorial" && activeAudience === "internal";
  const operationalBusy = reviewingOperationalPackage || uploadingOperationalPackage || uploadingOperationalDrift;
  // El PDF de avance es el entregable de cliente: pasa por el gate de readiness,
  // no por el conteo de filas del snapshot.
  const canGeneratePdf = salidaClienteHabilitada;
  const motivoPdfBloqueado = salidaClienteHabilitada
    ? undefined
    : readiness.bloqueos[0]?.mensaje ?? "El corte todavía no puede publicarse a cliente";
  const canGenerateProductionPdf = hasSnapshot && nRows > 0;
  const sheetsClienteBloqueado = activeAudience === "client" && !salidaClienteHabilitada;
  const canPreflightSheets = hasSnapshot &&
    !sheetsClienteBloqueado &&
    Boolean(activeTarget.trim()) &&
    !publishing &&
    !preflighting &&
    !evidencePacking &&
    !operationalBusy;
  const canPublishSheets = hasSnapshot &&
    !sheetsClienteBloqueado &&
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
  const canGenerateProcessingPackage = family === "territorial" && hasSnapshot && nRows > 0;

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

  // La evidencia es un ZIP: el contenedor lo entrega y su pie lleva lo que la
  // validación dijo y los archivos directos. Sin estado propio de «generando»:
  // la línea del contenedor es la única señal.
  const generateEvidencePack = () => {
    if (!canGenerateEvidencePack) return;
    const audience = activeAudience;
    setEvidencePacks((current) => ({ ...current, [audience]: null }));
    void evidencia[audience].ejecutar(async () => {
      const result = await apiMonitoreoPublicationEvidencePack(activeTarget.trim(), {
        audience,
        includeTargets,
        confirmedFullData: audience === "internal" ? internalConfirmed : undefined,
        ...publicationOperationalEvidence(audience),
        ...(config ? { config } : {}),
      });
      setPreflights((current) => ({ ...current, [audience]: result.preflight }));
      setEvidencePacks((current) => ({ ...current, [audience]: result }));
      return result;
    });
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

  // La revisión no muta el .pulso: su resultado va en la tarjeta del paquete y
  // sus archivos en el contenedor del kit, para verse sin descargarse (la
  // plantilla, y al pie la revisión y el reporte).
  const reviewOperationalPackage = () => {
    if (!canReviewOperationalPackage) return;
    setOperationalReview(null);
    setOperationalReviewStatus({ kind: "idle", message: "" });
    void revision.ejecutar(async () => {
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
      return plantillaDeLaRevisionOperativa(result) ?? result;
    }, { descargar: false });
  };

  // Entre el clic y el job, el servidor arma el modelo del reporte (~15 s en
  // Acreditación): el contenedor ya está en curso desde el clic (Gonzalo, 30/10).
  const generatePdf = (portada: MonitoreoPortadaPdf | undefined) => apiMonitoreoClientReportPdf({
    includeTargets,
    ...(config ? { config } : {}),
    ...(portada ? { portada } : {}),
  });

  const generateProductionPdf = (title: string) => apiMonitoreoProductionReportPdf({
    includeTargets,
    title,
    ...(config ? { config } : {}),
  });

  const generateProcessingPackage = (universe: MonitoreoProcessingHandoffUniverse) => apiMonitoreoProcessingHandoffExport({
    universe,
    ...(config ? { config } : {}),
  });

  // Revisar y Aplicar mandan el MISMO body: el backend arma el destino con el
  // mismo helper en los dos, así que el ensayo describe lo que Aplicar escribe.
  const publicationOptions = (audience: OutputAudience) => ({
    audience,
    includeTargets,
    confirmedFullData: audience === "internal" ? internalConfirmed : undefined,
    ...publicationOperationalEvidence(audience),
    ...(config ? { config } : {}),
  });

  // El mismo orden que `canPublishSheets`: se nombra la PRIMERA condición que
  // falta, no una lista genérica que mezcle públicos.
  const motivoSinPublicar = () => {
    if (!hasSnapshot) return "Sincroniza un corte antes de publicar.";
    if (sheetsClienteBloqueado) return "La salida a cliente todavía no está habilitada: revisa la preparación de Salidas.";
    if (!activeTarget.trim()) return "Configura el spreadsheet destino.";
    if (activeAudience === "internal" && !internalConfirmed) return "Confirma la salida interna para habilitar la publicación.";
    return "Hay otra operación de Salidas en curso; espera a que termine y vuelve a revisar.";
  };

  const revisarPanel = usePanelDireccionable(PANEL_REVISAR_PUBLICACION);
  const [ensayo, setEnsayo] = useState<EstadoEnsayo | null>(null);
  const revisarSheets = async () => {
    setEnsayo({ kind: "cargando" });
    try {
      const out = await apiMonitoreoPublicationSheetsRevisar(activeTarget.trim(), publicationOptions(activeAudience));
      setEnsayo({ kind: "listo", ensayo: out });
    } catch (e) {
      setEnsayo({ kind: "error", message: (e as Error).message });
    }
  };
  // Abrir el panel (por click o por `?panel=revisar-publicacion`) lanza el
  // ensayo; cerrarlo lo descarta, para que reabrir siempre lea el libro de hoy.
  useEffect(() => {
    // Abierto por dirección sin poder publicar: dice por qué, no gira para siempre.
    if (revisarPanel.abierto && ensayo === null) {
      if (canPublishSheets) void revisarSheets();
      else setEnsayo({ kind: "bloqueado", message: motivoSinPublicar() });
    }
    if (!revisarPanel.abierto && ensayo !== null) setEnsayo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisarPanel.abierto, ensayo, canPublishSheets]);

  const publishSheets = async (): Promise<boolean> => {
    if (!canPublishSheets) return false;
    const audience = activeAudience;
    setPublishing(audience);
    updateStatus(audience, { kind: "publishing", message: `Validando y actualizando Sheets ${audienceLabel(audience).toLowerCase()}...` });
    try {
      const out = await apiMonitoreoPublicationSheetsPublish(activeTarget.trim(), publicationOptions(audience));
      if (out.preflight) {
        setPreflights((current) => ({ ...current, [audience]: out.preflight ?? null }));
      }
      const next = {
        spreadsheetId: out.spreadsheet_id,
        url: spreadsheetUrl(out.spreadsheet_id),
        tabs: (out.controlled_tabs ?? []).map(String),
        updatedAt: out.updated_at || "",
      };
      setPublished((current) => ({ ...current, [audience]: next }));
      setSpreadsheetIds((current) => ({ ...current, [audience]: out.spreadsheet_id }));
      const performanceOnlyWarning = preflightHasOnlyColdPerformanceWarnings(out.preflight);
      updateStatus(audience, {
        kind: "success",
        message: performanceOnlyWarning
          ? `${next.tabs.length || 0} pestañas actualizadas. La validación solo detectó demora en frío.`
          : next.tabs.length
          ? `${next.tabs.length} pestañas actualizadas.`
          : "Publicación enviada a Google Sheets.",
        detail: out.spreadsheet_id,
      });
      onPublished?.();
      window.dispatchEvent(new CustomEvent("pulso:project-status-changed"));
      return true;
    } catch (e) {
      updateStatus(audience, { kind: "error", message: (e as Error).message });
      return false;
    } finally {
      setPublishing(null);
    }
  };

  const aplicarEnsayo = async () => {
    const ok = await publishSheets();
    if (ok) revisarPanel.cerrar();
  };

  // Antes decía solo "N registros", y ese N era la ingesta cruda: el usuario leía
  // "1.400 registros" y asumía 1.400 casos defendibles. Ahora los tres granos
  // viajan juntos y con nombre.
  //
  // El primero decía «en el snapshot», que es cómo la app guarda lo que trajo la
  // sincronización y no un concepto de investigación por encuestas. Lo que el
  // contrato de honestidad defiende es que el conteo crudo no se confunda con
  // las válidas, y «recibidas» lo distingue igual de bien sin hablar de la
  // implementación.
  // Cada dato del corte en su propio elemento, no unidos por «·» (Gonzalo, 30/10).
  const piezasDelCorte = hasSnapshot
    ? [
        `${fmt(corte.ingesta)} recibidas`,
        corte.procesable != null ? `${fmt(corte.procesable)} procesables` : null,
        `${corte.oficial == null ? "efectivas sin determinar" : `${fmt(corte.oficial)} válidas`}`,
        syncedAt ? `corte ${formatDate(syncedAt)}` : null,
      ].filter((pieza): pieza is string => Boolean(pieza))
    : [];
  const snapshotHint = hasSnapshot
    ? <span className="mon-outputs-corte-datos">{piezasDelCorte.map((pieza) => <span key={pieza}>{pieza}</span>)}</span>
    : "Sin corte sincronizado";
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
      ? `Revisar y actualizar Sheets ${audienceLabel(activeAudience).toLowerCase()}`
      : `Revisar y publicar Sheets ${audienceLabel(activeAudience).toLowerCase()}`;
  const operationalSueltos = archivosDeLaRevisionOperativa(operationalReview);
  const evidenceNotas = [
    activeEvidencePack?.preflight?.status === "blocked"
      ? "Soporte generado con validación bloqueada."
      : activeEvidencePack?.preflight?.status === "warnings"
        ? "Soporte generado con advertencias."
        : null,
    ...activeEvidenceHighlights.map((item) => `${item.label}: ${item.detail}`),
  ].filter((nota): nota is string => Boolean(nota));

  return (
    <section
      className={`mon-outputs-workbench${ficha ? " mon-outputs-workbench--ficha" : ""} ${className}`}
      aria-label="Salidas de monitoreo"
    >
      <header className="mon-outputs-workbench__head">
        {ficha && rotulo ? <span className="mon-outputs-workbench__rotulo">{rotulo}</span> : null}
        {ficha ? (
          <div>
            {rotulo ? null : <span className="mon-outputs-workbench__antetitulo">Salidas del avance</span>}
            <strong>{copy.sheetsTitle}</strong>
            <small>{hasSnapshot && syncedAt ? `Corte del ${formatDate(syncedAt)}` : hasSnapshot ? "Corte sin fecha" : "Sin corte sincronizado"}</small>
          </div>
        ) : (
          <div>
            <span><FileText size={15} /> Salidas del avance</span>
            <strong>{copy.sheetsTitle}</strong>
            <small>{snapshotHint}</small>
          </div>
        )}
        {ofreceMetasOpcionales ? (
          // Un booleano que queda puesto es un interruptor, no una casilla
          // (maqueta Meta B, L26).
          <label className="mon-outputs-targets-toggle">
            <Switch
              checked={includeTargets}
              ariaLabel="Incluir metas"
              onToggle={() => {
                setIncludeTargets((actual) => !actual);
                setPreflights({ client: null, internal: null });
                setEvidencePacks({ client: null, internal: null });
                evidenciaCliente.cerrar();
                evidenciaInterna.cerrar();
              }}
              disabled={!hasSnapshot || pdf.enCurso || produccion.enCurso || Boolean(publishing) || Boolean(preflighting) || Boolean(evidencePacking) || operationalBusy}
            />
            <span aria-hidden="true">Incluir metas</span>
          </label>
        ) : null}
      </header>

      <MonitoreoOutputsReadiness corte={corte} readiness={readiness} notaDeValidas={notaDeValidas} embudo={embudo} />

      <div className="mon-outputs-grid">
        <div className="mon-outputs-side-stack">
          {ofreceClientPdf ? (
            <TarjetaPdfDeAvance
              textos={copy}
              ofrecePortada={ofrecePortada}
              entrega={pdf}
              habilitado={canGeneratePdf}
              motivo={motivoPdfBloqueado}
              generar={generatePdf}
            />
          ) : null}

          {ofreceProductionPdf ? (
            <TarjetaProduccion
              key={productionDefaultTitle}
              textos={productionCopy}
              tituloSugerido={productionDefaultTitle}
              entrega={produccion}
              hayCorte={hasSnapshot}
              habilitado={canGenerateProductionPdf}
              generar={generateProductionPdf}
            />
          ) : null}

          <article className="mon-outputs-card mon-outputs-card--processing">
            <div className="mon-outputs-card__head">
              <span><Database size={14} /> Base final del corte</span>
              <strong>Procesamiento</strong>
              <small>{hasSnapshot ? snapshotHint : "Esperando corte sincronizado"}</small>
            </div>
            {family === "territorial" ? (
              <TarjetaProcesamiento
                key={family}
                habilitado={canGenerateProcessingPackage}
                detalleDelPaquete={monitoreoProcessingHandoffDetail}
                generar={generateProcessingPackage}
              />
            ) : (
              <p
                className="mon-outputs-processing-hint"
                title="El trabajo de campo validado se trae con su formulario para validar y codificar"
              >
                Se trae desde <strong>Carga</strong>
              </p>
            )}
          </article>
        </div>

        <article className="mon-outputs-card mon-outputs-card--sheets">
          <div className="mon-outputs-card__head" title="Cada audiencia se publica por separado">
            <span>Google Sheets</span>
            <strong>Cliente e interno</strong>
          </div>
          <GlidingTabList
            activeKey={activeAudience}
            mode="tabs"
            className="mon-outputs-audience-tabs"
            role="radiogroup"
            aria-label="Audiencia de salida"
            onRovingKeyChange={(key) => {
              if (key === "client" || key === "internal") setActiveAudience(key);
            }}
          >
            {(["client", "internal"] as const).map((audience) => {
              const ready = Boolean(published[audience]?.spreadsheetId);
              const status = statuses[audience];
              return (
                <button
                  key={audience}
                  type="button"
                  role="radio"
                  data-gliding-key={audience}
                  aria-checked={activeAudience === audience}
                  className={`is-${audience}${activeAudience === audience ? " is-active" : ""}${ready ? " is-ready" : ""}${status.kind === "error" ? " is-error" : ""}`}
                  onClick={() => setActiveAudience(audience)}
                >
                  <span>{audienceLabel(audience)}</span>
                  <strong>{statusLabel(status, ready)}</strong>
                </button>
              );
            })}
          </GlidingTabList>
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
                <Switch
                  checked={internalConfirmed}
                  ariaLabel="Confirmo que esta salida interna puede incluir datos personales, GPS, IDs y auditoría."
                  onToggle={() => {
                    setInternalConfirmed((actual) => !actual);
                    setPreflights((current) => ({ ...current, internal: null }));
                    setEvidencePacks((current) => ({ ...current, internal: null }));
                    evidenciaInterna.cerrar();
                    revision.cerrar();
                    setOperationalReview(null);
                    setOperationalReviewStatus({ kind: "idle", message: "" });
                    setOperationalPackageUpload(null);
                    setOperationalDriftUpload(null);
                  }}
                  disabled={Boolean(publishing) || Boolean(preflighting) || Boolean(evidencePacking) || operationalBusy}
                />
                <span aria-hidden="true">Confirmo que esta salida interna puede incluir datos personales, GPS, IDs y auditoría.</span>
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
                  activeEvidence.cerrar();
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
            {showOperationalPackageReview ? (
              <>
                <div className={`mon-outputs-operational-upload${operationalDriftUpload ? " is-ready" : ""}${uploadingOperationalDrift ? " is-uploading" : ""}`}>
                  <div className="mon-outputs-operational-upload__copy">
                    <span>{uploadingOperationalDrift ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}</span>
                    <div>
                      <strong>Drift / referencia validada</strong>
                      <small>
                        {operationalDriftUpload
                          ? [operationalDriftUpload.filename, formatBytes(operationalDriftUpload.size)].filter(Boolean).join(", ")
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
                          ? [operationalPackageUpload.filename, formatBytes(operationalPackageUpload.size)].filter(Boolean).join(", ")
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
                    {operationalReviewStatus.kind === "ready"
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
              </div>
            ) : null}
            <div className="mon-outputs-sheets-actions mon-outputs-sheets-actions--primary">
              <button
                type="button"
                className={`mon-outputs-publish-button mon-outputs-action-progress${publishRunning ? " is-running" : ""}${activeStatus.kind === "success" ? " is-complete" : ""}`}
                onClick={() => { setEnsayo(null); revisarPanel.abrir(); }}
                disabled={!canPublishSheets || publishRunning}
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
            <EnsayoPublicacionDialog
              destino={audienceLabel(activeAudience).toLowerCase()}
              estado={ensayo ?? { kind: "cargando" }}
              aplicando={publishing === activeAudience}
              onAplicar={() => { void aplicarEnsayo(); }}
              onReintentar={() => { void revisarSheets(); }}
            />
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
                  <button type="button" className="mon-outputs-secondary" onClick={reviewOperationalPackage} disabled={!canReviewOperationalPackage}>
                    <ShieldAlert size={14} aria-hidden="true" />
                    Validar paquete territorial
                  </button>
                ) : null}
                <button type="button" className="mon-outputs-secondary" onClick={() => { void reviewPreflight(); }} disabled={!canPreflightSheets}>
                  {preflighting === activeAudience ? <Loader2 size={14} className="pulso-spin" /> : <ShieldAlert size={14} />}
                  Validar salida
                </button>
                <button type="button" className="mon-outputs-secondary" onClick={generateEvidencePack} disabled={!canGenerateEvidencePack}>
                  <Archive size={14} aria-hidden="true" />
                  Descargar soporte
                </button>
              </div>
              {showOperationalPackageReview ? (
                <EntregaEnBloque
                  entrega={revision}
                  pie={revision.estado.fase === "lista"
                    ? <ArchivosSueltos archivos={operationalSueltos} etiqueta="Revisión y reporte del paquete operacional" />
                    : undefined}
                />
              ) : null}
              <EntregaEnBloque
                entrega={activeEvidence}
                pie={activeEvidence.estado.fase === "lista" && activeEvidencePack ? (
                  <>
                    {evidenceNotas.map((nota) => <span key={nota} className="mon-entrega-nota">{nota}</span>)}
                    <ArchivosSueltos archivos={activeEvidenceFiles} etiqueta="Archivos directos del soporte de publicación" />
                  </>
                ) : undefined}
              />
            </details>
          </div>
        </article>
      </div>
    </section>
  );
}
