/**
 * Pestaña "Entregables" (id salidas-entregables) de la sección Salida. Arriba
 * la tarjeta del reporte metodológico (generación Quarto + anexo de aulas);
 * luego la política de privacidad (PII) promovida a bloque propio con control
 * segmentado y popover que explica qué columnas entran o salen en cada
 * entregable; y la configuración de publicación agrupada en tarjetas por
 * destino (Excel local / Google Sheets) con lo esencial visible y los
 * renombres de hojas en un panel avanzado. El segmentado PII lleva thumb
 * deslizante (150ms) y el cambio de política funde (swap) la nota dependiente
 * y resalta su columna en el popover; las tarjetas de destino entran con
 * stagger y su pill de estado también funde al cambiar.
 */
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleHelp,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Table2,
} from "lucide-react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspacePublicationConfig,
} from "../../../../api/client";
import { Popover } from "../../../../components/Popover";
import { GlidingTabList } from "../../../../components/GlidingTabList";
import { ReporteMetodologicoCard } from "../../didactica/ReporteMetodologicoCard";
import { AvisoModulo } from "../shared/AvisoModulo";
import { DEFAULT_UNIVERSITY_PUBLICATION_CONFIG } from "../shared/constants";
import { PanelAvanzado } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import type { ClassroomLabModel } from "../aulas/aulasParts";
import "../../didactica/didactica.css";
import "./salidas.css";

/** Props del reporte metodológico que el desk arma con su estado real. */
export type SalidasReporteProps = {
  puedeGenerar: boolean;
  enCurso: boolean;
  disponible: boolean;
  formato: "html" | "pdf";
  onFormato: (f: "html" | "pdf") => void;
  onGenerar: () => void;
  descargarUrl: string | null;
  aulasListas: boolean;
  exportandoAulas: boolean;
  onExportarAulas?: () => void;
  aulasExportFilename?: string | null;
  /** true cuando el estudio cambió después de generar el reporte (meta
   *  `reporte.stale` del backend, F5): sigue descargable pero desactualizado.
   *  Retrocompatible: si no viene, la tarjeta se comporta como hoy. */
  stale?: boolean;
};

/** Piezas del paquete de defensa (reporte + anexo xlsx + memoria JSON). */
export type PaqueteDefensaPasoId = "reporte" | "aulas" | "memoria";

export type PaqueteDefensaPaso = {
  id: PaqueteDefensaPasoId;
  label: string;
  status: "pendiente" | "curso" | "ok" | "error";
  detalle?: string;
  url?: string;
  /** Nombre sugerido cuando el enlace es un blob descargable (memoria JSON). */
  downloadName?: string;
};

/** Props del paquete de defensa que el desk orquesta desde la página. */
export type SalidasPaqueteDefensaProps = {
  puedeGenerar: boolean;
  hint?: string;
  enCurso: boolean;
  pasos: PaqueteDefensaPaso[] | null;
  onGenerar: () => void;
};

const PAQUETE_STATUS_LABEL: Record<PaqueteDefensaPaso["status"], string> = {
  pendiente: "pendiente",
  curso: "en curso",
  ok: "listo",
  error: "con error",
};

function PaqueteDefensaPasoIcon({ status }: { status: PaqueteDefensaPaso["status"] }) {
  if (status === "ok") return <CheckCircle2 size={15} aria-hidden="true" />;
  if (status === "error") return <AlertTriangle size={15} aria-hidden="true" />;
  if (status === "curso") return <Loader2 size={15} className="pulso-spin" aria-hidden="true" />;
  return <Circle size={15} aria-hidden="true" />;
}

