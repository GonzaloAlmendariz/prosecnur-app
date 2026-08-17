import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, CalendarRange, CheckCircle2 } from "lucide-react";
import {
  apiMonitoreoAulasGenerarLibro,
  apiMonitoreoAulasImportarLibro,
  apiMonitoreoAulasImportFromCalcMuestra,
  apiMonitoreoAulasSync,
  apiMonitoreoState,
  type MonitoreoAulasDashboard,
  type MonitoreoAulasPlanRow,
  type MonitoreoRow,
  type MonitoreoState,
} from "../../../../api/client";
import { AulasOperationsPanel, aulasPlanImported } from "./AulasOperationsPanel";
import { VacioSinTablero } from "./VacioSinTablero";
import { AULAS_SAMPLE_ROUTE, AulasApplicationFlow, type AulasFlowMetric } from "../../../aulasFlow/AulasApplicationFlow";
import { RegistroDeCampo } from "./RegistroDeCampo";
import { AulasCoberturaChart } from "./AulasCoberturaChart";
import { MODULE_TONES } from "../../../../lib/modules";
import {
  MONITOREO_PESTANAS,
  pestanasDeMonitoreo,
} from "../../../../lib/navegacion/catalogos/monitoreo";
import {
  modoIdDesdeFamily, AULAS_WORKBENCH_VIEWS, MONITOREO_MODOS, type MonitoreoSeccion } from "../../core/monitoreoRegistry";
import {
  monitoreoPestanaDesdeParams,
  monitoreoSeccionDesdeParams,
  pestanaInicialDeSeccion,
  seccionInicialMonitoreo,
  useMonitoreoDireccion,
} from "../../useMonitoreoDireccion";
import { useRegistrarPestanasMonitoreo } from "../../useRegistrarPestanas";
import { MonitoreoModuleChrome } from "../../shell/MonitoreoModuleChrome";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";
import { GlidingTabList } from "../../../../components/GlidingTabList";
import {
  aulasFieldLabel,
  presentAulasRow,
  summarizeAulasValidation,
} from "./aulasPresentation";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";
import "../../shell/monitoreoShell.css";
import "./aulasMonitoreo.css";
import { recorteTabla } from "../../corte/corteContract";
import { corteAulas } from "../../corte/corteAdapters";
import { pct } from "../../core/formatoComun";

const AULAS_ROUTE = MONITOREO_MODOS.find((route) => route.family === "aulas_universitarias") ?? MONITOREO_MODOS[2];

// Avance es la única sección con pestañas: el resto siguen siendo hojas del
// árbol. «Salidas» es donde vive la publicación a Sheets del perfil (ADR 0019).
// Todas las secciones con pestañas, no sólo Avance: es la misma gramática que
// usan telefónico y acreditación (módulo → modo → sección → pestaña → panel).
const AULAS_PESTANAS = MONITOREO_PESTANAS.aulas as Record<string, ReadonlyArray<{ key: string; label: string }>>;

/** Pestañas de una sección; vacío cuando la sección es una hoja del árbol. */
function pestanasDe(seccion: MonitoreoSeccion) {
  return AULAS_PESTANAS[seccion] ?? [];
}

/** Primera pestaña de la sección, que es donde se aterriza. */
function primeraPestana(seccion: MonitoreoSeccion) {
  return pestanasDe(seccion)[0]?.key ?? "";
}

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}


function scopeForView(view: MonitoreoSeccion): MonitoreoReportScope {
  if (view === "calidad") return "validation_summary";
  if (view === "consultas") return "queries_summary";
  if (view === "fuentes" || view === "modelo") return "source";
  return "advance_summary";
}

function dashboardFromState(state: MonitoreoState | null) {
  return state?.dashboard?.aulas_universitarias_reports ?? null;
}

// El límite deja de estar incrustado: quien llama decide, y el recorte se
// declara en la vista (antes se perdían columnas sin aviso).
function compactColumns(
  rows: Array<Record<string, unknown>>,
  preferred: string[] = [],
  maxColumns = 8,
) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, maxColumns);
}

type AulasKpi = { label: string; value: string; tone?: "neutral" | "warn" };

