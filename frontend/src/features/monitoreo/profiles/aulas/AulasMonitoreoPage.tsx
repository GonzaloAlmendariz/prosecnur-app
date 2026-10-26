import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MonitoreoAulasTramo,
  MonitoreoAulasDistribucionSheets,
  MonitoreoAulasSincronizacion,
} from "../../../../api/monitoreo";
import { contar } from "../../fuentes/vocabulario";
import type { CSSProperties, ReactNode } from "react";
// Por el shim, que es la regla de la casa: los imports directos de
// `lucide-react` arrastran el barrel entero al bundle. Este archivo se lo
// saltaba desde antes; se corrige al pasar por aquí.
import { AlertCircle, CalendarRange, CheckCircle2, Info } from "../../../../vendor/lucide-react";
import {
  apiMonitoreoAulasGenerarLibro,
  apiMonitoreoAulasDisponibilidad,
  apiMonitoreoAulasDisponibilidadPlantilla,
  apiMonitoreoAulasImportarLibro,
  apiMonitoreoAulasImportarSheets,
  apiMonitoreoAulasPublicarDistribucion,
  apiMonitoreoAulasSincronizarDistribucion,
  apiMonitoreoAulasPublicarLibro,
  apiMonitoreoAulasRecalcularTraslape,
  apiMonitoreoAulasImportFromCalcMuestra,
  apiMonitoreoAulasConfig,
  apiMonitoreoAulasSync,
  apiMonitoreoSync,
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
import { AccionEnCelda, COLUMNA_DE_ACCION } from "./AccionEnCelda";
import { COLUMNAS_DE_ESTADO, EstadoEnCelda } from "./EstadoEnCelda";
import { COLUMNAS_DE_CODIGO, CodigoEnCelda } from "./CodigoEnCelda";
import { COLUMNAS_DE_NOTA, NotaEnCelda } from "./NotaEnCelda";
import { identidadEnCelda } from "./AulasSistemaPabellon";
import { columnasConDato } from "./columnasConDato";
import { filaVisibleEnAgenda } from "./filaVisibleEnAgenda";
import { AulasPestanaRendimiento } from "./AulasPestanaRendimiento";
import { AulasPestanaResumen } from "./AulasPestanaResumen";
import { AulasPestanaCuotas } from "./AulasPestanaCuotas";
import { AulasVistaPreviaDelLibro } from "./AulasVistaPreviaDelLibro";
import { AulasPestanaEfectividad } from "./AulasPestanaEfectividad";
import { AulasPestanaEstratos } from "./AulasPestanaEstratos";
import { AulasSeccionModelo } from "./AulasSeccionModelo";
import { AulasComoMideElEstudio, type ComoMideElEstudio } from "./AulasComoMideElEstudio";
import { AulasSeccionFuentes } from "./AulasSeccionFuentes";
import { AulasSeccionCalidad } from "./AulasSeccionCalidad";
import { AulasSeccionConsultas } from "./AulasSeccionConsultas";
import { avisoConversacion } from "./avisoConversacion";
import { fraseDelRetiro } from "./retiroDeLaDistribucion";
import { avisoDelSync } from "./avisoDelSync";
import { avisoLibroGenerado } from "./avisoLibroGenerado";
import { avisoLibroImportado, type TonoAviso } from "./avisoLibroImportado";
import { avisoDisponibilidadImportada } from "./avisoDisponibilidadImportada";
import { avisoLibroPublicado, avisoTraslapeRecalculado } from "./avisoLibroPublicado";
import { avisoDistribucionPublicada } from "./distribucionDeAplicadores";
import { sugerenciasDeDescarte } from "./AulasSexoYDescartes";
import { AulasOrigenDesfasado } from "./AulasOrigenDesfasado";
import { AulasCriterioDeAula } from "./AulasCriterioDeAula";
import { AulasFiltrosDeEfectiva, type FiltroDeEfectiva } from "./AulasFiltrosDeEfectiva";
import { focoDesdeTexto, textoDesdeFoco, type FocoDeCuota, esFocoDelEje } from "./AulasCuotasResumen";
import { AulasSelectorDeFoco } from "./AulasSelectorDeFoco";
import { valoresDelEje } from "./valoresDelEje";
import { mandoDeFacultadVisible } from "./mandoDeFacultad";
import { aulasKpis, fmt } from "./kpisDeAulas";
import { MODULE_TONES } from "../../../../lib/modules";
import { ordenarPorCadenaOperativa } from "../../../../lib/cadenaOperativa";
import { corteDelEstudio } from "./corteDelEstudio";
import { estadoDeMuestraLegible } from "./estadoDeMuestraLegible";
import { queTocaConCadaAula } from "./queTocaConCadaAula";
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
import { readinessDeAulas } from "./navegacion/readinessDeAulas";
import {
  aulasFieldLabel,
  aulasFieldTitle,
  escalaDeProporciones,
  presentAulasRow,
  summarizeAulasValidation,
} from "./aulasPresentation";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";
import "../../shell/monitoreoShell.css";
import "./aulasMonitoreo.css";
// Después de la hoja madre, nunca antes: ver la cabecera de
// `aulasReemplazos.css`.
import "./aulasReemplazos.css";
import "./aulasCargaDeCampo.css";
import "./aulasRutaPorFacultad.css";
import "./aulasTextoAbierto.css";
import "./aulasReservaDirigida.css";
import "./aulasProbabilidadDeCierre.css";
import { recorteTabla } from "../../corte/corteContract";
import { corteAulas } from "../../corte/corteAdapters";
import { columnasSinConstantesInertes, columnasSinDuplicados } from "./columnasQueAportan";
// El poll del job de sincronización de fuentes. Se IMPORTA en vez de copiarse:
// la nota de ese archivo defiende la copia por perfil para lo que diverge entre
// telefónico y acreditación (su vocabulario, sus fases), y esto no es eso — es
// esperar a un job y leer su progreso, idéntico para cualquier familia.
import { useWaitForSourceSyncJob } from "../../sync/pollSourceSync";

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
/**
 * Se conservan aunque sean constantes, porque su valor unico ES el dato.
 *
 * Reusa la regla de estado que ya usa el chip —`status`, `*_status`,
 * `*_state`— y suma la ACCION: «Llamar al docente» en las 193 filas dice que
 * el operativo no ha empezado, igual que el estado del que sale.
 */
const COLUMNAS_QUE_SOBREVIVEN_CONSTANTES = {
  has: (clave: string) => COLUMNAS_DE_ESTADO.has(clave) || clave === "que_toca",
};

const COLUMNAS_DE_INFRAESTRUCTURA = new Set([
  // El sello de la corrida ya vive en la cabecera del módulo y en Fuentes.
  "selection_run_id", "run_id", "frame_hash",
  // Ranuras e índices internos del sorteo: «slot_001» no es una posición que
  // alguien use, es cómo se numeran las plazas por dentro.
  "selection_slot_id", "slot_id", "operational_sequence", "orden", "order",
  // Identificadores técnicos con su equivalente legible ya en la tabla:
  // `operational_code` es «CH 1» y `course_name` el nombre del curso.
  "classroom_id", "course_id", "unit_id",
  // **El sexo DOMINANTE del aula es vocabulario del sorteo, no del operativo.**
  //
  // Gonzalo, 2026-08-31: «las columnas de sexo del plan nos sirven para ver las
  // cuotas por sexo de cada facultad; a nivel operativo no nos importa a qué
  // segmentos pertenezca el aula, eso sólo es a nivel de la selección del
  // aula».
  //
  // `sex_top_1` dice CUÁL sexo domina —«F» o «M»—, que es con lo que se repartió
  // la muestra. Quien monitorea necesita cuántas mujeres y cuántos hombres, y
  // eso ya está donde decide: las cuotas por facultad y sexo en Avance, y el
  // desglose de cada candidata en la ventana de reemplazo, que resuelven la F
  // a su conteo en vez de enseñarla cruda. Ya hay precedente de que la
  // construcción se malinterpreta: `sub_a` es el sexo MÁS FRECUENTE y se leyó
  // como «mujeres», lo que invirtió una tabla de cuotas entera.
  "sex_top_1", "sex_top_2", "sex_top_1_n", "sex_top_2_n",
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

function AulasKpiBand({ dashboard, seccion, pestana, facultadEnFoco = "", cargando = false, onIr = null }: {
  dashboard: MonitoreoAulasDashboard | null;
  seccion: MonitoreoSeccion;
  pestana: string;
  /**
   * La facultad del selector de la cabecera. La banda presidía un Resumen ya
   * filtrado con las cifras del estudio entero —«1 063 efectivas · meta 2 500»
   * encima de un panel que decía «12 de 99»—, y la de arriba es la que se lee
   * primero.
   */
  facultadEnFoco?: string;
  /** El proyecto todavía se está leyendo y no hay dashboard con qué contar. */
  cargando?: boolean;
  /**
   * Cambia de pestaña dentro de la sección: con él, la tarjeta con `destino`
   * se vuelve ACCESO — «Por agendar 144» lleva a la cola de Contacto en vez
   * de solo enunciarla. Sin callback, todo queda de lectura como siempre.
   */
  onIr?: ((clave: string) => void) | null;
}) {
  const kpis = aulasKpis(dashboard, seccion, pestana, facultadEnFoco);
  // **Un cero mientras se carga no es un dato, es una cuenta que aún no se
  // pudo hacer.**
  //
  // Sin dashboard, `aulasKpis` devuelve sus tiles con ceros, y la banda queda
  // publicando «Agendadas 0 · de 0 que se van a visitar» sobre un proyecto de
  // 193 titulares. Medido el 2026-08-24 abriendo el estudio real: **la lectura
  // del proyecto tarda entre 48 s y 3 min** —el backend queda al 100 % de CPU y
  // Plumber atiende en un solo hilo—, o sea minutos enteros enseñando ceros que
  // se leen como «no hay nada». El panel de abajo sí declara «Preparando
  // vista»; estas tarjetas contradecían ese mismo aviso dos centímetros arriba.
  //
  // El marco se queda (C2: no depende de los datos) y las cifras se declaran
  // pendientes. Es el mismo criterio de `c4af437d`: cuando la cuenta no se
  // puede hacer, se dice, no se resuelve a cero.
  const enEspera = cargando && !dashboard;
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
        // La tarjeta con destino navega; el resto sigue siendo lectura. El
        // botón conserva la geometría de la tarjeta (misma clase, C2).
        const esAcceso = Boolean(kpi.destino && onIr && !enEspera);
        const Tarjeta: "button" | "div" = esAcceso ? "button" : "div";
        return (
          <Tarjeta
            key={kpi.label}
            type={esAcceso ? "button" : undefined}
            onClick={esAcceso ? () => onIr?.(kpi.destino ?? "") : undefined}
            className={`aulas-kpi aulas-kpi--${kpi.tone ?? "neutral"}${esAcceso ? " es-acceso" : ""}`}
            title={enEspera
              ? "Todavía se está leyendo el proyecto"
              : esAcceso ? `${kpi.detalle ?? kpi.label} — click para ir a la lista` : kpi.detalle}
            aria-label={enEspera
              ? `${kpi.label}: todavía se está leyendo el proyecto`
              : esAcceso
                ? `${kpi.label}: ${kpi.value}. Ir a la lista`
                : kpi.detalle ? `${kpi.label}: ${kpi.value} — ${kpi.detalle}` : undefined}
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
            <strong>{enEspera ? "—" : kpi.value}</strong>
            <small>{enEspera ? "leyendo el proyecto" : kpi.pista}</small>
          </Tarjeta>
        );
      })}
    </div>
  );
}