/** CTA de un clic + checklist con estado y descarga por pieza. */
function PaqueteDefensaCard({ paquete }: { paquete: SalidasPaqueteDefensaProps }) {
  const { puedeGenerar, hint, enCurso, pasos, onGenerar } = paquete;
  return (
    <section className="cmv2-panel cmv2-sal-panel cmv2-sal-paquete" aria-label="Paquete de defensa del diseño">
      <div className="cmv2-panel-head">
        <strong>Paquete de defensa</strong>
        <button
          type="button"
          className="cmv2-primary"
          disabled={!puedeGenerar || enCurso}
          title={!puedeGenerar && hint ? hint : undefined}
          onClick={onGenerar}
        >
          {enCurso ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
          {enCurso ? "Generando paquete…" : "Generar paquete de defensa"}
        </button>
      </div>
      <p className="cmv2-sal-nota">
        Encadena el reporte metodológico, el anexo xlsx de la selección y una memoria JSON con semilla,
        firma del marco y decision log — lo que se presenta cuando piden justificar el diseño.
      </p>
      {!puedeGenerar && hint && <p className="cmv2-sal-nota cmv2-sal-paquete-hint">{hint}</p>}
      {pasos && (
        <ol className="cmv2-sal-paquete-lista cmv2-uni-stagger" aria-label="Checklist del paquete de defensa">
          {pasos.map((paso) => (
            <li key={paso.id} data-status={paso.status}>
              <PaqueteDefensaPasoIcon status={paso.status} />
              <div>
                <strong>
                  {paso.label}
                  <em>{PAQUETE_STATUS_LABEL[paso.status]}</em>
                </strong>
                {paso.detalle && <small>{paso.detalle}</small>}
              </div>
              {paso.status === "ok" && paso.url && (
                <a
                  className="cmv2-ghost"
                  href={paso.url}
                  download={paso.downloadName}
                  target={paso.downloadName ? undefined : "_blank"}
                  rel="noreferrer"
                >
                  <Download size={13} aria-hidden="true" /> {paso.downloadName ? "Descargar" : "Abrir"}
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const PII_OPTIONS = [
  {
    id: "sin_pii_cliente",
    label: "Cliente sin identificadores",
    detail: "El cliente recibe agregados y cursos-horario sin códigos de estudiante ni datos de contacto.",
  },
  {
    id: "interno_trazabilidad",
    label: "Trazabilidad interna",
    detail: "La versión interna conserva códigos operativos para controlar duplicados y cobertura.",
  },
] as const;

/** Qué columnas entran o salen por entregable según la política elegida. */
const PII_MATRIX: Array<{ entregable: string; cliente: string; interno: string }> = [
  { entregable: "Cálculo muestral", cliente: "N, cuotas y supuestos (sin cambios)", interno: "N, cuotas y supuestos (sin cambios)" },
  { entregable: "Selección de cursos-horario", cliente: "curso, horario, facultad y pesos; sin códigos de estudiante", interno: "agrega código operativo del curso-horario y conteos de repetidos" },
  { entregable: "Rutas y agenda", cliente: "no se publica al cliente", interno: "titular + cadena Rn.1, Rn.2… con contacto de coordinación" },
  { entregable: "Auditoría del marco", cliente: "totales y exclusiones agregadas", interno: "agrega columnas fuente usadas en la validación" },
];

const SHEET_NAME_FIELDS: Array<[keyof CalcMuestraWorkspacePublicationConfig, string, string]> = [
  ["frame_sheet_name", "Marco muestral", "base leída, exclusiones y marco operativo"],
  ["sample_calculation_sheet_name", "Cálculo muestral", "N, cuotas y supuestos de cálculo"],
  ["classroom_selection_sheet_name", "Selección de cursos-horario", "cursos-horario titulares, probabilidades y pesos"],
  ["replacement_sheet_name", "Cursos-horario de reemplazo", "reemplazos por titular e impacto"],
  ["operational_routes_sheet_name", "Rutas operativas", "titular y cadena Rn.1, Rn.2… para campo"],
  ["agenda_sheet_name", "Agenda de cursos-horario", "hoja preparada para coordinación de campo"],
  ["monitoring_handoff_sheet_name", "Plan para Monitoreo", "estado, enlace, QR y reemplazo usado"],
  ["methodology_sheet_name", "Sustento", "fuentes, advertencias y bitácora"],
];

const WORKBOOK_TABLE_TOGGLES: Array<[keyof CalcMuestraWorkspacePublicationConfig, string]> = [
  ["include_methodology", "Reporte metodológico"],
  ["include_frame_audit", "Auditoría del marco"],
  ["include_sample_calculation", "Cálculo muestral"],
  ["include_classroom_selection", "Selección de cursos-horario"],
  ["include_replacements", "Reemplazos por curso-horario"],
];

/** Texto que se funde (blur+opacity) cuando su contenido cambia. */
function TextoSwap({ texto, className }: { texto: string; className: string }) {
  const cambiando = useValorSwap(texto);
  return (
    <span className={`${className} cmv2-uni-swap`} data-cambiando={cambiando || undefined}>
      {texto}
    </span>
  );
}

export function SalidasEntregablesTab({
  model,
  workspace,
  onWorkspace,
  reporte,
  paquete,
}: {
  model: ClassroomLabModel;
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  reporte: SalidasReporteProps;
  paquete?: SalidasPaqueteDefensaProps;
}) {
  const config = { ...DEFAULT_UNIVERSITY_PUBLICATION_CONFIG, ...(workspace.publication_config ?? {}) };
  const { selectionReady, replacementReady } = model;

  function updateConfig(patch: Partial<CalcMuestraWorkspacePublicationConfig>) {
    onWorkspace({ ...workspace, publication_config: { ...config, ...patch } });
  }

  const pii = config.pii_policy === "interno_trazabilidad" ? "interno_trazabilidad" : "sin_pii_cliente";
  const sheetsConfigured = Boolean(config.google_sheets_enabled && (config.spreadsheet_id || config.spreadsheet_url));
  const workbookOn = Boolean(config.include_workbook);
  const notaPiiCambiando = useValorSwap(pii);

  // El badge de desactualización se pinta FUERA de la tarjeta (didactica/ es
  // compartida): la descarga sigue disponible, solo se avisa que el estudio
  // cambió después de generar el reporte.
  const { stale: reporteStale, ...reporteCard } = reporte;

  return (
    <div className="cmv2-sal-stack">
      <ReporteMetodologicoCard {...reporteCard} />
      {Boolean(reporteStale) && reporte.disponible && (
        <AvisoModulo tone="warn" role="status" compact title="Desactualizado:">
          el estudio cambió después de generarlo. La descarga sigue disponible; vuelve a generar el
          reporte para que refleje el diseño vigente.
        </AvisoModulo>
      )}

      {/* K2 (censo f224af2d): el Paquete de defensa estaba al FINAL y mínimo
          siendo la pieza que defiende el diseño; sube junto al reporte. */}
      {paquete && <PaqueteDefensaCard paquete={paquete} />}


      <div className="cmv2-sal-destinos cmv2-uni-stagger" aria-label="Destinos de publicación">
        <article className={`cmv2-sal-destino ${workbookOn ? "is-on" : ""}`}>
          <header>
            <span className="cmv2-sal-destino-icon"><FileSpreadsheet size={15} /></span>
            <div>
              <strong>Excel local</strong>
              <small>libro de trabajo auditable</small>
            </div>
            <TextoSwap
              className="cmv2-pill-soft"
              texto={workbookOn ? (selectionReady ? "listo para exportar" : "configurado") : "desactivado"}
            />
          </header>
          <label className="cmv2-classroom-toggle">
            <input
              type="checkbox"
              checked={workbookOn}
              onChange={(e) => updateConfig({ include_workbook: e.currentTarget.checked })}
            />
            <span>
              <strong>Generar Excel de trabajo</strong>
              <em>Todas las tablas del diseño en un solo archivo local, sin depender de internet.</em>
            </span>
          </label>
          <div className="cmv2-sal-tablas" aria-label="Tablas incluidas en el libro">
            {WORKBOOK_TABLE_TOGGLES.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(config[key])}
                  onChange={(e) => updateConfig({ [key]: e.currentTarget.checked } as Partial<CalcMuestraWorkspacePublicationConfig>)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="cmv2-sal-nota">
            {config.include_classroom_selection && !selectionReady && "La selección de cursos-horario se incluirá cuando esté generada. "}
            {config.include_replacements && !replacementReady && "Los reemplazos se incluirán cuando exista la simulación."}
          </p>
        </article>

        <article className={`cmv2-sal-destino ${config.google_sheets_enabled ? "is-on" : ""}`}>
          <header>
            <span className="cmv2-sal-destino-icon"><Table2 size={15} /></span>
            <div>
              <strong>Google Sheets</strong>
              <small>para compartir avance</small>
            </div>
            <TextoSwap
              className="cmv2-pill-soft"
              texto={sheetsConfigured ? "configurado" : config.google_sheets_enabled ? "falta el enlace" : "opcional"}
            />
          </header>
          <label className="cmv2-classroom-toggle">
            <input
              type="checkbox"
              checked={Boolean(config.google_sheets_enabled)}
              onChange={(e) => updateConfig({ google_sheets_enabled: e.currentTarget.checked })}
            />
            <span>
              <strong>Preparar publicación en Sheets</strong>
              <em>Comparte cálculo, selección y cierre sin depender solo del PDF.</em>
            </span>
          </label>
          {config.google_sheets_enabled && (
            <div className="cmv2-sal-campos">
              <label className="cmv2-compact-field">
                <span>Enlace o ID de Sheets</span>
                <input
                  value={config.spreadsheet_id || config.spreadsheet_url || ""}
                  placeholder="Pega el enlace o ID de Sheets"
                  onChange={(e) => updateConfig({ spreadsheet_id: e.currentTarget.value, spreadsheet_url: e.currentTarget.value })}
                />
              </label>
              <label className="cmv2-compact-field">
                <span>Modo de publicación</span>
                <select
                  value={config.publication_mode ?? "single_spreadsheet_multi_sheet"}
                  onChange={(e) => updateConfig({ publication_mode: e.currentTarget.value })}
                >
                  <option value="single_spreadsheet_multi_sheet">Un Sheets con varias hojas</option>
                  <option value="separate_outputs">Entregables separados</option>
                </select>
              </label>
            </div>
          )}
        </article>
      </div>

      <PanelAvanzado
        titulo="Nombres de hojas y detalles"
        descripcion="renombra las hojas de salida y las versiones interna/cliente"
      >
        <div className="cmv2-sal-campos cmv2-sal-campos--hojas">
          <label className="cmv2-compact-field">
            <span>Hoja interna</span>
            <input
              value={config.internal_sheet_name ?? ""}
              placeholder="Calculo muestra - interno"
              onChange={(e) => updateConfig({ internal_sheet_name: e.currentTarget.value })}
            />
          </label>
          <label className="cmv2-compact-field">
            <span>Hoja cliente</span>
            <input
              value={config.client_sheet_name ?? ""}
              placeholder="Calculo muestra - cliente"
              onChange={(e) => updateConfig({ client_sheet_name: e.currentTarget.value })}
            />
          </label>
          {SHEET_NAME_FIELDS.map(([key, label, detail]) => (
            <label key={key} className="cmv2-compact-field">
              <span>{label}</span>
              <input
                value={String(config[key] ?? "")}
                placeholder={label}
                onChange={(e) => updateConfig({ [key]: e.currentTarget.value } as Partial<CalcMuestraWorkspacePublicationConfig>)}
              />
              <em>{detail}</em>
            </label>
          ))}
        </div>
      </PanelAvanzado>

      {/* K2: la privacidad al pie — es una POLÍTICA transversal, no un paso
          entre el reporte y el Excel; interrumpía el flujo de generación. */}
      <section className="cmv2-panel cmv2-sal-panel" aria-label="Política de privacidad de los entregables">
        <div className="cmv2-panel-head">
          <strong>Privacidad</strong>
          <Popover
            ariaLabel="Columnas que entran o salen según la política"
            maxWidth={430}
            trigger={
              <button type="button" className="cmv2-ghost cmv2-sal-pii-help">
                <CircleHelp size={13} /> ¿Qué columnas entran?
              </button>
            }
          >
            <div className="cmv2-sal-pii-pop">
              <strong>Columnas por entregable según la política</strong>
              <table>
                <thead>
                  <tr>
                    <th>Entregable</th>
                    <th data-activa={pii === "sin_pii_cliente" || undefined}>Cliente sin identificadores</th>
                    <th data-activa={pii === "interno_trazabilidad" || undefined}>Trazabilidad interna</th>
                  </tr>
                </thead>
                <tbody>
                  {PII_MATRIX.map((row) => (
                    <tr key={row.entregable}>
                      <td>{row.entregable}</td>
                      <td data-activa={pii === "sin_pii_cliente" || undefined}>{row.cliente}</td>
                      <td data-activa={pii === "interno_trazabilidad" || undefined}>{row.interno}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>En ninguna política se publican nombres ni datos personales de estudiantes: los identificadores internos son códigos de curso-horario y de selección.</p>
            </div>
          </Popover>
        </div>
        <GlidingTabList
          activeKey={pii}
          mode="tabs"
          className="pulso-segmented cmv2-sal-pii-segment"
          role="radiogroup"
          aria-label="Política de identificadores"
          data-pii={pii}
        >
          {PII_OPTIONS.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              data-gliding-key={option.id}
              className={pii === option.id ? "is-active" : ""}
              aria-checked={pii === option.id}
              onClick={() => updateConfig({ pii_policy: option.id })}
              onKeyDown={(event) => {
                const targetIndex = event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? PII_OPTIONS.length - 1
                    : event.key === "ArrowRight"
                      ? (index + 1) % PII_OPTIONS.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + PII_OPTIONS.length) % PII_OPTIONS.length
                        : -1;
                if (targetIndex < 0) return;
                updateConfig({ pii_policy: PII_OPTIONS[targetIndex].id });
              }}
            >
              {option.label}
            </button>
          ))}
        </GlidingTabList>
        <p className="cmv2-sal-nota cmv2-uni-swap" data-cambiando={notaPiiCambiando || undefined}>
          {PII_OPTIONS.find((option) => option.id === pii)?.detail}
        </p>
      </section>
    </div>
  );
}
