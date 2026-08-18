import { useCallback, useEffect, useMemo, useState } from "react";
import { contar } from "../../fuentes/vocabulario";
import type { CSSProperties, ReactNode } from "react";
// Por el shim, que es la regla de la casa: los imports directos de
// `lucide-react` arrastran el barrel entero al bundle. Este archivo se lo
// saltaba desde antes; se corrige al pasar por aquí.
import { AlertCircle, CalendarRange, CheckCircle2, Info } from "../../../../vendor/lucide-react";
import {
  apiMonitoreoAulasGenerarLibro,
  apiMonitoreoAulasImportarLibro,
  apiMonitoreoAulasImportFromCalcMuestra,
  apiMonitoreoAulasSync,
  apiMonitoreoState,
  type MonitoreoAulasDashboard,
  type MonitoreoAulasPlanRow,
  type MonitoreoRow,
  type MonitoreoSource,
  type MonitoreoState,
} from "../../../../api/client";
import { AulasOperationsPanel, aulasPlanImported } from "./AulasOperationsPanel";
import { VacioSinTablero } from "./VacioSinTablero";
import { AULAS_SAMPLE_ROUTE, AulasApplicationFlow, type AulasFlowMetric } from "../../../aulasFlow/AulasApplicationFlow";
import { RegistroDeCampo } from "./RegistroDeCampo";
import { apiUpload } from "../../../../api/estudio";
import { AulasBrechaEstratoChart } from "./AulasBrechaEstratoChart";
import { AulasAgendaPorDia } from "./AulasAgendaPorDia";
import { AulasBancoExtras } from "./AulasBancoExtras";
import { columnasConDato } from "./columnasConDato";
import { AulasAvanceEnRespuestas } from "./AulasAvanceEnRespuestas";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { AulasCadenaChart } from "./AulasCadenaChart";
import { AulasPerfilPorFacultad } from "./AulasPerfilPorFacultad";
import { AulasControles } from "./AulasControles";
import { AulasControlDelLibro, type ResumenDeControl } from "./AulasControlDelLibro";
import { AulasFuentesDelEstudio, type ReciboDelLibro } from "./AulasFuentesDelEstudio";
import { AulasHistoriaCadena } from "./AulasHistoriaCadena";
import { historiaDeCadena } from "./historiaDeCadena";
import { AulasCoberturaChart } from "./AulasCoberturaChart";
import { AulasPiramideCuota } from "./AulasPiramideCuota";
import { AulasCuotasResumen, focoDesdeTexto, textoDesdeFoco, type FocoDeCuota } from "./AulasCuotasResumen";
import { aulasKpis, fmt } from "./kpisDeAulas";
import { AulasEstadoChart } from "./AulasEstadoChart";
import { AulasRitmoDiario, type RitmoDiario } from "./AulasRitmoDiario";
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
  useFocoMonitoreo,
  useMonitoreoDireccion,
} from "../../useMonitoreoDireccion";
import { useRegistrarPestanasMonitoreo } from "../../useRegistrarPestanas";
import { MonitoreoModuleChrome } from "../../shell/MonitoreoModuleChrome";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";
import { MonitoreoWorkbenchChrome, MonitoreoWorkbenchHead, MonitoreoWorkbenchRail } from "../../components";
import { railDeAulas } from "./railDeAulas";
import { parteDeCampo } from "./parteDeCampo";
import {
  aulasFieldLabel,
  escalaDeProporciones,
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

/**
 * Qué columnas de una tabla son cifra, para alinearlas a la derecha.
 *
 * `DataTable` pintaba las 196 filas con todo a la izquierda, así que ninguna
 * columna de números se podía recorrer con el ojo: en Partes de campo convivían
 * «25», «69.4 %», «1», «3», «20», «21» y «−1» pegados al borde izquierdo, cada
 * uno empezando a una altura distinta según su ancho. Es el mismo arreglo que
 * la Base de control ya tenía por su cuenta, y aquí sirve para las cinco tablas
 * que comparten este componente.
 *
 * Se decide por la COLUMNA entera y sobre los valores YA presentados —que es
 * donde `69.4 %` existe como tal—: basta un código como «CH 31» para que la
 * columna no sea cifra, y así ninguna de identificador se alinea por error.
 * Una columna vacía tampoco cuenta: sin un solo número, alinearla a la derecha
 * movería sus guiones sin motivo.
 */
function columnasDeCifra(
  filas: ReadonlyArray<Record<string, unknown>>,
  columnas: ReadonlyArray<string>,
) {
  const cifra = new Set<string>();
  for (const columna of columnas) {
    let vistos = 0;
    let todas = true;
    for (const fila of filas) {
      const texto = String(fila[columna] ?? "").trim();
      if (!texto || texto === "—") continue;
      vistos += 1;
      // Se admite el « %» que pone la capa de presentación y el separador de
      // millares de `es-PE`; lo demás tiene que ser un número.
      const crudo = texto.replace(/\s*%$/, "").replace(/,/g, "");
      if (!/^-?\d+(\.\d+)?$/.test(crudo)) { todas = false; break; }
    }
    if (vistos && todas) cifra.add(columna);
  }
  return cifra;
}

// La banda vive en `kpisDeAulas.ts`: el KPI de cuota comparte cálculo con el
// panel de Avance y así se puede probar sin montar la página.

function AulasKpiBand({ dashboard, seccion }: {
  dashboard: MonitoreoAulasDashboard | null;
  seccion: MonitoreoSeccion;
}) {
  return (
    <div
      className="aulas-kpi-band"
      role="group"
      aria-label="Indicadores de cursos-horario"
      data-qa-geometry-group="monitoring-aulas-kpis"
      data-qa-geometry-contract="equal"
    >
      {aulasKpis(dashboard, seccion).map((kpi) => {
        const Icono = kpi.icono;
        return (
          <div
            key={kpi.label}
            className={`aulas-kpi aulas-kpi--${kpi.tone ?? "neutral"}`}
            title={kpi.detalle}
            aria-label={kpi.detalle ? `${kpi.label}: ${kpi.value} — ${kpi.detalle}` : undefined}
          >
            {/* Ícono y pista son el patrón de telefónico y acreditación: cada
                cifra se reconoce de un vistazo y dice de dónde sale. Los llevan
                TODAS las tarjetas, así que el marco crece parejo y C2 aguanta.
                El ícono es decorativo —el rótulo ya nombra la cifra—, así que se
                oculta a lectores de pantalla. */}
            <span className="aulas-kpi-rotulo">
              <Icono size={13} aria-hidden="true" />
              {kpi.label}
            </span>
            <strong>{kpi.value}</strong>
            <small>{kpi.pista}</small>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({
  rows,
  empty,
  preferredColumns = [],
  maxColumns = 8,
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
  /**
   * Cuántas columnas caben. Por defecto ocho, y lo que sobra hasta ocho lo
   * rellena el payload en su propio orden — que es como la tabla de brechas
   * acabó mostrando «Curso-horario» e «ID de curso-horario», dos columnas con
   * el mismo valor en las 86 filas. Una tabla que pide menos de ocho puede
   * decirlo y quedarse con las suyas.
   */
  maxColumns?: number;
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
  // Y una columna sin un solo dato no gasta ancho ni cuenta para el recorte:
  // no se «recorta», es que no tiene nada que enseñar. Declararla como recorte
  // diría que hay algo escondido detrás, y no lo hay.
  const todasLasColumnas = columnasConDato(
    rows,
    compactColumns(rows, preferredColumns, Number.MAX_SAFE_INTEGER),
  );
  const recorteColumnas = recorteTabla(todasLasColumnas, maxColumns, "columna");
  const columns = recorteColumnas.visibles;
  // 80 filas dejaban fuera 116 de las 196 de un operativo real —y con las
  // reservas al final del plan, la Agenda no mostraba NI UNA—. El tope existe
  // para no reventar el DOM; 400 filas con scroll interno no lo revientan y
  // cubren un estudio entero. Sigue declarándose cuando recorta.
  // La escala se decide sobre TODAS las filas, no sobre las 400 que se pintan:
  // si el recorte dejara fuera justo la que pasa de 1, la misma columna se
  // formatearía distinto según cuántas filas quepan.
  const enProporcion = escalaDeProporciones(rows);
  const recorteFilas = recorteTabla(rows.map((row) => presentAulasRow(row, enProporcion)), 400);
  const avisos = [recorteFilas.etiqueta, recorteColumnas.etiqueta].filter(Boolean);
  // Sobre las filas ya presentadas y ya recortadas: son las que se pintan.
  const cifras = columnasDeCifra(recorteFilas.visibles, columns);
  return (
    <div
      className="mon-profile-table-wrap"
      data-qa-geometry-capacity="owned"
      data-qa-geometry-member
    >
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => (
            <th key={column} scope="col" className={cifras.has(column) ? "es-cifra" : undefined}>
              {aulasFieldLabel(column)}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {recorteFilas.visibles.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className={cifras.has(column) ? "es-cifra" : undefined}>
                  {String(row[column] ?? "")}
                </td>
              ))}
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
      detail: handoff.word ? `${contar(handoff.word, "ficha Word enlazada", "fichas Word enlazadas")}` : "QR, Word y PDF se preparan desde Fichas QR",
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
        {/* No sale de ninguna hoja del libro: es la cadena que deja el plan
            listo para salir a campo. Se llamaba «Aplicación por cursos-horario»
            y eso ya nombra DOS cosas —el perfil entero y la hoja «Aulas
            Aplicadas (Campo)»—, así que el mismo rótulo señalaba tres
            superficies distintas. */}
        <h3>Preparación de campo</h3>
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
  /** Las fuentes del estudio; Fuentes es la sección que promete decir cuáles son. */
  fuentes: ReadonlyArray<MonitoreoSource>,
  pestana: string,
  /** Corte elegido en el resumen de cuotas; vive en la URL, no en un estado suelto. */
  foco: FocoDeCuota,
  onFoco: (foco: FocoDeCuota) => void,
  /**
   * Cuánto trajo la plataforma: `n_rows` y `variables` del ESTADO, no del
   * tablero. Se pasan porque esta función no ve el estado —recibe sólo el
   * dashboard—, y sin ellos la tarjeta de la fuente describía igual una base de
   * 3 700 filas y 43 columnas que una de 3 700 y dos.
   */
  volumen: { filas?: number; columnas?: number } = {},
) {
  if (view === "fuentes") {
    // Las operaciones (importar plan / sincronizar campo) se muestran incluso
    // sin dashboard: importar el plan es justamente la acción de arranque.
    return (
      <div className="mon-profile-stack aulas-fuentes-stack">
        {operations}
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-fuentes"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* Antes decía «Fuente y plan» y era una tabla campo/valor que
                repetía la corrida y el marco —ya son tarjetas de «Operación del
                plan», justo arriba— y el sello de generación, que es el «Corte»
                de la banda. Lo que faltaba era esto: qué se está leyendo. */}
            <h3>De dónde salen las respuestas</h3>
            {/* El libro cuenta como fuente: de él salen el plan, el parte de
                campo y el control. Si no se contara, la cuenta diría una menos
                de las que la lista enseña. */}
            <span>{(() => {
              const n = fuentes.length + (dashboard?.libro ? 1 : 0);
              return n === 1 ? "1 fuente" : `${fmt(n)} fuentes`;
            })()}</span>
          </div>
          <AulasFuentesDelEstudio
            fuentes={fuentes}
            anonimas={Boolean(dashboard?.anonymous_responses)}
            libro={(dashboard?.libro ?? null) as ReciboDelLibro | null}
            filas={volumen.filas}
            columnas={volumen.columnas}
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
          // `aulas-agenda-panel`: este panel tiene TRES filas —cabecera, lectura
          // por día y tabla— y la regla común declara dos. Un hijo de más se
          // lleva una fila declarada y se dibuja encima del siguiente; medido:
          // los días se pintaban sobre la tabla. Es el mismo tropiezo que ya
          // costó el reparto de alto del banner de KPIs.
          className="mon-profile-panel aulas-agenda-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* La hoja del libro se llama así y estas son sus filas: las
                escribe `aulas_libro_hoja_agendadas()` y las vuelve a leer
                `aulas_agendadas_leer()`. */}
            <h3>Aulas agendadas</h3>
            <span>{fmt(dashboard.agenda?.length ?? 0)} cursos-horario</span>
          </div>
          {/* Primero cuándo se aplica cada cosa —que es lo que se pregunta al
              entrar a Agenda— y después la tabla, que es donde se busca un
              curso-horario concreto. La tabla NO se va: en esta sección sirve. */}
          <AulasAgendaPorDia filas={(dashboard.course_status ?? []) as MonitoreoAulasPlanRow[]} />
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
    const control = (dashboard.control_calidad ?? []) as Array<Record<string, unknown>>;
    const controlResumen = (dashboard.control_calidad_resumen ?? null) as ResumenDeControl | null;
    return (
      <div className="mon-profile-stack aulas-tablas-apiladas">
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* Se queda: los controles los deriva el motor —el libro no trae hoja
              de validación—, así que no hay encabezado que copiar. */}
          <h3>Validación de cursos-horario</h3>
          <span>{summary.label}</span>
        </div>
        {/* Avisos y no tabla: el detalle de un control es una frase entera y en
            una celda de tres columnas se lee mal. Es además el lenguaje que ya
            usa `CalidadDeCampo` justo arriba, en esta misma sección. */}
        <AulasControles filas={rows} />
      </section>
      {/* La tercera hoja del operativo. Los dos paneles son control de calidad y
          por eso comparten sección, pero no son la misma medida: arriba lo que
          deriva el motor, aquí lo que el equipo calcula en su Excel. Separarlos
          evita que una fila parezca respaldar a la otra. */}
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El nombre de la hoja, tal cual, porque es a lo que el equipo va a
              buscarlo en su libro. */}
          <h3>Base de control</h3>
          <span>{control.length ? contar(control.length, "aula", "aulas") : "Sin datos"}</span>
        </div>
        <AulasControlDelLibro filas={control} resumen={controlResumen} />
      </section>
      </div>
    );
  }
  if (view === "consultas") {
    // Las tres listas van en paneles propios. Concatenadas producian una tabla
    // donde la misma aula salia hasta tres veces sin que ninguna columna dijera
    // de cual lista venia cada fila: 7 aulas se veian como 15 filas.
    const reemplazos = (dashboard.reemplazos ?? []) as Array<Record<string, unknown>>;
    const brechas = (dashboard.brechas ?? []) as Array<Record<string, unknown>>;
    const cuadre = parteDeCampo((dashboard.partes_campo ?? []) as MonitoreoRow[]);
    // El PLAN entero, no `reemplazos`: la historia y el gráfico necesitan también
    // los titulares que nunca necesitaron reserva, porque «146 no necesitaron
    // reemplazo» es parte de la respuesta.
    const agendaFilas = (dashboard.agenda ?? []) as MonitoreoAulasPlanRow[];
    // La MISMA función que escribe la lectura: el contador de la cabecera y el
    // renglón de abajo no pueden salir de dos cuentas distintas.
    const cadenas = historiaDeCadena(agendaFilas);
    // Cada pestaña muestra SU panel, y el reparto es POSITIVO. Con dos bastaba
    // negar la otra; con tres hubo que negar dos; con la cuarta —Extras— la
    // negación volvía a fallar y la cadena se pintaba encima. Preguntar «¿es
    // esta pestaña?» en vez de «¿no es ninguna de las otras?» hace que la
    // siguiente pestaña que se añada no herede el panel de nadie.
    const enParte = pestana === "parte";
    const enBrechas = pestana === "brechas";
    const enExtras = pestana === "extras";
    const enCadena = !enParte && !enBrechas && !enExtras;
    return (
      <div className="mon-profile-stack aulas-tablas-apiladas">
        {enCadena ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* Se queda: el libro no tiene hoja de cadena, la expresa por
                bloques —«APLICACIÓN DE REEMPLAZO n»— y por el valor «EN RESERVA
                n» de STATUS MUESTRA. El nombre de la vista es nuestro. */}
            <h3>Cadena de reemplazos</h3>
            {/* En CADENAS, que es la unidad de la lectura de abajo. Decía «50
                filas» dos renglones encima de «3 con un reemplazo · 21 sin
                cerrar», que suman 24: el mismo panel daba dos números para lo
                que se lee como la misma cosa. La cuenta sale de la MISMA función
                que escribe la lectura. */}
            <span>{(() => {
              const n = cadenas.historias.length;
              return n === 1 ? "1 cadena" : `${fmt(n)} cadenas`;
            })()}</span>
          </div>
          {/* Primero CÓMO se llegó —titular, su reemplazo, cuál cerró—, que es
              lo que se pregunta al cerrar el operativo; después cuánta reserva
              se gastó. La tabla de abajo queda como el detalle fila a fila. */}
          <AulasHistoriaCadena filas={agendaFilas} />
          {/* Sale del PLAN entero, no de `reemplazos`: esa lista sólo trae
              reservas y caídas, así que un titular sin ninguna reserva —el caso
              de L54— no aparecería y el gráfico diría que el plan tiene un
              colchón que no tiene. */}
          <AulasCadenaChart filas={agendaFilas} />
          {/* La tabla cambia de unidad y lo dice: la lectura cuenta cadenas y
              aquí va cada aula de esas cadenas, la que cayó y sus reservas. Sin
              este renglón, 24 arriba y 50 abajo se leen como una contradicción. */}
          <p className="mon-profile-muted">
            Cada cadena, aula por aula: la que cayó y sus reservas.
          </p>
          <DataTable
            rows={reemplazos}
            empty="Ningún curso-horario ha necesitado reemplazo."
            // El ORDEN y el ESTADO van delante del rol: con seis reservas del
            // mismo titular, «reemplaza a CH 1» y «Reserva encadenada» se repiten
            // en las seis filas, y lo que hay que ver es cuál sigue y cuáles ya
            // se usaron.
            // `motivo` y no `replacement_reason`: el motivo vive en un campo
            // distinto según el papel de la fila —la que cae lo lleva en
            // `replacement_reason` y la que entra en `activation_reason`—, así
            // que sobre las 26 filas de reserva esa columna era estructuralmente
            // vacía. El motor lo resuelve en una sola columna.
            preferredColumns={["operational_code", "replacement_for", "replacement_order", "sample_status", "sample_role", "motivo"]}
          />
        </section>
        ) : null}
        {enBrechas ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* Se queda: la brecha la calcula el motor contra la meta; ninguna
                columna del libro la trae escrita. */}
            <h3>Cursos-horario con brecha</h3>
            <span>{fmt(brechas.length)} filas</span>
          </div>
          <DataTable
            rows={brechas}
            empty="Ningún curso-horario tiene brecha abierta."
            // Siete y se declaran: la octava la rellenaba el payload con
            // `classroom_id`, que en las 86 filas vale lo mismo que
            // `operational_code`. `faculty` entra a mano porque es el corte con
            // el que se reparte el trabajo, no porque toque por orden.
            preferredColumns={["operational_code", "label", "faculty", "respuestas_validas", "expected_valid", "brecha", "operational_status"]}
            maxColumns={7}
          />
        </section>
        ) : null}
        {enParte ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* «Partes de campo» y no «Aulas aplicadas (campo)», que es como se
                llama el panel del registro en Agenda: son dos superficies
                distintas sobre la misma hoja —allí se llena un parte, aquí se
                leen todos— y el guard de títulos rechaza que compartan nombre.
                Lo pilló al escribirlo. */}
            <h3>Partes de campo</h3>
            <span>{cuadre.label}</span>
          </div>
          {/* La resta ya viene hecha del motor —el mismo helper que decide el
              descuadre—, así que esta línea y el aviso de Validación no pueden
              discrepar. Es el destino que le faltaba a «Cuadre del parte de
              campo», que nombraba las aulas sin dar dónde mirarlas. */}
          {cuadre.descuadrados ? (
            <p className="aulas-parte-aviso">
              <strong>{fmt(cuadre.descuadrados)}</strong>{" "}
              {cuadre.descuadrados === 1 ? "parte no cuadra" : "partes no cuadran"}: asistentes
              menos rechazos y duplicados no dan las efectivas declaradas. Se ven primero.
            </p>
          ) : null}
          <DataTable
            rows={cuadre.filas}
            empty="Todavía no se ha registrado ningún parte de campo."
            // SÓLO las columnas del parte, más el código para saber de qué aula
            // es. Añadir facultad, curso u horario la convertiría en una segunda
            // Agenda, y de eso ya hay una.
            // Nueve y no ocho: `% Asistencia` va pegada a los asistentes que
            // califica. Es el único de los once campos de la hoja que se leía y
            // no llegaba a ninguna pantalla, y es el número que dice si el 70 %
            // del padrón era alcanzable —con 55 % de asistencia no se llega ni
            // respondiendo todos los presentes—.
            maxColumns={9}
            preferredColumns={["operational_code", "observed_students", "attendance_pct", "refusals", "duplicates", "effective_surveys", "esperado", "diferencia", "applied_by"]}
          />
        </section>
        ) : null}
        {enExtras ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-extras"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* «Extras» es el nombre del dato: el plan las trae con
                `wave = "Extra"`. La descripción dice para qué sirven, que es lo
                que no se deduce del nombre —y que yo tenía mal: no reemplazan
                a nadie—. */}
            <h3>Aulas extra por facultad</h3>
            <span>{fmt(dashboard.banco_extras?.total ?? 0)} extras</span>
          </div>
          <p className="mon-profile-muted">
            No reemplazan a ningún curso-horario: son aulas adicionales para
            cerrar la cuota de hombres y mujeres de cada facultad.
          </p>
          <AulasBancoExtras banco={dashboard.banco_extras ?? null} />
        </section>
        ) : null}
      </div>
    );
  }
  // Avance: las tres miradas del mismo campo, cada una en su panel. Antes las
  // cuotas y el avance por estrato COMPETIAN por un solo panel —`quotaRows.length
  // ? quotaRows : avance_por_estrato`—, y como un estudio de cursos-horario
  // siempre trae cuotas del calculo de muestra, el avance por estrato no se veia
  // nunca. El avance por aula ni siquiera estaba: vivia en Consultas, mezclado.
  const quotaRows = (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>;
  // El detalle de abajo obedece al corte elegido arriba. Sin foco se ven las
  // doce celdas; con foco, sólo las de esa facultad o ese sexo.
  const quotaEnFoco = !foco ? quotaRows : quotaRows.filter((fila) => (
    foco.tipo === "facultad" ? String(fila.faculty ?? "") === foco.valor
      : String(fila.sex ?? "") === foco.valor
  ));
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
          {/* Abre la sección porque es su primera pregunta —¿se está
              cumpliendo?—. La unidad va en el TÍTULO y no en el contador: se
              llamaba «Cumplimiento de la meta» y dos paneles más abajo estaba
              «Cobertura de la meta», que cuenta cursos-horario. Dos nombres casi
              iguales para dos unidades distintas, con la distinción escondida en
              un contador de 11 px —y en un comentario de código—. */}
          <h3>Cumplimiento en respuestas</h3>
          <span>meta {fmt(avanceEnRespuestas(aulaRows as unknown as MonitoreoAulasPlanRow[]).meta)}</span>
        </div>
        <AulasAvanceEnRespuestas filas={aulaRows as unknown as MonitoreoAulasPlanRow[]} />
      </section>
      )}
      {/* Va justo después del cumplimiento: primero CUÁNTO se lleva y en
          seguida CÓMO se llegó. Separarlos con el estado de aplicación en medio
          obligaba a recordar la cifra mientras se baja. */}
      {pestana !== "resumen" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Ritmo de la recolección</h3>
          <span>{fmt((dashboard?.ritmo_diario?.dias ?? []).length)} días</span>
        </div>
        <AulasRitmoDiario ritmo={(dashboard?.ritmo_diario ?? null) as RitmoDiario | null} />
      </section>
      )}
      {pestana !== "resumen" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Status de aplicación</h3>
          <span>{fmt(aulaRows.length)} cursos-horario</span>
        </div>
        {/* Los dos ejes van en paneles propios porque contestan preguntas
            distintas y cada superficie declara qué es (C1): éste dice en qué
            punto del circuito está cada aula —y cuántas ni se han agendado—, el
            de abajo cuánto lleva recogido cada una. Los dos van ANTES de la
            tabla: la tabla dice aula por aula y esto dice la forma del
            conjunto. */}
        <AulasEstadoChart filas={aulaRows as unknown as MonitoreoAulasPlanRow[]} />
      </section>
      )}
      {/* Los dos que se parecen, en pareja. Medido a 1440: cobertura ocupa 239 px
          de alto y «Dónde falta más» 206, cada uno solo en una caja de 1 316 de
          ancho, y la sección entera sumaba 1 636 px de columna para cuatro
          lecturas pequeñas. Eso es lo que se lee como «vacío y crudo»: no es
          relleno de más —el padding es el del sistema— sino cuatro gráficos
          cortos apilados sin usar el ancho. Son además la pareja natural: uno
          reparte los cursos-horario por cuánto cubren y el otro dice dónde
          falta. Bajo 1180 px vuelven a apilarse. */}
      {pestana !== "resumen" ? null : (
      <div
        className="aulas-avance-pareja"
        data-qa-geometry-group="monitoring-aulas-pareja"
        /* `intrinsic` y no `equal`, y la diferencia importa: son dos secciones
           INDEPENDIENTES —una reparte cursos-horario por cobertura y la otra
           dice dónde falta— que comparten fila por composición, no un par de
           variantes del mismo componente. Cuando comparten fila el grid las
           estira y salen idénticas (652×311 a 1440); cuando se apilan bajo
           1180 px cada una vuelve a su alto propio, y medí 307 contra 274. Con
           `equal` declarado esos 33 px serían un incumplimiento del contrato
           que yo mismo escribí de más, no un defecto. */
        data-qa-geometry-contract="intrinsic"
      >
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El nombre dice la unidad —lo que reparte son AULAS según cuánto
              cubren de su propia meta— y el de arriba mide la misma meta en
              respuestas. Primer intento fue «Cobertura por curso-horario» y el
              guard lo tumbó en el acto: terminaba igual que «Avance por
              curso-horario», la tabla del mismo stack. Cambiar un choque por
              otro no es renombrar. */}
          <h3>Cursos-horario por cobertura</h3>
          <span>{fmt(aulaRows.length)} cursos-horario</span>
        </div>
        <AulasCoberturaChart filas={aulaRows as unknown as MonitoreoAulasPlanRow[]} />
      </section>
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* La tercera pregunta de la sección, después del total y del estado:
              a dónde va el equipo mañana. El título es esa pregunta; «Por
              facultad» a secas no decía QUÉ por facultad y además terminaba
              igual que «Cuota sexo por facultad», que mide otra cosa en otra
              pestaña. El denominador es la meta del PLAN, no la cuota de sexo, y
              por eso el contador lo dice. */}
          <h3>Dónde falta más</h3>
          <span>contra la meta del plan</span>
        </div>
        <AulasPerfilPorFacultad filas={aulaRows as unknown as MonitoreoAulasPlanRow[]} />
      </section>
      </div>
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
        {/* El gráfico va antes que la tabla por la misma razón que en Resumen:
            contesta la pregunta del día siguiente —a dónde mando el equipo— que
            la tabla obliga a resolver restando de cabeza. */}
        <AulasBrechaEstratoChart filas={estratoRows as MonitoreoRow[]} />
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
          {/* En CELDAS, que es la unidad del cruce sexo × facultad y la que usa
              la lectura de abajo («5 de 12 celdas cumplidas»). «Filas» nombraba
              la tabla, que ahora puede ir filtrada. */}
          <span>{fmt(quotaRows.length)} celdas</span>
        </div>
        {/* La cuota del estudio en PERSONAS: «2/12 celdas» no distingue faltar
            una respuesta de faltar doscientas. Sólo el total y su lectura — los
            dos desagregados que había aquí decían lo mismo que la pirámide, y
            dos gráficos del mismo cruce le quitaban protagonismo al que sí
            contesta la pregunta. */}
        <AulasCuotasResumen filas={quotaRows as MonitoreoRow[]} />
        {/* Pirámide: una facultad por fila y un sexo a cada lado, cada uno
            contra SU propia meta. Se ve de qué lado va corta cada facultad, que
            es la pregunta con la que se sale a campo, y es además quien lleva el
            foco: elegir una facultad enfoca el detalle de abajo y el foco viaja
            en la URL (`?foco=facultad:Derecho`) para que la vista siga siendo
            enlazable.

            Recibe TODAS las filas, no las enfocadas: es el control, y filtrada
            se quedaría en una sola fila sin forma de elegir otra ni de soltar el
            foco. Quien se filtra es la tabla, que es el detalle. */}
        <AulasPiramideCuota filas={quotaRows as MonitoreoRow[]} foco={foco} onFoco={onFoco} />
        {/* La tabla filtrada lo dice: la cabecera del panel cuenta las 12 celdas
            del estudio y con un foco puesto abajo se ven dos. Un contador que no
            cuadra con lo que hay debajo es lo que llevo el día arreglando. */}
        {foco ? (
          <p className="mon-profile-muted">
            Detalle de <strong>{foco.valor}</strong> · {quotaEnFoco.length} de {quotaRows.length} celdas.
            Vuelve a pulsar su fila en la pirámide para ver todas.
          </p>
        ) : null}
        <DataTable rows={quotaEnFoco} empty="El plan no declara composición por sexo para estos cursos-horario." />
      </section>
      )}
    </div>
  );
}

