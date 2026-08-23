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
  apiMonitoreoAulasConfig,
  apiMonitoreoAulasSync,
  apiMonitoreoState,
  type MonitoreoAulasConfig,
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
import { AulasAlcanceDelBanco } from "./AulasAlcanceDelBanco";
import { COLUMNAS_DE_ESTADO, EstadoEnCelda } from "./EstadoEnCelda";
import { AulasConcentracionBrecha } from "./AulasConcentracionBrecha";
import { AulasCambioDeAula } from "./AulasCambioDeAula";
import { AulasEmbudoDelAula } from "./AulasEmbudoDelAula";
import { columnasConDato } from "./columnasConDato";
import { AulasAvanceEnRespuestas } from "./AulasAvanceEnRespuestas";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { AulasColaDeContacto } from "./AulasColaDeContacto";
import { AulasMedioDeContacto } from "./AulasMedioDeContacto";
import { AulasAgendaPorFacultad } from "./AulasAgendaPorFacultad";
import { AulasCadenaChart } from "./AulasCadenaChart";
import { AulasFrenteDelOperativo } from "./AulasFrenteDelOperativo";
import { AulasColchonPorFacultad } from "./AulasColchonPorFacultad";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasPronosticoDeCierre } from "./AulasPronosticoDeCierre";
import { AulasRitmoPorFacultad } from "./AulasRitmoPorFacultad";
import { AulasRendimientoPorFacultad } from "./AulasRendimientoPorFacultad";
import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import { AulasSerieDeRendimiento } from "./AulasSerieDeRendimiento";
import { AulasPerfilPorFacultad } from "./AulasPerfilPorFacultad";
import { AulasControles } from "./AulasControles";
import { AulasControlDelLibro, columnasDelControl, type ResumenDeControl } from "./AulasControlDelLibro";
import { avisoLibroGenerado } from "./avisoLibroGenerado";
import { avisoLibroImportado, type TonoAviso } from "./avisoLibroImportado";
import { AulasOrigenDesfasado } from "./AulasOrigenDesfasado";
import { columnasDeLaTabla } from "./columnasDeLaTabla";
import { AulasCriterioDeAula } from "./AulasCriterioDeAula";
import { AulasObservacionesDeCampo } from "./AulasObservacionesDeCampo";
import { AulasTrabajoDeLosEquipos } from "./AulasTrabajoDeLosEquipos";
import { AulasParteContraPlataforma } from "./AulasParteContraPlataforma";
import { AulasCadenaDeFiltros } from "./AulasCadenaDeFiltros";
import { AulasFichaDeAula } from "./AulasFichaDeAula";
import { dondeSeSaca } from "./dondeSeSaca";
import { fichaDeAula } from "./fichaDeAula";
import { AulasTextoAbierto } from "./AulasTextoAbierto";
import { AulasTiemposDeRespuesta } from "./AulasTiemposDeRespuesta";
import { AulasLoQueFalta } from "./AulasLoQueFalta";
import { AulasFiltrosDeEfectiva, type FiltroDeEfectiva } from "./AulasFiltrosDeEfectiva";
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
import { ordenarPorCadenaOperativa } from "../../../../lib/cadenaOperativa";
import { embudoDelOperativo } from "./embudoDelOperativo";
// Deuda declarada: `FlujoVertical` vive en `features/calcMuestra/universidad/ui/`
// y es genérico —etapas con valor, detalle, estado y merma—. Importarlo entre
// features es un olor; moverlo a `components/` tocaría muchos imports de otra
// feature a la vez. Se reutiliza aquí y el traslado queda anotado.
import { FlujoVertical } from "../../../calcMuestra/universidad/ui/FlujoVertical";
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
/**
 * Campos que identifican un registro pero no le dicen nada a quien opera.
 *
 * Gonzalo: «usa estos códigos internos y no se ve nada amigable».
 *
 * La tabla pone delante las columnas preferidas y **rellena el resto con lo que
 * traiga el payload, en su orden**. En Agenda las preferidas son el ciclo de
 * contacto —a quién llamo, por qué medio, cuándo, cuántas veces—, que está vacío
 * hasta que el equipo sale a campo; al no tener dato desaparecen, y el hueco se
 * llenaba con `sel_aulas_20260822204345_bf10d14c`, `slot_001` y la secuencia
 * operativa. Es decir: **cuanto menos trabajo de campo hay, más metadatos
 * enseña la tabla**.
 *
 * Se excluyen sólo los que no aportan en ninguna lectura. `titular_operational_
 * code` y `replacement_chain_code` NO están aquí: «CH 1» y «R 1.2» son
 * legibles y dicen de qué cadena es la fila.
 */
const COLUMNAS_DE_INFRAESTRUCTURA = new Set([
  // El sello de la corrida ya vive en la cabecera del módulo y en Fuentes.
  "selection_run_id", "run_id", "frame_hash",
  // Ranuras e índices internos del sorteo: «slot_001» no es una posición que
  // alguien use, es cómo se numeran las plazas por dentro.
  "selection_slot_id", "slot_id", "operational_sequence", "orden", "order",
  // Identificadores técnicos con su equivalente legible ya en la tabla:
  // `operational_code` es «CH 1» y `course_name` el nombre del curso.
  "classroom_id", "course_id", "unit_id",
]);

function compactColumns(
  rows: Array<Record<string, unknown>>,
  preferred: string[] = [],
  maxColumns = 8,
) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key
      && !key.startsWith("_")
      // Una preferida declarada explícitamente gana: si una tabla pide ver la
      // corrida, la enseña. Lo que se evita es que aparezca de relleno.
      && (preferred.includes(key) || !COLUMNAS_DE_INFRAESTRUCTURA.has(key))
      && !seen.has(key) && (seen.add(key), true));
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

