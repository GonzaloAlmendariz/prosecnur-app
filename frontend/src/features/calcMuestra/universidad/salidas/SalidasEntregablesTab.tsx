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
  CircleHelp,
  FileSpreadsheet,
  ShieldCheck,
  Table2,
} from "lucide-react";
import type {
  CalcMuestraAulasState,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
  CalcMuestraWorkspacePublicationConfig,
} from "../../../../api/client";
import { ContenedorEntregable } from "../../../../components/entregables/ContenedorEntregable";
import { Popover } from "../../../../components/Popover";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { GlidingTabList } from "../../../../components/GlidingTabList";
import { PulsoField, PulsoFieldRow } from "../../../../components/PulsoField";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { ReporteMetodologicoCard } from "../../didactica/ReporteMetodologicoCard";
import type { EntregaEnPantalla, PaqueteDefensaEntregas } from "../../entregas/modeloEntrega";
import { SustentoCoberturaCard } from "./SustentoCoberturaCard";
import { AvisoModulo } from "../shared/AvisoModulo";
import { DEFAULT_UNIVERSITY_PUBLICATION_CONFIG } from "../shared/constants";
import { PanelAvanzado } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import type { ClassroomLabModel } from "../aulas/aulasParts";
import "../../didactica/didactica.css";
import "./salidas.css";
import { EstadoChip } from "../../../../components/EstadoChip";
import { Panel } from "../../../../components/Panel";

/** Props del reporte metodológico que el desk arma con su estado real. */
export type SalidasReporteProps = {
  puedeGenerar: boolean;
  /** Hay un reporte generado en el backend (meta `reporte.disponible`). */
  disponible: boolean;
  formato: "html" | "pdf";
  onFormato: (f: "html" | "pdf") => void;
  onGenerar: () => void;
  /** La generación del reporte por el kit de entregables (ADR 0133). */
  reporte: EntregaEnPantalla;
  aulasListas: boolean;
  onExportarAulas?: () => void;
  anexo?: EntregaEnPantalla;
  /** true cuando el estudio cambió después de generar el reporte (meta
   *  `reporte.stale` del backend, F5): sigue descargable pero desactualizado.
   *  Retrocompatible: si no viene, la tarjeta se comporta como hoy. */
  stale?: boolean;
};

/** Props del paquete de defensa que el desk orquesta desde la página. */
export type SalidasPaqueteDefensaProps = {
  puedeGenerar: boolean;
  hint?: string;
  enCurso: boolean;
  entregas: PaqueteDefensaEntregas;
  onGenerar: () => void;
};

/**
 * CTA de un clic y, debajo, cada pieza con su contenedor del kit: el botón sólo
 * se deshabilita mientras se arma y lo único que se mueve es la línea de la
 * pieza en curso. La memoria JSON la arma el front (archivo local del kit).
 */
