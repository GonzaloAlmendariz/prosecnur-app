import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  type LucideIcon,
} from "../../vendor/lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GlidingTabList } from "../../components/GlidingTabList";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../components/ChromeIndicator";
import { ModuleCommandBar } from "../../components/ModuleCommandBar";
import { toDataURL } from "qrcode";
import {
  apiCalcMuestraState,
  apiConnectionsList,
  apiMonitoreoAulasAgenda,
  apiMonitoreoAulasConfig,
  apiMonitoreoKoboAssets,
  apiMonitoreoKoboSurveyLink,
  apiMonitoreoState,
  type CalcMuestraState,
  type ConnectionProfileState,
  type ConnectionTokenState,
  type MonitoreoAulasDashboard,
  type MonitoreoKoboAssetItem,
  type MonitoreoAulasPlanRow,
  type MonitoreoState,
} from "../../api/client";
import { AULAS_SAMPLE_ROUTE } from "../aulasFlow/AulasApplicationFlow";
import { MODULE_TONES, PROSECNUR_MODULES } from "../../lib/modules";
import { searchConNivel, useDireccion, useSeccion } from "../../lib/navegacion/useDireccion";
import {
  esDireccionCanonica,
  resolverDireccion,
  type RecopiladoresPestana,
  type RecopiladoresSeccion,
} from "./navegacion";
import { captureUrlIssue, captureUrlMessage, captureUrlOk } from "../../lib/captureUrl";
import "./recopiladores.css";

type QrSection = RecopiladoresSeccion;
type QrTab = RecopiladoresPestana;
type StepTone = "ready" | "current" | "waiting";

type TabDefinition = {
  id: QrTab;
  label: string;
  detail: string;
  icon: LucideIcon;
};

type ManualLinkRecord = {
  key: string;
  surveyLink: string;
  qr: string;
  word: string;
  pdf: string;
  sample: string;
};

type LinkParseResult = {
  records: ManualLinkRecord[];
  ignored: number;
};

type TemplateContext = Record<string, string>;

/**
 * Las etiquetas e íconos salen del manifiesto: duplicar aquí el catálogo fue la
 * causa de que la URL y la pantalla dijeran cosas distintas. El único dato que
 * la página añade es el `detail`, que es copy de esta vista y de nadie más.
 */
const MODULO = PROSECNUR_MODULES.find((m) => m.slug === "recopiladores")!;

const SECTION_DETAIL: Record<QrSection, string> = {
  "plan-recoleccion": "unidades de aplicación",
  accesos: "canales y vinculación",
  materiales: "fichas y paquetes",
  "entrega-campo": "verificación y traspaso",
};

const TAB_DETAIL: Record<QrTab, string> = {
  unidades: "cursos-horario y docentes",
  canales: "uno por curso-horario",
  vinculacion: "revisión por curso-horario",
  vista: "ficha imprimible",
  paquetes: "fichas imprimibles",
  traspaso: "guardar enlaces",
};

const SECTIONS: Array<{ id: QrSection; label: string; detail: string; icon: LucideIcon }> =
  MODULO.sections.map((s) => ({
    id: s.id as QrSection,
    label: s.label,
    detail: SECTION_DETAIL[s.id as QrSection],
    icon: s.icon,
  }));

const SECTION_TABS: Record<QrSection, TabDefinition[]> = Object.fromEntries(
  MODULO.sections.map((s) => [
    s.id,
    (s.tabs ?? []).map((t) => ({
      id: t.id as QrTab,
      label: t.label,
      detail: TAB_DETAIL[t.id as QrTab],
      icon: t.icon,
    })),
  ]),
) as Record<QrSection, TabDefinition[]>;

const TAB_COPY: Record<QrTab, { kicker: string; title: string; detail: string }> = {
  unidades: {
    kicker: "Antes de imprimir",
    title: "Confirma qué cursos-horario entran a campo",
    detail: "La unidad operativa es el curso-horario: una fila debe tener curso, horario, salón, docente, facultad y estado de coordinación.",
  },
  canales: {
    kicker: "Enlace del curso-horario",
    title: "Crea un enlace único para cada curso-horario",
    detail: "El QR conserva el curso-horario sin pedir códigos al estudiante.",
  },
  vista: {
    kicker: "Material de campo",
    title: "Revisa la ficha antes de llevarla a campo",
    detail: "La ficha debe poder leerse en segundos: curso, horario, docente, salón y QR específico de la aplicación.",
  },
  vinculacion: {
    kicker: "Control operativo",
    title: "Busca cursos-horario y corrige pendientes",
    detail: "Usa la lista para detectar enlaces faltantes, cursos sin horario o cursos-horario que aún no están listos para imprimir.",
  },
  paquetes: {
    kicker: "Motor PDF",
    title: "Genera el PDF de fichas QR",
    detail: "La salida produce una portada y una ficha imprimible por curso-horario, con QR, salón, docente y enlace visible.",
  },
  traspaso: {
    kicker: "Seguimiento",
    title: "Guarda los enlaces en Monitoreo",
    detail: "Cada curso-horario conserva el enlace usado para su QR, de modo que el seguimiento sepa qué ficha recibió.",
  },
};

const SIDEBAR_NOTES: Record<QrTab, { icon: typeof ClipboardList; title: string; detail: string; tone: StepTone }> = {
  unidades: {
    icon: ClipboardList,
    title: "Primero confirma los cursos-horario",
    detail: "Cada fila es un curso-horario que luego tendrá enlace, QR y ficha imprimible.",
    tone: "current",
  },
  canales: {
    icon: Link2,
    title: "Luego conecta Kobo",
    detail: "El identificador del curso-horario viaja en el enlace para reconocer la respuesta en Monitoreo.",
    tone: "current",
  },
  vista: {
    icon: QrCode,
    title: "Revisa una ficha",
    detail: "La hoja debe identificar el curso-horario, mostrar el QR y sostenerse aun si el enlace se digita.",
    tone: "current",
  },
  vinculacion: {
    icon: Search,
    title: "Audita antes de imprimir",
    detail: "Busca cursos-horario sin enlace o datos incompletos antes de generar el paquete PDF.",
    tone: "waiting",
  },
  paquetes: {
    icon: FileText,
    title: "Motor PDF",
    detail: "Genera portada y una ficha QR por curso-horario para aplicación presencial.",
    tone: "ready",
  },
  traspaso: {
    icon: CheckCircle2,
    title: "Cierra trazabilidad",
    detail: "Guarda los enlaces para que Monitoreo sepa qué ficha recibió cada curso-horario.",
    tone: "ready",
  },
};

const numberFormat = new Intl.NumberFormat("es-PE");
const KOBO_DEFAULT_BASE_URL = "https://kf.kobotoolbox.org";
const KOBO_PARAM_TEMPLATE = "d[collectorID]={curso_horario}";
const PULSO_LOGO_SRC = "/pulso-pucp-logo.png";
const LINK_IMPORT_EXAMPLE = [
  "cursohorario\tenlace\tqr\tword\tpdf",
  "MAT146-0205\thttps://encuesta/aula/MAT146-0205\thttps://drive/qr\thttps://drive/word\thttps://drive/pdf",
].join("\n");

const RETURN_MANIFEST_HEADERS = [
  "curso_horario",
  "facultad",
  "carrera",
  "curso",
  "horario",
  "docente",
  "muestra",
  "enlace_aplicacion",
  "qr_estado",
  "word_link",
  "pdf_link",
  "fuente_enlace",
];

function fmt(value: unknown, fallback = "0") {
  const n = Number(value);
  if (Number.isFinite(n)) return numberFormat.format(n);
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeMatchKey(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeHeader(value: unknown) {
  return normalizeMatchKey(value);
}

function isUrl(value: unknown) {
  return /^https?:\/\//i.test(normalizeText(value));
}

function classroomLabel(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.operational_code) ||
    normalizeText(row.titular_operational_code) ||
    normalizeText(row.classroom_id) ||
    normalizeText(row.label) ||
    `Curso-horario ${fmt(row.orden)}`;
}

function rowFaculty(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.faculty) || "Sin facultad";
}

function rowKey(row: MonitoreoAulasPlanRow, index: number) {
  return `${classroomLabel(row)}-${normalizeText(row.wave)}-${index}`;
}

function rowMatchKeys(row: MonitoreoAulasPlanRow) {
  return [
    classroomLabel(row),
    row.classroom_id,
    row.operational_code,
    row.selection_slot_id,
    row.course_id && row.schedule ? `${row.course_id}-${row.schedule}` : "",
    row.course_id && row.section ? `${row.course_id}-${row.section}` : "",
  ].map(normalizeMatchKey).filter(Boolean);
}

function cleanKoboBaseUrl(value: unknown) {
  return normalizeText(value).replace(/\/+$/, "") || KOBO_DEFAULT_BASE_URL;
}

function koboProfileLabel(profile: ConnectionProfileState) {
  return [profile.alias || "Kobo", profile.server_label || profile.base_url || ""].filter(Boolean).join(" · ");
}

function rowTemplateContext(row: MonitoreoAulasPlanRow, asset: MonitoreoKoboAssetItem | null): TemplateContext {
  return {
    aula: classroomLabel(row),
    curso_horario: classroomLabel(row),
    curso_id: normalizeText(row.course_id),
    curso: normalizeText(row.course_name),
    seccion: normalizeText(row.section),
    horario: normalizeText(row.schedule),
    docente: normalizeText(row.teacher),
    correo_docente: normalizeText(row.teacher_email),
    facultad: rowFaculty(row),
    carrera: normalizeText(row.program),
    nivel: normalizeText(row.level),
    muestra: sampleLabel(row),
    rol: roleLabel(row),
    orden: normalizeText(row.orden),
    estudiantes: normalizeText(row.eligible_n),
    asset_uid: normalizeText(asset?.uid),
    formulario: normalizeText(asset?.name),
    version: normalizeText(asset?.version_id),
  };
}

function fillTemplate(value: string, context: TemplateContext) {
  return value.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => context[key.toLowerCase()] ?? "");
}

function appendPersonalizedParams(baseLink: string, paramsTemplate: string, context: TemplateContext) {
  const base = fillTemplate(normalizeText(baseLink), context);
  const rawParams = fillTemplate(normalizeText(paramsTemplate), context).replace(/^[?&]+/, "");
  if (!base || !rawParams) return base;
  const encoded = rawParams
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, ...rest] = part.split("=");
      const cleanKey = key.trim();
      const cleanValue = rest.join("=").trim();
      if (!cleanKey) return "";
      return `${encodeURIComponent(cleanKey)}=${encodeURIComponent(cleanValue)}`;
    })
    .filter(Boolean)
    .join("&");
  if (!encoded) return base;
  const separator = base.includes("?")
    ? base.endsWith("?") || base.endsWith("&") ? "" : "&"
    : "?";
  return `${base}${separator}${encoded}`;
}

function rowLink(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.link);
}

function savedQrSrc(row: MonitoreoAulasPlanRow) {
  const saved = normalizeText(row.qr);
  if (/^(https?:|data:image)/i.test(saved)) return saved;
  return "";
}

function hasQr(row: MonitoreoAulasPlanRow) {
  return Boolean(savedQrSrc(row) || rowLink(row));
}

function returnManifestCell(value: unknown) {
  return normalizeText(value).replace(/[\t\r\n]+/g, " ");
}

function returnManifestRecord(row: MonitoreoAulasPlanRow) {
  const link = rowLink(row);
  return {
    curso_horario: classroomLabel(row),
    facultad: rowFaculty(row),
    carrera: normalizeText(row.program),
    curso: normalizeText(row.course_name),
    horario: normalizeText(row.schedule),
    docente: normalizeText(row.teacher),
    muestra: sampleLabel(row),
    enlace_aplicacion: link,
    qr_estado: savedQrSrc(row) ? "qr importado" : link ? "qr generado localmente" : "sin enlace",
    word_link: normalizeText(row.word_link),
    pdf_link: normalizeText(row.pdf_link),
    fuente_enlace: sourceRowText(row as Record<string, unknown>, ["manual_link_source", "collector_id"]) || (link ? "agenda" : ""),
  };
}

function returnManifestTsv(rows: MonitoreoAulasPlanRow[]) {
  const body = rows.map((row) => {
    const record = returnManifestRecord(row);
    return RETURN_MANIFEST_HEADERS.map((header) => returnManifestCell(record[header as keyof typeof record])).join("\t");
  });
  return [RETURN_MANIFEST_HEADERS.join("\t"), ...body].join("\n");
}