export default function AulasMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [seccionActiva, setActiveView] = useState<MonitoreoSeccion>(() => seccionInicialMonitoreo("fuentes", AULAS_WORKBENCH_VIEWS));
  // Una pestaña activa POR SECCIÓN: volver a una sección la reencuentra donde
  // se dejó, en vez de reiniciarla.
  const [pestanaPorSeccion, setPestanaPorSeccion] = useState<Record<string, string>>(() => {
    const inicial = seccionInicialMonitoreo("fuentes", AULAS_WORKBENCH_VIEWS);
    const mapa: Record<string, string> = {};
    for (const def of AULAS_WORKBENCH_VIEWS) {
      const claves = pestanasDe(def.key).map((item) => item.key);
      if (!claves.length) continue;
      mapa[def.key] = pestanaInicialDeSeccion(def.key, inicial, claves[0], claves);
    }
    return mapa;
  });
  const pestanaActiva = pestanaPorSeccion[seccionActiva] ?? primeraPestana(seccionActiva);
  // El nombre de la pestaña activa, para el encabezado. Sale del mismo registro
  // que dibuja el rail, así que no puede desincronizarse con lo que se ve.
  const pestanaActivaLabel = pestanasDe(seccionActiva).find((p) => p.key === pestanaActiva)?.label ?? "";
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
  // Los AVISOS no son errores y por eso no comparten estado con ellos. Importar
  // un libro al que le falta una hoja es una importación que FUNCIONÓ, y decirlo
  // en rojo la lee como un fallo. Además `loadView` limpia `error` cuando la
  // recarga sale bien —así que el aviso duraba lo que tardaba la petición
  // siguiente, que es la que el propio import dispara—.
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  const activeDef = useMemo(
    () => AULAS_WORKBENCH_VIEWS.find((item) => item.key === seccionActiva) ?? AULAS_WORKBENCH_VIEWS[0],
    [seccionActiva],
  );
  const dashboard = dashboardFromState(state);
  // El foco de cuotas vive en la URL, como el resto de la dirección: así la
  // vista sigue siendo enlazable y el botón Atrás la deshace.
  //
  // Lo lee y lo escribe `useFocoMonitoreo`, no la página. Hacerlo aquí con
  // `useSearchParams` convertía a este archivo en el séptimo lector de la
  // dirección a mano, y el contrato de `lectoresDeDireccion` sólo tolera los
  // seis heredados —lo detectó su test, que llevaba rojo desde que el foco pasó
  // a la URL—.
  const [focoTexto, escribirFoco] = useFocoMonitoreo();
  const foco = focoDesdeTexto(focoTexto);
  const cambiarFoco = useCallback(
    (siguiente: FocoDeCuota) => escribirFoco(textoDesdeFoco(siguiente) || null),
    [escribirFoco],
  );
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

  /**
   * Relee el estado del proyecto.
   *
   * `silencioso` NO toca `loading`, y eso no es un detalle de parpadeo: la vista
   * se pinta como `{loading ? <EmptyPanel/> : <RegistroDeCampo/>}`, así que
   * cualquier recarga DESMONTA el registro de campo y se lleva por delante su
   * estado —la selección, el formulario y el mensaje de la acción que acaba de
   * ocurrir—. Medido: al activar un reemplazo, el motor devuelve «CH 3 pasa a
   * reemplazada y entra R 3.1 en su lugar. Quedan 1 reservas en la cadena» y
   * quien pulsó el botón no lo llegaba a leer nunca: la respuesta llegaba y el
   * componente se desmontaba en el mismo tic. Se refresca en silencio, llegan
   * los datos nuevos por props y lo que la acción dijo sigue en pantalla.
   */
  const loadView = useCallback(async (view: MonitoreoSeccion, force = false, silencioso = false) => {
    if (!silencioso) setLoading(true);
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
      if (!silencioso) setLoading(false);
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
    setAviso("");
    try {
      // Dos pasos a propósito. Mandar el xlsx directo a `importar-libro`
      // no funciona: con `parsers = multi` el archivo llega pero plumber
      // muere parseando el xlsx de dentro, y con `octet` deja de llegar.
      // `/api/files/upload` ya sabe guardar binarios y devuelve el `file_id`
      // que el endpoint acepta desde el primer día.
      const subido = await apiUpload(archivo, "aulas_libro");
      const res = await apiMonitoreoAulasImportarLibro({ file_id: subido.file_id });
      setState(res.state);
      // Lo que NO venía se dice, en vez de mostrar ceros silenciosos.
      if (res.hojas_ausentes?.length) {
        // Y dice dónde queda escrito: la tarjeta del libro en Fuentes lo
        // conserva, así que el aviso no es el único registro de que faltó algo.
        setAviso(`El libro no traía ${res.hojas_ausentes.join(" ni ")}. Lo demás se leyó; queda anotado en Fuentes.`);
      }
      await loadView(seccionActiva, true, true);
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

      {/* Las pestañas viven en el RAIL lateral con íconos, no en píldoras
          arriba: es el patrón de telefónico y acreditación y criterio de toda la
          app. Aulas tenía la gramática correcta —módulo → modo → sección →
          pestaña— con el patrón visual equivocado. Los rótulos y los íconos
          salen del catálogo de navegación; el rail sólo añade contador y estado.

          El chrome compartido es quien coloca el rail a la izquierda: con un
          `<main>` propio el rail caía como columna encima del contenido. Se le
          pasan las clases de aulas (`mainClassName`/`contentClassName`) para no
          perder la hoja del perfil, que gobierna stacks, tablas y gráficos. */}
      <MonitoreoWorkbenchChrome
        seccionActiva={seccionActiva}
        ariaLabel={`Mesa de trabajo de cursos-horario: ${activeDef.label}`}
        className="is-aulas"
        mainClassName="mon-profile-workbench"
        contentClassName={`mon-profile-content${seccionActiva === "fuentes" ? " has-aulas-flow" : ""}`}
        contentRole="tabpanel"
        contentAriaLabelledBy={`monitoreo-${seccionActiva}-tab-${pestanaActiva}`}
        scrollResetKey={`${seccionActiva}/${pestanaActiva}`}
        head={
          /* Aulas era el ÚNICO de los cuatro perfiles con `head={null}`, y el
            componente existe justo para lo que a aulas le faltaba: su propio
            comentario lo dice —«el rail es icon-only y su cuadrante no lleva
            rótulo, así que el nombre de dónde estás vive acá»—. Medido en
            Avance > Resumen: el rail tiene cuatro botones, el activo no lleva
            texto ni `title`, y la palabra «Resumen» no aparecía en ninguna
            parte de la pantalla. Se estaba en una pestaña y nada decía cuál.

            Sin `pills`: la franja de arriba ya lleva estado, registros y corte,
             y repetirlos aquí sería decir dos veces lo mismo a dos dedos. Y sin
             `detail`: con la descripción de la sección el encabezado medía
             177 px, y esa frase ya la dice el rail al pasar por su icono. Lo
             que aquí no estaba en ninguna parte es el nombre de la pestaña. */
          (
          <MonitoreoWorkbenchHead
            icon={activeDef.icon}
            eyebrow="Cursos-horario"
            title={activeDef.label}
            detail={activeDef.desc}
            pestanaLabel={pestanaActivaLabel}
          />
          )
        }
        rail={(
          <MonitoreoWorkbenchRail
          pestanaActiva={pestanaActiva}
          activeSection={{ label: activeDef.label, desc: activeDef.desc ?? "Vista operativa", icon: activeDef.icon }}
          seccionActiva={seccionActiva}
          ariaLabel={`Mesa de trabajo de cursos-horario: ${activeDef.label}`}
          className="is-aulas"
          emptyDetail={activeDef.desc ?? "Vista operativa"}
          iconOnlyTabs
          localTabs={railDeAulas(seccionActiva, dashboard)}
          modeCountLabel={contar(pestanasDe(seccionActiva).length || 1, "pestaña", "pestañas")}
          routeLabel="Cursos-horario"
          routeSectionLabel="Cursos-horario · sección"
          routeShortLabel="Cursos-horario"
          statusAriaLabel="Última actualización del monitoreo"
          statusItems={[{
            label: "Última actualización",
            value: state?.synced_at || "Sin actualización",
            ready: Boolean(state?.synced_at),
          }]}
          onCambioPestana={(key) => elegirPestana(seccionActiva, key)}
        />
        )}
      >

          <AulasKpiBand dashboard={dashboard} seccion={seccionActiva} />
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
            {/* Fuera del `{loading ? …}` de abajo: un aviso sobre lo que acaba
                de pasar no puede vivir dentro de lo que la acción remonta. */}
            {aviso ? <div className="aulas-aviso"><Info size={16} /> {aviso}</div> : null}
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
                // Silencioso: el workbench acaba de escribir «N pestañas
                // actualizadas» con el id del spreadsheet, y una recarga que
                // encienda `loading` lo desmonta con su mensaje dentro. Publicar
                // a Sheets sin confirmación es peor que no confirmarlo: el id es
                // lo único que dice DÓNDE quedó publicado.
                onPublished={() => { void loadView(seccionActiva, true, true); }}
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
                // Del TABLERO, no de la config: el plan dejo de viajar ahi y
                // `agenda` es un superconjunto suyo —mismos campos mas
                // `respuestas_validas` y `brecha`— que ademas se reconstruye en
                // cada peticion, tambien antes de la primera respuesta.
                agenda={(dashboard?.agenda ?? []) as MonitoreoAulasPlanRow[]}
                onGuardado={() => { void loadView(seccionActiva, true, true); }}
              />,
              state?.sources ?? [],
              pestanaActiva,
              foco,
              cambiarFoco,
              {
                filas: Number(state?.n_rows ?? 0) || undefined,
                columnas: (state?.variables ?? []).length || undefined,
              },
            )}
          </div>
      </MonitoreoWorkbenchChrome>
    </div>
  );
}