function AulasKpiBand({ dashboard, seccion, pestana }: {
  dashboard: MonitoreoAulasDashboard | null;
  seccion: MonitoreoSeccion;
  pestana: string;
}) {
  const kpis = aulasKpis(dashboard, seccion, pestana);
  // Sin tiles no hay banda: pintarla vacía dejaría 111 px de marco sin nada
  // dentro, que es peor que la repetición que se viene a quitar.
  if (!kpis.length) return null;
  return (
    <div
      className="aulas-kpi-band"
      role="group"
      aria-label="Indicadores de cursos-horario"
      data-qa-geometry-group="monitoring-aulas-kpis"
      data-qa-geometry-contract="equal"
    >
      {kpis.map((kpi) => {
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
                  {/* Un estado se pinta como chip de color; el resto, texto.
                      Los colores son los de la franja por día: la misma aula
                      tiene que verse igual en su barra y en su fila. */}
                  {COLUMNAS_DE_ESTADO.has(column)
                    ? <EstadoEnCelda valor={String(row[column] ?? "")} />
                    : String(row[column] ?? "")}
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

/**
 * Las filas de la AGENDA: el plan sin el banco.
 *
 * Las aulas extra no cuelgan de ningún titular, no tienen fecha y no están
 * agendadas —son respaldo del estrato para cerrar la cuota, y tienen su propia
 * pestaña—. Metidas aquí añadían 40 filas sin fecha a una tabla de 196 que sí
 * importan, y hacían que el panel dijera «236 cursos-horario» dos dedos debajo
 * de un KPI que decía 196: la misma palabra con dos cifras.
 */
/**
 * Las reservas que hay detrás de la agenda, para poder decir cuántas son.
 *
 * No se listan: la agenda es la vista del agendador, que llama TITULAR por
 * titular. Una reserva es un plan B que sólo entra en juego el día que su
 * titular se declara caída — enseñárselas mezcladas le multiplica la lista por
 * 3,6 y le dice que hay 700 aulas que atender donde hay 193.
 */
function agendaReservas(dashboard: MonitoreoAulasDashboard | null) {
  return ((dashboard?.agenda ?? []) as unknown as Array<Record<string, unknown>>)
    .filter((fila) => String(fila.sample_role ?? "") === "chain_reserve").length;
}

function agendaRows(dashboard: MonitoreoAulasDashboard | null) {
  const filas = ((dashboard?.agenda ?? []) as unknown as Array<Record<string, unknown>>)
    .filter((fila) => {
      const rol = String(fila.sample_role ?? "");
      // Ni el banco —capacidad, no visitas— ni las reservas de cadena. Ver
      // `agendaReservas` y `docs/qa/roles-del-operativo-de-aulas-2026-08-22.md`.
      return rol !== "extra_reserve_pool" && rol !== "chain_reserve";
    });
  // En el orden en que se recorre el operativo: cada titular con sus reservas
  // detrás. La tabla las enseñaba en el orden crudo del plan, que agrupa por rol
  // —todos los titulares y después todas las reservas—, así que la cadena, que
  // es la unidad con la que se decide cuando un aula cae, no se veía.
  //
  // Misma regla que la tabla del plan de Recopiladores, y por eso vive en
  // `lib/cadenaOperativa` y no aquí.
  return ordenarPorCadenaOperativa(filas, (fila) => ({
    rol: String(fila.sample_role ?? ""),
    secuencia: fila.operational_sequence,
    orden: fila.replacement_order,
    codigo: String(fila.operational_code ?? ""),
    reemplazaA: String(fila.titular_operational_code ?? fila.replacement_for ?? ""),
  }));
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
      // Sin grupo en el `section`. Lo tenía —«monitoring-aulas-handoff-panel»,
      // intrinsic— y con él la CABECERA entraba como miembro, así que sus 5 px
      // de holgura se leían como `capacity-drift` del panel. Es exactamente la
      // trampa que la norma describe: declarar el grupo en el `section` en vez
      // del wrapper de datos hace que el padding del encabezado se lea como
      // capacidad inflada. El contenedor de datos —la rejilla de tarjetas— ya
      // declara su propio grupo `equal` justo debajo, que es lo que hay que
      // vigilar aquí.
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
        // C1: la rejilla es el contenedor visible de datos y la dueña de su
        // espacio interior.
        data-qa-geometry-capacity="owned"
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

/**
 * Días de campo transcurridos: los días DISTINTOS con parte de campo.
 *
 * Es el denominador del ritmo de caídas —una caída puede ocurrir cualquier día
 * que el operativo salga— y no debe confundirse con los días con respuestas,
 * que en este corte son 24 porque las aulas ya agendadas traen las suyas.
 *
 * Función suelta y no `useMemo`: `renderAulasView` no es un componente y tiene
 * returns tempranos, así que un hook ahí se ejecuta o no según la sección y
 * React lo rechaza con «rendered more hooks than during the previous render».
 * Lo aprendí metiéndolo dentro y viendo la pantalla caerse al error boundary.
 */
function diasDeCampoDelCorte(partes: ReadonlyArray<MonitoreoRow>): number {
  const dias = new Set<string>();
  for (const p of partes) {
    const m = String(p.applied_at ?? p.applied_date ?? "").match(/\d{4}-\d{2}-\d{2}/);
    if (m) dias.add(m[0]);
  }
  return dias.size;
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
  /**
   * Qué cuenta como encuesta EFECTIVA en este estudio, ya construido.
   *
   * Se pasa hecho, como `operations`: esta función no ve el estado ni sabe
   * guardar, y el panel necesita las variables de la base y el escritor de la
   * config. Gonzalo: «la sección de fuentes no deja declarar las variables que
   * definen a una encuesta efectiva».
   */
  criterioDeEfectiva: ReactNode = null,
  /**
   * La declaración de qué es un aula válida, ya construida.
   *
   * Se pasa hecha —como `criterioDeEfectiva`— porque esta función no ve el
   * estado ni sabe guardar, y el control necesita las dos cosas.
   */
  criterioDeAula: ReactNode = null,
  /**
   * Cambia de pestaña dentro de la misma sección.
   *
   * Lo necesita la ficha del aula para llevar al registro de campo, que es
   * donde vive la única acción que activa un reemplazo: la ficha dice lo que
   * pasó con el aula y la acción está una pestaña más allá. Se pasa como
   * función y no se resuelve aquí porque quien recuerda la pestaña activa de
   * cada sección es el componente de arriba.
   */
  irAPestana: ((clave: string) => void) | null = null,
) {
  // **El foco cruza la sección entera.** Es una dimensión declarada de la
  // gramática de navegación, viaja en la URL y lo obedecía UNA sola superficie
  // —la tabla de cuotas— teniendo el perfil SEIS listas de las mismas veinte
  // facultades. Para saber cómo va Derecho había que cazar su fila seis veces.
  const facultadEnFoco = foco?.tipo === "facultad" ? foco.valor : undefined;

  if (view === "fuentes") {
    // Las operaciones (importar plan / sincronizar campo) se muestran incluso
    // sin dashboard: importar el plan es justamente la acción de arranque.
    const embudo = embudoDelOperativo(dashboard?.kpis);
    return (
      <div className="mon-profile-stack aulas-fuentes-stack">
        {operations}
        {/* **El recorrido, con su merma en cada paso.** Es el patrón 4 del
            catálogo: Cálculo tiene un mapa que va de las filas leídas a los
            titulares y contesta «¿de dónde salió este número?» sin salir de la
            pantalla; Monitoreo enseñaba KPIs sueltos sin decir cómo se encadenan.
            Ver docs/qa/roles-del-operativo-de-aulas-2026-08-22.md.
            Vacío cuando no hay plan: el embudo de ceros no explica nada. */}
        {embudo.length ? (
          <section
            className="mon-profile-panel aulas-embudo-panel"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Del plan a las encuestas que cuentan</h3>
              <span>dónde está cada curso-horario ahora mismo</span>
            </div>
            <div data-qa-geometry-capacity="owned">
              <FlujoVertical
                etapas={embudo}
                orientacion="horizontal"
                ariaLabel="Recorrido del operativo: del plan a las encuestas válidas"
              />
            </div>
          </section>
        ) : null}
        <section
          className="mon-profile-panel"
          // Sin grupo en el `section`: con él, la CABECERA entra como miembro y sus
          // 5 px de holgura se leen como `capacity-drift` del panel. Es la trampa
          // que la norma describe —declarar el grupo en el `section` en vez del
          // wrapper de datos hace que el padding del encabezado se lea como
          // capacidad inflada— y salía igual en cinco paneles del perfil. Lo que hay
          // que vigilar es el contenedor de datos, que declara lo suyo más abajo.
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
        {/* **Qué cuenta como efectiva**, aquí y no en otra sección: Fuentes es la
            que promete decir de dónde salen las respuestas, y de qué vale cada
            una es parte de eso. Hasta ahora no se podía declarar en aulas —los
            perfiles hermanos sí— y el motor sólo admitía una condición. */}
        {criterioDeEfectiva ? (
          <section className="mon-profile-panel" data-qa-geometry-contract="intrinsic">
            <div className="mon-profile-panel-head">
              <h3>Qué cuenta como encuesta efectiva</h3>
              <span className="mon-profile-panel-hint">
                hasta cuatro condiciones, y se cumplen todas
              </span>
            </div>
            {criterioDeEfectiva}
          </section>
        ) : null}
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
      // El reparto es POSITIVO —«¿es esta pestaña?»— desde que son tres. Con dos
      // bastaba negar la otra; al llegar la tercera, «no es registro» incluye
      // «por facultad» y la agenda se pintaba también ahí. Es literalmente el
      // mismo tropiezo que ya costó el reparto de Consultas al llegar su cuarta
      // pestaña, y por eso acá se escribe positivo desde el principio.
      <div className={`mon-profile-stack aulas-agenda-stack${
        pestana === "facultad" ? " is-ruta" : ""}`}>
        {/* La preparación NO entra en «Por facultad». A 1366x768 la sección
            entera dispone de 367 px y ese panel se lleva 158: a la ruta le
            quedaban 198, o sea una ventana de 104 px para 5 538 de contenido
            —el «scroll interno muy agresivo» que ya costó una queja en la
            agenda—. Sin él, la ruta se queda con los 367. No se pierde nada:
            el mismo panel está en las otras dos pestañas de la sección, a un
            click. */}
        {/* La preparación NO entra en «Por facultad» ni en «Contacto». En las
            dos la sección dispone de 367 px a 1366x768 y ese panel se lleva
            159: en la ruta dejaba la lista en 104 px y en Contacto ahogaba el
            bloque de medios. Y en ninguna de las dos aporta —una dice a dónde
            ir y la otra a quién llamar—; el mismo panel sigue en la pestaña
            Agenda, a un click. */}
        {pestana === "facultad" || pestana === "contacto"
          ? null
          : <HandoffTracePanel dashboard={dashboard} />}
        {pestana === "contacto" ? (
        <section
          // Clase propia: el stack de Agenda reparte el alto entre DOS filas con
          // `height: 100%`, y esta pestaña mete dos paneles en uno. Sin ella, a
          // 1024x600 la seccion quedaba en 54 px, el bloque de medios en CERO y
          // 421 px de contenido desbordaban SIN NINGUN dueño de scroll —medido—.
          // El gate no lo vio: da ok=true porque no hay grupo declarado que se
          // viole ni dueño que auditar. Un contenido que desborda sin dueño es
          // invisible para el.
          className="mon-profile-panel aulas-contacto-panel"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* El título cubre las DOS cosas que hay dentro. Decía «Qué medio
                agenda mejor», que es sólo la primera: quien buscara «a quién
                llamo hoy» no lo encontraba ahí, y la superficie no declaraba lo
                que contiene (C1). Cada bloque lleva ahora su propio rótulo. */}
            <h3>Cómo se consigue la cita</h3>
            <span>el medio y la cola de contacto</span>
          </div>
          {/* Los dos dentro de UN dueño de scroll, no cada uno con el suyo: la
              pantalla tiene que tener un solo recorrido. */}
          <div className="aulas-contacto-cuerpo">
            <AulasMedioDeContacto filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]} />
            {/* Y a quién toca llamar. Los dos contestan «cómo consigo la cita»,
                por eso comparten pestaña; el medio dice con qué y la cola con
                quién. */}
            <AulasColaDeContacto
              filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]}
              facultadEnFoco={facultadEnFoco}
              onFoco={onFoco}
            />
          </div>
        </section>
        ) : null}
        {pestana === "facultad" ? (
        <section
          // `mon-profile-panel` a secas y NO `aulas-agenda-panel`: aquella clase
          // tiene su grid afinado a TRES hijos —cabecera, banda de días y
          // tabla— y este panel tiene dos. Reusándola, la lista recibía la fila
          // del medio —118 px para 5 538 de contenido, cuatro filas visibles— y
          // quedaban 223 px muertos debajo. Medido antes de cambiarla.
          className="mon-profile-panel aulas-ruta-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* «Ruta por facultad» terminaba igual que «Cuota sexo por
                facultad» y el guard de títulos lo tumbó. El nombre dice ahora lo
                que la vista CONTESTA —a dónde hay que ir cada día—; que sea por
                facultad ya lo dice la pestaña. */}
            <h3>A dónde ir cada día</h3>
            {/* La MISMA fuente que la tabla de la pestaña de al lado: si cada
                una sacara sus filas por su cuenta, las dos vistas de la misma
                agenda podrían enseñar cuentas distintas. */}
            <span>{(() => {
              const n = agendaRows(dashboard).length;
              return n ? `${n.toLocaleString("es-PE")} cursos-horario` : "sin agenda";
            })()}</span>
          </div>
          <AulasAgendaPorFacultad filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]} />
        </section>
        ) : null}
        {pestana === "agenda"
          || (pestana !== "facultad" && pestana !== "contacto") ? (
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
            {/* Cuenta lo que la tabla ENSEÑA, no lo que trae el payload. Y las
                reservas se declaran al lado en vez de listarse: existen, pero no
                son trabajo del agendador hasta que una titular se cae. */}
            <span>
              {fmt(agendaRows(dashboard).length)} cursos-horario
              {agendaReservas(dashboard)
                ? ` · ${fmt(agendaReservas(dashboard))} reservas detrás`
                : ""}
            </span>
          </div>
          {/* Primero cuándo se aplica cada cosa —que es lo que se pregunta al
              entrar a Agenda— y después la tabla, que es donde se busca un
              curso-horario concreto. La tabla NO se va: en esta sección sirve. */}
          {/* Sin el banco, por lo mismo: un aula sin fecha no tiene día en el
              que contarse, y las 40 caían en el tramo «sin fecha». */}
          <AulasAgendaPorDia
            filas={((dashboard.course_status ?? []) as MonitoreoAulasPlanRow[])
              .filter((f) => String((f as { sample_role?: unknown }).sample_role ?? "") !== "extra_reserve_pool")}
            // El plan de verdad, no lo que cupo en el payload: `course_status`
            // llega topeado a 500 filas y contar las recibidas hacía decir
            // «ninguno de los 42» sobre un plan de 686.
            totalDelPlan={Number(dashboard.course_status_total_plan ?? 0) || 0}
          />
          <DataTable
            rows={agendaRows(dashboard)}
            empty="No hay agenda importada para cursos-horario."
            // El rol y a quién reemplaza van delante de la sección y el
            // responsable: con una cadena de seis, las siete filas del mismo
            // titular sólo se distinguían por su código. La tabla recorta a
            // ocho columnas y lo declara, así que el orden decide qué se ve.
            // La AGENDA enseña lo que la agenda recoge. Medido: la hoja «Aulas
            // Agendadas» trae 20 campos por eslabón —el ciclo de contacto
            // entero: a quién se llama, por qué medio, qué día, cuántos
            // intentos, en qué quedó y para cuándo— y la tabla no mostraba NI
            // UNO: enseñaba curso, facultad, rol, a quién reemplaza, sesiones,
            // nombre del curso, horario, ficha y estado de ficha. Todo eso se
            // puede mirar en otras superficies; el ciclo de contacto sólo vive
            // aquí. El orden es el de quien agenda: a quién llamo, cómo, cuándo
            // llamé, cuántas veces, en qué quedó, para cuándo quedó.
            maxColumns={12}
            preferredColumns={["operational_code", "faculty", "teacher", "teacher_phone", "contact_medium", "contact_date", "contact_attempts", "sample_status", "scheduled_date", "scheduled_time", "link", "label"]}
          />
        </section>
        ) : null}
      </div>
    );
  }
  if (view === "calidad") {
    // **El registro de campo abre Validación.**
    //
    // Estaba en «Agenda de cursos-horario», que es otro trabajo: agendar es
    // conseguir la cita y el control de campo empieza cuando se sale. Y va
    // primero porque esta sección la usan dos personas —el jefe de campo, que
    // entra por lo que pasó en el aula, y el analista, que entra por los
    // controles— y lo que se registra viene antes de lo que se valida.
    if (pestana === "abiertas") {
      return (
        <div className="mon-profile-stack aulas-tablas-apiladas">
        {/* **La calidad de lo que se escribió a mano.** Capacidad que no
            existía en ningún perfil de Monitoreo. Es un visualizador: ordena
            por dónde empezar a leer y no esconde respuestas. Como el de
            tiempos, se muestra aunque este estudio no traiga instrumento.
            Tiene pestaña propia —«Respuestas abiertas»— porque leerlas es un
            trabajo entero y no algo que se mire de paso entre otros seis
            paneles. */}
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Lo que se escribió a mano</h3>
            <span>calidad de las respuestas abiertas</span>
          </div>
          <AulasTextoAbierto bloque={dashboard.texto_abierto} />
        </section>
        </div>
      );
    }
    if (pestana === "registro") {
      return (
        <div className="mon-profile-stack">
          {registro}
          {/* **Lo que el campo reportó, que hasta hoy no se leía en ninguna
              pantalla.** `field_note` tenía formulario de entrada y cero
              superficies de lectura: el aplicador anotaba lo que vio en el aula
              y eso no llegaba a nadie. Va aquí, debajo del registro, porque es
              la misma pestaña y la misma persona: quien registra y quien lee lo
              registrado son el jefe de campo. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Lo que reportó el campo</h3>
              <span>observaciones de los partes</span>
            </div>
            <AulasObservacionesDeCampo
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
            />
          </section>
          {/* **Cómo trabaja cada equipo, en Validación y no enterrado en
              Avance.** Es lo que el jefe de campo viene a ver, y existía sólo
              como el cuarto de nueve paneles de otra sección midiendo encuestas
              por aula. Aquí va con su banda: se está juzgando el trabajo de
              personas y una diferencia de cinco encuestas entre el primero y el
              último cabe entera en el ruido. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Cómo trabaja cada equipo</h3>
              <span>producción y calidad por aplicador</span>
            </div>
            <AulasTrabajoDeLosEquipos
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
            />
          </section>
          {/* La pregunta del analista: ¿lo de plataforma coincide con lo que se
              vio en el aula? Va en la misma pestaña que el registro porque es el
              contraste de lo que ahí se anota. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>El parte contra la plataforma</h3>
              <span>lo declarado y lo que llegó</span>
            </div>
            <AulasParteContraPlataforma
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
              agenda={(dashboard.agenda ?? []) as Array<Record<string, unknown>>}
            />
          </section>
          {/* **El control de tiempos, que el Excel anterior tenía y la app no.**
              Va en Validación porque es pregunta del analista, y se muestra
              aunque este estudio no traiga marcas de tiempo: el panel dice que
              faltan. Un panel que desaparece cuando no hay dato deja al usuario
              sin saber que el dato existe. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Cuánto se tarda en responder</h3>
              <span>duración por respuesta y por aula</span>
            </div>
            <AulasTiemposDeRespuesta tiempos={dashboard.tiempos} />
          </section>

          {/* **Qué descarta cada filtro.** Con sólo el total de válidas no se
              puede saber si el criterio trabaja: un filtro que acepta todos los
              valores da el mismo número que no tener filtro. Va en Validación
              porque es la pregunta del analista sobre su propio criterio. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Qué descarta cada filtro</h3>
              <span>la cadena de validez, paso a paso</span>
            </div>
            <AulasCadenaDeFiltros bloque={dashboard.cadena_filtros} />
          </section>
        </div>
      );
    }
    const rows = (dashboard.validation ?? []) as Array<Record<string, unknown>>;
    const summary = summarizeAulasValidation(rows);
    const control = (dashboard.control_calidad ?? []) as Array<Record<string, unknown>>;
    const controlResumen = (dashboard.control_calidad_resumen ?? null) as ResumenDeControl | null;
    // Cada pestaña muestra SU panel, y el reparto es POSITIVO —«¿es ésta?»— y no
    // por negación de la otra: con dos bastaría negar, pero en Consultas la
    // negación ya falló al llegar la cuarta y no hay razón para repetirla acá.
    const enBase = pestana === "base";
    return (
      <div className="mon-profile-stack aulas-tablas-apiladas">
      {/* **La ficha del aula en foco.** Va primero porque quien la abrió
          viene a verla, y se gobierna con `foco=aula:<codigo>`, igual que el
          detalle de facultad de esta misma sección. Cerrarla limpia el foco
          y la sección vuelve a su lectura completa. */}
      {foco?.tipo === "aula" ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Ficha del curso-horario</h3>
          <span>lo esperado, lo conseguido y lo que anotó el campo</span>
        </div>
        <AulasFichaDeAula
          codigo={foco.valor}
          fuentes={{
            agenda: (dashboard.agenda ?? []) as Array<Record<string, unknown>>,
            partes: (dashboard.partes_campo ?? []) as Array<Record<string, unknown>>,
            control: (dashboard.control_calidad ?? []) as Array<Record<string, unknown>>,
            brechas: (dashboard.brechas ?? []) as Array<Record<string, unknown>>,
          }}
          onCerrar={() => onFoco(null)}
          // El foco viaja en la URL, así que el registro se abre ya sobre esta
          // aula: `codigoEnFoco` lo recoge del mismo `foco=aula:<codigo>`.
          onRegistrar={irAPestana ? () => irAPestana("registro") : undefined}
        />
      </section>
      ) : null}
      {enBase ? null : (
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
        <AulasControles filas={rows} plan={(dashboard.agenda ?? []) as Array<Record<string, unknown>>} />
      </section>
      )}
      {/* La tercera hoja del operativo. Los dos paneles son control de calidad y
          por eso comparten sección, pero no son la misma medida: arriba lo que
          deriva el motor, aquí lo que el equipo calcula en su Excel. Separarlos
          evita que una fila parezca respaldar a la otra, y ahora además cada uno
          recibe la vista entera en vez de competir por el alto. */}
      {enBase ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El nombre de la hoja, tal cual, porque es a lo que el equipo va a
              buscarlo en su libro. */}
          <h3>Base de control</h3>
          {/* «filas de la hoja» y no «aulas»: son las que trae el libro que llena
              el equipo, y no tienen por qué ser las del plan —aquí 210 contra
              196—. Llamarlas «aulas» ponía dos cifras con el mismo nombre en un
              perfil cuya unidad es el curso-horario. El recibo del libro ya usa
              este mismo lenguaje: «210 filas de control». */}
          {/* Y cuantas columnas: en 1440 solo caben nueve, asi que dos tercios
              de la tabla viven a la derecha del borde. La sombra de
              desplazamiento ensena que hay mas; el numero dice cuanto mas.
              «en la tabla» y no «columnas» a secas: pegado a «filas de la
              hoja», se leia como el ancho de la HOJA, que son 39. */}
          <span>
            {control.length
              ? `${contar(control.length, "fila de la hoja", "filas de la hoja")} · ${columnasDeLaTabla(controlResumen)}`
              : "Sin datos"}
          </span>
        </div>
        {/* La vara, junto al veredicto que produce. Declararla en una pantalla
            de ajustes la dejaría lejos de su resultado, que es lo que hacía que
            nadie supiera cuál era. */}
        {criterioDeAula}
        <AulasControlDelLibro
          filas={control}
          resumen={controlResumen}
          criterio={(dashboard.criterio_validez ?? null) as never}
        />
      </section>
      ) : null}
      {/* El precio de cerrar lo que no llegó. Va DESPUÉS de la tabla del libro
          —el veredicto primero, la cola de trabajo después— y en la misma
          pestaña porque sale del mismo dato: en una pestaña propia habría que
          saltar entre las dos para saber de qué aula se habla. */}
      {enBase && control.length ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Lo que falta para cerrar</h3>
          <span>en encuestas, sobre el umbral que la hoja calculó</span>
        </div>
        <AulasLoQueFalta filas={control} facultadEnFoco={facultadEnFoco} onFoco={onFoco} />
      </section>
      ) : null}
      </div>
    );
  }
  if (view === "consultas") {
    // Las tres listas van en paneles propios. Concatenadas producian una tabla
    // donde la misma aula salia hasta tres veces sin que ninguna columna dijera
    // de cual lista venia cada fila: 7 aulas se veian como 15 filas.
    const reemplazos = (dashboard.reemplazos ?? []) as Array<Record<string, unknown>>;
    const brechas = (dashboard.brechas ?? []) as Array<Record<string, unknown>>;
    const cuadre = parteDeCampo((dashboard.partes_campo ?? []) as MonitoreoRow[], (dashboard.agenda ?? []) as MonitoreoRow[]);
    // El PLAN entero, no `reemplazos`: la historia y el gráfico necesitan también
    // los titulares que nunca necesitaron reserva, porque «146 no necesitaron
    // reemplazo» es parte de la respuesta.
    // El BANCO fuera de la agenda. Las aulas extra no cuelgan de ningún titular,
    // no tienen fecha y no están agendadas: son respaldo del estrato para cerrar
    // la cuota, y desde hace poco tienen su propia pestaña. Metidas aquí añadían
    // 40 filas sin fecha a una tabla de 196 que sí importan, y hacían que el
    // panel dijera «236 cursos-horario» dos dedos debajo de un KPI que decía
    // 196: la misma palabra con dos cifras.
    const agendaFilas = ((dashboard.agenda ?? []) as MonitoreoAulasPlanRow[])
      .filter((f) => String((f as { sample_role?: unknown }).sample_role ?? "") !== "extra_reserve_pool");
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
          {/* Y DÓNDE aguanta. El consumo de arriba es del operativo entero; la
              cuota, en cambio, es por facultad: veinte reservas libres no
              sirven si la facultad que perdió un aula tiene cero. */}
          <AulasColchonPorFacultad filas={agendaFilas} />
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
            preferredColumns={["operational_code", "faculty", "replacement_for", "replacement_order", "sample_status", "sample_role", "motivo"]}
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
          {/* ¿Hay atajo? Una lista ordenada por brecha SUGIERE que las primeras
              concentran lo que falta, y puede ser al revés. Esto lo dice. */}
          <AulasConcentracionBrecha filas={(dashboard.brechas ?? []) as MonitoreoRow[]} />
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
          {/* De qué hoja sale. Las otras dos superficies del libro llevan el
              nombre EXACTO de la suya —«Aulas agendadas» y «Base de control»,
              que es a lo que el equipo va a buscarlas—; ésta se llama «partes de
              campo», que es como se dice, y la hoja se llama «Aulas Aplicadas
              (Campo)». Sin decirlo, quien busca en su libro no sabe cuál abrir. */}
          <p className="mon-profile-muted">
            De la hoja «Aulas Aplicadas (Campo)» del libro: lo que anotó quien
            estuvo en el aula.
          </p>
          {/* La cadena del parte, SUMADA. Fila a fila no se ve que los
              duplicados pesen más que los rechazos. */}
          <AulasEmbudoDelAula filas={(dashboard.partes_campo ?? []) as MonitoreoRow[]} />
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
          {/* El cambio de aula va DESPUÉS del descuadre, no en medio.
              Metido entre el embudo y esta frase, partía la narración: el
              lector iba «5 390 → 4 865 → el equipo declaró 4 863, DOS MENOS» y
              se cruzaba con «30 aulas en otro salón» antes de leer la frase que
              explica esos dos. Son dos hechos del mismo parte, pero uno explica
              al anterior y el otro no. */}
          <AulasCambioDeAula
            partes={cuadre.filas as MonitoreoRow[]}
            plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          />
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
            // El parte dice DOS cosas y la tabla solo enseñaba una: la
            // aritmetica del cuadre. Lo otro —si se aplico, en que aula de
            // verdad, que dia y quien estuvo— es lo que el aplicador reporta y
            // solo vive en esta hoja. Va primero porque es lo que se pregunta
            // antes de mirar si las cuentas cuadran.
            maxColumns={13}
            preferredColumns={["operational_code", "faculty", "application_status", "actual_room", "applied_date", "applied_by", "observed_students", "attendance_pct", "refusals", "duplicates", "effective_surveys", "esperado", "diferencia"]}
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
            {/* NO «… por facultad»: choca con «Cuota sexo por facultad» y el
                guard de títulos lo caza. Dos paneles que terminan igual se
                confunden en el rail y en el historial de navegación. */}
            <h3>Aulas extra disponibles</h3>
            <span>{fmt(dashboard.banco_extras?.total ?? 0)} extras</span>
          </div>
          <p className="mon-profile-muted">
            No reemplazan a ningún curso-horario: son aulas adicionales para
            cerrar la cuota de hombres y mujeres de cada facultad.
          </p>
          {/* **Antes del inventario, no después.** La frase de arriba dice que
              estas aulas existen para cerrar la cuota; lo primero que hay que
              saber es si la cierran. Puesto debajo quedaba tras una tabla de 73
              filas, y la respuesta se leía al final del catálogo —el mismo orden
              que la Base de control ya sigue: veredicto, después detalle—. En el
              mismo panel porque es una sola decisión. */}
          <AulasAlcanceDelBanco
            banco={dashboard.banco_extras ?? null}
            control={(dashboard.control_calidad ?? []) as Array<Record<string, unknown>>}
            quotas={(dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>}
            agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
            partes={(dashboard.partes_campo ?? []) as MonitoreoRow[]}
          />
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
  const totalAulas = Number(dashboard.course_status_total ?? aulaRows.length) || aulaRows.length;
  // Cuántas de esas filas son EXTRAS del banco. Avance cuenta 236 donde Fuentes
  // cuenta 196 «titulares y sus reservas encadenadas», y la diferencia son los
  // 40 extras: la misma palabra con dos cifras y nada que explique el salto.
  // Aquí el 236 es correcto —los extras se aplican y traen respuestas— así que
  // lo que faltaba no era la cuenta sino decir qué entra en ella.
  const aulasExtra = aulaRows.reduce(
    (n, row) => (String(row.sample_role ?? "") === "extra_reserve_pool" ? n + 1 : n),
    0,
  );
  const contadorDeAulas = (visibles: number) => {
    const base = totalAulas > visibles
      ? `${fmt(visibles)} de ${fmt(totalAulas)} cursos-horario`
      : `${fmt(visibles)} cursos-horario`;
    return aulasExtra ? `${base} · ${fmt(aulasExtra)} del banco` : base;
  };
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
          {/* La meta del MOTOR: sumarla acá la calculaba sobre un payload
              recortado a 500 filas. */}
          <span>meta {fmt(
            Number(dashboard?.cumplimiento_respuestas?.meta)
            || avanceEnRespuestas(aulaRows as unknown as MonitoreoAulasPlanRow[]).meta,
          )}</span>
        </div>
        <AulasAvanceEnRespuestas
          filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
          resumen={dashboard?.cumplimiento_respuestas ?? null}
          validasTotales={Number(dashboard.kpis?.respuestas_validas ?? 0) || 0}
        />
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
          {/* «12 días» a secas contradecía la lectura de dentro —«en 10 días
              de campo»— y el pie —«al ritmo de estos 10»—: el mismo panel daba
              dos cifras para la misma palabra. Los 12 son corridos y 2 son fin
              de semana sin campo; el contador lo dice en vez de elegir uno. */}
          <span>{(() => {
            const dias = (dashboard?.ritmo_diario?.dias ?? []) as Array<{ validas?: unknown }>;
            const conCampo = dias.filter((d) => Number(d?.validas ?? 0) > 0).length;
            const base = `${fmt(dias.length)} ${dias.length === 1 ? "día" : "días"}`;
            return conCampo && conCampo !== dias.length ? `${base} · ${fmt(conCampo)} con campo` : base;
          })()}</span>
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
          {/* El perfil sabía por separado las dos mitades —la agenda tiene la
              fecha de cada aula, la hoja de partes dice cuáles se llenaron— y
              nadie las cruzaba. Los demás paneles de Avance contestan cuánto se
              lleva; éste, qué se quedó atrás. */}
          {/* El registro del informe. «Lo que se quedó atrás» es la frase de una
              reunión, no de un reporte, y este panel cuenta algo muy concreto:
              cursos-horario cuya fecha ya pasó y que siguen sin parte. */}
          <h3>Cursos-horario vencidos sin aplicar</h3>
          <span>fecha ya pasada al corte, sin parte de campo</span>
        </div>
        <AulasFrenteDelOperativo
          filas={(dashboard?.agenda ?? []) as MonitoreoAulasPlanRow[]}
          partes={(dashboard?.partes_campo ?? []) as Array<Record<string, unknown>>}
          // El día del corte y NO `new Date()`: un panel que lee el reloj da un
          // resultado distinto cada vez que se abre y no hay forma de fijarlo en
          // un test ni de reproducir lo que vio el usuario.
          corte={String(dashboard?.generated_at ?? "").slice(0, 10)}
        />
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
          {/* El recorte del PAYLOAD se declara aquí. La tabla ya declara el
              suyo, pero éste ocurre antes de que la tabla vea nada: el motor
              manda 500 filas de las 2 615 del plan, y sin decirlo la pantalla
              afirmaba que el estudio tiene 500 aulas. */}
          <span>{contadorDeAulas(aulaRows.length)}</span>
        </div>
        {/* Los dos ejes van en paneles propios porque contestan preguntas
            distintas y cada superficie declara qué es (C1): éste dice en qué
            punto del circuito está cada aula —y cuántas ni se han agendado—, el
            de abajo cuánto lleva recogido cada una. Los dos van ANTES de la
            tabla: la tabla dice aula por aula y esto dice la forma del
            conjunto. */}
        <AulasEstadoChart
          filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
          resumen={dashboard.course_status_estados ?? null}
          desconocidasMotor={dashboard.course_status_estados_desconocidos}
        />
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
          <span>{contadorDeAulas(aulaRows.length)}</span>
        </div>
        <AulasCoberturaChart
          filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
          resumen={dashboard.course_status_cobertura ?? null}
          sinMetaMotor={dashboard.course_status_sin_meta}
          bancoMotor={dashboard.course_status_banco}
        />
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
        <AulasPerfilPorFacultad
          filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
          resumen={(dashboard.avance_por_facultad ?? []) as never}
          facultadEnFoco={facultadEnFoco}
          onFoco={onFoco}
        />
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
        {/* El orden, DICHO. La tabla no abre por código ni alfabéticamente: la
            ordena el motor por dónde está el aula en el circuito —en campo,
            lista, planificada— y dentro de cada tramo por brecha. Sin decirlo,
            «CH 74, CH 99, CH 49» se lee como desorden y el lector busca un
            control de orden que no existe. */}
        <p className="mon-profile-muted">
          Primero las que están en campo y con más brecha; el banco y las reservas dormidas, al final.
        </p>
        <DataTable
          rows={aulaRows}
          empty="Todavía no hay respuestas que atribuir a un curso-horario."
          preferredColumns={["operational_code", "faculty", "label", "respuestas_validas", "expected_valid", "brecha", "application_state"]}
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
      {pestana !== "rendimiento" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* Lo primero de la pestaña, antes que ningún gráfico: es lo único que
              pide una acción hoy. Los demás paneles explican el campo; éste dice
              a quién llamar. */}
          <h3>A quién hay que agendar</h3>
          <span>aulas por pedir, con la anticipación del operativo de 2025</span>
        </div>
        <AulasAlertaDeAnticipacion
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
          cuotas={(dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[]}
          banco={dashboard.banco_extras?.por_facultad ?? []}
          facultadEnFoco={facultadEnFoco}
          onFoco={onFoco}
        />
      </section>
      )}
      {pestana !== "rendimiento" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El ranking de arriba dice QUIÉN rinde más; esto, cómo le fue día a
              día y qué cabe esperar de su próxima aula. Son preguntas distintas
              y por eso son dos paneles: el ranking se mira para repartir hoy, la
              serie para ver si una facultad se está apagando. */}
          <h3>Cómo rinde cada facultad, día a día</h3>
          <span>encuestas por aula visitada · y lo que cabe esperar</span>
        </div>
        <AulasSerieDeRendimiento
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
          cuotas={(dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[]}
          plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          control={(dashboard.control_calidad ?? []) as MonitoreoRow[]}
        />
      </section>
      )}
      {pestana !== "rendimiento" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El título son SUS palabras —«qué nos está rindiendo más, qué no
              está rindiendo más»— y además esquiva el guard: «Rendimiento por
              facultad» terminaría igual que «Cuota sexo por facultad». */}
          <h3>Qué está rindiendo más</h3>
          {/* «del parte»: estas encuestas son las que el equipo anotó aula por
              aula —4 863 sobre este corte— y no las respuestas de Kobo que la
              pestaña vecina cuenta como VÁLIDAS —3 700—. Sin nombrar la fuente,
              dos cifras separadas por una pestaña y con 1 163 de diferencia se
              leen como la misma. */}
          <span>encuestas del parte, por aula visitada</span>
        </div>
        {/* Las filas del parte YA UNIDAS a su facultad, que es lo que devuelve
            `parteDeCampo`. Pasando el parte crudo salían las 210 aulas bajo
            «Sin facultad»: la hoja «Aulas Aplicadas (Campo)» no tiene columna de
            facultad y la une el mismo helper que la tabla de Consultas — usar el
            suyo evita que las dos superficies discrepen en de qué facultad es un
            aula. */}
        <AulasRendimientoPorFacultad
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          facultadEnFoco={facultadEnFoco}
          onFoco={onFoco}
        />
      </section>
      )}
      {/* Las otras TRES unidades de esfuerzo, en paneles propios y no tras un
          selector: se leen juntas —una facultad rinde poco Y su aplicador rinde
          bien— y un control las escondería de a dos.

          Y ahora en FILA, que es lo que hace verdad esa frase. Apiladas medían
          920 px dentro de una pestaña de 7,5 pantallas de scroll, así que para
          comparar la franja con el día había que recordar el primero. La cuarta
          —por facultad— se queda encima a todo lo ancho: son 21 filas contra 7 y
          a un tercio de ancho sus nombres no caben. */}
      {pestana !== "rendimiento" ? null : (
      <div
        className="aulas-lentes-trio"
        data-qa-geometry-group="monitoring-aulas-lentes"
        /* `intrinsic` por el mismo motivo que la pareja: apiladas bajo 1180 px
           cada una vuelve a su alto propio —7, 3 y 7 filas— así que `equal`
           sería una promesa que no pueden cumplir. */
        data-qa-geometry-contract="intrinsic"
      >
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Quién consigue más</h3>
          <span>encuestas por aula, según quién aplicó</span>
        </div>
        <AulasRendimientoPorFacultad
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          clave="applied_by"
          unidad="Aplicador"
          /* Las columnas ya las explica «Qué está rindiendo más», dos paneles
             más arriba y en esta misma pantalla. */
          explicaLasColumnas={false}
        />
      </section>
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* Las franjas son las del libro —hoja «planilla»—, no unas nuestras. */}
          {/* «A qué hora se consigue más» terminaba igual que «Quién consigue
              más» y el guard lo tumbó. El título nombra la unidad, que además es
              la del libro. */}
          <h3>Franja horaria del operativo</h3>
          <span>encuestas por aula, según cuándo se aplicó</span>
        </div>
        <AulasRendimientoPorFacultad
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          clave="franja"
          unidad="Franja"
          explicaLasColumnas={false}
        />
      </section>
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* La cuarta unidad de esfuerzo, y la única sobre la que el equipo
              decide al agendar: la hora la pone el curso, el aplicador lo pone
              la asignación, la facultad la pone la muestra — el día se elige.

              Y no es una curiosidad: el pronóstico de cierre proyecta «al ritmo
              observado de N aulas por día de campo», o sea tratando todos los
              días como iguales. Si un martes rinde el doble que un viernes, dos
              agendas con el mismo número de aulas dan resultados distintos.

              El título nombra la unidad y no termina como ningún otro, que es
              la regla que el guard de títulos sujeta. */}
          <h3>Día de la semana</h3>
          <span>encuestas por aula, según qué día se aplicó</span>
        </div>
        <AulasRendimientoPorFacultad
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          clave="dia_semana"
          unidad="Día"
          explicaLasColumnas={false}
        />
      </section>
      </div>
      )}
      {pestana !== "rendimiento" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El ritmo del estudio entero ya existe en Resumen; éste dice QUIÉN
              lo sostiene y quién se paró. «Siempre todo es por facultad». */}
          {/* «Encuestas por día» y no «ritmo» a secas: el panel de arriba también
              es día a día y por facultad, y se llamaban casi igual. Éste cuenta
              PRODUCCIÓN —cuántas encuestas trajo cada día— y el otro RENDIMIENTO
              —cuántas dejó cada aula—. Son la misma pregunta a dos escalas y
              conviene decidir si sobra uno; mientras tanto, que al menos se
              distingan. */}
          <h3>Encuestas por día de cada facultad</h3>
          <span>producción diaria, sin dividir entre aulas</span>
        </div>
        <AulasRitmoPorFacultad
          facultadEnFoco={facultadEnFoco}
          onFoco={onFoco}
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
        />
      </section>
      )}
      {pestana !== "rendimiento" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* Se proyectan AULAS y no respuestas: la meta esta en respuestas
              atribuidas a un curso-horario y sobre este corte hay cero —llegan
              anonimas—, asi que proyectar la serie del parte contra esa meta
              daria una fecha inventada. Las aulas viven en un solo universo. */}
          {/* La unidad en el subtítulo. Este panel cuenta AULAS y el acumulado
              del panel de arriba cuenta ENCUESTAS: son dos preguntas distintas
              —terminar de visitar no es llegar a la cuota— y sin decir la unidad
              parecían el mismo gráfico dos veces. */}
          <h3>Cuándo se termina de aplicar el plan</h3>
          <span>aulas del plan aplicadas, al ritmo observado</span>
        </div>
        <AulasPronosticoDeCierre
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
          plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
        />
      </section>
      )}
      {pestana !== "rendimiento" ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El registro es el del informe, no el de la sala. Se llamaba
              «Cuánto aguanta el colchón · al ritmo al que están cayendo». */}
          {/* Sin «por facultad» en el título: el guard de títulos lo cazó por
              terminar igual que «Cuota sexo por facultad», que es el defecto que
              ese guard existe para impedir. La unidad va en el subtítulo. */}
          <h3>Consumo de la reserva</h3>
          <span>por facultad, al ritmo de reemplazos observado</span>
        </div>
        {/* Los días de campo salen de los PARTES —los días en que el operativo
            salió de verdad— y no de `ritmo_diario`, que cuenta días con
            respuestas y en este corte abarca 24 por las aulas ya agendadas: una
            caída sólo puede ocurrir un día en que se sale. */}
        <AulasConsumoDelBanco
          filas={(dashboard.agenda ?? []) as MonitoreoAulasPlanRow[]}
          diasDeCampo={diasDeCampoDelCorte((dashboard.partes_campo ?? []) as MonitoreoRow[])}
          facultadEnFoco={facultadEnFoco}
          onFoco={onFoco}
        />
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
        <AulasPiramideCuota
          filas={quotaRows as MonitoreoRow[]}
          foco={foco}
          onFoco={onFoco}
          agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
          partes={parteDeCampo(
            (dashboard.partes_campo ?? []) as MonitoreoRow[],
            (dashboard.agenda ?? []) as MonitoreoRow[],
          ).filas as MonitoreoRow[]}
        />
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
  // Texto y tono en UN estado, no dos. «ok» para lo que salió bien, «atencion»
  // para lo que hay que mirar — y como viajan juntos, no hay forma de anunciar
  // algo nuevo heredando el tono de la acción anterior: un `setAviso` suelto que
  // olvidara el tono pintaría el resultado siguiente con el color del anterior.
  const [aviso, setAviso] = useState<{ texto: string; tono: TonoAviso }>({
    texto: "", tono: "ok",
  });
  const [error, setError] = useState("");
  /**
   * Los filtros que definen una encuesta efectiva, en edición.
   *
   * `null` mientras no se han cargado: así se distingue «todavía no sé» de «el
   * estudio no declara ninguno», que son cosas distintas y con `[]` se
   * confundirían —y el segundo caso se guardaría como si el usuario lo hubiera
   * vaciado a propósito—.
   */
  const [filtrosEfectiva, setFiltrosEfectiva] = useState<FiltroDeEfectiva[] | null>(null);
  const [guardandoCriterio, setGuardandoCriterio] = useState(false);

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
  // Cuántas aulas traen META DEL DISEÑO, que es lo que hace juzgable el
  // criterio.
  //
  // Se lee `meta_origen`, no se infiere. Antes se comparaba la meta con los
  // elegibles y se contaba «distinta» como si fuera del diseño: en el fixture
  // de QA eso daba 267 aulas «del diseño» y ninguna sale de un cálculo de
  // muestra. El campo lo escribe el cálculo junto a `efectivas_esperadas`, y
  // cuando no viene, el normalizador lo deriva y nombra el fallback.
  const metasDelDiseno = useMemo(() => {
    const filas = (dashboard?.agenda ?? []) as Array<Record<string, unknown>>;
    return filas.filter((f) => String(f.meta_origen ?? "") === "diseno").length;
  }, [dashboard]);
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
    setAviso({ texto: "", tono: "ok" });
    try {
      const res = await apiMonitoreoAulasGenerarLibro();
      // Decir qué lleva dentro: el libro se descargaba en silencio.
      setAviso({ texto: avisoLibroGenerado(res), tono: "ok" });
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
    setAviso({ texto: "", tono: "ok" });
    try {
      // Dos pasos a propósito. Mandar el xlsx directo a `importar-libro`
      // no funciona: con `parsers = multi` el archivo llega pero plumber
      // muere parseando el xlsx de dentro, y con `octet` deja de llegar.
      // `/api/files/upload` ya sabe guardar binarios y devuelve el `file_id`
      // que el endpoint acepta desde el primer día.
      const subido = await apiUpload(archivo, "aulas_libro");
      const res = await apiMonitoreoAulasImportarLibro({ file_id: subido.file_id });
      setState(res.state);
      // El resumen entero, no solo lo que faltaba: quien importa necesita saber
      // que entro, y que columnas con datos NO se leyeron.
      setAviso(avisoLibroImportado(res));
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

  // Los filtros guardados entran al borrador cuando llega el estado, y **sólo
  // una vez**: si se resembraran en cada carga, una edición sin guardar se
  // perdería al recargar el tablero de fondo.
  useEffect(() => {
    if (filtrosEfectiva !== null) return;
    const mapping = state?.aulas_universitarias?.source_mapping;
    if (!mapping) return;
    const declarados = mapping.valid_filters;
    if (declarados?.length) {
      setFiltrosEfectiva(declarados.map((f) => ({ var: f.var, values: [...f.values] })));
    } else if (mapping.status_var) {
      // Un estudio configurado a la vieja usanza entra como UN filtro: es
      // exactamente lo que el motor hace, así que la pantalla enseña lo que se
      // está aplicando y no una lista vacía.
      setFiltrosEfectiva([{ var: mapping.status_var, values: [...(mapping.valid_statuses ?? [])] }]);
    } else {
      setFiltrosEfectiva([]);
    }
  }, [state, filtrosEfectiva]);

  const guardarCriterio = useCallback(async () => {
    if (!filtrosEfectiva) return;
    setGuardandoCriterio(true);
    setError("");
    try {
      // Sólo los completos: un filtro sin variable o sin valores no filtra nada
      // y el motor lo descarta igual, así que guardarlo dejaría en la config una
      // condición que no hace nada y confunde al leerla.
      const limpios = filtrosEfectiva.filter((f) => f.var && f.values.length);
      await apiMonitoreoAulasConfig({
        source_mapping: {
          ...(state?.aulas_universitarias?.source_mapping ?? {}),
          valid_filters: limpios,
        },
      } as Partial<MonitoreoAulasConfig>);
      // **Con el scope de VALIDACIÓN**, no con el de la sección.
      //
      // La frase que el panel enseña —«cuentan N de M»— la calcula el motor y
      // viaja en los controles de validación. La sección Fuentes pide el scope
      // `source`, que no los trae, así que al guardar el panel seguía enseñando
      // el número ANTERIOR: se guardaba «sexo = F», el motor ya contaba 1 850 y
      // la pantalla decía 3 700 hasta recargar. Un panel que no puede enseñar el
      // efecto de su propio botón enseña a desconfiar del botón.
      const next = await apiMonitoreoState({
        includeReports: true, reportScope: "validation_summary", force: true,
      });
      setState(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardandoCriterio(false);
    }
  }, [filtrosEfectiva, state, loadView, seccionActiva]);

  /**
   * Declarar qué es un aula válida en este estudio.
   *
   * Mismo camino que el criterio de respuesta válida —la config de aulas y
   * después un refresco con el scope de VALIDACIÓN—, porque el veredicto que
   * cambia viaja ahí: sin eso el panel seguiría enseñando el reparto anterior y
   * el botón parecería no hacer nada.
   */
  const guardarCriterioDeAula = useCallback(async (valor: { modo: string; alfa: number }) => {
    try {
      await apiMonitoreoAulasConfig({ aula_valida: valor } as Partial<MonitoreoAulasConfig>);
      const next = await apiMonitoreoState({
        includeReports: true, reportScope: "validation_summary", force: true,
      });
      setState(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // **Un error de una carga anterior no describe lo que estás viendo ahora.**
  // `loadView` se dispara por SECCIÓN, así que al cambiar de pestaña dentro de la
  // misma sección el aviso rojo sobrevivía: medido, «Internal Server Error ·
  // HTTP_500» seguía en pantalla con la API respondiendo 200 y los datos de
  // delante correctos, y sólo se iba al salir de la sección y volver. Un cartel
  // de error sobre datos buenos es peor que no avisar: enseña a ignorar los
  // avisos.
  //
  // No se BORRA —eso sería dejar de afirmar algo sin comprobarlo—: se
  // **reintenta**, en silencio. Si la carga sigue rota el error vuelve solo, y si
  // se recuperó desaparece porque se recuperó.
  useEffect(() => {
    if (!error) return;
    void loadView(seccionActiva, true, true);
    // `error` fuera de las dependencias a propósito: reintentar al CAMBIAR DE
    // PESTAÑA, no cada vez que el error cambie —eso sería un bucle—.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaActiva]);

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
      {/* **La marca dice «false» mientras la vista carga.**
          Emitida fija, la vista se declaraba lista desde el primer render y el
          runner canónico capturaba la pantalla de «Preparando vista» como si
          fuera la vista: `ok=true issues=0` sobre CONTROLES 0, ALERTAS 0 y
          REPRESENTATIVIDAD S/D. Verde por ausencia, y no en un panel sino en el
          gate entero del perfil. `data-audit-has-dashboard` llevaba el dato al
          lado sin que nadie lo consultara.

          Sólo `loading`, que es transitorio: un estudio que terminó de cargar y
          no tiene libro SÍ está listo —su vacío es legítimo y hay que poder
          auditarlo—, y declararlo «false» dejaría al runner esperando hasta el
          timeout. */}
      <span
        hidden
        data-audit-ready={loading ? "false" : "monitoreo-aulas"}
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

      {/* Va ENTRE el chrome de módulo y la mesa de trabajo porque califica todo
          lo que hay debajo —avance, cuotas, atrasos—, no un panel concreto. */}
      <AulasOrigenDesfasado origen={state?.aulas_origen} />

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

          <AulasKpiBand dashboard={dashboard} seccion={seccionActiva} pestana={pestanaActiva} />
          {seccionActiva === "fuentes" ? (
            <AulasApplicationFlow
              tone="monitoreo"
              current="monitoreo"
              compact
              title="Seguimiento de la intervención por cursos-horario"
              // **La franja en prosa era la propia franja.** Decía «lee el plan
              // del cálculo de muestra y sus enlaces QR/PDF para medir avance,
              // caídas, reemplazos y brechas» —26 palabras— y justo debajo están
              // los cuatro pasos con esos mismos rótulos; lo único que añadía,
              // «sin rediseñar la muestra», ya lo dice la tarjeta de Monitoreo.
              // Gonzalo: «todos los elementos visuales siguen bastante
              // verborreados en esta sección».
              //
              // Se queda lo que los pasos NO dicen: que cada uno se hace en otro
              // sitio y que esta vista sólo mira.
              summary="Cada paso se hace en su módulo; aquí sólo se sigue."
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
            {aviso.texto ? (
              <div className="aulas-aviso" data-tono={aviso.tono}>
                {aviso.tono === "ok" ? <CheckCircle2 size={16} /> : <Info size={16} />} {aviso.texto}
              </div>
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
                origen={state?.aulas_origen}
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
                // La hoja de partes, sólo para el contador: sin ella el panel
                // decía «0 con parte» mientras Consultas enseñaba «210 partes».
                partes={(dashboard?.partes_campo ?? []) as Array<Record<string, unknown>>}
                onGuardado={() => { void loadView(seccionActiva, true, true); }}
                // La dirección abre el aula: `?foco=aula:CH 21` deja el
                // formulario puesto sobre ella, que es donde vive la única
                // acción que activa su reemplazo. Antes había que buscarla
                // entre 196 filas, y quien la veía caer en la ruta del día no
                // tenía cómo llegar hasta aquí.
                codigoEnFoco={foco?.tipo === "aula" ? foco.valor : ""}
                onElegir={(codigo) => cambiarFoco({ tipo: "aula", valor: codigo })}
              />,
              state?.sources ?? [],
              pestanaActiva,
              foco,
              cambiarFoco,
              {
                filas: Number(state?.n_rows ?? 0) || undefined,
                columnas: (state?.variables ?? []).length || undefined,
              },
              // El panel del criterio, ya construido: el render no ve el estado
              // ni sabe guardar. Sólo cuando hay base que mirar —sin variables
              // no hay nada que elegir y el panel sería un formulario vacío.
              filtrosEfectiva && (state?.variables ?? []).length ? (
                <AulasFiltrosDeEfectiva
                  filtros={filtrosEfectiva}
                  variables={state?.variables ?? []}
                  criterio={((dashboard?.validation ?? []).find(
                    (c) => (c as { check?: string }).check === "valid_response_criterion",
                  )?.detail as string | undefined) || undefined}
                  guardando={guardandoCriterio}
                  onChange={setFiltrosEfectiva}
                  onGuardar={() => { void guardarCriterio(); }}
                />
              ) : null,
              // La vara de aula válida, también construida aquí por lo mismo.
              <AulasCriterioDeAula
                criterio={(state?.aulas_universitarias?.aula_valida ?? null) as never}
                hayMetas={metasDelDiseno}
                onGuardar={guardarCriterioDeAula}
              />,
              // Cambiar de pestaña dentro de la sección: quien recuerda la
              // activa de cada una es este componente, no el render.
              (clave) => elegirPestana(seccionActiva, clave),
            )}
          </div>
      </MonitoreoWorkbenchChrome>
    </div>
  );
}