function returnAgendaUpdate(row: MonitoreoAulasPlanRow, packageStatus?: string): Partial<MonitoreoAulasPlanRow> {
  return {
    classroom_id: normalizeText(row.classroom_id),
    operational_code: normalizeText(row.operational_code),
    link: rowLink(row),
    qr: savedQrSrc(row),
    word_link: normalizeText(row.word_link),
    pdf_link: normalizeText(row.pdf_link),
    package_label: packageLabel(row),
    package_status: packageStatus || (rowLink(row) ? "listo_para_pdf" : "pendiente_enlace"),
    collector_id: sourceRowText(row as Record<string, unknown>, ["collector_id", "manual_link_source"]),
    responsible: normalizeText(row.responsible),
  };
}

function roleLabel(row: MonitoreoAulasPlanRow) {
  const role = normalizeText(row.sample_role);
  if (role === "titular" || normalizeText(row.wave) === "M1") return "Titular";
  if (role === "chain_reserve") return `Reserva ${normalizeText(row.wave) || ""}`.trim();
  if (role === "extra_reserve_pool") return "Reserva adicional";
  return normalizeText(row.wave) || "Curso-horario";
}

function sampleLabel(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.wave) ||
    sourceRowText(row as Record<string, unknown>, ["muestra", "sample", "selection_label"]) ||
    "Selección";
}

function packageLabel(row: MonitoreoAulasPlanRow) {
  return sourceRowText(row as Record<string, unknown>, ["package_label", "selection_label", "seleccion", "muestra"]) ||
    sampleLabel(row);
}

function fichaId(row: MonitoreoAulasPlanRow) {
  return sourceRowText(row as Record<string, unknown>, ["cursohorario", "curso_horario", "course_schedule_id", "id_match"]) ||
    classroomLabel(row);
}

function fichaVenue(row: MonitoreoAulasPlanRow) {
  return sourceRowText(row as Record<string, unknown>, [
    "pabellon_aula",
    "pabellon",
    "aula",
    "salon",
    "room",
    "building_room",
    "venue",
    "label",
    "section",
  ]) || "Por confirmar";
}

function statusLabel(row: MonitoreoAulasPlanRow) {
  const status = normalizeText(row.operational_status);
  const labels: Record<string, string> = {
    agendada: "Agendada",
    aplicada: "Aplicada",
    parcial: "Parcial",
    pendiente: "Pendiente",
    sin_acceso: "Sin acceso",
    cancelada: "Cancelada",
    reemplazo_pendiente: "Reemplazo pendiente",
    reemplazada: "Reemplazada",
    cerrada: "Cerrada",
  };
  return labels[status] ?? (status || "Pendiente");
}

function dashboardFromState(state: MonitoreoState | null): MonitoreoAulasDashboard | null {
  return state?.dashboard?.aulas_universitarias_reports ?? null;
}

function monitorAgendaFromState(state: MonitoreoState | null) {
  const dashboard = dashboardFromState(state);
  if (dashboard?.agenda?.length) return dashboard.agenda;
  return state?.config?.aulas_universitarias?.plan ?? [];
}

function sourceRowText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(row[key]);
    if (value) return value;
  }
  return "";
}

function sourceRowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function splitImportLine(line: string) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  return line.split(",");
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function parseLinkClipboard(input: string): LinkParseResult {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { records: [], ignored: 0 };
  const first = splitImportLine(lines[0]).map(normalizeHeader);
  const hasHeader = first.some((cell) => [
    "documentid",
    "id",
    "cursohorario",
    "cursohorario",
    "qrlink",
    "wordlink",
    "pdflink",
    "url",
    "acortador",
  ].includes(cell));
  const headers = hasHeader ? first : [];
  const rows = hasHeader ? lines.slice(1) : lines;
  const keyIndex = hasHeader ? headerIndex(headers, ["documentid", "id", "idmatch", "cursohorario", "cursohorario", "classroomid", "aulacodigo"]) : 0;
  const urlIndex = hasHeader ? headerIndex(headers, ["url", "acortador", "link", "enlace", "surveylink"]) : -1;
  const qrIndex = hasHeader ? headerIndex(headers, ["qrlink", "qr", "qrcode", "enlaceqr"]) : -1;
  const wordIndex = hasHeader ? headerIndex(headers, ["wordlink", "word", "docx", "fichaword"]) : -1;
  const pdfIndex = hasHeader ? headerIndex(headers, ["pdflink", "pdf", "fichapdf"]) : -1;
  const sampleIndex = hasHeader ? headerIndex(headers, ["muestra", "sample", "seleccion"]) : -1;
  const records: ManualLinkRecord[] = [];
  let ignored = 0;
  rows.forEach((line) => {
    const cells = splitImportLine(line).map((cell) => cell.trim());
    const key = normalizeText(cells[keyIndex >= 0 ? keyIndex : 0]);
    const urls = cells.filter(isUrl);
    const surveyLink = normalizeText(urlIndex >= 0 ? cells[urlIndex] : hasHeader ? "" : urls[0]);
    const qr = normalizeText(qrIndex >= 0 ? cells[qrIndex] : "");
    const word = normalizeText(wordIndex >= 0 ? cells[wordIndex] : "");
    const pdf = normalizeText(pdfIndex >= 0 ? cells[pdfIndex] : "");
    const sample = normalizeText(sampleIndex >= 0 ? cells[sampleIndex] : "");
    if (!key || (!surveyLink && !qr && !word && !pdf)) {
      ignored += 1;
      return;
    }
    records.push({ key, surveyLink, qr, word, pdf, sample });
  });
  return { records, ignored };
}

function applyManualLinks(rows: MonitoreoAulasPlanRow[], links: Map<string, ManualLinkRecord>) {
  if (!links.size) return rows;
  return rows.map((row) => {
    const match = rowMatchKeys(row).map((key) => links.get(key)).find(Boolean);
    if (!match) return row;
    return {
      ...row,
      link: match.surveyLink || row.link,
      qr: match.qr || row.qr,
      collector_id: match.sample || row.collector_id,
      word_link: match.word || row.word_link,
      pdf_link: match.pdf || row.pdf_link,
      manual_link_source: match.sample || row.manual_link_source || "pegado",
    };
  });
}

function calcSelectionAgenda(calcState: CalcMuestraState | null): MonitoreoAulasPlanRow[] {
  const selection = calcState?.aulas?.selection;
  const rows = (selection?.selection ?? []) as Array<Record<string, unknown>>;
  return rows.map((row, index) => {
    const wave = sourceRowText(row, ["wave", "muestra", "sample_wave"]) || "M1";
    const role = sourceRowText(row, ["sample_role", "rol_muestra"]) || (wave === "M1" ? "titular" : "chain_reserve");
    const classroomId = sourceRowText(row, ["classroom_id", "curso_horario", "course_schedule_id", "id_match", "id"]);
    return {
      selection_run_id: selection?.selection_run_id ?? "",
      operational_code: sourceRowText(row, ["operational_code", "codigo_operativo", "selection_slot_id"]) || classroomId,
      titular_operational_code: sourceRowText(row, ["titular_operational_code"]),
      replacement_chain_code: sourceRowText(row, ["replacement_chain_code"]),
      operational_sequence: sourceRowNumber(row, ["operational_sequence", "orden"], index + 1),
      selection_slot_id: sourceRowText(row, ["selection_slot_id"]),
      sample_role: role,
      wave,
      replacement_order: sourceRowNumber(row, ["replacement_order"], 0),
      orden: sourceRowNumber(row, ["orden", "rank"], index + 1),
      classroom_id: classroomId || `aula-${index + 1}`,
      label: sourceRowText(row, ["label", "classroom_label", "sesiones_y_aula", "aula", "section"]),
      course_id: sourceRowText(row, ["course_id", "curso_id", "curso"]),
      course_name: sourceRowText(row, ["course_name", "nombre_del_curso", "nombre_curso"]),
      section: sourceRowText(row, ["section", "seccion"]),
      schedule: sourceRowText(row, ["schedule", "horario"]),
      teacher: sourceRowText(row, ["teacher", "docente", "nombre_de_docente"]),
      teacher_email: sourceRowText(row, ["teacher_email", "correo_docente"]),
      faculty: sourceRowText(row, ["faculty", "facultad", "stratum"]),
      program: sourceRowText(row, ["program", "programa", "carrera"]),
      level: sourceRowText(row, ["level", "nivel", "ciclo"]),
      stratum: sourceRowText(row, ["stratum", "faculty", "facultad"]),
      eligible_n: sourceRowNumber(row, ["eligible_n", "matriculados_poblacion", "students_n"]),
      expected_valid: sourceRowNumber(row, ["expected_valid", "validos_esperados"], 0),
      link: sourceRowText(row, ["link", "url", "acortador", "enlace", "survey_link"]),
      qr: sourceRowText(row, ["qr", "qr_url", "qr_link"]),
      cursohorario: classroomId || sourceRowText(row, ["cursohorario", "curso_horario", "course_schedule_id", "id_match"]),
      pabellon_aula: sourceRowText(row, ["pabellon_aula", "pabellon", "aula", "salon", "room", "building_room", "venue", "label"]),
      collector_id: sourceRowText(row, ["collector_id", "recopilador_id"]),
      responsible: sourceRowText(row, ["responsible", "responsable"]),
      operational_status: "pendiente",
      replacement_for: sourceRowText(row, ["replacement_for"]),
      replacement_reason: sourceRowText(row, ["replacement_reason"]),
      replacement_note: sourceRowText(row, ["replacement_note"]),
      updated_at: selection?.generated_at ?? "",
    };
  });
}

function facultyOptions(rows: MonitoreoAulasPlanRow[]) {
  return Array.from(new Set(rows.map(rowFaculty))).sort((a, b) => a.localeCompare(b, "es"));
}

type PackageOutputGroup = {
  label: string;
  total: number;
  linked: number;
  missing: number;
  qr: number;
  word: number;
  pdf: number;
  students: number;
  ready: boolean;
};