// Banda canonica: unifica los KPIs que antes estaban repartidos entre la
// cabecera (3) y la fila de stats de avance (5). El color semantico (warn)
// se reserva para brechas/cuotas con deficit real; el resto queda neutral
// para no meter ruido verde en conteos que aun estan en 0.
function aulasKpis(dashboard: MonitoreoAulasDashboard | null): AulasKpi[] {
  const kpis = dashboard?.kpis;
  const quotaOk = Number(kpis?.quota_cells_ok ?? 0);
  const quotaAll = Number(kpis?.quota_cells ?? 0);
  const quotaPending = Number(kpis?.quota_cells_pending ?? 0);
  const brechas = Number(kpis?.brechas ?? 0);
  return [
    { label: "Cursos-horario", value: fmt(kpis?.total_aulas) },
    { label: "Aplicadas", value: fmt(kpis?.aulas_aplicadas) },
    { label: "Válidas", value: fmt(kpis?.respuestas_validas) },
    { label: "Representatividad", value: pct(kpis?.representativity_effective_score) },
    { label: "Cuotas sexo/facultad", value: `${fmt(quotaOk)}/${fmt(quotaAll)}`, tone: quotaPending ? "warn" : "neutral" },
    { label: "Brechas", value: fmt(kpis?.brechas), tone: brechas ? "warn" : "neutral" },
  ];
}