// Exportada para poder probarla con filas reales: la intercepción de chips de
// identidad (Sistema Pabellón, B33) vive en su celda y un test de fuente no
// probaría que se pinta.
export function DataTable({
  rows,
  empty,
  preferredColumns = [],
  maxColumns = 8,
  totalReal,
  onVerFicha = null,
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
  /**
   * Llevar de una celda de código a la ficha de ese curso-horario. Opcional a
   * propósito: sin ella la celda se pinta como hoy y la tabla sigue siendo
   * renderizable sin Router.
   */
  onVerFicha?: ((codigo: string) => void) | null;
  /**
   * El total del motor cuando el payload viene topeado, para que el pie divida
   * por el plan y no por lo que cupo en la respuesta. Ver `recorteTabla`.
   */
  totalReal?: number;
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
  // Y una columna que repite a otra, o que trae el mismo valor en las 193
  // filas, tampoco gasta ancho: no es que se recorte, es que no informa. Medido
  // en Agenda el 2026-08-23 sobre el sorteo del 22 —«Codigo titular» igual a
  // «Curso-horario» en 193 de 193, «Rol de muestra» = Titular 193 veces,
  // «Muestra» = M1, «Orden en la cadena» = 0—: cuatro columnas de doce. Todas
  // existian para distinguir un titular de sus reservas, y la agenda paso a
  // listar solo titulares. El estado SI se conserva aunque sea constante: «Sin
  // contactar» en las 193 dice que el operativo no ha empezado.
  const todasLasColumnas = columnasSinConstantesInertes(
    rows,
    columnasSinDuplicados(
      rows,
      columnasConDato(rows, compactColumns(rows, preferredColumns, Number.MAX_SAFE_INTEGER)),
    ),
    COLUMNAS_QUE_SOBREVIVEN_CONSTANTES,
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
  const recorteFilas = recorteTabla(
    rows.map((row) => presentAulasRow(row, enProporcion)),
    TOPE_DE_FILAS,
    "fila",
    totalReal,
  );
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
            <th
              key={column}
              scope="col"
              className={cifras.has(column) ? "es-cifra" : undefined}
              // El alcance de un casi homónimo («Respuestas atribuidas» contra
              // «Respuestas leídas») vive en el title de su cabecera; para las
              // demás columnas devuelve undefined y no pinta nada.
              title={aulasFieldTitle(column)}
            >
              {aulasFieldLabel(column)}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {recorteFilas.visibles.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className={cifras.has(column) ? "es-cifra" : undefined}>
                  {/* Un estado se pinta como chip de color; la identidad
                      —lugar, hora, «Sesiones y aula»— como chips del Sistema
                      Pabellón (B33); el resto, texto. Los colores del estado
                      son los de la franja por día y el tono del lugar deriva
                      de su letra: la misma aula tiene que verse igual en su
                      barra, en su fila y en cualquier otra vista del perfil. */}
                  {/* Las OBSERVACIONES van plegadas en su botón (B42): cada
                      familia por su columna, y el peek dice de cuál es. */}
                  {COLUMNAS_DE_ESTADO.has(column)
                    ? <EstadoEnCelda valor={String(row[column] ?? "")} />
                    : column === COLUMNA_DE_ACCION
                      ? <AccionEnCelda valor={String(row[column] ?? "")} />
                      : COLUMNAS_DE_NOTA.has(column)
                        ? <NotaEnCelda texto={String(row[column] ?? "")} origen={COLUMNAS_DE_NOTA.get(column) ?? ""} />
                        : COLUMNAS_DE_CODIGO.has(column)
                          ? (
                            <CodigoEnCelda
                              valor={String(row[column] ?? "")}
                              hrefDeFicha={(codigo) =>
                                `/monitoreo?seccion=consultas&pestana=ficha&foco=${encodeURIComponent(`aula:${codigo}`)}`}
                              onVerFicha={onVerFicha ?? undefined}
                            />
                          )
                          : identidadEnCelda(column, String(row[column] ?? "")) ?? String(row[column] ?? "")}
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
    // Quién se ve es UNA verdad nombrada (caso A del dictado 2026-09-03):
    // titulares siempre, reservas solo despiertas — filaVisibleEnAgenda.ts.
    .filter(filaVisibleEnAgenda);
  // En el orden en que se recorre el operativo: cada titular con sus reservas
  // detrás. La tabla las enseñaba en el orden crudo del plan, que agrupa por rol
  // —todos los titulares y después todas las reservas—, así que la cadena, que
  // es la unidad con la que se decide cuando un aula cae, no se veía.
  //
  // Misma regla que la tabla del plan de Recopiladores, y por eso vive en
  // `lib/cadenaOperativa` y no aquí.
  // Qué toca hacer con cada aula, calculado aquí y no en la cabeza del
  // agendador: la tabla enseñaba el estado y él lo traducía a una acción 193
  // veces. Ver `queTocaConCadaAula.ts`.
  // **El corte del ESTUDIO, no el sello del tablero.** `generated_at` dice
  // cuándo se calculó el tablero —el reloj de la máquina que lo abrió— y con él
  // «qué toca» se calculaba contra un día que el campo no vivió. Ver
  // `corteDelEstudio.ts`: el «hoy» del estudio es su último parte.
  const corte = corteDelEstudio(
    ((dashboard as { partes_campo?: unknown } | null)?.partes_campo ?? []) as Array<Record<string, unknown>>,
    (dashboard as { generated_at?: unknown } | null)?.generated_at,
  ).dia;
  const conAccion: Array<Record<string, unknown>> = filas.map((fila) => ({
    ...fila, que_toca: queTocaConCadaAula(fila, corte),
    // **Una fila no puede decir «Aplicada» y «Sin contactar» a la vez.** El
    // normalizador del estado de muestra es una lista cerrada y las seis
    // palabras que los equipos escriben de verdad caen todas al default. Ver
    // `estadoDeMuestraLegible.ts`: no cambia el mapeo, sólo impide que la tabla
    // afirme la contradicción sin señalarla.
    sample_status: estadoDeMuestraLegible(fila.sample_status, fila.operational_status),
  }));
  return ordenarPorCadenaOperativa(conAccion, (fila) => ({
    rol: String(fila.sample_role ?? ""),
    secuencia: fila.operational_sequence,
    orden: fila.replacement_order,
    codigo: String(fila.operational_code ?? ""),
    reemplazaA: String(fila.titular_operational_code ?? fila.replacement_for ?? ""),
  }));
}

/**
 * La cadena de reemplazos, en el orden en que se lee.
 *
 * Medido el 2026-08-23 sobre las 507 reservas del sorteo del 22: la tabla
 * llegaba «R 3.3, R 11.3, R 2.3, R 1.3, R 1.1…», con **146 saltos hacia atrás
 * en 400 filas**, y cerraba en «R 158.1, R 156.1, R 148.1» hacia abajo. Buscar
 * una cadena concreta obligaba a recorrer la tabla entera.
 *
 * Usa la misma regla que ordena el plan de Recopiladores —vive en
 * `lib/cadenaOperativa` justamente para que las dos no discrepen— con una
 * diferencia deliberada en las señas: aquí manda `replacement_for`, porque en
 * esta lista una reserva puede declarar a quién reemplaza sin traer el código
 * operativo del titular.
 */
export function reemplazosEnOrdenDeCadena(
  filas: unknown,
): Array<Record<string, unknown>> {
  const lista = (filas ?? []) as Array<Record<string, unknown>>;
  return ordenarPorCadenaOperativa(lista, (fila) => ({
    rol: cleanCell(fila.sample_role),
    secuencia: fila.operational_sequence,
    orden: fila.replacement_order,
    codigo: cleanCell(fila.operational_code),
    reemplazaA: cleanCell(fila.replacement_for) || cleanCell(fila.titular_operational_code),
    alias: cleanCell(fila.label),
  }));
}

/**
 * Cuántos cursos-horario hay delante, y si son todos.
 *
 * «500 de 2.616 cursos-horario» se lee como un PROGRESO —500 aulas ya hicieron
 * algo— cuando es lo contrario: un recorte del payload, porque el motor manda
 * las primeras 500 filas. El mismo par de números admite las dos lecturas y son
 * opuestas: una dice que el operativo avanza y la otra que la pantalla no está
 * enseñando todo.
 *
 * «se ven» lo desambigua en dos palabras. Medido en Avance el 2026-08-23, donde
 * la frase salía dos veces —«Status de aplicación» y «Cursos-horario por
 * cobertura»— sobre un plan de 2.616.
 *
 * Sin recorte NO se dice «se ven»: ahí no hay nada escondido, y anunciar un
 * recorte que no existe hace dudar de una cifra completa.
 */
/**
 * Cuántas filas pinta la tabla como mucho.
 *
 * Se exporta porque el CONTADOR del panel vive fuera de la tabla y decía otra
 * cosa: el pie de «Avance por curso-horario» publicaba «se ven 500 de 1 392»
 * mientras el DOM tenía 400 filas, medido el 2026-09-08. Le pasaban el largo de
 * `course_status` —que el motor topea en 500— en vez de lo que de verdad se ve.
 *
 * El denominador ya se había arreglado una vez («el plan entero, no lo que cupo
 * en el payload») y el numerador se quedó con el mismo defecto una capa más
 * arriba: la fracción volvía a contar dos conjuntos distintos.
 */
export const TOPE_DE_FILAS = 400;

export function contadorDeCursosHorario(
  visibles: number,
  total: number,
  deReservaAdicional: number,
): string {
  const base = total > visibles
    ? `se ven ${fmt(visibles)} de ${fmt(total)} cursos-horario`
    : `${fmt(visibles)} cursos-horario`;
  return deReservaAdicional ? `${base} · ${fmt(deReservaAdicional)} de la reserva adicional` : base;
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
      //
      // El `data-qa-geometry-contract` de aquí abajo es INERTE y se deja a
      // propósito: `ui-quick-check` lee el contrato del mismo elemento que
      // lleva el grupo, así que éste no lo mide nadie. Pero
      // `AulasCompactWorkbenchLayout.test.ts` exige que TODO panel declare su
      // contrato en su etiqueta de apertura, y esa convención documenta qué es
      // el panel aunque el runner no la consuma. Las dos reglas conviven y el
      // conflicto está anotado; quitarlo por «inerte» rompe el test.
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
        {/* **En qué paso está el operativo.** Patrón 3 del catálogo: el
            recorrido de Cálculo marca con un badge dónde estás, y estas cuatro
            tarjetas eran una rejilla al mismo nivel —tenían tono `current` y
            nadie lo leía como «aquí»—. La fase en curso es la primera que
            todavía no está lista; si todas lo están, no se marca ninguna: el
            operativo ya pasó la preparación.

            El badge va POSICIONADO y no en el flujo: el grupo declara contrato
            `equal` y una tarjeta con un renglón de más rompería el alto común. */}
        {cards.map((card, i) => {
          const enCurso = cards.findIndex((c) => c.tone !== "ready") === i;
          return (
            <article
              key={card.label}
              className={`is-${card.tone}`}
              data-fase={enCurso ? "actual" : undefined}
            >
              {enCurso ? <em className="mon-aulas-fase-aqui">Estás aquí</em> : null}
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          );
        })}
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

function renderAulasView({
  view,
  dashboard,
  // Recarga la vista tras marcar un complemento o un refuerzo: el plan cambia y
  // sin esto la pantalla sigue ofreciendo el aula que se acaba de apartar.
  onGuardado = undefined,
  operations,
  vacioSinTablero,
  registro,
  fuentes,
  pestana,
  foco,
  onFoco,
  volumen = {},
  comoMide = null,
  criterioDeEfectiva = null,
  criterioDeAula = null,
  irAPestana = null,
  verFichaDe = null,
  onDeclararUmbralDeDuracion = null,
  onFijarReparto = null,
  onConfirmarDuracion = null,
  onImportarDisponibilidad = null,
  onPlantillaDisponibilidad = null,
  onDeclararRango = null,
  fueraDelReparto = [],
  onDeclararFuera = null,
  onResortear = null,
  onConcentrar = null,
  distribucionRecordada = null,
  onPublicarDistribucion = null,
  onSincronizarDistribucion = null,
  sincronizacion = null,
}: {
  view: MonitoreoSeccion;
  dashboard: MonitoreoAulasDashboard | null;
  operations: ReactNode;
  vacioSinTablero: ReactNode;
  registro: ReactNode;
  /** Las fuentes del estudio; Fuentes es la sección que promete decir cuáles son. */
  fuentes: ReadonlyArray<MonitoreoSource>;
  pestana: string;
  /** Corte elegido en el resumen de cuotas; vive en la URL, no en un estado suelto. */
  foco: FocoDeCuota;
  onFoco: (foco: FocoDeCuota) => void;
  /**
   * Cuánto trajo la plataforma: `n_rows` y `variables` del ESTADO, no del
   * tablero. Se pasan porque esta función no ve el estado —recibe sólo el
   * dashboard—, y sin ellos la tarjeta de la fuente describía igual una base de
   * 3 700 filas y 43 columnas que una de 3 700 y dos.
   */
  volumen?: { filas?: number; columnas?: number };
  /**
   * Qué cuenta como encuesta EFECTIVA en este estudio, ya construido.
   *
   * Se pasa hecho, como `operations`: esta función no ve el estado ni sabe
   * guardar, y el panel necesita las variables de la base y el escritor de la
   * config. Gonzalo: «la sección de fuentes no deja declarar las variables que
   * definen a una encuesta efectiva».
   */
  /**
   * Las tres declaraciones que gobiernan lo que el tablero significa, ya
   * construidas. Se pasa hecha por el mismo motivo que `criterioDeEfectiva`:
   * esta función no ve el estado ni sabe guardar.
   */
  comoMide?: ReactNode;
  criterioDeEfectiva?: ReactNode;
  /**
   * La declaración de qué es un aula válida, ya construida.
   *
   * Se pasa hecha —como `criterioDeEfectiva`— porque esta función no ve el
   * estado ni sabe guardar, y el control necesita las dos cosas.
   */
  criterioDeAula?: ReactNode;
  /**
   * Cambia de pestaña dentro de la misma sección.
   *
   * Lo necesita la ficha del aula para llevar al registro de campo, que es
   * donde vive la única acción que activa un reemplazo: la ficha dice lo que
   * pasó con el aula y la acción está una pestaña más allá. Se pasa como
   * función y no se resuelve aquí porque quien recuerda la pestaña activa de
   * cada sección es el componente de arriba.
   */
  irAPestana?: ((clave: string) => void) | null;
  /**
   * Del código de un curso-horario a su ficha: cruza de sección, mueve su
   * pestaña y deja el foco puesto. Lo arma la página, que es quien recuerda la
   * pestaña activa de cada sección.
   */
  verFichaDe?: ((codigo: string) => void) | null;
  /**
   * Declarar a partir de cuántos minutos una respuesta es sospechosa.
   *
   * Va como función y no como nodo ya construido —al revés que
   * `criterioDeEfectiva` y `criterioDeAula`— porque el control vive DENTRO del
   * panel de tiempos, junto a la distribución con la que se elige el número.
   * Sacarlo a un nodo aparte lo alejaría del histograma que lo justifica.
   */
  onDeclararUmbralDeDuracion?: ((minutos: number) => void | Promise<void>) | null;
  /**
   * Fijar o soltar el aplicador de una cita del reparto (B36). Función y no
   * nodo por lo mismo que el umbral: el control vive DENTRO de la tabla de
   * Asignación, fila por fila.
   */
  onFijarReparto?: ((mapa: Record<string, string>) => void | Promise<void>) | null;
  /** B70: persistir la duración de la aplicación (config del backend). */
  onConfirmarDuracion?: ((min: number) => void | Promise<void>) | null;
  /** B74: importar el excel de disponibilidad de aplicadores. */
  onImportarDisponibilidad?: ((archivo: File) => void | Promise<void>) | null;
  /** Descargar la plantilla vacía de disponibilidad. */
  onPlantillaDisponibilidad?: (() => void | Promise<void>) | null;
  /** B75: declarar/limpiar el rango de despliegue del reparto. */
  onDeclararRango?: ((rango: { desde: string; hasta: string } | null) => void | Promise<void>) | null;
  /** Los tramos del operativo con su estado derivado, de paso hacia la asignación. */
  tramos?: MonitoreoAulasTramo[];
  onGuardarTramos?: ((tramos: { nombre: string; desde: string; hasta: string }[]) => void | Promise<void>) | null;
  guardandoTramos?: boolean;
  /** Quién no sale en el despliegue vigente, y cómo cambiarlo. */
  fueraDelReparto?: ReadonlyArray<string>;
  onDeclararFuera?: ((nombres: string[]) => void | Promise<void>) | null;
  /** B67: pedir otro sorteo del reparto. */
  onResortear?: ((semillaSiguiente: number) => void | Promise<void>) | null;
  /** Dictado 2026-09-04: concentrar el día del aplicador en el reparto. */
  onConcentrar?: ((valor: boolean) => void | Promise<void>) | null;
  /** S7: el Sheets de los aplicadores recordado y su publicación. */
  distribucionRecordada?: MonitoreoAulasDistribucionSheets | null;
  onPublicarDistribucion?: ((enlace?: string) => void | Promise<void>) | null;
  onSincronizarDistribucion?:
    | ((aplicar: boolean, enlace?: string) => void | Promise<void>)
    | null;
  sincronizacion?: MonitoreoAulasSincronizacion | null;
  /** Recarga la vista tras marcar un complemento (B) o un refuerzo (C). */
  onGuardado?: () => void;
}) {
  // **El foco cruza la sección entera.** Es una dimensión declarada de la
  // gramática de navegación, viaja en la URL y lo obedecía UNA sola superficie
  // —la tabla de cuotas— teniendo el perfil SEIS listas de las mismas veinte
  // facultades. Para saber cómo va Derecho había que cazar su fila seis veces.
  // Se pregunta por el EJE, no por su nombre de hoy: en un estudio cuyas metas
  // son por nivel el foco llega como `nivel:7` y esta comparación lo daba por
  // «no es el eje», así que la sección entera dejaba de obedecer al foco. La
  // clave la declara el motor en `avance_cuota.eje`; sin ella, `facultad`.
  const ejeDeLaSeccion = String(
    (dashboard as { avance_cuota?: { eje?: { clave?: unknown } } } | null)
      ?.avance_cuota?.eje?.clave ?? "facultad",
  );
  const facultadEnFoco = esFocoDelEje(foco, ejeDeLaSeccion) ? foco!.valor : undefined;
  // El umbral declarado, leído del mismo bloque que dibuja el panel de tiempos
  // para que las dos pantallas no puedan discrepar.
  const umbralDeDuracion = (() => {
    const u = (dashboard as { tiempos?: { umbral?: { declarado?: unknown; minutos?: unknown } } } | null)
      ?.tiempos?.umbral;
    const m = Number(u?.minutos);
    return { declarado: u?.declarado === true, minutos: Number.isFinite(m) ? m : null };
  })();

  if (view === "fuentes") {
    return (
      <AulasSeccionFuentes
        dashboard={dashboard}
        operations={operations}
        fuentes={fuentes}
        volumen={volumen}
        comoMide={comoMide}
        criterioDeEfectiva={criterioDeEfectiva}
        umbralDeDuracion={umbralDeDuracion}
        onDeclararUmbralDeDuracion={onDeclararUmbralDeDuracion}
      />
    );
  }
  // El vacío lo pone la página, que es la que sabe si el plan está importado.
  // Ver `VacioSinTablero`.
  if (!dashboard) return vacioSinTablero;
  if (view === "modelo") {
    return (
      <AulasSeccionModelo
        dashboard={dashboard}
        pestana={pestana}
        facultadEnFoco={facultadEnFoco}
        onFoco={onFoco}
        verFichaDe={verFichaDe}
        tabla={DataTable}
        traza={<HandoffTracePanel dashboard={dashboard} />}
        agendaRows={agendaRows}
        agendaReservas={agendaReservas}
        onFijarReparto={onFijarReparto}
        onConfirmarDuracion={onConfirmarDuracion}
        onImportarDisponibilidad={onImportarDisponibilidad}
        onPlantillaDisponibilidad={onPlantillaDisponibilidad}
        onDeclararRango={onDeclararRango}
        fueraDelReparto={fueraDelReparto}
        onDeclararFuera={onDeclararFuera}
        onResortear={onResortear}
        onConcentrar={onConcentrar}
        distribucionRecordada={distribucionRecordada}
        onPublicarDistribucion={onPublicarDistribucion}
        onSincronizarDistribucion={onSincronizarDistribucion}
        sincronizacion={sincronizacion}
      />
    );
  }
  if (view === "calidad") {
    return (
      <AulasSeccionCalidad
        dashboard={dashboard}
        criterioDeAula={criterioDeAula}
        facultadEnFoco={facultadEnFoco}
        foco={foco}
        irAPestana={irAPestana}
        onDeclararUmbralDeDuracion={onDeclararUmbralDeDuracion}
        onFoco={onFoco}
        pestana={pestana}
        registro={registro}
      />
    );
  }
  if (view === "consultas") {
    return (
      <AulasSeccionConsultas
        dashboard={dashboard}
        Tabla={DataTable}
        pestana={pestana}
        reemplazosEnOrdenDeCadena={reemplazosEnOrdenDeCadena}
        facultadEnFoco={facultadEnFoco}
        // El mismo par que ya recibe Calidad: `?foco=aula:<código>` abre
        // «Buscar por código» sobre ese curso-horario, y la ficha que se está
        // viendo se escribe de vuelta en la dirección.
        foco={foco}
        onFoco={onFoco}
        // Marcar un complemento o un refuerzo cambia el plan: sin recargar, la
        // pantalla sigue ofreciendo como disponible el aula que se acaba de
        // apartar.
        onGuardado={onGuardado}
      />
    );
  }
  // **Las derivaciones de Avance se mudaron con sus pestañas.** `quotaRows`,
  // `quotaEnFoco` y `cuotaDiseno` viven en `AulasPestanaCuotas`; `estratoRows`
  // y `estratoRowsLegibles`, en `AulasPestanaEstratos`. Dejarlas aquí las
  // convertía en código muerto: cada pestaña ya las calcula. Mover el JSX sin
  // mover el peso habría dejado el archivo igual de gordo.
  return (
    // `aulas-tablas-apiladas`: sin ella el stack es grid y asigna 0 px a la fila
    // cuyo contenido no la empuja —medido: el panel del gráfico quedaba en 26 px
    // y el gráfico se dibujaba encima de la tabla—. La clase lo pasa a flex con
    // hijos que no se encogen, que es lo que ya arregló el reparto de alto.
    <div className="mon-profile-stack aulas-tablas-apiladas">
      <AulasPestanaResumen
        dashboard={dashboard}
        pestana={pestana}
        tabla={DataTable}
        facultadEnFoco={facultadEnFoco}
        onFoco={onFoco}
      />
      <AulasPestanaEstratos dashboard={dashboard} pestana={pestana} tabla={DataTable} facultadEnFoco={facultadEnFoco} />
      <AulasPestanaEfectividad
        dashboard={dashboard}
        pestana={pestana}
        facultadEnFoco={facultadEnFoco}
        onFoco={onFoco}
      />
      <AulasPestanaRendimiento
        dashboard={dashboard}
        pestana={pestana}
        facultadEnFoco={facultadEnFoco}
        onFoco={onFoco}
        diasDeCampoDelCorte={diasDeCampoDelCorte}
      />
      <AulasPestanaCuotas
        dashboard={dashboard}
        pestana={pestana}
        foco={foco}
        facultadEnFoco={facultadEnFoco}
        onFoco={onFoco}
        tabla={DataTable}
        // Llegó con «Consumo de la reserva», que vino de Rendimiento el
        // 2026-09-08 para quedar junto a «A qué aula del banco ir».
        diasDeCampoDelCorte={diasDeCampoDelCorte}
      />
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
  // Espera del job de descarga de la plataforma, amarrada al ciclo de vida de
  // esta página: al salir del módulo el poll se corta en vez de seguir vivo.
  const esperarSyncDeFuentes = useWaitForSourceSyncJob();
  const [guardandoTramos, setGuardandoTramos] = useState(false);
  const [guardandoFacultad, setGuardandoFacultad] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tono: TonoAviso }>({
    texto: "", tono: "ok",
  });
  // El recibo del último ensayo o de la última sincronización: es lo que decide
  // si se ofrece el botón que escribe.
  const [sincronizacion, setSincronizacion] = useState<MonitoreoAulasSincronizacion | null>(null);
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
  const [guardandoComoMide, setGuardandoComoMide] = useState(false);
  const [guardandoCriterio, setGuardandoCriterio] = useState(false);

  const activeDef = useMemo(
    () => AULAS_WORKBENCH_VIEWS.find((item) => item.key === seccionActiva) ?? AULAS_WORKBENCH_VIEWS[0],
    [seccionActiva],
  );
  const dashboard = dashboardFromState(state);
  // **La clave del eje de cuotas del estudio, leída del motor.**
  //
  // El bloque `avance_cuota` declara de qué son sus celdas (`eje.clave`:
  // `facultad` para todo lo vigente, `nivel` para CCSS Perfil 2026-II). Se lee
  // aquí una vez y baja: preguntar por «facultad» en cada sitio era una
  // respuesta cableada que en un estudio por nivel decía «no es el eje».
  // Un payload viejo sin `eje` cae a `facultad`, que es lo que era.
  const ejeDeclarado = (dashboard as {
    avance_cuota?: { eje?: { clave?: string; etiqueta?: string; etiqueta_plural?: string; etiqueta_sin?: string } | null };
  } | null)?.avance_cuota?.eje ?? null;
  const ejeClave = String(ejeDeclarado?.clave ?? "facultad");
  // Las categorías de una dimensión descriptiva, tal como el motor las publica.
  // **Se leen de `avance_cuota.composicion` y no de `quotas.category_profiles`**:
  // el payload del estado RECORTA esas listas —pesaban ~54 MB— y sustituirlas
  // por conteos deja `undefined` aquí en un estudio real y cero en los tests
  // sintéticos. Es el fallo mudo más caro de este perfil.
  const categoriasDeLaComposicion = useCallback((dimension: string): string[] => {
    const dims = (dashboard as {
      avance_cuota?: { composicion?: { dimensiones?: Record<string, { filas?: Array<{ categoria?: unknown }> }> } | null };
    } | null)?.avance_cuota?.composicion?.dimensiones;
    const filas = dims?.[dimension]?.filas ?? [];
    // Ya vienen ordenadas por población desde el motor: no se reordenan.
    return filas.map((f) => String(f?.categoria ?? "").trim()).filter((v) => v.length > 0);
  }, [dashboard]);
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
  /**
   * Las facultades del estudio, para el selector de la cabecera.
   *
   * Salen de `quotas_sex_faculty`, la lista que fija el DISEÑO: tomarlas de lo
   * que aparece en el parte dejaría fuera justo las que no han empezado, que
   * son las que hay que ir a mirar. Orden alfabético porque el selector se
   * recorre a mano con las flechas y el orden por rendimiento cambia cada día.
   *
   * **Salían de `quotas_sex_faculty` y ésa es la lista equivocada.** Son las
   * celdas de SEXO, y un estudio cuya meta es sólo por nivel no declara ninguna:
   * medido en el simulacro de CCSS Perfil 2026-II, la lista salía **vacía** y con
   * ella **la dimensión del eje desaparecía del selector de la cabecera** — el
   * control ofrecía «Carrera» y «Sexo» y ni una palabra del eje que manda.
   *
   * Ahora salen de `avance_cuota.facultades`, que es la lista del diseño para el
   * EJE y existe declare o no cuotas de sexo. El razonamiento de la cabecera no
   * cambia: sigue siendo el diseño y no lo que ha aparecido.
   */
  const facultadesDelEstudio = useMemo(() => valoresDelEje(
    (dashboard as { avance_cuota?: { facultades?: Array<Record<string, unknown>> } } | null)
      ?.avance_cuota?.facultades,
    (dashboard?.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
  ), [dashboard]);
  const facultadDeLaCabecera = esFocoDelEje(foco, ejeClave) ? foco!.valor : "";
  const cambiarFoco = useCallback(
    (siguiente: FocoDeCuota) => escribirFoco(textoDesdeFoco(siguiente) || null),
    [escribirFoco],
  );
  const corte = useMemo(() => corteAulas(state, dashboard), [state, dashboard]);
  const aulasConfig = state?.config?.aulas_universitarias ?? null;
  // A5: lo declarado fuera del operativo y el nombre del colector, para la UI
  // del criterio y sus sugerencias.
  const colectorDeclarado = String(state?.aulas_universitarias?.source_mapping?.collector_var ?? "collectorID");
  const descartesDeclarados: string[] = (state?.aulas_universitarias?.source_mapping?.descartes ?? [])
    .flatMap((d) => (d.values ?? []).map(String));
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
  // **Un mismo acto, un mismo nombre.** Este botón y el «Traer respuestas» del
  // panel de Fuentes llaman los DOS a `syncField()`: son la misma acción
  // ofrecida en dos sitios. Se llamaba «Recargar», y con dos nombres para lo
  // mismo nadie sabe cuál aprieta ni qué esperar — Gonzalo, el 2026-09-09: «no
  // entiendo el propósito de estos dos botones entonces». El título dice lo que
  // hace en el orden en que lo hace, que es lo que faltaba: primero pide a la
  // plataforma, después recalcula.
  const refreshTitle = busy
    ? "Trayendo respuestas de la plataforma..."
    : imported
      ? "Pide las respuestas nuevas a la plataforma y recalcula el corte de campo, la agenda y el avance"
      : "Primero importa el plan desde el cálculo de muestra (sección Fuentes)";
  // «Avance» NO trae datos: abre la sección y la recalcula con lo que el
  // proyecto ya tiene. Decirlo evita que se lea como una segunda sincronización.
  const advanceTitle = busy
    ? "Actualizando vista de cursos-horario..."
    : "Abre la sección Avance y la recalcula con los datos que ya están en el proyecto (no pide nada a la plataforma)";

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

  /**
   * La plantilla de disponibilidad, para que haya qué importar.
   *
   * El motor la sabía escribir —días, franjas, el 1 en verde y el 0 en rojo—
   * y no la pedía nadie: hasta hoy el coordinador tenía que adivinar el
   * formato que el lector espera. Misma mecánica de descarga efímera que el
   * libro: un Excel operativo no vive dentro del proyecto, y sacarlo es el punto.
   */
  const plantillaDisponibilidad = useCallback(async () => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      const res = await apiMonitoreoAulasDisponibilidadPlantilla();
      setAviso({
        texto: "Plantilla lista" +
          (res.aplicadores
            ? ": trae escritos los " + fmt(res.aplicadores) + " aplicadores ya declarados."
            : ": se llena con el nombre de cada aplicador y un 1 o un 0 por franja.") +
          " Al llenarla, vuelve por «Importar disponibilidad».",
        tono: "ok",
      });
      const a = document.createElement("a");
      a.href = res.download_url;
      a.download = res.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar la plantilla.");
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

  /**
   * B74 (dictado 2026-09-03): «la pestaña de disponibilidad no tiene ningún
   * mecanismo para poder importarla… ¿qué pasa si quiero enviarte una
   * actualizada y volver a hacer una asignación?». La misma vía de dos pasos
   * que el libro (upload → import por file_id); el refresco forzado trae el
   * reparto rearmado con la oferta nueva — las fijaciones sobreviven porque
   * viven en el config, no en la disponibilidad.
   */
  const importarDisponibilidad = useCallback(async (archivo: File) => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      const subido = await apiUpload(archivo, "aulas_disponibilidad");
      const res = await apiMonitoreoAulasDisponibilidad({ file_id: subido.file_id });
      // El aviso lo arma `avisoDisponibilidadImportada`: aquí se contaban TODOS
      // los avisos del lector y se les llamaba «celdas ilegibles», que dejó de
      // ser cierto en cuanto el lector empezó a declarar filas —una persona en
      // dos filas, una disponibilidad sin dueño—. Y los textos, que son los que
      // dicen la fila del excel, no se enseñaban nunca.
      setAviso(avisoDisponibilidadImportada(res));
      await loadView(seccionActiva, true, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer la disponibilidad.");
    } finally {
      setMutating(false);
    }
  }, [loadView, seccionActiva]);

  /**
   * La misma operación por la otra puerta: el Sheets en vez del archivo.
   *
   * No hay paso de subida —no hay nada que subir— pero de ahí en adelante es
   * idéntico, y el aviso se arma con el MISMO `avisoLibroImportado`: la
   * respuesta tiene la misma forma venga de donde venga, y ramificar aquí por
   * procedencia sería inventar una diferencia que el backend ya no hace.
   */
  const leerDeSheets = useCallback(async (enlace: string) => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      const res = await apiMonitoreoAulasImportarSheets(enlace);
      setState(res.state);
      setAviso(avisoLibroImportado(res));
      await loadView(seccionActiva, true, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el Sheets.");
    } finally {
      setMutating(false);
    }
  }, [loadView, seccionActiva]);

  /**
   * La vuelta de ese viaje: publicar el libro al MISMO destino recordado.
   *
   * Sin `enlace` el backend usa el que guarda la config (`libro_sheets`); con
   * enlace lo recuerda ANTES de publicar, así que un fallo de red no pierde lo
   * pegado. El aviso cuenta hoja por hoja qué pasó —una `respetada` con su
   * motivo, que es la regla de dueño hecha visible, no un fallo—. La recarga
   * silenciosa trae la config con el destino recién recordado al campo.
   */
  /**
   * S7: publicar la distribución de la semana al Sheets de los aplicadores.
   * Con enlace lo recuerda; sin él usa el recordado. La recarga trae el
   * bloque recordado y la huella nueva, y el aviso de Asignación pasa a
   * «al día».
   */
  const publicarDistribucion = useCallback(async (enlace?: string) => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      const res = await apiMonitoreoAulasPublicarDistribucion(enlace);
      setAviso(avisoDistribucionPublicada(res));
      await loadView(seccionActiva, true, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo publicar la distribución a los aplicadores.");
    } finally {
      setMutating(false);
    }
  }, [loadView, seccionActiva]);

  /**
   * El ciclo del Sheets de los aplicadores en una sola acción: lee la hoja,
   * adopta lo que el coordinador decidió, añade las agendadas que no tienen
   * cita y refresca el ESTADO. `aplicar = false` es un ENSAYO y no escribe.
   *
   * Hasta hoy los cuatro movimientos se hacían con scripts fuera de la app, así
   * que el operativo dependía de que hubiera alguien con una consola abierta.
   */
  const sincronizarDistribucion = useCallback(async (aplicar: boolean, enlace?: string) => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      // **El enlace pegado viaja con la llamada.** Sin él sólo servía el destino
      // recordado, y un proyecto reabierto que aún no lo tiene guardado enseñaba
      // el enlace en su campo y devolvía «No hay Sheets de la distribución que
      // sincronizar: pega su enlace una vez». El ensayo lo recuerda al llegar,
      // así que pegarlo una vez basta — que es lo que el mensaje prometía.
      const res = await apiMonitoreoAulasSincronizarDistribucion({ aplicar, url: enlace });
      setSincronizacion(res);
      // El motor ya redacta la frase que cierra la jornada; la pantalla no la
      // vuelve a componer para que no existan dos versiones del mismo recibo.
      setAviso({
        texto: res.aplicado ? res.resumen : `Ensayo: ${res.resumen}`,
        // Un aula CORREGIDA es motivo de atención aunque todo lo demás cuadre:
        // significa que la hoja que los veintidós tienen abierta les estaba
        // dando un aula que el libro ya había cambiado.
        tono:
          res.sin_aplicador.length ||
          res.estado.conflictos.length ||
          (res.aulas?.corregidas ?? 0) > 0 ||
          // Que el reparto de la app no sea el de la hoja es lo más grave que
          // puede decir este recibo: significa que la pestaña de Asignación
          // lleva quién sabe cuánto enseñando una foto vieja.
          res.fijaciones_desfasadas?.hay
            ? "atencion"
            : "ok",
      });
      if (aplicar) await loadView(seccionActiva, true, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo sincronizar la distribución.");
    } finally {
      setMutating(false);
    }
  }, [loadView, seccionActiva]);

  /**
   * **Releer el cruce con el otro estudio.** A petición y no al abrir ni al
   * sincronizar: leer el plan ajeno entero y su Sheets encarece el warm start,
   * y atarlo a «traer respuestas» lo metería bajo un botón que además publica.
   *
   * No recarga el tablero: el cruce no cambia ninguna cifra del avance —informa,
   * no descuenta— así que sólo el recibo tiene algo nuevo que decir.
   */
  const recalcularTraslape = useCallback(async () => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      setAviso(avisoTraslapeRecalculado(await apiMonitoreoAulasRecalcularTraslape()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo releer el cruce con el otro estudio.");
    } finally {
      setMutating(false);
    }
  }, []);

  const publicarASheets = useCallback(async (enlace?: string) => {
    setMutating(true);
    setError("");
    setAviso({ texto: "", tono: "ok" });
    try {
      const res = await apiMonitoreoAulasPublicarLibro(enlace);
      setAviso(avisoLibroPublicado(res));
      await loadView(seccionActiva, true, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo publicar el libro al Sheets.");
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

  /**
   * Dictado 2026-09-04: qué columna de la base dice el sexo. Se persiste en el
   * mismo `source_mapping` que el resto del criterio y el refresco trae las
   * cifras por sexo ya contadas; vacío la des-declara.
   */
  const declararVariableDeSexo = useCallback(async (variable: string) => {
    try {
      await apiMonitoreoAulasConfig({
        source_mapping: {
          ...(state?.aulas_universitarias?.source_mapping ?? {}),
          sex_var: variable,
        },
      } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva, state]);

  /**
   * A5 (2026-09-08): los valores de la variable de sexo (mujeres / hombres) y
   * los códigos de colector fuera del operativo, guardados en el MISMO
   * `source_mapping` que la variable y los filtros. El 07/09 se escribieron
   * por API; sin pantalla el próximo estudio repite el día 1 de éste.
   */
  const declararValoresDeSexo = useCallback(async (v: { mujeres: string[]; hombres: string[] }) => {
    try {
      await apiMonitoreoAulasConfig({
        source_mapping: {
          ...(state?.aulas_universitarias?.source_mapping ?? {}),
          sex_female_values: v.mujeres,
          sex_male_values: v.hombres,
        },
      } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva, state]);

  const declararDescartes = useCallback(async (valores: string[]) => {
    const mapping = state?.aulas_universitarias?.source_mapping;
    const colector = String(mapping?.collector_var ?? "collectorID");
    try {
      await apiMonitoreoAulasConfig({
        source_mapping: {
          ...(mapping ?? {}),
          descartes: valores.length ? [{ var: colector, values: valores }] : [],
        },
      } as unknown as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva, state]);

  /**
   * **Las tres declaraciones de «cómo mide este estudio»**, por el mismo camino
   * que el resto de la config de aulas: guardar y refrescar con el scope de
   * VALIDACIÓN, que es donde viajan los veredictos que cambian. Con el scope de
   * la sección el panel seguiría enseñando el reparto anterior.
   *
   * Se envía sólo lo que cambió: un `POST` con las tres claves reescribiría las
   * otras dos con lo que la pantalla tenía en memoria, que no es lo mismo que
   * lo que el motor tiene guardado.
   */
  const declararComoMide = useCallback(async (cambio: Partial<ComoMideElEstudio>) => {
    setGuardandoComoMide(true);
    setError("");
    try {
      const cuerpo: Record<string, unknown> = {};
      if (cambio.eje !== undefined) cuerpo.eje_cuota = cambio.eje;
      if (cambio.agrupacion !== undefined) cuerpo.agrupacion_operativa = cambio.agrupacion;
      if (cambio.inicioCampo !== undefined) cuerpo.inicio_campo = cambio.inicioCampo;
      if (!Object.keys(cuerpo).length) return;
      await apiMonitoreoAulasConfig(cuerpo as Partial<MonitoreoAulasConfig>);
      const next = await apiMonitoreoState({
        includeReports: true, reportScope: "validation_summary", force: true,
      });
      setState(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardandoComoMide(false);
    }
  }, []);

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
  /**
   * Declarar el umbral de duración sospechosa.
   *
   * Mismo camino que `aula_valida` y que el criterio de respuesta válida: la
   * config de aulas y después un refresco con el scope de VALIDACIÓN, porque el
   * veredicto que cambia viaja ahí. Sin ese scope el panel seguiría enseñando
   * «no ha declarado» después de declararlo, y un botón que no puede mostrar su
   * propio efecto enseña a desconfiar del botón.
   */
  const guardarUmbralDeDuracion = useCallback(async (minutos: number) => {
    try {
      await apiMonitoreoAulasConfig({ duracion_sospecha_min: minutos } as Partial<MonitoreoAulasConfig>);
      const next = await apiMonitoreoState({
        includeReports: true, reportScope: "validation_summary", force: true,
      });
      setState(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  /**
   * Fijar o soltar el aplicador de una cita (B36, dictado 2026-09-02:
   * «mecanismo propio de asignación y reasignación, que sea equitativo»).
   *
   * Viaja el mapa COMPLETO de fijaciones —la whitelist del config lo
   * reemplaza entero— y después el mismo refresco forzado que las demás
   * declaraciones: el reparto recalculado con la fijación viaja en el
   * dashboard, y sin refresco el selector parecería no hacer nada.
   */
  const fijarReparto = useCallback(async (mapa: Record<string, string>) => {
    try {
      await apiMonitoreoAulasConfig({ reparto_fijado: mapa } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva]);

  /**
   * B70 (dictado 2026-09-03): confirmar el slider PERSISTE la duración en el
   * config (`duracion_aplicacion_min`) y fuerza el refresco — ventanas,
   * franjas, reparto y aviso del día se rearman con ella en el backend. Sin
   * esto el slider era estado local y el aviso salía con los 20 del default.
   */
  /**
   * B75: el rango de despliegue del reparto — se persiste en el config
   * (`reparto_rango`; `{}` lo des-declara) y el refresco forzado trae el
   * reparto re-particionado con lo aplazado declarado.
   */
  /**
   * Los TRAMOS del operativo (dictado 2026-09-15). Se persiste la LISTA
   * entera, porque quitar uno es tan legítimo como añadirlo y un merge por
   * nombre dejaría vivo el que alguien acaba de borrar. `[]` devuelve el
   * estudio al respaldo por semanas de calendario, que es el comportamiento de
   * siempre para quien no los ha declarado.
   */
  /**
   * QUÉ pregunta dice la facultad del alumno, y qué es cada código. Las dos
   * cosas van juntas en la misma llamada: una variable declarada sin catálogo
   * hace que el cruce compare un «7» contra un nombre, y el motor se niega —con
   * razón— porque eso daría 100 % de desacuerdo sobre un campo sano.
   */
  const declararFacultad = useCallback(async (
    variable: string, etiquetas: Record<string, string>,
  ) => {
    setGuardandoFacultad(true);
    try {
      await apiMonitoreoAulasConfig({
        source_mapping: {
          ...(state?.aulas_universitarias?.source_mapping ?? {}),
          faculty_var: variable,
          faculty_labels: etiquetas,
        },
      } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardandoFacultad(false);
    }
  }, [loadView, seccionActiva, state]);

  const guardarTramos = useCallback(async (
    tramos: { nombre: string; desde: string; hasta: string }[],
  ) => {
    setGuardandoTramos(true);
    try {
      await apiMonitoreoAulasConfig({ tramos } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardandoTramos(false);
    }
  }, [loadView, seccionActiva]);

  const declararRango = useCallback(async (rango: { desde: string; hasta: string } | null) => {
    try {
      await apiMonitoreoAulasConfig({ reparto_rango: rango ?? {} } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva]);

  /**
   * B67: otro sorteo — la semilla siguiente se persiste en el config y el
   * refresco trae el reparto con el desempate rotado; equidad y fijaciones
   * intactas (contrato del motor).
   */
  /**
   * C9: quién no sale en este despliegue. Se persiste en el config
   * (`reparto_fuera`) y el refresco forzado trae el reparto ya sin esa gente
   * —el motor los quita ANTES de repartir, así que las citas se reparten entre
   * quienes sí salen en vez de quedar descubiertas—.
   */
  const declararFuera = useCallback(async (nombres: string[]) => {
    try {
      await apiMonitoreoAulasConfig({ reparto_fuera: nombres } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva]);

  const resortear = useCallback(async (semillaSiguiente: number) => {
    try {
      await apiMonitoreoAulasConfig({ reparto_semilla: semillaSiguiente } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva]);

  /**
   * Dictado 2026-09-04: concentrar el día del aplicador —«que sus cursos
   * horario no estén dispersos en toda la semana»—. Se persiste en el config
   * (`reparto_concentrado`) y el refresco forzado trae el reparto rearmado
   * con el criterio nuevo; la equidad y lo fijado a mano siguen mandando.
   */
  const concentrar = useCallback(async (valor: boolean) => {
    try {
      await apiMonitoreoAulasConfig({ reparto_concentrado: valor } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva]);

  const confirmarDuracion = useCallback(async (min: number) => {
    try {
      await apiMonitoreoAulasConfig({ duracion_aplicacion_min: min } as Partial<MonitoreoAulasConfig>);
      await loadView(seccionActiva, true, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadView, seccionActiva]);

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
      // **Primero TRAER de la plataforma, y sólo después recalcular.**
      //
      // `/aulas/sync` no baja nada: recalcula con el snapshot que ya está en la
      // sesión. El botón se llama «Sincronizar campo» y durante dos jornadas
      // (2026-09-08 y 09) devolvió las mismas cifras viejas sin decir por qué:
      // Gonzalo lo pulsaba, veía 579 respuestas del día anterior y no había
      // nada en pantalla que dijera que no se había pedido nada a Kobo. La
      // descarga vive en `/monitoreo/sync`, que es un job.
      //
      // Un fallo de la descarga NO cancela el recálculo: el corte de campo se
      // rehace igual con lo que haya y el motivo se dice como aviso. Sin
      // fuentes activas no se pide nada y no es un error: hay estudios de aulas
      // que cargan la base a mano.
      let avisoDescarga = "";
      if (activeSources > 0) {
        try {
          // **Sin config.** La de la pantalla viene RECORTADA del payload (sin
          // plan ni tablas del marco) y el backend la guardaba tal cual: tras
          // cada «Traer respuestas» la población de «A quién se está
          // alcanzando» quedaba en 0 (CCSS, 2026-09-23). Aquí no hay nada que
          // editar en ella: el backend usa la que ya tiene.
          const inicio = await apiMonitoreoSync(undefined, [], { syncMode: "advance" });
          if (inicio?.job_id) await esperarSyncDeFuentes(inicio.job_id);
        } catch (cause) {
          avisoDescarga = cause instanceof Error ? cause.message : String(cause);
        }
      }
      const result = await apiMonitoreoAulasSync();
      setState(result.state);
      if (avisoDescarga) {
        setAviso({
          texto: `No se pudieron traer respuestas nuevas de la plataforma (${avisoDescarga}). Las cifras son las de la última sincronización que sí entró.`,
          tono: "atencion",
        });
      }
      // La conversación con el Sheets (B7) viaja SOLO con destino recordado.
      // Sin bloque el aviso ni se toca: el sync se comunica como siempre. Y un
      // fallo de la conversación NO es un fallo del sync —el corte de campo
      // sí se recalculó—, así que va como aviso de atención, no a `error`.
      const conversacion = avisoConversacion(result.libro_conversacion);
      // B3 (2026-09-08): si la última sincronización volvió sin ningún registro,
      // se dice. El 08/09 Gonzalo leyó «Efectivas 0» en una pantalla que no
      // tenía nada que le avisara de que no había traído nada, y la creyó. El
      // motor redacta la causa y su consecuencia; aquí sólo se enseña, y manda
      // sobre el aviso del libro porque decide si las cifras son de hoy.
      // **Un solo sitio para dos avisos: manda la gravedad, no el orden.**
      //
      // El de las fuentes se escribía DESPUÉS y pisaba al del libro sin mirar
      // qué decía, así que una publicación fallida quedaba tapada por un «no
      // trajo respuestas nuevas». Gonzalo lo vio desde fuera el 2026-09-16:
      // «actualiza la data de la app pero ya no actualiza el Sheets», sin
      // ningún error en pantalla. Ver `avisoDelSync.ts`.
      const elegido = avisoDelSync(conversacion, result.state?.aviso_fuentes_vacias);
      // Y lo que se retiró de la distribución de aplicadores, junto al aviso
      // que ya hay o solo; un fallo de esa limpieza pide atención.
      const retiro = fraseDelRetiro(result.distribucion_retiro);
      if (elegido && retiro) {
        setAviso({ texto: `${elegido.texto} ${retiro.texto}`,
                   tono: retiro.tono === "atencion" ? "atencion" : elegido.tono });
      } else if (elegido || retiro) {
        setAviso((elegido ?? retiro)!);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutating(false);
    }
  }, [activeSources, state?.config, esperarSyncDeFuentes]);

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
          timeout.

          Y lista, la marca es la DIRECCIÓN de la vista (Meta B, L10):
          `monitoreo-aulas-<sección>-<pestaña>`. Con una sola marca para todo el
          modo, una pestaña muda aterrizaba en la de al lado y salía aprobada. */}
      <span
        hidden
        data-audit-ready={loading ? "false" : readinessDeAulas(seccionActiva, pestanaActiva)}
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
        // A26b — semántica dictada por el dueño (2026-09-01): «Avance es para
        // ver el avance en plataforma; Recargar es para cargar el excel y
        // todo lo demás». Estaba al revés: «Avance» conversaba con el libro y
        // «Recargar» solo releía memoria — medido: un Recargar dejó la agenda
        // en 12 con el libro en 28.
        advanceSyncDisabled={busy}
        advanceSyncLabel="Avance"
        advanceSyncTitle={advanceTitle}
        onSyncAdvance={() => {
          if (seccionActiva !== "avance") setActiveView("avance");
          void loadView("avance", true);
        }}
        syncDisabled={busy || !imported}
        syncLabel="Traer respuestas"
        syncTitle={refreshTitle}
        onSyncAll={() => { void syncField(); }}
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
        perfil="aulas"
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
            // **El MANDO vive sólo en Resumen; el foco sigue cruzando todo.**
            //
            // Está en la cabecera y no dentro de un panel porque ahí se movía con
            // el scroll. Pero estaba en las CINCO pestañas de Avance y en las
            // otras cuatro secciones, y Gonzalo lo dijo el 2026-09-10: «el
            // selector de facultades que está en el encabezado debería ser un
            // botón que sólo esté en resumen, no en las demás pestañas, porque
            // es Resumen quien maneja este selector».
            //
            // Tiene razón en el reparto: Resumen es la única pestaña donde el
            // foco FILTRA —el bloque «Respuestas» enseña las de esa facultad—;
            // en las demás sólo RESALTA una fila de un ranking
            // (`focoQueCruzaLaSeccion.test.tsx`). Un mando que en cuatro de cada
            // cinco pantallas no cambia lo que se lee, sino que pinta una fila,
            // pide más atención de la que devuelve.
            //
            // El resaltado NO se toca: sigue cruzando la sección, y quien quiera
            // quitarlo vuelve a Resumen, que es de donde salió.
            control={mandoDeFacultadVisible(seccionActiva, pestanaActiva) ? (
              <AulasSelectorDeFoco
                // El eje desde las filas del avance; carrera y sexo desde
                // `avance_cuota.composicion`, que el motor publica YA ordenado
                // por población — reordenarlos aquí haría bailar la lista con
                // cada sincronización.
                valores={{
                  eje: facultadesDelEstudio,
                  carrera: categoriasDeLaComposicion("carrera"),
                  sexo: categoriasDeLaComposicion("sexo"),
                }}
                foco={foco}
                onFoco={cambiarFoco}
                eje={ejeDeclarado}
              />
            ) : undefined}
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
            // Mientras se lee el proyecto no se sabe si hubo actualización: «Sin
            // actualización» en ese tramo afirmaba algo que nadie había leído.
            value: state?.synced_at || (loading && !state ? "Leyendo el proyecto…" : "Sin actualización"),
            ready: Boolean(state?.synced_at),
          }]}
          onCambioPestana={(key) => elegirPestana(seccionActiva, key)}
        />
        )}
      >

          <AulasKpiBand
            dashboard={dashboard}
            seccion={seccionActiva}
            pestana={pestanaActiva}
            facultadEnFoco={facultadDeLaCabecera}
            cargando={loading}
            onIr={(clave) => elegirPestana(seccionActiva, clave)}
          />
          {seccionActiva === "fuentes" ? (
            <AulasApplicationFlow
              tone="monitoreo"
              current="monitoreo"
              compact
              // «Seguimiento de la INTERVENCIÓN» convivía con el eyebrow
              // «APLICACIÓN por cursos-horario» en el mismo bloque: dos palabras
              // para lo mismo, que es la ambigüedad que este perfil lleva todo
              // el día pagando. «Intervención» es palabra del dueño (cita del
              // 18/08 en AulasMatrizUmbrales), pero el vocabulario dominante de
              // la pantalla es «aplicación» —estados, fechas, KPIs— y el bloque
              // ya lo usa de eyebrow. Se unifica hacia el dominante.
              title="Seguimiento de la aplicación por cursos-horario"
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
              // Con su sección: el botón promete fichas y «/material-campo» a
              // secas aterriza en la lista de unidades.
              action={{ to: "/material-campo?modo=aulas&seccion=catalogo&pestana=editor", label: "Abrir fichas QR" }}
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
              <>
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
                {/* Y debajo del workbench, lo que se va a publicar. Las cinco
                    tablas del libro estuvieron en Metas y volvieron aquí: allá
                    duplicaban paneles que ya existían, aquí contestan la
                    pregunta de la pestaña —qué sale— antes de que alguien le
                    dé al botón. */}
                <AulasVistaPreviaDelLibro />
              </>
            ) : renderAulasView({
              onGuardado: () => { void loadView(seccionActiva, true, true); },
              view: seccionActiva,
              dashboard,
              operations: (
                <AulasOperationsPanel
                  config={aulasConfig}
                  sources={state?.sources ?? []}
                  busy={busy}
                  origen={state?.aulas_origen}
                  onImportPlan={() => { void importPlan(); }}
                  onSyncField={() => { void syncField(); }}
              selloDeLibro={aulasConfig?.libro_publicado ?? null}
              sincronizadoEn={state?.synced_at ?? ""}
                  onGenerarLibro={() => { void generarLibro(); }}
                  onImportarLibro={(archivo) => { void importarLibro(archivo); }}
                  onLeerDeSheets={(enlace) => { void leerDeSheets(enlace); }}
                  onPublicarASheets={(enlace) => { void publicarASheets(enlace); }}
                  onRecalcularTraslape={
                    aulasConfig?.traslape_fuente?.etiqueta
                      ? () => { void recalcularTraslape(); }
                      : undefined
                  }
                  traslapeDe={aulasConfig?.traslape_fuente?.etiqueta ?? ""}
                />
              ),
              vacioSinTablero: (
                <VacioSinTablero
                  planImportado={imported}
                  fuentesActivas={activeSources}
                  fuentesDeclaradas={sourceTotal}
                  onIrAFuentes={() => setActiveView("fuentes")}
                  lecturaFallida={!state && Boolean(error)}
                  onReintentar={() => { void loadView(seccionActiva, true); }}
                />
              ),
              registro: (
                <RegistroDeCampo
                  // Del TABLERO, no de la config: el plan dejo de viajar ahi y
                  // `agenda` es un superconjunto suyo —mismos campos mas
                  // `respuestas_validas` y `brecha`— que ademas se reconstruye en
                  // cada peticion, tambien antes de la primera respuesta.
                  agenda={(dashboard?.agenda ?? []) as MonitoreoAulasPlanRow[]}
                  // La hoja de partes, sólo para el contador: sin ella el panel
                  // decía «0 con parte» mientras Consultas enseñaba «210 partes».
                  partes={(dashboard?.partes_campo ?? []) as Array<Record<string, unknown>>}
                  // Las cuotas por sexo, para que elegir un reemplazo mire lo
                  // que a la facultad le falta. Es el mismo bloque que pinta la
                  // pestaña de cuotas.
                  celdasSexo={(dashboard?.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>}
                  onGuardado={() => { void loadView(seccionActiva, true, true); }}
                  // La dirección abre el aula: `?foco=aula:CH 21` deja el
                  // formulario puesto sobre ella, que es donde vive la única
                  // acción que activa su reemplazo. Antes había que buscarla
                  // entre 196 filas, y quien la veía caer en la ruta del día no
                  // tenía cómo llegar hasta aquí.
                  codigoEnFoco={foco?.tipo === "aula" ? foco.valor : ""}
                  onElegir={(codigo) => cambiarFoco({ tipo: "aula", valor: codigo })}
                />
              ),
              fuentes: state?.sources ?? [],
              pestana: pestanaActiva,
              foco,
              onFoco: cambiarFoco,
              volumen: (
                {
                  filas: Number(state?.n_rows ?? 0) || undefined,
                  columnas: (state?.variables ?? []).length || undefined,
                }
              ),
              // Las tres declaraciones de «cómo mide este estudio», ya
              // construidas: la sección no ve el estado ni sabe guardar.
              comoMide: (
                <AulasComoMideElEstudio
                  valores={{
                    eje: state?.aulas_universitarias?.eje_cuota ?? "",
                    ejeMotivo: state?.aulas_universitarias?.eje_cuota_motivo ?? "",
                    agrupacion: state?.aulas_universitarias?.agrupacion_operativa ?? "",
                    inicioCampo: state?.aulas_universitarias?.inicio_campo ?? "",
                  }}
                  dimensiones={dashboard?.ejes_declarables ?? []}
                  padron={{
                    personas: Number(dashboard?.padron?.personas ?? 0) || 0,
                    sinNivel: Number(dashboard?.padron?.sin_nivel ?? 0) || 0,
                  }}
                  fueraDelOperativo={
                    dashboard?.respuestas_desglose?.total
                      ? Number(dashboard.respuestas_desglose.total.fuera_del_operativo ?? 0) || 0
                      : null
                  }
                  guardando={guardandoComoMide}
                  onGuardar={(cambio) => { void declararComoMide(cambio); }}
                />
              ),
              // El panel del criterio, ya construido: el render no ve el estado
              // ni sabe guardar. Sólo cuando hay base que mirar —sin variables
              // no hay nada que elegir y el panel sería un formulario vacío.
              criterioDeEfectiva: (
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
                    variableDeSexo={state?.aulas_universitarias?.source_mapping?.sex_var ?? ""}
                    facultadDeclarada={{
                      variables: (state?.variables ?? []).map((v) => ({
                        name: v.name, values: (v.values ?? []).map(String),
                      })),
                      facultadVar: state?.aulas_universitarias?.source_mapping?.faculty_var ?? "",
                      etiquetas: (state?.aulas_universitarias?.source_mapping?.faculty_labels ?? {}) as Record<string, string>,
                      // Las facultades que ofrece el desplegable salen del
                      // DISEÑO, no de la base: son las que tienen cuota, y son
                      // las que el cruce va a comparar contra lo declarado.
                      facultadesDelPlan: (aulasConfig?.design_targets?.facultades ?? [])
                        .map((f) => String(f?.facultad ?? "")).filter((f) => f !== ""),
                      control: dashboard?.control_facultad ?? null,
                      onDeclarar: declararFacultad,
                      ocupado: guardandoFacultad,
                    }}
                    onVariableDeSexo={declararVariableDeSexo}
                    valoresDeSexo={{
                      mujeres: (state?.aulas_universitarias?.source_mapping?.sex_female_values ?? []).map(String),
                      hombres: (state?.aulas_universitarias?.source_mapping?.sex_male_values ?? []).map(String),
                    }}
                    onValoresDeSexo={(v) => { void declararValoresDeSexo(v); }}
                    descartes={descartesDeclarados}
                    onDescartes={(v) => { void declararDescartes(v); }}
                    sugerenciasDeDescarte={sugerenciasDeDescarte(
                      (state?.variables ?? []).find((v) => v.name === colectorDeclarado)?.values?.map(String) ?? [],
                      (dashboard?.agenda ?? []).map((r) => String((r as { operational_code?: unknown }).operational_code ?? "")),
                      descartesDeclarados,
                    )}
                  />
                ) : null
              ),
              // La vara de aula válida, también construida aquí por lo mismo.
              criterioDeAula: (
                <AulasCriterioDeAula
                  criterio={(state?.aulas_universitarias?.aula_valida ?? null) as never}
                  hayMetas={metasDelDiseno}
                  onGuardar={guardarCriterioDeAula}
                />
              ),
              // Cambiar de pestaña dentro de la sección: quien recuerda la
              // activa de cada una es este componente, no el render.
              irAPestana: (clave) => elegirPestana(seccionActiva, clave),
              // **Del código de una entrada a su ficha.** Cruza de sección, así
              // que no le basta `irAPestana`: escribe sección, pestaña y foco
              // en UNA sola navegación, y la vista la sigue.
              //
              // Hacerlo en dos —mover la vista por estado y el foco por la
              // URL— NO funciona y falla callando: el escritor del foco navega
              // con el `search` del render actual, que todavía trae la sección
              // vieja, y el efecto de seguimiento devuelve la vista a donde
              // estaba. Medido en pantalla el 2026-09-12: el foco quedaba
              // puesto y la sección nunca cambiaba.
              //
              // No se navega a mano: escribir la dirección con `useSearchParams`
              // aquí convertiría a este archivo en el séptimo lector, que es lo
              // que el contrato de `lectoresDeDireccion` impide.
              verFichaDe: (codigo: string) => {
                escribirFoco(`aula:${codigo}`, { seccion: "consultas", pestana: "ficha" });
              },
              // El umbral de duración sospechosa: el motor lo aceptaba desde
              // siempre y no había dónde ponerlo.
              onDeclararUmbralDeDuracion: guardarUmbralDeDuracion,
              // Fijar/reasignar aplicadores del reparto (B36).
              onFijarReparto: fijarReparto,
              onConfirmarDuracion: confirmarDuracion,
              onImportarDisponibilidad: importarDisponibilidad,
              onPlantillaDisponibilidad: plantillaDisponibilidad,
              onDeclararRango: declararRango,
              // Los tramos del operativo y su estado ya derivado por el motor.
              // Van al lado del rango porque contestan la misma pregunta —«qué
              // estoy repartiendo»— y el rango queda como la excepción.
              tramos: dashboard?.tramos ?? [],
              onGuardarTramos: guardarTramos,
              guardandoTramos,
              // C9 (dictado 2026-09-12): quién NO sale este despliegue, sin
              // tener que editar el Excel de disponibilidad y recargarlo.
              fueraDelReparto: aulasConfig?.reparto_fuera ?? [],
              onDeclararFuera: declararFuera,
              onResortear: resortear,
              onConcentrar: concentrar,
              // S7: el Sheets de los aplicadores, recordado en la config.
              distribucionRecordada: aulasConfig?.distribucion_sheets ?? null,
              onPublicarDistribucion: publicarDistribucion,
              onSincronizarDistribucion: sincronizarDistribucion,
              sincronizacion,
            })}
          </div>
      </MonitoreoWorkbenchChrome>
    </div>
  );
}