function PaqueteDefensaCard({ paquete }: { paquete: SalidasPaqueteDefensaProps }) {
  const { puedeGenerar, hint, enCurso, entregas, onGenerar } = paquete;
  const { reporte, anexo, memoria } = entregas;
  const hayPiezas = [reporte, anexo, memoria].some((pieza) => pieza.estado.fase !== "inactiva");
  return (
    <Panel className="cmv2-sal-panel cmv2-sal-paquete" aria-label="Paquete de defensa del diseño" title="Paquete de defensa" actions={
        <>
          <button
            type="button"
            className="cmv2-primary"
            disabled={!puedeGenerar || enCurso}
            title={!puedeGenerar && hint ? hint : undefined}
            onClick={onGenerar}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            Generar paquete de defensa
          </button>
        </>
      }>
      <p className="cmv2-sal-nota">
        Encadena el reporte metodológico, el anexo xlsx de la selección y una memoria JSON con semilla,
        firma del marco y decision log — lo que se presenta cuando piden justificar el diseño.
      </p>
      {!puedeGenerar && hint && <p className="cmv2-sal-nota cmv2-sal-paquete-hint">{hint}</p>}
      {hayPiezas && (
        <div className="cmv2-sal-paquete-piezas" aria-label="Piezas del paquete de defensa">
          <ContenedorEntregable estado={reporte.estado} forma="bloque" onCerrar={reporte.onCerrar} />
          <ContenedorEntregable estado={anexo.estado} forma="bloque" onCerrar={anexo.onCerrar} />
          <ContenedorEntregable estado={memoria.estado} forma="bloque" onCerrar={memoria.onCerrar} />
        </div>
      )}
    </Panel>
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

const PUBLICATION_MODE_OPTIONS = [
  { id: "single_spreadsheet_multi_sheet", label: "Un Sheets con varias hojas" },
  { id: "separate_outputs", label: "Entregables separados" },
] as const;

type PublicationMode = (typeof PUBLICATION_MODE_OPTIONS)[number]["id"];

const WORKBOOK_TABLE_TOGGLES: Array<[keyof CalcMuestraWorkspacePublicationConfig, string]> = [
  ["include_methodology", "Reporte metodológico"],
  ["include_frame_audit", "Auditoría del marco"],
  ["include_sample_calculation", "Cálculo muestral"],
  ["include_classroom_selection", "Selección de cursos-horario"],
  ["include_replacements", "Reemplazos por curso-horario"],
];

export function SalidasEntregablesTab({
  model,
  workspace,
  onWorkspace,
  reporte,
  paquete,
  estudio,
  aulasState,
}: {
  model: ClassroomLabModel;
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  reporte: SalidasReporteProps;
  paquete?: SalidasPaqueteDefensaProps;
  /** Para la cobertura del sustento: aquí es donde alguien pide el documento,
   *  así que aquí tiene que poder ver si estaría completo. */
  estudio?: CalcMuestraEstudio | null;
  aulasState?: CalcMuestraAulasState | null;
}) {
  const config = { ...DEFAULT_UNIVERSITY_PUBLICATION_CONFIG, ...(workspace.publication_config ?? {}) };
  const { selectionReady, replacementReady } = model;

  function updateConfig(patch: Partial<CalcMuestraWorkspacePublicationConfig>) {
    onWorkspace({ ...workspace, publication_config: { ...config, ...patch } });
  }

  const pii = config.pii_policy === "interno_trazabilidad" ? "interno_trazabilidad" : "sin_pii_cliente";
  const sheetsConfigured = Boolean(config.google_sheets_enabled && (config.spreadsheet_id || config.spreadsheet_url));
  const workbookOn = Boolean(config.include_workbook);
  const publicationMode: PublicationMode =
    config.publication_mode === "separate_outputs" ? "separate_outputs" : "single_spreadsheet_multi_sheet";
  const notaPiiCambiando = useValorSwap(pii);

  // El badge de desactualización se pinta FUERA de la tarjeta (didactica/ es
  // compartida): solo se avisa que el estudio cambió después de generar el reporte.
  const reporteStale = reporte.stale;

  return (
    <div
      className="cmv2-sal-stack"
      // Declarada para que el gate visual pueda auditarla.
      // Y la readiness con ella: sin `[data-audit-ready]` el puente responde
      // `sin-marca-de-readiness` y la pestaña queda SIN MEDIR, que no es lo
      // mismo que conforme. `true` al montar: los entregables se piden desde
      // aquí, la vista no espera nada para pintarse.
      data-audit-ready="true"
      data-qa-geometry-group="calc-muestra/salidas-entregables"
      data-qa-geometry-contract="intrinsic"
    >
      <ReporteMetodologicoCard
        puedeGenerar={reporte.puedeGenerar}
        formato={reporte.formato}
        onFormato={reporte.onFormato}
        onGenerar={reporte.onGenerar}
        reporte={reporte.reporte}
        aulasListas={reporte.aulasListas}
        onExportarAulas={reporte.onExportarAulas}
        anexo={reporte.anexo}
      />
      {/* Antes de generar nada, qué capítulos tendría el sustento. */}
      <SustentoCoberturaCard estudio={estudio} workspace={workspace} aulasState={aulasState} />
      {Boolean(reporteStale) && reporte.disponible && (
        <AvisoModulo tone="warn" role="status" compact title="Desactualizado:">
          el estudio cambió después de generar el reporte. Vuelve a generarlo para que refleje el
          diseño vigente.
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
            <EstadoChip
              tone={workbookOn ? (selectionReady ? "success" : "info") : "neutral"}
              label={workbookOn ? (selectionReady ? "listo para exportar" : "configurado") : "desactivado"}
            />
          </header>
          {/* K1 (L27): el destino se enciende con el switch del kit y cada tabla
              del libro es un switch-chip; los chips declaran su grupo (C1). */}
          <div className="cmv2-classroom-toggle">
            <PulsoSwitch
              label="Generar Excel de trabajo"
              description={<em>Todas las tablas del diseño en un solo archivo local, sin depender de internet.</em>}
              checked={workbookOn}
              onCheckedChange={(on) => updateConfig({ include_workbook: on })}
            />
          </div>
          <div
            className="cmv2-sal-tablas"
            role="group"
            aria-label="Tablas incluidas en el libro"
            data-qa-geometry-group="calc-muestra/salidas-tablas-libro"
            data-qa-geometry-contract="equal"
          >
            {WORKBOOK_TABLE_TOGGLES.map(([key, label]) => (
              <PulsoSwitch
                key={key}
                variant="chip"
                label={label}
                checked={Boolean(config[key])}
                onCheckedChange={(on) => updateConfig({ [key]: on } as Partial<CalcMuestraWorkspacePublicationConfig>)}
              />
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
            <EstadoChip
              tone={sheetsConfigured ? "success" : config.google_sheets_enabled ? "warn" : "neutral"}
              label={sheetsConfigured ? "configurado" : config.google_sheets_enabled ? "falta el enlace" : "opcional"}
            />
          </header>
          <div className="cmv2-classroom-toggle">
            <PulsoSwitch
              label="Preparar publicación en Sheets"
              description={<em>Comparte cálculo, selección y cierre sin depender solo del PDF.</em>}
              checked={Boolean(config.google_sheets_enabled)}
              onCheckedChange={(on) => updateConfig({ google_sheets_enabled: on })}
            />
          </div>
          {config.google_sheets_enabled && (
            <PulsoFieldRow className="cmv2-sal-campos" geometryGroup="calc-muestra/salidas-sheets">
              <PulsoField label="Enlace o ID de Sheets">
                <PulsoInput
                  size="sm"
                  value={config.spreadsheet_id || config.spreadsheet_url || ""}
                  placeholder="Pega el enlace o ID de Sheets"
                  onChange={(e) => updateConfig({ spreadsheet_id: e.currentTarget.value, spreadsheet_url: e.currentTarget.value })}
                />
              </PulsoField>
              {/* Dos opciones excluyentes: segmentado, no select (L27). */}
              <PulsoField label="Modo de publicación" group>
                <GlidingRadioGroup
                  value={publicationMode}
                  options={PUBLICATION_MODE_OPTIONS}
                  getOptionValue={(option) => option.id}
                  onValueChange={(mode) => updateConfig({ publication_mode: mode })}
                  className="pulso-segmented cmv2-sal-pii-segment"
                  aria-label="Modo de publicación"
                >
                  {(option) => option.label}
                </GlidingRadioGroup>
              </PulsoField>
            </PulsoFieldRow>
          )}
        </article>
      </div>

      <PanelAvanzado
        titulo="Nombres de hojas y detalles"
        descripcion="renombra las hojas de salida y las versiones interna/cliente"
      >
        <PulsoFieldRow className="cmv2-sal-campos cmv2-sal-campos--hojas" geometryGroup="calc-muestra/salidas-nombres-hojas">
          <PulsoField label="Hoja interna">
            <PulsoInput
              size="sm"
              value={config.internal_sheet_name ?? ""}
              placeholder="Calculo muestra - interno"
              onChange={(e) => updateConfig({ internal_sheet_name: e.currentTarget.value })}
            />
          </PulsoField>
          <PulsoField label="Hoja cliente">
            <PulsoInput
              size="sm"
              value={config.client_sheet_name ?? ""}
              placeholder="Calculo muestra - cliente"
              onChange={(e) => updateConfig({ client_sheet_name: e.currentTarget.value })}
            />
          </PulsoField>
          {SHEET_NAME_FIELDS.map(([key, label, detail]) => (
            <PulsoField key={key} label={label} hint={detail}>
              <PulsoInput
                size="sm"
                value={String(config[key] ?? "")}
                placeholder={label}
                onChange={(e) => updateConfig({ [key]: e.currentTarget.value } as Partial<CalcMuestraWorkspacePublicationConfig>)}
              />
            </PulsoField>
          ))}
        </PulsoFieldRow>
      </PanelAvanzado>

      {/* K2: la privacidad al pie — es una POLÍTICA transversal, no un paso
          entre el reporte y el Excel; interrumpía el flujo de generación. */}
      <Panel className="cmv2-sal-panel" aria-label="Política de privacidad de los entregables" title="Privacidad" actions={
          <>
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
          </>
        }>
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
      </Panel>
    </div>
  );
}