function AulasKpiBand({ dashboard }: { dashboard: MonitoreoAulasDashboard | null }) {
  return (
    <div
      className="aulas-kpi-band"
      role="group"
      aria-label="Indicadores de cursos-horario"
      data-qa-geometry-group="monitoring-aulas-kpis"
      data-qa-geometry-contract="equal"
    >
      {aulasKpis(dashboard).map((kpi) => (
        <div key={kpi.label} className={`aulas-kpi aulas-kpi--${kpi.tone ?? "neutral"}`}>
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  rows,
  empty,
  preferredColumns = [],
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
}) {
  if (!rows.length) {
    return (
      <div
        className="mon-profile-table-wrap"
        data-qa-geometry-capacity="owned"
        data-qa-geometry-member
      >
        <p className="mon-profile-muted">{empty}</p>
      </div>
    );
  }
  // La tabla recortaba a ocho columnas y ochenta filas sin decirlo, y Agenda
  // pide nueve: origen y recopilador desaparecían de la vista sin dejar rastro.
  // Ahora todo recorte se declara.
  const todasLasColumnas = compactColumns(rows, preferredColumns, Number.MAX_SAFE_INTEGER);
  const recorteColumnas = recorteTabla(todasLasColumnas, 8, "columna");
  const columns = recorteColumnas.visibles;
  // 80 filas dejaban fuera 116 de las 196 de un operativo real —y con las
  // reservas al final del plan, la Agenda no mostraba NI UNA—. El tope existe
  // para no reventar el DOM; 400 filas con scroll interno no lo revientan y
  // cubren un estudio entero. Sigue declarándose cuando recorta.
  const recorteFilas = recorteTabla(rows.map(presentAulasRow), 400);
  const avisos = [recorteFilas.etiqueta, recorteColumnas.etiqueta].filter(Boolean);
  return (
    <div
      className="mon-profile-table-wrap"
      data-qa-geometry-capacity="owned"
      data-qa-geometry-member
    >
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{aulasFieldLabel(column)}</th>)}</tr>
        </thead>
        <tbody>
          {recorteFilas.visibles.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {avisos.length ? (
        <p className="mon-profile-table-recorte">{avisos.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mon-profile-empty">
      <span className="mon-profile-empty__icon"><CalendarRange size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function agendaRows(dashboard: MonitoreoAulasDashboard | null) {
  return (dashboard?.agenda ?? []) as unknown as Array<Record<string, unknown>>;
}

function cleanCell(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function hasCell(row: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => cleanCell(row[key]).length > 0);
}

function packagePrepared(row: Record<string, unknown>) {
  const status = cleanCell(row.package_status).toLowerCase();
  return hasCell(row, ["pdf_link", "pdf_url", "pdf", "ficha_pdf"]) || status === "pdf_preparado";
}

function handoffSummary(dashboard: MonitoreoAulasDashboard | null) {
  const rows = agendaRows(dashboard);
  const kpiTotal = Number(dashboard?.kpis.total_aulas ?? 0);
  const total = rows.length || (Number.isFinite(kpiTotal) ? kpiTotal : 0);
  const linked = rows.filter((row) => hasCell(row, ["link", "url", "collector_link"])).length;
  const pdf = rows.filter(packagePrepared).length;
  const word = rows.filter((row) => hasCell(row, ["word_link", "word_url", "word", "docx", "ficha_word"])).length;
  return { rows, total, linked, pdf, word };
}

function coverageLabel(done: number, total: number, unit = "cursos-horario") {
  if (!total) return "pendiente";
  return `${fmt(done)}/${fmt(total)} ${unit}`;
}

function metricTone(done: number, total: number): AulasFlowMetric["tone"] {
  if (!total) return "neutral";
  if (done >= total) return "ready";
  if (done > 0) return "current";
  return "warning";
}

function HandoffTracePanel({ dashboard }: { dashboard: MonitoreoAulasDashboard | null }) {
  const handoff = handoffSummary(dashboard);
  const cards = [
    {
      label: "Plan de muestra",
      value: dashboard?.selection_run_id ? "importado" : "pendiente",
      detail: `${fmt(handoff.total)} cursos-horario de la selección del cálculo de muestra`,
      tone: dashboard?.selection_run_id ? "ready" : "waiting",
    },
    {
      label: "Kobo + QR",
      value: coverageLabel(handoff.linked, handoff.total),
      detail: "enlace de aplicación guardado por curso-horario",
      tone: metricTone(handoff.linked, handoff.total) === "ready" ? "ready" : handoff.linked ? "current" : "waiting",
    },
    {
      label: "Fichas PDF",
      value: handoff.pdf ? coverageLabel(handoff.pdf, handoff.total, "fichas") : handoff.linked ? "listas para preparar" : "pendiente",
      detail: handoff.word ? `${fmt(handoff.word)} fichas Word enlazadas` : "QR, Word y PDF se preparan desde Fichas QR",
      tone: handoff.pdf ? "ready" : handoff.linked ? "current" : "waiting",
    },
    {
      label: "Monitoreo",
      value: handoff.linked ? "trazable" : "sin enlaces",
      detail: "lee agenda y enlaces; no recalcula la muestra",
      tone: handoff.linked ? "ready" : "waiting",
    },
  ];

  return (
    // El `<section>` declara su propia geometria aunque su grid interior ya
    // declare el suyo: son dos superficies, la seccion y el grupo de tarjetas.
    <section
      className="mon-profile-panel mon-aulas-handoff-panel"
      data-qa-geometry-group="monitoring-aulas-handoff-panel"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-profile-panel-head">
        <h3>Aplicación por cursos-horario</h3>
        <span>muestra, fichas QR y monitoreo</span>
      </div>
      <div
        className="mon-aulas-handoff-grid"
        data-qa-geometry-group="monitoring-aulas-handoff"
        data-qa-geometry-contract="equal"
      >
        {cards.map((card) => (
          <article key={card.label} className={`is-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function renderAulasView(
  view: MonitoreoSeccion,
  dashboard: MonitoreoAulasDashboard | null,
  operations: ReactNode,
  vacioSinTablero: ReactNode,
  registro: ReactNode,
  pestana: string,
) {
  if (view === "fuentes") {
    // Las operaciones (importar plan / sincronizar campo) se muestran incluso
    // sin dashboard: importar el plan es justamente la acción de arranque.
    const rows: MonitoreoRow[] = dashboard
      ? [
        { campo: "corrida", valor: dashboard.selection_run_id ?? "S/D" },
        { campo: "marco", valor: dashboard.frame_hash ?? "S/D" },
        { campo: "anonimas", valor: Boolean(dashboard.anonymous_responses) },
        { campo: "generado", valor: dashboard.generated_at },
      ]
      : [];
    return (
      <div className="mon-profile-stack aulas-fuentes-stack">
        {operations}
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Fuente y plan</h3>
            <span>{fmt(rows.length)} campos</span>
          </div>
          <DataTable
            rows={rows as Array<Record<string, unknown>>}
            empty="No hay metadatos del plan de cursos-horario. Importa el plan desde el cálculo de muestra."
            preferredColumns={["campo", "valor"]}
          />
        </section>
      </div>
    );
  }
  // El vacío lo pone la página, que es la que sabe si el plan está importado.
  // Ver `VacioSinTablero`.
  if (!dashboard) return vacioSinTablero;
  if (view === "modelo") {
    return (
      // La franja de traza acompaña a las dos pestañas: dice de dónde viene el
      // plan, y eso importa igual consultándolo que registrando sobre él. Lo que
      // ya no compite es la tabla contra el registro.
      <div className={`mon-profile-stack aulas-agenda-stack${pestana === "registro" ? " is-registro" : ""}`}>
        <HandoffTracePanel dashboard={dashboard} />
        {pestana === "registro" ? registro : null}
        {pestana === "registro" ? null : (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Agenda de cursos-horario</h3>
            <span>{fmt(dashboard.agenda?.length ?? 0)} cursos-horario</span>
          </div>
          <DataTable
            rows={agendaRows(dashboard)}
            empty="No hay agenda importada para cursos-horario."
            // El rol y a quién reemplaza van delante de la sección y el
            // responsable: con una cadena de seis, las siete filas del mismo
            // titular sólo se distinguían por su código. La tabla recorta a
            // ocho columnas y lo declara, así que el orden decide qué se ve.
            preferredColumns={["operational_code", "sample_role", "replacement_for", "label", "course_name", "schedule", "link", "package_status"]}
          />
        </section>
        )}
      </div>
    );
  }
  if (view === "calidad") {
    const rows = (dashboard.validation ?? []) as Array<Record<string, unknown>>;
    const summary = summarizeAulasValidation(rows);
    return (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Validación de cursos-horario</h3>
          <span>{summary.label}</span>
        </div>
        <DataTable
          rows={rows}
          empty="No hay controles de validación para este corte."
          preferredColumns={["check", "status", "detail"]}
        />
      </section>
    );
  }
  if (view === "consultas") {
    // Las tres listas van en paneles propios. Concatenadas producian una tabla
    // donde la misma aula salia hasta tres veces sin que ninguna columna dijera
    // de cual lista venia cada fila: 7 aulas se veian como 15 filas.
    const reemplazos = (dashboard.reemplazos ?? []) as Array<Record<string, unknown>>;
    const brechas = (dashboard.brechas ?? []) as Array<Record<string, unknown>>;
    return (
      <div className="mon-profile-stack">
        {pestana === "brechas" ? null : (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Cadena de reemplazos</h3>
            <span>{fmt(reemplazos.length)} filas</span>
          </div>
          <DataTable
            rows={reemplazos}
            empty="Ningún curso-horario ha necesitado reemplazo."
            // El ORDEN y el ESTADO van delante del rol: con seis reservas del
            // mismo titular, «reemplaza a CH 1» y «Reserva encadenada» se repiten
            // en las seis filas, y lo que hay que ver es cuál sigue y cuáles ya
            // se usaron.
            preferredColumns={["operational_code", "replacement_for", "replacement_order", "sample_status", "sample_role", "replacement_reason"]}
          />
        </section>
        )}
        {pestana === "reemplazos" ? null : (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Cursos-horario con brecha</h3>
            <span>{fmt(brechas.length)} filas</span>
          </div>
          <DataTable
            rows={brechas}
            empty="Ningún curso-horario tiene brecha abierta."
            preferredColumns={["operational_code", "label", "respuestas_validas", "expected_valid", "brecha", "operational_status"]}
          />
        </section>
        )}
      </div>
    );
  }
  // Avance: las tres miradas del mismo campo, cada una en su panel. Antes las
  // cuotas y el avance por estrato COMPETIAN por un solo panel —`quotaRows.length
  // ? quotaRows : avance_por_estrato`—, y como un estudio de cursos-horario
  // siempre trae cuotas del calculo de muestra, el avance por estrato no se veia
  // nunca. El avance por aula ni siquiera estaba: vivia en Consultas, mezclado.
  const quotaRows = (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>;
  const estratoRows = (dashboard.avance_por_estrato ?? []) as Array<Record<string, unknown>>;
  const aulaRows = (dashboard.course_status ?? []) as Array<Record<string, unknown>>;
  return (
    // `aulas-tablas-apiladas`: sin ella el stack es grid y asigna 0 px a la fila
    // cuyo contenido no la empuja —medido: el panel del gráfico quedaba en 26 px
    // y el gráfico se dibujaba encima de la tabla—. La clase lo pasa a flex con
    // hijos que no se encogen, que es lo que ya arregló el reparto de alto.
    <div className="mon-profile-stack aulas-tablas-apiladas">
      {pestana !== "resumen" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Cobertura de la meta</h3>
          <span>{fmt(aulaRows.length)} cursos-horario</span>
        </div>
        {/* Va ANTES de la tabla: la tabla dice aula por aula y esto dice la
            forma del conjunto, que es lo que decide dónde insistir. */}
        <AulasCoberturaChart filas={aulaRows as unknown as MonitoreoAulasPlanRow[]} />
      </section>
      )}
      {pestana !== "resumen" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Avance por curso-horario</h3>
          <span>{fmt(aulaRows.length)} filas</span>
        </div>
        <DataTable
          rows={aulaRows}
          empty="Todavía no hay respuestas que atribuir a un curso-horario."
          preferredColumns={["operational_code", "label", "respuestas_validas", "expected_valid", "brecha", "application_state"]}
        />
      </section>
      )}
      {pestana !== "estratos" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Avance por estrato</h3>
          <span>{fmt(estratoRows.length)} filas</span>
        </div>
        <DataTable rows={estratoRows} empty="No hay avance por estrato preparado." />
      </section>
      )}
      {pestana !== "cuotas" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Cuota sexo por facultad</h3>
          <span>{fmt(quotaRows.length)} filas</span>
        </div>
        <DataTable rows={quotaRows} empty="El plan no declara composición por sexo para estos cursos-horario." />
      </section>
      )}
    </div>
  );
}

export default function AulasMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [seccionActiva, setActiveView] = useState<MonitoreoSeccion>(() => seccionInicialMonitoreo("avance", AULAS_WORKBENCH_VIEWS));
  // Una pestaña activa POR SECCIÓN: volver a una sección la reencuentra donde
  // se dejó, en vez de reiniciarla.
  const [pestanaPorSeccion, setPestanaPorSeccion] = useState<Record<string, string>>(() => {
    const inicial = seccionInicialMonitoreo("avance", AULAS_WORKBENCH_VIEWS);
    const mapa: Record<string, string> = {};
    for (const def of AULAS_WORKBENCH_VIEWS) {
      const claves = pestanasDe(def.key).map((item) => item.key);
      if (!claves.length) continue;
      mapa[def.key] = pestanaInicialDeSeccion(def.key, inicial, claves[0], claves);
    }
    return mapa;
  });
  const pestanaActiva = pestanaPorSeccion[seccionActiva] ?? primeraPestana(seccionActiva);
  const elegirPestana = (seccion: MonitoreoSeccion, clave: string) =>
    setPestanaPorSeccion((prev) => ({ ...prev, [seccion]: clave }));

  useMonitoreoDireccion(seccionActiva, pestanaActiva || undefined, "aulas", {
    onSeccionPedida: (seccion) => {
      setActiveView(seccion);
      // La pestaña de la URL se aplica AQUÍ, junto con su sección. Al cambiar
      // de sección, la pestaña activa pasa a ser la recordada para esa sección
      // y se publica en la URL, pisando la pedida: `?seccion=consultas&
      // pestana=reemplazos` aterrizaba en `brechas` si esa era la última vista.
      // La vista quedaba alcanzable por clic y no por dirección, que es
      // justamente lo que el contrato v3 prohíbe.
      // Se exige que la SECCIÓN de la URL coincida con la que se activa: eso
      // distingue «vengo de una dirección» de «vengo de un clic», donde la URL
      // todavía trae la pestaña de la sección anterior. Aquí el clic de sección
      // no pasa por este callback, pero depender de eso es suponer quién
      // dispara qué; la condición lo hace explícito y es la misma en los cuatro
      // perfiles.
      if (monitoreoSeccionDesdeParams(window.location.search) !== seccion) return;
      const pedida = monitoreoPestanaDesdeParams(window.location.search);
      if (pedida && pestanasDe(seccion).some((item) => item.key === pedida)) {
        elegirPestana(seccion, pedida);
      }
    },
    onPestanaPedida: (pestana, seccion) => {
      if (pestanasDe(seccion as MonitoreoSeccion).some((item) => item.key === pestana)) {
        elegirPestana(seccion as MonitoreoSeccion, pestana);
      }
    },
  });
  useRegistrarPestanasMonitoreo(
    "aulas",
    seccionActiva,
    pestanasDeMonitoreo("aulas", seccionActiva),
  );
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");

  const activeDef = useMemo(
    () => AULAS_WORKBENCH_VIEWS.find((item) => item.key === seccionActiva) ?? AULAS_WORKBENCH_VIEWS[0],
    [seccionActiva],
  );
  const dashboard = dashboardFromState(state);
  const corte = useMemo(() => corteAulas(state, dashboard), [state, dashboard]);
  const aulasConfig = state?.config?.aulas_universitarias ?? null;
  const imported = aulasPlanImported(aulasConfig);
  const sourceTotal = state?.sources?.length ?? 0;
  const activeSources = (state?.sources ?? []).filter((source) => source.enabled).length;
  const busy = loading || mutating;
  const refreshTitle = busy
    ? "Actualizando vista de cursos-horario..."
    : `Recargar ${activeDef.shortLabel ?? activeDef.label} desde la memoria local del proyecto`;
  const advanceTitle = imported
    ? "Recalcular el corte de campo de cursos-horario con el snapshot y la agenda locales"
    : "Primero importa el plan desde el cálculo de muestra (sección Fuentes)";

  const loadView = useCallback(async (view: MonitoreoSeccion, force = false) => {
    setLoading(true);
    try {
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: scopeForView(view),
        warmupCache: !force,
        force,
      });
      setState(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // El ciclo del libro operativo. Generar lo descarga; leer lo vuelve a meter
  // en la sesión. Los endpoints existían desde hace rato y no los llamaba nadie:
  // el ciclo sólo se podía cerrar por API.
  const generarLibro = useCallback(async () => {
    setMutating(true);
    setError("");
    try {
      const res = await apiMonitoreoAulasGenerarLibro();
      // La descarga la dispara un enlace efímero: no hay dónde «guardar» un
      // Excel operativo dentro del proyecto, y sacarlo es justo el punto.
      const a = document.createElement("a");
      a.href = res.download_url;
      a.download = res.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el libro.");
    } finally {
      setMutating(false);
    }
  }, []);

  const importarLibro = useCallback(async (archivo: File) => {
    setMutating(true);
    setError("");
    try {
      const res = await apiMonitoreoAulasImportarLibro(archivo);
      setState(res.state);
      // Lo que NO venía se dice, en vez de mostrar ceros silenciosos.
      if (res.hojas_ausentes?.length) {
        setError(`El libro no traía ${res.hojas_ausentes.join(" ni ")}. Lo demás se leyó.`);
      }
      await loadView(seccionActiva, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el libro.");
    } finally {
      setMutating(false);
    }
  }, [loadView, seccionActiva]);


  useEffect(() => {
    void loadView(seccionActiva);
  }, [seccionActiva, loadView]);

  // Flujos movidos del monolito (unidad 4.1) sin reescribir la lógica:
  // importAulasFromCalcMuestra / syncAulasUniversitarias de MonitoreoPage.tsx.
  const importPlan = useCallback(async () => {
    setMutating(true);
    setError("");
    try {
      const result = await apiMonitoreoAulasImportFromCalcMuestra();
      setState(result.state);
      // El monolito aterrizaba en la agenda tras importar; se conserva.
      setActiveView("modelo");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutating(false);
    }
  }, []);

  const syncField = useCallback(async () => {
    setMutating(true);
    setError("");
    try {
      const result = await apiMonitoreoAulasSync();
      setState(result.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutating(false);
    }
  }, []);

  return (
    <div className="mon-profile-page is-aulas-flow" style={MODULE_TONES.monitoreo as CSSProperties}>
      <span
        hidden
        data-audit-ready="monitoreo-aulas"
        data-audit-has-dashboard={dashboard ? "true" : "false"}
      />
      <MonitoreoModuleChrome
        routes={[AULAS_ROUTE]}
        route={AULAS_ROUTE}
        routeSelected
        seccionActiva={seccionActiva}
        saving={busy}
        syncedAt={state?.synced_at ?? ""}
        generatedAt={state?.generated_at ?? state?.synced_at ?? ""}
        generationStatus={state?.generation_status ?? ""}
        pendingRegeneration={Boolean(state?.pending_regeneration)}
        syncErrors={state?.sync_errors ?? state?.errors ?? []}
        sourceTotal={sourceTotal}
        activeSources={activeSources}
        nRows={state?.n_rows ?? 0}
        hasSnapshot={Boolean(state?.has_snapshot)}
        syncing={busy}
        advanceSyncDisabled={busy || !imported}
        advanceSyncLabel="Avance"
        advanceSyncTitle={advanceTitle}
        onSyncAdvance={() => { void syncField(); }}
        syncDisabled={busy}
        syncLabel="Recargar"
        syncTitle={refreshTitle}
        onSyncAll={() => { void loadView(seccionActiva, true); }}
        onCambioSeccion={(view) => {
          if (view !== seccionActiva) setActiveView(view);
        }}
      />

      <main className="mon-profile-workbench">
        <aside className="mon-profile-sidebar">
          <div className="mon-profile-context">
            <span>SECCIÓN ACTIVA</span>
            <strong>Cursos-horario</strong>
            <small>{activeDef.label}</small>
          </div>
          <div className="mon-profile-readiness">
            <span>{dashboard ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span>
            <div>
              <strong>{dashboard ? "Vista lista" : "Preparando vista"}</strong>
              <small>{dashboard?.schema ?? "Memoria local"}</small>
            </div>
          </div>
        </aside>

        <section className={`mon-profile-content${seccionActiva === "fuentes" ? " has-aulas-flow" : ""}`}>
          <AulasKpiBand dashboard={dashboard} />
          {seccionActiva === "fuentes" ? (
            <AulasApplicationFlow
              tone="monitoreo"
              current="monitoreo"
              compact
              title="Seguimiento de la intervención por cursos-horario"
              summary="Este monitoreo lee el plan del cálculo de muestra de cursos-horario y sus enlaces QR/PDF para medir avance, caídas, reemplazos y brechas sin rediseñar la muestra."
              secondaryAction={{ to: AULAS_SAMPLE_ROUTE, label: "Ver muestra de cursos-horario" }}
              action={{ to: "/recopiladores", label: "Abrir fichas QR" }}
            />
          ) : null}
          <div
            className="aulas-mon-view"
            role={pestanaActiva ? "tabpanel" : undefined}
            id={pestanaActiva ? `aulas-mon-panel-${pestanaActiva}` : undefined}
            aria-labelledby={pestanaActiva ? `aulas-mon-tab-${pestanaActiva}` : undefined}
          >
            {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
            {pestanasDe(seccionActiva).length ? (
              <GlidingTabList
                activeKey={pestanaActiva}
                className="aulas-mon-tabs"
                role="tablist"
                aria-label={`Pestañas de ${activeDef.label}`}
              >
                {pestanasDe(seccionActiva).map((pestana) => (
                  <button
                    key={pestana.key}
                    id={`aulas-mon-tab-${pestana.key}`}
                    type="button"
                    role="tab"
                    aria-controls={`aulas-mon-panel-${pestana.key}`}
                    data-gliding-key={pestana.key}
                    data-nav-item=""
                    data-nav-shape="pill"
                    data-nav-state={pestanaActiva === pestana.key ? "selected" : undefined}
                    aria-selected={pestanaActiva === pestana.key}
                    className={pestanaActiva === pestana.key ? "is-active" : ""}
                    onClick={() => elegirPestana(seccionActiva, pestana.key)}
                  >
                    {pestana.label}
                  </button>
                ))}
              </GlidingTabList>
            ) : null}
            {loading ? (
              <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." />
            ) : seccionActiva === "avance" && pestanaActiva === "salidas" ? (
              // Salidas se muestra aunque no haya dashboard: el workbench declara
              // por qué está bloqueada (sin corte, sin válidas) en vez de dejar la
              // pestaña muda.
              <MonitoreoOutputsWorkbench
                family="aulas"
                routeLabel="Cursos-horario"
                config={state?.config}
                clientSheets={state?.publication?.client_last_sheets ?? null}
                internalSheets={state?.publication?.internal_last_sheets ?? null}
                corte={corte}
                syncedAt={state?.synced_at ?? ""}
                onPublished={() => { void loadView(seccionActiva, true); }}
              />
            ) : renderAulasView(
              seccionActiva,
              dashboard,
              <AulasOperationsPanel
                config={aulasConfig}
                sources={state?.sources ?? []}
                busy={busy}
                onImportPlan={() => { void importPlan(); }}
                onSyncField={() => { void syncField(); }}
                onGenerarLibro={() => { void generarLibro(); }}
                onImportarLibro={(archivo) => { void importarLibro(archivo); }}
              />,
              <VacioSinTablero
                planImportado={imported}
                fuentesActivas={activeSources}
                fuentesDeclaradas={sourceTotal}
                onIrAFuentes={() => setActiveView("fuentes")}
              />,
              <RegistroDeCampo
                agenda={aulasConfig?.plan ?? []}
                onGuardado={() => { void loadView(seccionActiva, true); }}
              />,
              pestanaActiva,
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