function buildPackageOutputGroups(rows: MonitoreoAulasPlanRow[]): PackageOutputGroup[] {
  const groups = new Map<string, PackageOutputGroup>();
  rows.forEach((row) => {
    const label = packageLabel(row) || "Selección";
    const current = groups.get(label) ?? {
      label,
      total: 0,
      linked: 0,
      missing: 0,
      qr: 0,
      word: 0,
      pdf: 0,
      students: 0,
      ready: false,
    };
    const linked = Boolean(rowLink(row));
    current.total += 1;
    current.linked += linked ? 1 : 0;
    current.missing += linked ? 0 : 1;
    current.qr += hasQr(row) ? 1 : 0;
    current.word += normalizeText(row.word_link) ? 1 : 0;
    current.pdf += normalizeText(row.pdf_link) ? 1 : 0;
    const n = Number(row.eligible_n);
    current.students += Number.isFinite(n) ? n : 0;
    groups.set(label, current);
  });
  return Array.from(groups.values())
    .map((group) => ({ ...group, ready: group.total > 0 && group.missing === 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }) || b.total - a.total);
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rec-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rec-empty">
      <AlertCircle size={18} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function ReadinessRail({
  steps,
}: {
  steps: Array<{ label: string; status: string; detail: string; tone: StepTone }>;
}) {
  return (
    <ol
      className="rec-readiness"
      aria-label="Recorrido operativo de aplicación por curso-horario"
      data-qa-geometry-group="recopiladores/readiness"
      data-qa-geometry-contract="intrinsic"
    >
      {steps.map((step, index) => (
        <li key={step.label} className={`is-${step.tone}`}>
          <span>{index + 1}</span>
          <div>
            <strong>{step.label}</strong>
            <em>{step.status}</em>
            <p>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LinkProcessStrip({
  agendaCount,
  linkedCount,
  missingCount,
  readyForPrint,
  returnSaved,
}: {
  agendaCount: number;
  linkedCount: number;
  missingCount: number;
  readyForPrint: boolean;
  returnSaved: boolean;
}) {
  const steps = [
    {
      label: "Agenda",
      value: agendaCount ? `${fmt(agendaCount)} cursos-horario` : "pendiente",
      detail: "curso-horario y docente",
      tone: agendaCount ? "ready" : "current",
      icon: ClipboardList,
    },
    {
      label: "Identificador",
      value: "curso-horario",
      detail: "viaja junto al enlace",
      tone: agendaCount ? "current" : "waiting",
      icon: Link2,
    },
    {
      label: "QR",
      value: linkedCount ? `${fmt(linkedCount)} listos` : `${fmt(missingCount)} faltan`,
      detail: "uno por ficha de curso-horario",
      tone: linkedCount ? "ready" : agendaCount ? "current" : "waiting",
      icon: QrCode,
    },
    {
      label: "PDF y monitoreo",
      value: returnSaved ? "guardado" : readyForPrint ? "por guardar" : "después",
      detail: "paquete y seguimiento",
      tone: returnSaved ? "ready" : readyForPrint ? "current" : "waiting",
      icon: FileText,
    },
  ] satisfies Array<{ label: string; value: string; detail: string; tone: StepTone; icon: typeof ClipboardList }>;
  return (
    <ol
      className="rec-link-process"
      aria-label="Recorrido de enlaces QR por curso-horario"
      data-qa-geometry-group="recopiladores/proceso-enlaces"
      data-qa-geometry-contract="intrinsic"
    >
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.label} className={`is-${step.tone}`}>
            <span>{index + 1}</span>
            <Icon size={15} />
            <div>
              <strong>{step.label}</strong>
              <em>{step.value}</em>
              <p>{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PackageFlow({
  agendaReady,
  withLink,
  readyForPrint,
  monitorReady,
}: {
  agendaReady: boolean;
  withLink: number;
  readyForPrint: boolean;
  monitorReady: boolean;
}) {
  const steps = [
    {
      label: "Agenda",
      detail: "Curso-horario, docente, salón y matrícula objetivo.",
      tone: agendaReady ? "ready" : "current",
      icon: ClipboardList,
    },
    {
      label: "QR individual",
      detail: "Un enlace específico se convierte en código QR por curso-horario.",
      tone: withLink ? "ready" : agendaReady ? "current" : "waiting",
      icon: QrCode,
    },
    {
      label: "PDF de fichas",
      detail: "Una página por curso-horario reúne QR, curso, horario, salón y responsable de coordinación.",
      tone: readyForPrint ? "ready" : withLink ? "current" : "waiting",
      icon: FileText,
    },
    {
      label: "Monitoreo",
      detail: "Los enlaces usados por las fichas quedan guardados en el seguimiento de campo.",
      tone: monitorReady ? "ready" : readyForPrint ? "current" : "waiting",
      icon: CheckCircle2,
    },
  ] satisfies Array<{ label: string; detail: string; tone: StepTone; icon: typeof ClipboardList }>;
  return (
    <ol className="rec-package-flow" aria-label="Flujo de producción de fichas QR">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.label} className={`is-${step.tone}`}>
            <span>{index + 1}</span>
            <Icon size={16} />
            <strong>{step.label}</strong>
            <p>{step.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ReturnManifestPanel({
  rows,
  copied,
  saving,
  unsavedLinks,
  saveMessage,
  saveError,
  onCopy,
  onSave,
  showActions = true,
}: {
  rows: MonitoreoAulasPlanRow[];
  copied: boolean;
  saving: boolean;
  unsavedLinks: number;
  saveMessage: string;
  saveError: string;
  onCopy: () => void;
  onSave: () => void;
  showActions?: boolean;
}) {
  const linked = rows.filter((row) => Boolean(rowLink(row))).length;
  const complete = rows.length > 0 && linked === rows.length;
  const saved = linked > 0 && unsavedLinks === 0;
  const previewRows = rows.slice(0, 6);
  return (
    <section className="rec-return-panel">
      <div className="rec-return-head">
        <div>
          <span>Guardar en Monitoreo</span>
          <strong>{saved ? "Enlaces guardados para seguimiento" : complete ? "Listo para guardar en Monitoreo" : "Completa enlaces antes de cerrar"}</strong>
          <p>Monitoreo recibirá el curso-horario, el enlace de aplicación y el origen usado para generar cada QR.</p>
        </div>
        {showActions ? (
          <div className="rec-return-actions">
            <button type="button" onClick={onCopy} disabled={!rows.length || !linked}>
              <ClipboardList size={14} />
              {copied ? "Copiado" : "Copiar respaldo"}
            </button>
            <button type="button" className="is-save" onClick={onSave} disabled={saving || !linked || !unsavedLinks}>
              {saving ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
              {saved ? "Guardado" : saving ? "Guardando" : "Guardar en Monitoreo"}
            </button>
          </div>
        ) : null}
      </div>
      <div className="rec-return-summary">
        <span>{fmt(rows.length)} cursos-horario</span>
        <span>{fmt(linked)} con enlace</span>
        <span>{saved ? "guardado en Monitoreo" : `${fmt(unsavedLinks)} por guardar`}</span>
        <span>{complete ? "cobertura completa" : `${fmt(Math.max(rows.length - linked, 0))} pendientes`}</span>
      </div>
      {saveMessage ? <p className="rec-return-message is-ok">{saveMessage}</p> : null}
      {saveError ? <p className="rec-return-message is-error">{saveError}</p> : null}
      <div className="rec-return-table-wrap">
        <table className="rec-return-table">
          <thead>
            <tr>
              <th>Curso-horario</th>
              <th>Facultad</th>
              <th>Enlace</th>
              <th>QR</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => {
              const record = returnManifestRecord(row);
              const linkedRow = Boolean(record.enlace_aplicacion);
              const qrLabel = savedQrSrc(row) ? "Importado" : linkedRow ? "Generado" : "Pendiente";
              return (
                <tr key={`${record.curso_horario}-${index}`} className={linkedRow ? "is-ready" : "is-waiting"}>
                  <td><strong>{record.curso_horario}</strong><small>{record.muestra || roleLabel(row)}</small></td>
                  <td>{record.facultad}</td>
                  <td>{linkedRow ? "Listo" : "Pendiente"}</td>
                  <td>{qrLabel}</td>
                  <td>{record.fuente_enlace || "sin fuente"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > previewRows.length ? (
        <p className="rec-return-footnote">Vista previa de {fmt(previewRows.length)} filas. El respaldo copiado incluye los {fmt(rows.length)} cursos-horario de la agenda.</p>
      ) : null}
    </section>
  );
}

function PackageEnginePanel({
  groups,
  printableRows,
  missingLinks,
  returnSaved,
  printPreparedAt,
}: {
  groups: PackageOutputGroup[];
  printableRows: MonitoreoAulasPlanRow[];
  missingLinks: number;
  returnSaved: boolean;
  printPreparedAt: string;
}) {
  const linked = printableRows.length;
  const savedWord = groups.reduce((sum, group) => sum + group.word, 0);
  const savedPdf = groups.reduce((sum, group) => sum + group.pdf, 0);
  const consolidated = groups.filter((group) => group.ready).length;
  const fichaFields = [
    "ID curso-horario",
    "Enlace Kobo",
    "Curso",
    "Facultad",
    "Horario",
    "Curso-horario",
  ];
  const stages = [
    { label: "QR individual", value: linked ? `${fmt(linked)} listos` : "pendiente", tone: linked ? "ready" : "waiting" },
    { label: "Ficha Word", value: savedWord ? `${fmt(savedWord)} enlaces` : `${fmt(linked)} producibles`, tone: linked ? "ready" : "waiting" },
    { label: "Ficha PDF", value: savedPdf ? `${fmt(savedPdf)} enlaces` : printPreparedAt ? "preparado local" : `${fmt(linked)} producibles`, tone: linked ? "ready" : "waiting" },
    { label: "Consolidado", value: consolidated ? `${fmt(consolidated)} selección` : missingLinks ? "incompleto" : printPreparedAt ? "preparado" : "listo", tone: !missingLinks && linked ? "ready" : "waiting" },
    { label: "Monitoreo", value: returnSaved ? "guardado" : linked ? "por guardar" : "pendiente", tone: returnSaved ? "ready" : linked ? "current" : "waiting" },
  ] satisfies Array<{ label: string; value: string; tone: StepTone }>;

  return (
    <section className="rec-package-panel rec-engine-panel" aria-label="Motor de fichas QR y PDF">
      <div>
        <span>Motor de fichas</span>
        <strong>QR, Word, PDF y consolidado por selección</strong>
      </div>
      <div className="rec-engine-fields" aria-label="Datos mínimos de cada ficha">
        {fichaFields.map((field) => <span key={field}>{field}</span>)}
      </div>
      <div className="rec-engine-stages">
        {stages.map((stage, index) => (
          <div key={stage.label} className={`is-${stage.tone}`}>
            <span>{index + 1}</span>
            <strong>{stage.label}</strong>
            <em>{stage.value}</em>
          </div>
        ))}
      </div>
      <div className="rec-engine-groups">
        {groups.length ? groups.map((group) => (
          <article key={group.label} className={group.ready ? "is-ready" : "is-waiting"}>
            <header>
              <strong>{group.label}</strong>
              <span>{group.ready ? "Listo para consolidar" : `${fmt(group.missing)} sin enlace`}</span>
            </header>
            <dl>
              <div><dt>Fichas</dt><dd>{fmt(group.linked)}/{fmt(group.total)}</dd></div>
              <div><dt>Word</dt><dd>{group.word ? fmt(group.word) : "producible"}</dd></div>
              <div><dt>PDF</dt><dd>{group.pdf ? fmt(group.pdf) : "producible"}</dd></div>
            </dl>
          </article>
        )) : (
          <p>No hay selección de cursos-horario para producir fichas.</p>
        )}
      </div>
      <div className="rec-engine-note">
        <FileSpreadsheet size={14} />
        <span>El paquete sigue la lógica del motor de fichas: una hoja por curso-horario, consolidado por selección y enlaces exportables para seguimiento.</span>
      </div>
    </section>
  );
}

function NextAction({
  title,
  detail,
  tone,
  children,
}: {
  title: string;
  detail: string;
  tone: StepTone;
  children?: ReactNode;
}) {
  return (
    <div className={`rec-next is-${tone}`}>
      <div>
        <span>Próxima acción</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {children ? <div className="rec-next-actions">{children}</div> : null}
    </div>
  );
}

function FichaPreview({ row }: { row: MonitoreoAulasPlanRow | null }) {
  if (!row) {
    return (
      <div className="rec-preview-shell">
        <EmptyState
          title="Selecciona un curso-horario"
          detail="Elige una fila de la agenda para revisar cómo quedará la ficha antes de imprimirla."
        />
      </div>
    );
  }
  return (
    <div className="rec-preview-shell">
      <FichaDocument row={row} />
    </div>
  );
}

function FichaLogLine({
  label,
  value,
  wide,
  large,
}: {
  label: string;
  value?: ReactNode;
  wide?: boolean;
  large?: boolean;
}) {
  const className = [
    "rec-ficha-log-line",
    wide ? "is-wide" : "",
    large ? "is-large" : "",
  ].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <span className="rec-ficha-log-label">{label}</span>
      <span className="rec-ficha-write-value">{value}</span>
    </div>
  );
}

function FichaDocument({ row }: { row: MonitoreoAulasPlanRow }) {
  const link = rowLink(row);
  const code = fichaId(row);
  const course = normalizeText(row.course_name) || "Curso sin nombre";
  const venue = fichaVenue(row);
  const faculty = rowFaculty(row);
  const schedule = normalizeText(row.schedule) || "Por confirmar";
  const classroomName = classroomLabel(row) || venue;
  const teacher = normalizeText(row.teacher) || "Por coordinar";
  const selection = [packageLabel(row), roleLabel(row)].filter(Boolean).join(" - ") || "Por definir";
  const eligibleStudents = Number.isFinite(Number(row.eligible_n)) && Number(row.eligible_n) > 0
    ? fmt(row.eligible_n)
    : "Sin dato";
  const responsible = normalizeText(row.responsible);
  return (
    <article className="rec-ficha" aria-label={`Ficha QR de ${classroomName}`}>
      <header className="rec-ficha-brand">
        <img src={PULSO_LOGO_SRC} alt="Pulso PUCP" />
        <div>
          <span>Intervención universitaria por cursos-horario</span>
          <strong>Ficha de aplicación</strong>
        </div>
      </header>
      <section className="rec-ficha-body">
        <div className="rec-ficha-qr-block">
          <div className="rec-ficha-qr">
            <LocalQrImage row={row} />
          </div>
          <div className="rec-ficha-instruction">
            <span><QrCode size={18} /></span>
            <div>
              <strong>Escanea el QR para responder</strong>
              <small>La encuesta se abre con el enlace correspondiente a este curso-horario.</small>
            </div>
          </div>
        </div>
        <div className="rec-ficha-info">
          <span>Aplicación presencial</span>
          <h2>{course}</h2>
          <dl className="rec-ficha-fields">
            <div><dt>Código de ficha</dt><dd>{code}</dd></div>
            <div><dt>Pabellón y salón</dt><dd>{venue}</dd></div>
            <div><dt>Horario del curso</dt><dd>{schedule}</dd></div>
            <div className="is-wide"><dt>Facultad</dt><dd>{faculty}</dd></div>
            <div className="is-wide"><dt>Curso</dt><dd>{course}</dd></div>
            <div className="is-wide"><dt>Docente o contacto</dt><dd>{teacher}</dd></div>
            <div className="is-wide"><dt>Selección</dt><dd>{selection}</dd></div>
            <div className="is-wide rec-ficha-url"><dt>Enlace de respaldo</dt><dd>{link || "Agrega un enlace para generar el QR"}</dd></div>
          </dl>
          <section className="rec-ficha-log" aria-label="Registro de aplicación en el salón">
            <div className="rec-ficha-log-heading">
              <span>Registro de aplicación</span>
              <strong>Completar en el salón</strong>
            </div>
            <div className="rec-ficha-log-grid">
              <FichaLogLine label="N° total de alumnos" value={eligibleStudents} />
              <FichaLogLine label="N° de alumnos presentes" />
              <FichaLogLine label="Rechazos" />
              <FichaLogLine label="Aplicador/a" value={responsible} />
              <FichaLogLine label="Fecha" />
              <FichaLogLine label="Hora de aplicación" />
              <FichaLogLine label="Observaciones" wide large />
            </div>
          </section>
        </div>
      </section>
      <footer className="rec-ficha-footer">
        <span>Pulso PUCP</span>
        <strong>{link ? "Ficha lista para impresión" : "Agrega un enlace antes de imprimir"}</strong>
      </footer>
    </article>
  );
}

function PrintFichaPackage({ rows }: { rows: MonitoreoAulasPlanRow[] }) {
  return (
    <section className="rec-print-package" aria-label="Paquete PDF de fichas QR">
      <div className="rec-print-cover">
        <div className="rec-print-cover-brand">
          <img src={PULSO_LOGO_SRC} alt="Pulso PUCP" />
          <span>Aplicación por cursos-horario</span>
        </div>
        <strong>Fichas QR para el estudio de hostigamiento</strong>
        <p>Cada hoja contiene el QR de encuesta y los datos visibles necesarios para ubicar el salón durante la aplicación presencial.</p>
        <dl aria-label="Resumen del paquete">
          <div><dt>Fichas</dt><dd>{fmt(rows.length)}</dd></div>
          <div><dt>Uso</dt><dd>Aplicación presencial</dd></div>
          <div><dt>Contenido</dt><dd>QR, salón y registro</dd></div>
        </dl>
      </div>
      {rows.map((row, index) => (
        <FichaDocument key={`${classroomLabel(row)}-${index}`} row={row} />
      ))}
    </section>
  );
}

function LocalQrImage({ row }: { row: MonitoreoAulasPlanRow }) {
  const saved = savedQrSrc(row);
  const link = rowLink(row);
  const [src, setSrc] = useState(saved);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (saved) {
      setSrc(saved);
      return () => {
        alive = false;
      };
    }
    if (!link) {
      setSrc("");
      return () => {
        alive = false;
      };
    }
    setSrc("");
    toDataURL(link, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 500,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((value) => {
      if (alive) setSrc(value);
    }).catch(() => {
      if (!alive) return;
      setSrc("");
      setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [link, saved]);

  if (src) return <img src={src} alt={`Código QR para ${classroomLabel(row)}`} />;
  return (
    <div>
      {link && !failed ? <Loader2 size={46} className="pulso-spin" /> : <QrCode size={54} />}
      <span>{link && !failed ? "Generando QR" : failed ? "QR no disponible" : "Sin enlace"}</span>
    </div>
  );
}

function AgendaTable({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: MonitoreoAulasPlanRow[];
  selectedKey: string;
  onSelect: (row: MonitoreoAulasPlanRow, key: string) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="Agenda pendiente" detail="Importa o genera la agenda de cursos-horario desde Cálculo de muestra y Monitoreo." />;
  }
  return (
    <div className="rec-table-wrap">
      <table className="rec-table">
        <thead>
          <tr>
            <th>Curso-horario</th>
            <th>Facultad</th>
            <th>Curso</th>
            <th>Horario</th>
            <th>Enlace</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row, index);
            const hasLink = Boolean(rowLink(row));
            return (
              <tr key={key} className={key === selectedKey ? "is-selected" : ""} onClick={() => onSelect(row, key)}>
                <td><strong>{classroomLabel(row)}</strong><small>{roleLabel(row)}</small></td>
                <td>{rowFaculty(row)}</td>
                <td>{normalizeText(row.course_name) || "Sin nombre"}</td>
                <td>{normalizeText(row.schedule) || "Por confirmar"}</td>
                <td><span className={hasLink ? "rec-status is-ready" : "rec-status is-waiting"}>{hasLink ? "Listo" : "Falta"}</span></td>
                <td>{statusLabel(row)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LinkImportPanel({
  value,
  parseResult,
  matched,
  hasSessionLinks,
  onChange,
  onApply,
  onClear,
}: {
  value: string;
  parseResult: LinkParseResult;
  matched: number;
  hasSessionLinks: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <section className="rec-link-import" aria-label="Pegar enlaces por curso-horario">
      <div className="rec-link-import-head">
        <span><Link2 size={15} /></span>
        <div>
          <small>Enlaces importados</small>
          <strong>Pega enlaces ya preparados</strong>
          <p>Acepta columnas como curso-horario, enlace, QR, Word y PDF. Se aplica solo a esta sesión hasta guardar los enlaces en Monitoreo.</p>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={LINK_IMPORT_EXAMPLE}
        spellCheck={false}
      />
      <div className="rec-link-import-foot">
        <span>{fmt(parseResult.records.length)} filas leídas</span>
        <span>{fmt(matched)} coinciden con la agenda</span>
        {parseResult.ignored ? <span>{fmt(parseResult.ignored)} omitidas</span> : null}
        <button type="button" onClick={onClear} disabled={!value && !hasSessionLinks}>
          Limpiar
        </button>
        <button type="button" className="is-primary" onClick={onApply} disabled={!parseResult.records.length}>
          Aplicar enlaces
        </button>
      </div>
    </section>
  );
}

function KoboLinkPanel({
  connection,
  profiles,
  selectedProfileId,
  baseUrl,
  assets,
  selectedAssetUid,
  baseLink,
  paramsTemplate,
  loading,
  resolving,
  error,
  resolvedFrom,
  agendaCount,
  linkedCount,
  onProfileChange,
  onBaseUrlChange,
  onLoadAssets,
  onResolveLink,
  onAssetChange,
  onBaseLinkChange,
  onParamsTemplateChange,
  onGenerate,
}: {
  connection: ConnectionTokenState | null;
  profiles: ConnectionProfileState[];
  selectedProfileId: string;
  baseUrl: string;
  assets: MonitoreoKoboAssetItem[];
  selectedAssetUid: string;
  baseLink: string;
  paramsTemplate: string;
  loading: boolean;
  resolving: boolean;
  error: string;
  resolvedFrom: string;
  agendaCount: number;
  linkedCount: number;
  onProfileChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onLoadAssets: () => void;
  onResolveLink: () => void;
  onAssetChange: (value: string) => void;
  onBaseLinkChange: (value: string) => void;
  onParamsTemplateChange: (value: string) => void;
  onGenerate: () => void;
}) {
  const hasToken = connection?.has_token === true;
  // Un enlace vacío todavía no es un error que mostrar: el usuario no ha
  // empezado. Solo se explica el problema cuando pegó algo que no captura.
  const baseLinkIssue = normalizeText(baseLink) ? captureUrlIssue(baseLink) : "";
  return (
    <section className="rec-kobo-panel" aria-label="Kobo para generar enlaces por curso-horario">
      <div className="rec-kobo-head">
        <span><ExternalLink size={15} /></span>
        <div>
          <small>Kobo</small>
          <strong>Crea enlaces únicos por curso-horario</strong>
          <p>Usa una conexión guardada o pega el enlace base. La credencial no se muestra ni entra al proyecto.</p>
        </div>
      </div>
      <div
        className="rec-kobo-controls"
        data-qa-geometry-group="recopiladores/kobo-campos"
        data-qa-geometry-contract="intrinsic"
      >
        <label>
          <span>Cuenta</span>
          <select value={selectedProfileId} onChange={(event) => onProfileChange(event.currentTarget.value)} disabled={!profiles.length || loading}>
            {profiles.length ? profiles.map((profile) => (
              <option key={profile.id || profile.alias} value={profile.id}>{koboProfileLabel(profile)}</option>
            )) : (
              <option value="">Kobo sin configurar</option>
            )}
          </select>
        </label>
        <label>
          <span>Servidor</span>
          <input value={baseUrl} onChange={(event) => onBaseUrlChange(event.currentTarget.value)} placeholder={KOBO_DEFAULT_BASE_URL} />
        </label>
        <button type="button" onClick={onLoadAssets} disabled={loading || !hasToken}>
          {loading ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          Cargar formularios
        </button>
        <label className="rec-kobo-form-field">
          <span>Formulario</span>
          <select value={selectedAssetUid} onChange={(event) => onAssetChange(event.currentTarget.value)} disabled={!assets.length}>
            {assets.length ? assets.map((asset) => (
              <option key={asset.uid} value={asset.uid}>{asset.name || asset.uid}</option>
            )) : (
              <option value="">Selecciona desde Kobo</option>
            )}
          </select>
        </label>
        <button type="button" className="rec-kobo-resolve" onClick={onResolveLink} disabled={resolving || !hasToken || !selectedAssetUid}>
          {resolving ? <Loader2 size={14} className="pulso-spin" /> : <ExternalLink size={14} />}
          Resolver enlace
        </button>
        <label className="rec-kobo-wide">
          <span>Enlace base de aplicación</span>
          <input
            value={baseLink}
            onChange={(event) => onBaseLinkChange(event.currentTarget.value)}
            placeholder="Pega el enlace del formulario web de Kobo"
            aria-invalid={baseLinkIssue ? true : undefined}
          />
          {baseLinkIssue ? <small className="rec-kobo-invalid">{captureUrlMessage(baseLinkIssue)}</small> : null}
        </label>
        <label className="rec-kobo-wide">
          <span>Identificador por curso-horario</span>
          <small>Usa el curso-horario para que Kobo y Monitoreo reconozcan de qué unidad vino cada respuesta.</small>
          <textarea
            value={paramsTemplate}
            onChange={(event) => onParamsTemplateChange(event.currentTarget.value)}
            spellCheck={false}
          />
        </label>
      </div>
      {error ? <p className="rec-kobo-error">{error}</p> : null}
      <div className="rec-kobo-foot">
        <span>{hasToken ? "Kobo conectado" : "Pega enlace base o configura Kobo"}</span>
        <span>{assets.length ? `${fmt(assets.length)} formularios` : "sin catálogo"}</span>
        {resolvedFrom ? <span>{resolvedFrom === "deployment" ? "enlace de aplicación" : "sin formulario resuelto"}</span> : null}
        <span>{linkedCount ? `${fmt(linkedCount)} con enlace` : `${fmt(agendaCount)} por generar`}</span>
        <button type="button" className="is-primary" onClick={onGenerate} disabled={!agendaCount || !captureUrlOk(baseLink)}>
          {linkedCount ? "Regenerar enlaces" : "Generar enlaces"}
        </button>
      </div>
    </section>
  );
}

export default function RecopiladoresPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [calcState, setCalcState] = useState<CalcMuestraState | null>(null);
  // La navegación NO es estado local: vive en la dirección, como en el resto de
  // la app. Antes eran dos `useState` y por eso `?seccion=&pestana=` se leía en
  // el inspector pero no movía la pantalla.
  // `useSeccion` ya resuelve la sección contra el manifiesto, así que una clave
  // vieja llegaría aquí convertida en la primera sección y el alias no se vería
  // nunca. Los valores CRUDOS salen de `useDireccion`; de `useSeccion` solo se
  // toma el navegador de niveles.
  const direccionUrl = useDireccion();
  const seccionUrl = direccionUrl?.seccion ?? null;
  const pestanaUrl = direccionUrl?.pestana ?? null;
  const { irA } = useSeccion("recopiladores");
  const { seccion: activeSection, pestana: activeTab } = useMemo(
    () => resolverDireccion(seccionUrl, pestanaUrl),
    [seccionUrl, pestanaUrl],
  );
  const setActiveSection = useCallback((section: QrSection) => irA("seccion", section), [irA]);
  const setActiveTab = useCallback((tab: QrTab) => irA("pestana", tab), [irA]);

  // Un enlace viejo (`?seccion=preparacion&pestana=agenda`) aterriza donde debe
  // y la app reescribe la dirección a la forma canónica, sin dejar entrada en el
  // historial: los alias se leen, nunca se escriben. Se escriben los dos niveles
  // de una sola vez porque `irA` gobierna uno solo y encadenarlo dejaría un
  // estado intermedio con la sección nueva y la pestaña vieja.
  useEffect(() => {
    if (esDireccionCanonica(seccionUrl, pestanaUrl)) return;
    const canonico = searchConNivel(
      searchConNivel(location.search, "seccion", activeSection),
      "pestana",
      activeTab,
    );
    navigate(`${location.pathname}${canonico}`, { replace: true });
  }, [seccionUrl, pestanaUrl, activeSection, activeTab, location.pathname, location.search, navigate]);
  const [selectedFaculty, setSelectedFaculty] = useState("todas");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [linkPaste, setLinkPaste] = useState("");
  const [manualLinks, setManualLinks] = useState<Map<string, ManualLinkRecord>>(() => new Map());
  const [koboConnection, setKoboConnection] = useState<ConnectionTokenState | null>(null);
  const [koboProfileId, setKoboProfileId] = useState("");
  const [koboBaseUrl, setKoboBaseUrl] = useState(KOBO_DEFAULT_BASE_URL);
  const [koboAssets, setKoboAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [koboAssetUid, setKoboAssetUid] = useState("");
  const [koboBaseLink, setKoboBaseLink] = useState("");
  const [koboParamTemplate, setKoboParamTemplate] = useState(KOBO_PARAM_TEMPLATE);
  const [koboLoading, setKoboLoading] = useState(false);
  const [koboResolving, setKoboResolving] = useState(false);
  const [koboResolvedFrom, setKoboResolvedFrom] = useState("");
  const [koboError, setKoboError] = useState("");
  const [returnCopied, setReturnCopied] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnSaveMessage, setReturnSaveMessage] = useState("");
  const [returnSaveError, setReturnSaveError] = useState("");
  const [printPreparedAt, setPrintPreparedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [monitoreoResult, calcResult] = await Promise.allSettled([
        apiMonitoreoState({
          includeReports: true,
          reportScope: "source",
          warmupCache: !force,
          force,
        }),
        apiCalcMuestraState(),
      ]);
      if (monitoreoResult.status === "fulfilled") {
        setState(monitoreoResult.value);
      }
      if (calcResult.status === "fulfilled") {
        setCalcState(calcResult.value);
      }
      if (monitoreoResult.status === "rejected" && calcResult.status === "rejected") {
        throw monitoreoResult.reason;
      }
      setError(monitoreoResult.status === "rejected" ? "No se pudo leer Monitoreo; usando Cálculo de muestra si está disponible." : "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    apiConnectionsList()
      .then((result) => {
        if (cancelled) return;
        const kobo = result.connections.find((connection) => connection.provider === "kobo") ?? null;
        setKoboConnection(kobo);
      })
      .catch((e) => {
        if (!cancelled) setKoboError((e as Error).message || String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monitorRows = useMemo(() => monitorAgendaFromState(state), [state]);
  const calcRows = useMemo(() => calcSelectionAgenda(calcState), [calcState]);
  const baseAgendaRows = monitorRows.length ? monitorRows : calcRows;
  const agendaRows = useMemo(() => applyManualLinks(baseAgendaRows, manualLinks), [baseAgendaRows, manualLinks]);
  const printableRows = useMemo(() => agendaRows.filter((row) => Boolean(rowLink(row))), [agendaRows]);
  const agendaSource = monitorRows.length ? "Monitoreo de cursos-horario" : calcRows.length ? "Cálculo de muestra" : "";
  const unsavedLinks = useMemo(() => {
    if (!agendaRows.length) return 0;
    const monitorLinks = new Map<string, string>();
    monitorRows.forEach((row) => {
      const link = rowLink(row);
      if (!link) return;
      rowMatchKeys(row).forEach((key) => {
        if (key && !monitorLinks.has(key)) monitorLinks.set(key, link);
      });
    });
    return agendaRows.filter((row) => {
      const link = rowLink(row);
      if (!link) return false;
      return !rowMatchKeys(row).some((key) => monitorLinks.get(key) === link);
    }).length;
  }, [agendaRows, monitorRows]);
  const linkParseResult = useMemo(() => parseLinkClipboard(linkPaste), [linkPaste]);
  const linkPasteMatches = useMemo(() => {
    if (!linkParseResult.records.length || !baseAgendaRows.length) return 0;
    const parsedKeys = new Set(linkParseResult.records.map((record) => normalizeMatchKey(record.key)).filter(Boolean));
    return baseAgendaRows.filter((row) => rowMatchKeys(row).some((key) => parsedKeys.has(key))).length;
  }, [baseAgendaRows, linkParseResult.records]);
  const faculties = useMemo(() => facultyOptions(agendaRows), [agendaRows]);
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return agendaRows.filter((row) => {
      if (selectedFaculty !== "todas" && rowFaculty(row) !== selectedFaculty) return false;
      if (!needle) return true;
      return [
        classroomLabel(row),
        rowFaculty(row),
        normalizeText(row.course_name),
        normalizeText(row.program),
        normalizeText(row.teacher),
        normalizeText(row.schedule),
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [agendaRows, query, selectedFaculty]);

  const firstKey = filteredRows.length ? rowKey(filteredRows[0], 0) : "";
  const selectedRow = useMemo(() => {
    if (!filteredRows.length) return null;
    const found = filteredRows.find((row, index) => rowKey(row, index) === selectedKey);
    return found ?? filteredRows[0];
  }, [filteredRows, selectedKey]);

  useEffect(() => {
    if (!filteredRows.length) {
      if (selectedKey) setSelectedKey("");
      return;
    }
    if (!selectedKey || !filteredRows.some((row, index) => rowKey(row, index) === selectedKey)) {
      setSelectedKey(firstKey);
    }
  }, [filteredRows, firstKey, selectedKey]);

  const tabs = SECTION_TABS[activeSection];
  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab(tabs[0].id);
  }, [activeTab, tabs]);

  const withLink = agendaRows.filter((row) => Boolean(rowLink(row))).length;
  const withQr = agendaRows.filter(hasQr).length;
  const missingLinks = Math.max(agendaRows.length - withLink, 0);
  const pdfPageCount = printableRows.length ? printableRows.length + 1 : 0;
  const returnManifest = useMemo(() => returnManifestTsv(agendaRows), [agendaRows]);
  const totalEligible = agendaRows.reduce((sum, row) => {
    const n = Number(row.eligible_n);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const selectedFacultyLabel = selectedFaculty === "todas" ? "Todas las facultades" : selectedFaculty;
  const dashboard = dashboardFromState(state);
  const koboProfiles = koboConnection?.profiles ?? [];
  const selectedKoboProfile = koboProfiles.find((profile) => profile.id === koboProfileId) ??
    koboProfiles.find((profile) => profile.is_default) ??
    koboProfiles[0] ??
    null;
  const selectedKoboAsset = koboAssets.find((asset) => asset.uid === koboAssetUid) ?? null;
  const readyForPrint = printableRows.length > 0;
  const packageOutputGroups = useMemo(() => buildPackageOutputGroups(agendaRows), [agendaRows]);
  const packageGroups = useMemo(() => faculties.map((faculty) => {
    const rows = agendaRows.filter((row) => rowFaculty(row) === faculty);
    const linked = rows.filter((row) => Boolean(rowLink(row))).length;
    const students = rows.reduce((sum, row) => {
      const n = Number(row.eligible_n);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    return {
      faculty,
      total: rows.length,
      linked,
      students,
      missing: Math.max(rows.length - linked, 0),
    };
  }).sort((a, b) => b.total - a.total || a.faculty.localeCompare(b.faculty, "es")), [agendaRows, faculties]);
  const activeCopy = TAB_COPY[activeTab];
  const sidebarNote = SIDEBAR_NOTES[activeTab];
  const SidebarNoteIcon = sidebarNote.icon;
  const isFichaPreview = activeSection === "materiales" && activeTab === "vista";
  const isPackageOutput = activeSection === "materiales" && activeTab === "paquetes";
  const isPackageSave = activeSection === "entrega-campo" && activeTab === "traspaso";
  const isLinkSetup = activeSection === "accesos" && activeTab === "canales";
  const isFichaList = activeSection === "accesos" && activeTab === "vinculacion";
  const isAgendaReview = activeSection === "plan-recoleccion" && activeTab === "unidades";
  const agendaReady = agendaRows.length > 0;
  const linksReady = agendaReady && missingLinks === 0;
  const linksPartial = agendaReady && withLink > 0 && missingLinks > 0;
  const monitorReady = monitorRows.length > 0;
  const returnSaved = withLink > 0 && monitorReady && unsavedLinks === 0;
  const topStatus = readyForPrint
    ? {
        icon: FileText,
        tone: "ready" as StepTone,
        label: `${fmt(printableRows.length)} fichas QR`,
        detail: "PDF listo",
      }
    : withLink
      ? {
          icon: QrCode,
          tone: "current" as StepTone,
          label: `${fmt(withLink)} enlaces`,
          detail: missingLinks ? `${fmt(missingLinks)} enlaces faltan` : "listo para PDF",
        }
      : agendaReady
        ? {
            icon: Link2,
            tone: "waiting" as StepTone,
            label: "Enlaces pendientes",
            detail: `${fmt(agendaRows.length)} cursos-horario`,
          }
        : {
            icon: ClipboardList,
            tone: "waiting" as StepTone,
            label: "Sin agenda",
            detail: "preparar cursos-horario",
          };
  // Done por sección del rail: espejo 1:1 de los hitos que ya usa ReadinessRail
  // (Preparar QR → linksReady · Aplicar en el salón → readyForPrint ·
  // Cerrar trazabilidad → returnSaved). No introduce señales nuevas.
  const sectionDone: Record<QrSection, boolean> = {
    "plan-recoleccion": agendaRows.length > 0,
    accesos: linksReady,
    materiales: readyForPrint,
    "entrega-campo": returnSaved,
  };
  const readinessSteps = [
    {
      label: "Coordinar curso-horario",
      status: agendaReady ? `${fmt(agendaRows.length)} cursos-horario` : "Pendiente",
      detail: agendaReady ? "Curso-horario, docente y horario listos para contactar." : "Primero genera o importa la selección de cursos-horario.",
      tone: agendaReady ? "ready" : "current",
    },
    {
      label: "Preparar QR",
      status: linksReady ? "Completo" : linksPartial ? `${fmt(missingLinks)} faltan` : "Pendiente",
      detail: linksReady ? "Cada QR lleva el identificador del curso-horario." : "Cada ficha necesita un enlace específico del curso-horario.",
      tone: linksReady ? "ready" : agendaReady ? "current" : "waiting",
    },
    {
      label: "Aplicar en el salón",
      status: readyForPrint ? `${fmt(printableRows.length)} fichas` : "Pendiente",
      detail: readyForPrint ? "El PDF imprime un QR por curso-horario para aplicación presencial." : "El paquete PDF se habilita cuando haya cursos-horario con enlace.",
      tone: readyForPrint ? "ready" : linksReady || linksPartial ? "current" : "waiting",
    },
    {
      label: "Cerrar trazabilidad",
      status: returnSaved ? "Guardado" : withLink ? `${fmt(unsavedLinks)} por guardar` : "Por conectar",
      detail: returnSaved
        ? "Monitoreo ya conserva enlaces y fuente por curso-horario."
        : withLink
          ? "Guarda en Monitoreo para que el seguimiento use los enlaces generados."
          : "Luego el paquete PDF y sus enlaces deben volver al seguimiento.",
      tone: returnSaved ? "ready" : readyForPrint ? "current" : "waiting",
    },
  ] satisfies Array<{ label: string; status: string; detail: string; tone: StepTone }>;
  const nextAction = !agendaReady
    ? {
        title: "Genera la selección de cursos-horario",
        detail: "Empieza en Cálculo de muestra para obtener cursos-horario titulares y reservas antes de producir fichas.",
        tone: "current" as StepTone,
      }
    : !withLink
    ? {
        title: "Agrega enlaces de encuesta por curso-horario",
        detail: "La agenda ya existe, pero todavía no hay enlaces para convertir en QR. Sin enlace no hay ficha aplicable.",
        tone: "current" as StepTone,
      }
    : missingLinks > 0
    ? {
        title: "Completa los enlaces faltantes",
        detail: `${fmt(missingLinks)} cursos-horario todavía no tienen enlace. Puedes generar un PDF parcial o cerrar la cobertura antes de entregar.`,
        tone: "current" as StepTone,
      }
    : !returnSaved
    ? {
        title: "Genera el PDF y guarda enlaces",
        detail: `El PDF tendrá ${fmt(pdfPageCount)} páginas: portada y ${fmt(printableRows.length)} fichas de curso-horario. Luego guarda los enlaces en Monitoreo.`,
        tone: "current" as StepTone,
      }
    : {
        title: "Paquete listo para campo",
        detail: "La agenda, los enlaces y el seguimiento están alineados para la aplicación presencial en salones.",
        tone: "ready" as StepTone,
      };

  useEffect(() => {
    if (!koboConnection) return;
    const preferredProfile = koboConnection.active_profile_id ||
      koboProfiles.find((profile) => profile.is_default)?.id ||
      koboProfiles[0]?.id ||
      "";
    if (preferredProfile) {
      setKoboProfileId((current) => current || preferredProfile);
    }
    const preferredBase = cleanKoboBaseUrl(
      koboConnection.active_profile_base_url ||
      koboProfiles.find((profile) => profile.id === preferredProfile)?.base_url ||
      koboProfiles[0]?.base_url ||
      KOBO_DEFAULT_BASE_URL,
    );
    setKoboBaseUrl((current) => current && current !== KOBO_DEFAULT_BASE_URL ? current : preferredBase);
  }, [koboConnection, koboProfiles]);

  function selectKoboAsset(uid: string) {
    setKoboAssetUid(uid);
    setKoboResolvedFrom("");
    // El campo no se siembra con la landing administrativa: el enlace sale de
    // "Resolver enlace" o lo pega el usuario. Un enlace heredado que no captura
    // se limpia al cambiar de formulario en vez de arrastrarse al QR.
    setKoboBaseLink((current) => (captureUrlOk(current) ? current : ""));
  }

  async function loadKoboAssets() {
    if (!koboConnection?.has_token) {
      setKoboError("Configura Kobo en Usuarios antes de cargar formularios.");
      return;
    }
    setKoboLoading(true);
    setKoboError("");
    try {
      const cleanBase = cleanKoboBaseUrl(koboBaseUrl || selectedKoboProfile?.base_url);
      setKoboBaseUrl(cleanBase);
      const result = await apiMonitoreoKoboAssets(cleanBase, 100, {
        connection_profile_id: selectedKoboProfile?.id || koboProfileId || undefined,
      });
      setKoboAssets(result.assets);
      const nextAsset = result.assets.find((asset) => asset.uid === koboAssetUid) ?? result.assets[0] ?? null;
      setKoboAssetUid(nextAsset?.uid ?? "");
      if (nextAsset) {
        setKoboBaseLink((current) => (captureUrlOk(current) ? current : ""));
        setKoboResolvedFrom("");
      }
    } catch (e) {
      setKoboError((e as Error).message || String(e));
    } finally {
      setKoboLoading(false);
    }
  }

  async function resolveKoboSurveyLink() {
    const assetUid = koboAssetUid || selectedKoboAsset?.uid || "";
    if (!assetUid) {
      setKoboError("Selecciona un formulario Kobo para resolver su enlace.");
      return;
    }
    if (!koboConnection?.has_token) {
      setKoboError("Configura Kobo en Usuarios antes de resolver el enlace desde el deployment.");
      return;
    }
    setKoboResolving(true);
    setKoboError("");
    try {
      const cleanBase = cleanKoboBaseUrl(koboBaseUrl || selectedKoboProfile?.base_url);
      setKoboBaseUrl(cleanBase);
      const result = await apiMonitoreoKoboSurveyLink({
        asset_uid: assetUid,
        base_url: cleanBase,
        connection_profile_id: selectedKoboProfile?.id || koboProfileId || undefined,
      });
      // Solo `survey_url` sirve para colgar los parámetros de unidad. Si Kobo no
      // resolvió un formulario, el campo se queda vacío y se dice por qué: la
      // landing administrativa no es un reemplazo silencioso.
      setKoboBaseLink(result.survey_url || "");
      setKoboResolvedFrom(result.resolved_from || "unresolved");
      if (!result.survey_url) {
        setKoboError(
          result.capture_message ||
            "Kobo no devolvió un formulario web para este proyecto. Copia el enlace del formulario desde Kobo y pégalo.",
        );
      }
      if (result.name && !koboAssets.some((asset) => asset.uid === assetUid)) {
        setKoboAssets((current) => [
          ...current,
          {
            uid: assetUid,
            name: result.name,
            version_id: result.version_id,
            date_modified: null,
            deployment_active: result.deployment_active,
          },
        ]);
      }
    } catch (e) {
      setKoboError((e as Error).message || String(e));
    } finally {
      setKoboResolving(false);
    }
  }

  function generateKoboLinks() {
    if (!baseAgendaRows.length) {
      setKoboError("Primero necesitas una agenda de cursos-horario.");
      return;
    }
    const base = normalizeText(koboBaseLink);
    const issue = captureUrlIssue(base);
    if (issue) {
      setKoboError(
        issue === "vacia"
          ? "Pega el enlace del formulario web de Kobo, o resuélvelo desde el formulario seleccionado."
          : captureUrlMessage(issue),
      );
      return;
    }
    const next = new Map(manualLinks);
    baseAgendaRows.forEach((row) => {
      const key = classroomLabel(row);
      const context = rowTemplateContext(row, selectedKoboAsset);
      const surveyLink = appendPersonalizedParams(base, koboParamTemplate, context);
      const matchKey = normalizeMatchKey(key);
      if (!matchKey || !surveyLink) return;
      next.set(matchKey, {
        key,
        surveyLink,
        qr: "",
        word: "",
        pdf: "",
        sample: selectedKoboAsset?.name || "Kobo",
      });
    });
    setManualLinks(next);
    setKoboError("");
    setReturnSaveMessage("");
    setReturnSaveError("");
  }

  function changeSection(section: QrSection) {
    setActiveSection(section);
    setActiveTab(SECTION_TABS[section][0].id);
  }

  function copySelectedLink() {
    const link = selectedRow ? rowLink(selectedRow) : "";
    if (!link || !navigator.clipboard) return;
    void navigator.clipboard.writeText(link);
  }

  function copyReturnManifest() {
    if (!agendaRows.length || !withLink || !navigator.clipboard) return;
    void navigator.clipboard.writeText(returnManifest).then(() => {
      setReturnCopied(true);
      window.setTimeout(() => setReturnCopied(false), 1800);
    });
  }

  function preparePrintPackage() {
    if (!printableRows.length) return;
    setActiveSection("materiales");
    setActiveTab("paquetes");
    setPrintPreparedAt(new Date().toISOString());
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 160);
    });
  }

  async function saveReturnToMonitoring() {
    const linkedRows = agendaRows.filter((row) => Boolean(rowLink(row)));
    if (!linkedRows.length) {
      setReturnSaveError("No hay enlaces para guardar todavía.");
      return;
    }
    setReturnSaving(true);
    setReturnSaveError("");
    setReturnSaveMessage("");
    try {
      const packageStatus = printPreparedAt ? "pdf_preparado" : undefined;
      if (monitorRows.length) {
        const result = await apiMonitoreoAulasAgenda(linkedRows.map((row) => returnAgendaUpdate(row, packageStatus)));
        setState(result.state);
      } else {
        const result = await apiMonitoreoAulasConfig({
          enabled: true,
          imported_at: new Date().toISOString(),
          plan: agendaRows.map((row) => ({
            ...row,
            ...returnAgendaUpdate(row, packageStatus),
            collector_id: sourceRowText(row as Record<string, unknown>, ["collector_id", "manual_link_source"]),
          })),
        });
        setState(result.state);
      }
      setManualLinks(new Map());
      setReturnSaveMessage(`${fmt(linkedRows.length)} enlaces guardados en Monitoreo.`);
    } catch (e) {
      setReturnSaveError((e as Error).message || String(e));
    } finally {
      setReturnSaving(false);
    }
  }

  function applyPastedLinks() {
    const next = new Map(manualLinks);
    linkParseResult.records.forEach((record) => {
      const key = normalizeMatchKey(record.key);
      if (key) next.set(key, record);
    });
    setManualLinks(next);
    setReturnSaveMessage("");
    setReturnSaveError("");
  }

  function clearPastedLinks() {
    setLinkPaste("");
    setManualLinks(new Map());
    setReturnSaveMessage("");
    setReturnSaveError("");
  }

  return (
    <div className="rec-page" style={MODULE_TONES.recopiladores as CSSProperties} data-audit-ready={!loading && (state !== null || calcState !== null) ? "recopiladores" : undefined}>
      {/* La banda venía con el título largo del módulo a la izquierda y las
          acciones a la derecha: 659px de tinta contra 348, el peor desbalance de
          los ocho módulos. El título además estaba repetido literalmente en el
          `AulasApplicationFlow` de abajo, así que retirarlo no pierde nada — la
          decisión de retirar las franjas de título ya estaba tomada.
          En su lugar, la izquierda lleva los dos datos que sí se consultan
          mientras se opera: qué entra a campo y sobre qué facultad. */}
      <ModuleCommandBar
        modulo="recopiladores"
        ariaLabel="Acciones de Recopiladores"
        className="rec-topbar"
        contexto={
          <ChromeIndicatorGroup
            ariaLabel="Contexto de Recopiladores"
            resumen={`${fmt(agendaRows.length)} cursos-horario en el plan · ${selectedFacultyLabel}`}
          >
            <ChromeIndicator
              label="Plan"
              value={agendaRows.length ? `${fmt(agendaRows.length)} cursos-horario` : "pendiente"}
              prioridad="alta"
            />
            {/* «Todas las facultades» se dice con el label puesto: dentro de un
                indicador rotulado «Facultad», el valor «Todas» ya es la frase
                completa, y las 19 letras de más eran 100px de desbalance contra
                el lado derecho.
                Prioridad media, no baja: con `baja` la escalera lo recogía ya a
                1259px de banda —medido— y el dato desaparecía habiendo sitio de
                sobra. Es el segundo en irse cuando de verdad aprieta, no el
                primero en irse siempre. */}
            <ChromeIndicator
              label="Facultad"
              value={selectedFaculty === "todas" ? "Todas" : selectedFacultyLabel}
              prioridad="media"
              detalle={selectedFacultyLabel}
            />
          </ChromeIndicatorGroup>
        }
        estado={[
          {
            id: "estado",
            label: topStatus.label,
            tone: topStatus.tone === "ready" ? "success" : topStatus.tone === "current" ? "info" : "warn",
            detail: topStatus.detail,
          },
        ]}
        acciones={[
          {
            id: "actualizar",
            label: "Actualizar",
            rank: 1,
            onSelect: () => void load(true),
            disabled: loading,
            busy: loading,
          },
          // Heredadas de la barra de pasos retirada: son los dos destinos que
          // el módulo necesita ofrecer sin dibujar un recorrido paralelo.
          {
            id: "muestra",
            label: "Ver muestra",
            icon: CalendarRange,
            rank: 3,
            onSelect: () => navigate(AULAS_SAMPLE_ROUTE),
          },
          {
            id: "monitoreo",
            label: "Abrir monitoreo",
            icon: ExternalLink,
            rank: 2,
            onSelect: () => navigate("/monitoreo"),
          },
        ]}
        secciones={
        <>
        {/* Selector de etapas (.pulso-phase-pillbar):
            mismas píldoras centradas de Monitoreo/Bitácora, con número de fase
            19×19 y estado done derivado de los hitos existentes. El acento
            activo entra por --module-accent/--pulso-primary del scope. */}
        <GlidingTabList
          activeKey={activeSection}
          mode="tabs"
          className="pulso-phase-pillbar rec-section-pillbar"
          role="group"
          aria-label="Secciones de Recopiladores"
        >
          <ol
            className="pulso-phase-pill-list"
            data-qa-geometry-group="recopiladores/secciones"
            data-qa-geometry-contract="intrinsic"
          >
            {SECTIONS.map((section, index) => {
              const active = activeSection === section.id;
              return (
                <li key={section.id} className="pulso-phase-pill-item">
                  <button
                    type="button"
                    data-gliding-key={section.id}
                    aria-pressed={active}
                    className={`pulso-phase-pill rec-section-pill${active ? " is-active" : ""}${sectionDone[section.id] ? " is-done" : ""}`}
                    title={`${section.label}: ${section.detail}`}
                    aria-label={`${section.label}: ${section.detail}`}
                    onClick={() => changeSection(section.id)}
                  >
                    <span className="pulso-phase-pill-circle" aria-hidden="true" />
                    <span className="pulso-phase-pill-stack">
                      <span className="pulso-phase-pill-label">
                        <span className="pulso-phase-pill-text">{section.label}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </GlidingTabList>
        </>
        }
      />

      {/* Aquí vivía `AulasApplicationFlow`: una segunda barra con los cuatro
          pasos numerados del módulo y una tercera banda de chips de estado. Las
          tres decían la misma secuencia que el rail de secciones —que YA es el
          recorrido— y encima la barra de pasos se desincronizaba de la sección
          activa: en Paquete seguía marcando «3 Fichas PDF/Word». Entre las tres
          bandas el chrome se comía casi un tercio del alto antes del primer dato
          y el mismo número aparecía seis veces en pantalla.

          El estado de avance no se perdió: vive en `ChromeIndicator` (Plan) y en
          el command strip de cada pestaña, que lo dice donde se está operando.
          Los dos destinos externos pasaron a acciones de la banda. */}

      <main className="rec-workbench">
        {/* Rail de tercer nivel (módulo → sección → pestaña): SIEMPRE comprimido
            icon-only (dec-sidebar-icon-tooltip, patrón maestro #3 — el push por
            grid quedó deprecado). El reveal es la burbuja flotante
            data-rail-tooltip en hover/focus (incluida la pestaña activa); la
            identificación persistente la da el command strip de cada pestaña
            al inicio del canvas. */}
        <aside className="rec-sidebar" aria-label="Pestañas de la sección activa">
          <div className="rec-sidebar-shell">
            <div className="rec-sidebar-head">
              <span>Sección activa</span>
              <strong>{SECTIONS.find((section) => section.id === activeSection)?.label}</strong>
              <small>{selectedFacultyLabel}</small>
            </div>
            <GlidingTabList as="nav" activeKey={activeTab} orientation="vertical" role="tablist" aria-label="Pestañas de la sección activa">
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`rec-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-gliding-key={tab.id}
                    aria-controls={active ? "rec-tabpanel" : undefined}
                    tabIndex={active ? 0 : -1}
                    className={active ? "is-active" : ""}
                    aria-label={`${tab.label}. ${tab.detail}`}
                    data-rail-tooltip={`${tab.label}\n${tab.detail}`}
                    // Contrato de `app/nav-states.css`: con el atributo puesto, el
                    // item toma el hover, el foco y el material de reposo
                    // compartidos. Sin él este rail se quedaba plano —sin fondo ni
                    // borde hasta el hover— mientras los de Procesamiento y
                    // Monitoreo ya eran tarjetas. Era el mismo destino con dos
                    // aspectos según el módulo.
                    data-nav-item=""
                    data-nav-shape="row"
                    data-nav-state={active ? "selected" : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => {
                      // Roving tabindex del tablist vertical: las flechas mueven
                      // el foco y activan (activación automática, patrón WAI-ARIA).
                      const target = event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : event.key === "ArrowDown" || event.key === "ArrowRight"
                            ? (index + 1) % tabs.length
                            : event.key === "ArrowUp" || event.key === "ArrowLeft"
                              ? (index - 1 + tabs.length) % tabs.length
                              : -1;
                      if (target < 0) return;
                      event.preventDefault();
                      const nextTab = tabs[target];
                      setActiveTab(nextTab.id);
                      document.getElementById(`rec-tab-${nextTab.id}`)?.focus();
                    }}
                  >
                    <span className="rec-sidebar-tab-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="rec-sidebar-tab-copy">
                      <strong>{tab.label}</strong>
                      <small>{tab.detail}</small>
                    </span>
                  </button>
                );
              })}
            </GlidingTabList>
            <div className={`rec-sidebar-note is-${sidebarNote.tone}`}>
              <SidebarNoteIcon size={15} />
              <div>
                <strong>{sidebarNote.title}</strong>
                <p>{sidebarNote.detail}</p>
              </div>
            </div>
          </div>
        </aside>

        <section
          role="tabpanel"
          id="rec-tabpanel"
          aria-labelledby={`rec-tab-${activeTab}`}
          className={`rec-content${isFichaPreview ? " is-ficha-preview" : ""}${isFichaList ? " is-ficha-list" : ""}${isAgendaReview ? " is-agenda-review" : ""}${isPackageOutput ? " is-package-output" : ""}${isPackageSave ? " is-package-save" : ""}${isLinkSetup ? " is-link-setup" : ""}`}
        >
          {/* Identidad accesible sin franja visual (contrato: sin H1 visible en
              módulos; el primer viewport es para datos). Título compacto de la
              pestaña activa (dec-sidebar-icon-tooltip): el command strip de cada
              pestaña YA cumple ese rol — es la primera pieza del panel y trae
              kicker propio de la pestaña (span acento/uppercase) + título en
              strong + detalle en p, así que no se duplica con un header extra.
              Los enlaces a muestra/monitoreo ya existen en los strips y en la
              banda de aplicación. pulso-sr-only es position:absolute, no ocupa
              fila del grid del canvas. */}
          <h1 className="pulso-sr-only">{`Recopiladores · ${activeCopy.title}`}</h1>

          {error ? <div className="rec-error"><AlertCircle size={16} /> {error}</div> : null}

          {isAgendaReview ? (
            <div className="rec-agenda-command-strip">
              <div>
                <span>{activeCopy.kicker}</span>
                <strong>
                  {agendaReady
                    ? `${fmt(filteredRows.length)} cursos-horario visibles para preparar QR`
                    : "Primero trae la selección de cursos-horario"}
                </strong>
                <p>Confirma curso-horario, facultad, curso y horario. Cada fila será una ficha cuando tenga enlace de encuesta.</p>
              </div>
              <div>
                {agendaReady ? (
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => setActiveTab("canales")}
                  >
                    <Link2 size={14} />
                    Preparar enlaces
                  </button>
                ) : (
                  <Link className="is-primary" to={AULAS_SAMPLE_ROUTE}>
                    <CalendarRange size={14} />
                    Revisar muestra
                  </Link>
                )}
                <Link to="/monitoreo"><ExternalLink size={14} /> Abrir monitoreo</Link>
              </div>
            </div>
          ) : isLinkSetup ? (
            <div className="rec-link-command-strip">
              <div>
                <span>{activeCopy.kicker}</span>
                <strong>{withLink ? `${fmt(withLink)} enlaces listos para convertir en fichas` : "Genera enlaces únicos antes de imprimir"}</strong>
                <p>{activeCopy.detail}</p>
              </div>
              <div>
                <Link to={AULAS_SAMPLE_ROUTE}><CalendarRange size={14} /> Revisar muestra</Link>
                <Link to="/monitoreo"><ExternalLink size={14} /> Abrir monitoreo</Link>
              </div>
            </div>
          ) : isFichaPreview ? (
            <div className="rec-ficha-command-strip">
              <div>
                <span>{activeCopy.kicker}</span>
                <strong>{readyForPrint ? `${fmt(printableRows.length)} fichas listas para PDF` : "Prepara enlaces antes de imprimir"}</strong>
                <p>{activeCopy.detail}</p>
              </div>
              <div>
                <button type="button" onClick={preparePrintPackage} disabled={!printableRows.length}>
                  <FileText size={14} />
                  Generar PDF
                </button>
                <button type="button" onClick={saveReturnToMonitoring} disabled={!withLink || returnSaving || returnSaved}>
                  {returnSaving ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
                  {returnSaved ? "Guardado" : "Guardar en Monitoreo"}
                </button>
              </div>
            </div>
          ) : isFichaList ? (
            <div className="rec-list-command-strip">
              <div>
                <span>{activeCopy.kicker}</span>
                <strong>
                  {linksReady
                    ? "Todos los cursos-horario están listos para imprimir"
                    : withLink
                      ? `${fmt(missingLinks)} cursos-horario necesitan enlace antes del PDF`
                      : "Agrega enlaces para activar las fichas"}
                </strong>
                <p>Audita curso-horario, docente, salón y enlace. Al seleccionar una fila se abre su ficha QR.</p>
              </div>
              <div>
                {missingLinks ? (
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => {
                      setActiveSection("accesos");
                      setActiveTab("canales");
                    }}
                  >
                    <Link2 size={14} />
                    Completar enlaces
                  </button>
                ) : (
                  <button type="button" className="is-primary" onClick={preparePrintPackage} disabled={!printableRows.length}>
                    <FileText size={14} />
                    Generar PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("materiales");
                    setActiveTab("vista");
                  }}
                  disabled={!selectedRow}
                >
                  <QrCode size={14} />
                  Ver ficha
                </button>
              </div>
            </div>
          ) : isPackageOutput ? (
            <div className="rec-package-command-strip">
              <div>
                <span>{activeCopy.kicker}</span>
                <strong>{readyForPrint ? `${fmt(pdfPageCount)} páginas listas para imprimir` : "Prepara enlaces antes de generar el PDF"}</strong>
                <p>{activeCopy.detail}</p>
              </div>
              <div>
                <button type="button" onClick={preparePrintPackage} disabled={!printableRows.length}>
                  <FileText size={14} />
                  Generar PDF
                </button>
                <button type="button" onClick={saveReturnToMonitoring} disabled={!withLink || returnSaving || returnSaved}>
                  {returnSaving ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
                  {returnSaved ? "Guardado" : "Guardar en Monitoreo"}
                </button>
              </div>
            </div>
          ) : isPackageSave ? (
            <div className="rec-return-command-strip">
              <div>
                <span>{activeCopy.kicker}</span>
                <strong>{returnSaved ? "Enlaces guardados en Monitoreo" : withLink ? `${fmt(unsavedLinks)} enlaces por guardar` : "Faltan enlaces para cerrar"}</strong>
                <p>{activeCopy.detail}</p>
              </div>
              <div>
                <button type="button" onClick={copyReturnManifest} disabled={!withLink}>
                  <ClipboardList size={14} />
                  {returnCopied ? "Copiado" : "Copiar respaldo"}
                </button>
                <button type="button" className="is-save" onClick={saveReturnToMonitoring} disabled={!withLink || returnSaving || returnSaved}>
                  {returnSaving ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
                  {returnSaved ? "Guardado" : "Guardar en Monitoreo"}
                </button>
              </div>
            </div>
          ) : (
            <NextAction title={nextAction.title} detail={nextAction.detail} tone={nextAction.tone}>
              {!agendaReady ? (
                <Link to={AULAS_SAMPLE_ROUTE}><CalendarRange size={14} /> Ir a muestra</Link>
              ) : activeSection === "materiales" && readyForPrint ? (
                <>
                  <button type="button" onClick={preparePrintPackage}>
                    <FileText size={14} />
                    Generar PDF
                  </button>
                  <button type="button" onClick={saveReturnToMonitoring} disabled={!withLink || returnSaving || !unsavedLinks}>
                    {returnSaving ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
                    {returnSaved ? "Guardado" : "Guardar en Monitoreo"}
                  </button>
                </>
              ) : !returnSaved ? (
                <button type="button" onClick={saveReturnToMonitoring} disabled={!withLink || returnSaving}>
                  {returnSaving ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
                  Guardar en Monitoreo
                </button>
              ) : (
                <button type="button" onClick={preparePrintPackage} disabled={!printableRows.length}>
                  <FileText size={14} />
                  Generar PDF
                </button>
              )}
            </NextAction>
          )}

          {isLinkSetup ? (
            <LinkProcessStrip
              agendaCount={agendaRows.length}
              linkedCount={withLink}
              missingCount={missingLinks}
              readyForPrint={readyForPrint}
              returnSaved={returnSaved}
            />
          ) : isAgendaReview ? (
            <div className="rec-agenda-summary-strip">
              <span><strong>{loading ? "..." : fmt(filteredRows.length)}</strong> visibles</span>
              <span><strong>{loading ? "..." : fmt(agendaRows.length)}</strong> curso-horario</span>
              <span><strong>{loading ? "..." : totalEligible ? fmt(totalEligible) : "sin dato"}</strong> estudiantes</span>
              <span><strong>{loading ? "..." : agendaSource || "sin fuente"}</strong> origen</span>
            </div>
          ) : isFichaPreview ? (
            <div className="rec-ficha-summary-strip">
              <span><strong>{loading ? "..." : fmt(agendaRows.length)}</strong> curso-horario</span>
              <span><strong>{loading ? "..." : totalEligible ? fmt(totalEligible) : "sin dato"}</strong> estudiantes</span>
              <span><strong>{loading ? "..." : fmt(withLink)}</strong> con QR</span>
              <span><strong>{loading ? "..." : fmt(pdfPageCount)}</strong> páginas PDF</span>
            </div>
          ) : isFichaList ? (
            <div className="rec-list-summary-strip">
              <span><strong>{loading ? "..." : fmt(filteredRows.length)}</strong> visibles</span>
              <span><strong>{loading ? "..." : fmt(agendaRows.length)}</strong> curso-horario</span>
              <span><strong>{loading ? "..." : fmt(withLink)}</strong> con enlace</span>
              <span><strong>{loading ? "..." : missingLinks ? fmt(missingLinks) : "0"}</strong> por resolver</span>
            </div>
          ) : isPackageOutput ? (
            <div className="rec-package-summary-strip">
              <span><strong>{loading ? "..." : fmt(printableRows.length)}</strong> fichas QR</span>
              <span><strong>{loading ? "..." : fmt(pdfPageCount)}</strong> páginas PDF</span>
              <span><strong>{loading ? "..." : fmt(packageOutputGroups.length)}</strong> selecciones</span>
              <span><strong>{loading ? "..." : returnSaved ? "listo" : unsavedLinks ? fmt(unsavedLinks) : "0"}</strong> por guardar</span>
            </div>
          ) : isPackageSave ? (
            <div className="rec-return-summary-strip">
              <span><strong>{loading ? "..." : fmt(agendaRows.length)}</strong> cursos-horario</span>
              <span><strong>{loading ? "..." : fmt(withLink)}</strong> con enlace</span>
              <span><strong>{loading ? "..." : fmt(Math.max(agendaRows.length - withLink, 0))}</strong> pendientes</span>
              <span><strong>{loading ? "..." : returnSaved ? "listo" : fmt(unsavedLinks)}</strong> por guardar</span>
            </div>
          ) : (
            <div
              className="rec-metrics"
              data-qa-geometry-group="recopiladores/metricas"
              data-qa-geometry-contract="equal"
            >
              <Metric label="Cursos-horario en agenda" value={loading ? "..." : fmt(agendaRows.length)} hint="unidad de selección" />
              <Metric label="Estudiantes en cursos-horario" value={loading ? "..." : totalEligible ? fmt(totalEligible) : "sin dato"} hint="matrícula objetivo" />
              <Metric
                label={activeSection === "materiales" ? "Fichas PDF" : "Con enlace"}
                value={loading ? "..." : fmt(activeSection === "materiales" ? printableRows.length : withLink)}
                hint={activeSection === "materiales" ? "una por curso-horario" : "listas para QR"}
              />
              <Metric
                label={activeSection === "materiales" ? "Páginas PDF" : "Faltan enlaces"}
                value={loading ? "..." : fmt(activeSection === "materiales" ? pdfPageCount : missingLinks)}
                hint={activeSection === "materiales" ? "incluye portada" : selectedFacultyLabel}
              />
            </div>
          )}

          {activeSection === "materiales" || activeTab === "canales" || isFichaPreview || isFichaList || isAgendaReview ? null : <ReadinessRail steps={readinessSteps} />}

          {activeSection === "materiales" || activeTab === "canales" ? null : (
            <div className="rec-toolbar">
              <label>
                <span>Facultad</span>
                <select value={selectedFaculty} onChange={(event) => setSelectedFaculty(event.currentTarget.value)}>
                  <option value="todas">Todas</option>
                  {faculties.map((faculty) => <option key={faculty} value={faculty}>{faculty}</option>)}
                </select>
              </label>
              <label>
                <span>Buscar curso-horario, curso o docente</span>
                <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Buscar..." />
              </label>
              <button type="button" onClick={copySelectedLink} disabled={!selectedRow || !rowLink(selectedRow)}>
                <Link2 size={14} />
                Copiar enlace
              </button>
            </div>
          )}

          {isPackageOutput || isPackageSave ? (
            <div className={`rec-package-board${activeTab === "traspaso" ? " is-return is-save" : ""}${activeTab === "paquetes" ? " is-output" : ""}`}>
              {activeTab === "paquetes" ? (
                <div className="rec-package-output">
                  <section className="rec-package-output-main">
                    <div className="rec-package-output-icon"><FileText size={22} /></div>
                    <div>
                      <span>PDF final</span>
                      <strong>Portada + fichas QR por curso-horario</strong>
                      <p>Imprime una hoja por curso-horario. Cada QR abre la encuesta de Kobo con la unidad ya identificada para la aplicación presencial.</p>
                    </div>
                    <dl>
                      <div><dt>Fichas</dt><dd>{fmt(printableRows.length)}</dd></div>
                      <div><dt>QR listos</dt><dd>{fmt(withQr)}</dd></div>
                      <div><dt>Sin enlace</dt><dd>{fmt(missingLinks)}</dd></div>
                    </dl>
                    <div className="rec-package-output-state">
                      <CheckCircle2 size={15} />
                      <span>{printPreparedAt ? "Paquete preparado para PDF local" : readyForPrint ? "Listo para imprimir y revisar en campo" : "Primero genera enlaces por curso-horario"}</span>
                    </div>
                  </section>
                  <PackageEnginePanel
                    groups={packageOutputGroups}
                    printableRows={printableRows}
                    missingLinks={missingLinks}
                    returnSaved={returnSaved}
                    printPreparedAt={printPreparedAt}
                  />
                  <section className="rec-package-panel rec-package-blocks-panel">
                    <div>
                      <span>Bloques de impresión</span>
                      <strong>{packageGroups.length ? `${fmt(packageGroups.length)} ${packageGroups.length === 1 ? "grupo" : "grupos"} para repartir` : "Sin bloques todavía"}</strong>
                    </div>
                    <div className="rec-package-group-list">
                      {packageGroups.slice(0, 10).map((group) => (
                        <div key={group.faculty} className={group.missing ? "is-waiting" : "is-ready"}>
                          <strong>{group.faculty}</strong>
                          <span>{fmt(group.linked)} fichas</span>
                          <em>{group.missing ? `${fmt(group.missing)} sin enlace` : `${fmt(group.students)} estudiantes`}</em>
                        </div>
                      ))}
                      {!packageGroups.length ? <p>No hay facultades para agrupar.</p> : null}
                    </div>
                  </section>
                  <section className="rec-package-panel rec-package-return-panel">
                    <div>
                      <span>Guardar en Monitoreo</span>
                      <strong>
                        {returnSaved
                          ? "Seguimiento actualizado"
                          : !withLink
                            ? "Faltan enlaces para QR"
                            : unsavedLinks
                              ? `${fmt(unsavedLinks)} enlaces por guardar`
                              : "Sin cambios pendientes"}
                      </strong>
                    </div>
                    <ul className="rec-return-list">
                      <li><CheckCircle2 size={14} /> Código de curso-horario</li>
                      <li><CheckCircle2 size={14} /> Enlace usado para generar el QR</li>
                      <li><CheckCircle2 size={14} /> Facultad o bloque de entrega</li>
                      <li><CheckCircle2 size={14} /> Estado listo para seguimiento</li>
                    </ul>
                    <div className={`rec-package-return-status${returnSaved ? " is-ready" : !withLink || unsavedLinks ? " is-waiting" : ""}`}>
                      <Download size={15} />
                      <span>
                        {returnSaved
                          ? "Guardado en Monitoreo"
                          : !withLink
                            ? "Genera enlaces por curso-horario antes de cerrar"
                            : unsavedLinks
                              ? "Guarda antes de cerrar el paquete"
                              : dashboard
                                ? "Monitoreo no necesita cambios"
                                : "Conecta Monitoreo para cerrar trazabilidad"}
                      </span>
                    </div>
                  </section>
                </div>
              ) : null}
              {activeTab === "traspaso" ? (
                <div className="rec-return-workbench">
                  <ReturnManifestPanel
                    rows={agendaRows}
                    copied={returnCopied}
                    saving={returnSaving}
                    unsavedLinks={unsavedLinks}
                    saveMessage={returnSaveMessage}
                    saveError={returnSaveError}
                    onCopy={copyReturnManifest}
                    onSave={saveReturnToMonitoring}
                    showActions={false}
                  />
                  <section className="rec-return-guide">
                    <div>
                      <span>Cierre operativo</span>
                      <strong>Qué queda conectado</strong>
                    </div>
                    <ul className="rec-return-list">
                      <li><CheckCircle2 size={14} /> Curso-horario de la ficha</li>
                      <li><CheckCircle2 size={14} /> Enlace usado para abrir Kobo</li>
                      <li><CheckCircle2 size={14} /> Origen del enlace y estado del QR</li>
                      <li><CheckCircle2 size={14} /> Agenda lista para seguimiento de campo</li>
                    </ul>
                    <div className={`rec-package-return-status${returnSaved ? " is-ready" : withLink ? " is-waiting" : ""}`}>
                      <Download size={15} />
                      <span>{returnSaved ? "Monitoreo ya tiene los enlaces" : withLink ? "Guarda antes de cerrar el paquete" : "Genera enlaces por curso-horario primero"}</span>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          ) : activeTab === "canales" || activeTab === "vinculacion" || activeTab === "unidades" ? (
            <div className={`rec-list-panel${activeTab === "canales" ? " has-link-import" : ""}${activeTab === "unidades" ? " is-agenda-table" : ""}`}>
              <div className="rec-audit-strip">
                <strong>{activeTab === "canales" ? "Revisión de enlaces" : activeTab === "unidades" ? "Agenda de cursos-horario" : "Lista de cursos-horario"}</strong>
                <span>{activeTab === "vinculacion" || activeTab === "unidades" ? `${fmt(filteredRows.length)} visibles` : withLink ? `${fmt(withLink)} con enlace` : "sin enlaces"}</span>
                <span>{missingLinks ? `${fmt(missingLinks)} faltan` : "cobertura completa"}</span>
                <span>{agendaSource || "sin agenda"}</span>
              </div>
              {activeTab === "canales" ? (
                <div className="rec-link-workbench">
                  <KoboLinkPanel
                    connection={koboConnection}
                    profiles={koboProfiles}
                    selectedProfileId={koboProfileId}
                    baseUrl={koboBaseUrl}
                    assets={koboAssets}
                    selectedAssetUid={koboAssetUid}
                    baseLink={koboBaseLink}
                    paramsTemplate={koboParamTemplate}
                    loading={koboLoading}
                    resolving={koboResolving}
                    error={koboError}
                    resolvedFrom={koboResolvedFrom}
                    agendaCount={baseAgendaRows.length}
                    linkedCount={withLink}
                    onProfileChange={setKoboProfileId}
                    onBaseUrlChange={setKoboBaseUrl}
                    onLoadAssets={loadKoboAssets}
                    onResolveLink={resolveKoboSurveyLink}
                    onAssetChange={selectKoboAsset}
                    onBaseLinkChange={setKoboBaseLink}
                    onParamsTemplateChange={setKoboParamTemplate}
                    onGenerate={generateKoboLinks}
                  />
                  <LinkImportPanel
                    value={linkPaste}
                    parseResult={linkParseResult}
                    matched={linkPasteMatches}
                    hasSessionLinks={manualLinks.size > 0}
                    onChange={setLinkPaste}
                    onApply={applyPastedLinks}
                    onClear={clearPastedLinks}
                  />
                </div>
              ) : (
                <AgendaTable
                  rows={filteredRows}
                  selectedKey={selectedKey}
                  onSelect={(row, key) => {
                    setSelectedKey(key);
                    if (activeTab === "vinculacion") {
                      setActiveSection("materiales");
                      setActiveTab("vista");
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <div className="rec-split">
              <FichaPreview row={selectedRow} />
              <AgendaTable
                rows={filteredRows}
                selectedKey={selectedKey}
                onSelect={(row, key) => {
                  setSelectedKey(key);
                  if (activeSection === "plan-recoleccion") {
                    setActiveSection("materiales");
                    setActiveTab("vista");
                  }
                }}
              />
            </div>
          )}
        </section>
      </main>
      <PrintFichaPackage rows={printableRows} />
    </div>
  );
}
