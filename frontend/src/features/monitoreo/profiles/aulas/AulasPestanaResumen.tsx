import type { ReactNode } from "react";

import { AulasAvancePorCurso } from "./AulasAvancePorCurso";
import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import { AulasAvanceEnRespuestas } from "./AulasAvanceEnRespuestas";
import { AulasCoberturaChart } from "./AulasCoberturaChart";
import { AulasResumenPorFacultad } from "./AulasResumenPorFacultad";
import { AulasResumenRespuestas } from "./AulasResumenRespuestas";
import { respuestasDeLaFacultad } from "./respuestasDeLaFacultad";
import { AulasEstadoChart } from "./AulasEstadoChart";
import { AulasEstadoPorRol } from "./AulasEstadoPorRol";
import { AulasFrenteDelOperativo } from "./AulasFrenteDelOperativo";
import { AulasCierrePorAgenda } from "./AulasCierrePorAgenda";
import { AulasRitmoDiario, type RitmoDiario } from "./AulasRitmoDiario";
import { ritmoDeLaFacultad, type RitmoDeFacultad } from "./ritmoDeLaFacultad";
import { delMapaPorFacultad } from "./delMapaPorFacultad";
import { AulasRendimientoYEfectividad } from "./AulasRendimientoYEfectividad";
import { filaDeLaFacultad } from "./resumenDeEfectividad";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { corteDelEstudio } from "./corteDelEstudio";
import { deLaFacultad } from "./deLaFacultad";
import { pronosticoDeCierre, sumarDiasDeCampo } from "./pronosticoDeCierre";
import { cierrePorAgenda } from "./cierrePorAgenda";
import { fmt, fmtCuenta } from "./kpisDeAulas";
import { TOPE_DE_FILAS, contadorDeCursosHorario } from "./AulasMonitoreoPage";
import { contadorDeLoQueReparte } from "./contadorDeLoQueReparte";
import { parteDeCampo } from "./parteDeCampo";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import type { TablaDelPerfil } from "./tablaDelPerfil";
import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow, MonitoreoRow } from "../../../../api/monitoreo";

/**
 * La pestaña «Resumen» del perfil de aulas.
 *
 * Segundo corte de `renderAulasView` —1.610 líneas con ocho pestañas dentro—,
 * con el patrón que dejó `AulasPestanaRendimiento`: los seis paneles eran
 * contiguos, así que moverlos juntos no cambia el orden del DOM, y las seis
 * guardas repetidas se vuelven una.
 *
 * **Las cuatro derivaciones vienen con la pestaña, no se pasan como props.**
 * `aulaRows`, `totalAulas`, `aulasExtra` y `contadorDeAulas` vivían sueltas en
 * `renderAulasView` y se comprobó que NADIE MÁS las usa: dejarlas allá habría
 * sido mover el JSX y no el peso.
 */
export function AulasPestanaResumen({
  dashboard, pestana, tabla, facultadEnFoco, onFoco,
}: {
  /** No nulable: `renderAulasView` ya devolvió el vacío mucho antes. */
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  /**
   * La tabla compartida del perfil; sigue viviendo en el page-file y se pasa
   * con SU forma, no como `Record<string, unknown>`: un tipo laxo aquí dejaría
   * pasar una llamada sin `rows` ni `empty`.
   */
  tabla: TablaDelPerfil;
  facultadEnFoco: string | undefined;
  onFoco: (foco: FocoDeCuota) => void;
}): ReactNode {
  if (pestana !== "resumen") return null;
  const Tabla = tabla;
  // El parte cruzado con el plan, una sola vez: lo piden «Cuándo se termina de
  // aplicar el plan» y «A quién hay que agendar», que llegaron juntos desde
  // Rendimiento el 2026-09-08. Sin `useMemo` porque esta pestaña no lo usa en
  // ningún otro hook y la guarda de arriba ya cortó el render.
  /**
   * **Con una facultad en foco, esta pestaña habla SÓLO de ella.**
   *
   * Gonzalo, dos veces: «el selector de facultad que está en el encabezado no
   * hace que los gráficos actualicen» y «todos los gráficos de resumen aún no
   * muestran sólo lo de una facultad cuando la ponemos por facultad».
   *
   * Se filtra la ENTRADA y no cada panel: las tres fuentes de esta pestaña
   * —partes, agenda y estados— traen `faculty`, así que pasarlas ya filtradas
   * deja los nueve componentes intactos y evita nueve formas distintas de
   * comparar dos nombres de facultad.
   *
   * Aquí el foco FILTRA y en las otras pestañas RESALTA, y no es una
   * incoherencia: allí los paneles son rankings —lo que aportan es dónde cae una
   * facultad entre las otras— y aquí son resúmenes. El mando, además, sólo
   * existe en esta pestaña desde `a8d903a8`.
   */
  const partesTodos = parteDeCampo(
    (dashboard.partes_campo ?? []) as MonitoreoRow[],
    (dashboard.agenda ?? []) as MonitoreoRow[],
  ).filas as MonitoreoRow[];
  const partesConFacultad = deLaFacultad(partesTodos, facultadEnFoco) as MonitoreoRow[];
  const agendaEnFoco = deLaFacultad(
    (dashboard.agenda ?? []) as MonitoreoRow[], facultadEnFoco) as MonitoreoRow[];
  /**
   * **`course_status` viaja RECORTADO a 500 filas de las 1 392 del plan**, así
   * que filtrarlo aquí da el recorte de una facultad y no su universo. Se hace
   * igual porque los titulares —174— entran enteros en el recorte y son de lo
   * que hablan estos paneles; lo que puede faltar son reservas dormidas, que no
   * son trabajo. Los repartos que el motor ya calcula sobre el plan entero se
   * piden por facultad al motor, no se filtran aquí.
   */
  const aulaRows = deLaFacultad(
    (dashboard.course_status ?? []) as Array<Record<string, unknown>>,
    facultadEnFoco) as Array<Record<string, unknown>>;
  const totalAulas = Number(dashboard.course_status_total ?? aulaRows.length) || aulaRows.length;
  // Cuántas de esas filas son EXTRAS de la reserva adicional. Avance cuenta 236 donde Fuentes
  // cuenta 196 «titulares y sus reservas encadenadas», y la diferencia son los
  // 40 extras: la misma palabra con dos cifras y nada que explique el salto.
  // Aquí el 236 es correcto —los extras se aplican y traen respuestas— así que
  // lo que faltaba no era la cuenta sino decir qué entra en ella.
  const aulasExtra = aulaRows.reduce(
    (n, row) => (String(row.sample_role ?? "") === "extra_reserve_pool" ? n + 1 : n),
    0,
  );
  // Lo que de verdad SE VE, no lo que trae el payload: `course_status` llega
  // topeado en 500 y la tabla pinta 400, así que el pie decía «se ven 500 de
  // 1 392» con 400 filas delante.
  const contadorDeAulas = (visibles: number) =>
    contadorDeCursosHorario(Math.min(visibles, TOPE_DE_FILAS), totalAulas, aulasExtra);
  /**
   * **Lo que reparte un gráfico no siempre es lo que viaja.**
   *
   * Los dos gráficos de esta pestaña prefieren el reparto que publica el motor
   * —`course_status_estados` y `course_status_cobertura`, calculados «sobre
   * TODAS las filas y no sobre las 500 que viajan», como dice el tipo de su
   * prop— y sólo caen a las filas recortadas cuando ese reparto no llega.
   *
   * Los dos llevaban igualmente el aviso «se ven 500 de 1,424 cursos-horario»,
   * y con el reparto del motor puesto es **falso**: medido en pantalla, los seis
   * tramos de «Estado de aplicación» suman exactamente 1.424. El aviso nació
   * cuando el gráfico repartía las 500 filas y se quedó escrito cuando pasó a
   * usar el total; quien lo lee cree que le falta el 65 % de los datos que está
   * viendo.
   *
   * La tabla es el único caso donde sigue siendo cierto: ésa sí pinta
   * `aulaRows`.
   */
  /**
   * Cada rótulo dice lo que reparte SU gráfico: cobertura reparte los que
   * tienen meta —174— y estado reparte el plan entero —1.424—. La regla y su
   * porqué viven en `contadorDeLoQueReparte.ts`, con sus tres casos probados.
   */
  // Los titulares de la facultad en foco, para que el rótulo cuente SU universo.
  // `null` sin foco o sin reparto del motor, y entonces manda el del estudio.
  const titularesEnFoco = facultadEnFoco
    ? (delMapaPorFacultad(dashboard.course_status_rol_y_estado_por_facultad, facultadEnFoco)
        ?.titulares?.total ?? null)
    : null;
  const contadorDelReparto = (resumenDelMotor: unknown) =>
    contadorDeLoQueReparte(resumenDelMotor, {
      total: titularesEnFoco ?? totalAulas,
      filasQueViajan: aulaRows.length,
      // La reserva adicional del estudio no es la de una facultad, y no viaja
      // repartida: con foco no se nombra en vez de atribuirle a Derecho las
      // 1.173 del operativo.
      deReservaAdicional: facultadEnFoco ? 0 : aulasExtra,
    });
  /**
   * El último día del horizonte: el cierre PESIMISTA del pronóstico.
   *
   * Se usa el lento y no el central a propósito: el eje tiene que caber lo peor
   * que puede pasar, o el abanico del pronóstico se saldría de su propio
   * gráfico. Cadena vacía cuando no hay ritmo que proyectar, y entonces cada
   * gráfico se queda con su propio final, como estaba.
   *
   * Sin `useMemo`: esta línea vive DESPUÉS de la guarda de pestaña de arriba, y
   * un hook aquí se llamaría en unos renders y no en otros — React #310, que ya
   * tumbó esta pestaña una vez.
   */
  const agendaDelCierre = cierrePorAgenda(
    agendaEnFoco,
    corteDelEstudio(
      (dashboard?.partes_campo ?? []) as Array<Record<string, unknown>>,
      dashboard?.generated_at,
    ).dia,
  );
  const pron = pronosticoDeCierre(partesConFacultad, agendaEnFoco);
  /**
   * **El horizonte lo pone la AGENDA, no el ritmo.**
   *
   * Primero se usó el cierre PESIMISTA del pronóstico y se midió lo que hacía:
   * con el ritmo lento del arranque la fecha se iba a **noviembre**, el eje
   * dibujaba setenta días y las cuatro jornadas reales quedaban aplastadas
   * contra el borde izquierdo. Justo lo contrario de lo que él pedía al decir
   * que el ritmo «se ve vacío».
   *
   * La agenda es finita y es la que manda —«depende del ritmo de la agenda»—:
   * el eje llega hasta la última fecha agendada. El pronóstico queda de
   * respaldo, y su rama lenta ya no decide cuánto mide el gráfico.
   */
  const horizonteDelCierre = agendaDelCierre.ultimaFecha
    || (pron.motivo || !pron.ultimaFecha
      ? undefined
      : sumarDiasDeCampo(pron.ultimaFecha, pron.diasQueFaltan ?? 0));

  const desglose = dashboard.respuestas_desglose;
  // Qué cuenta enseña el bloque: la del conjunto o la de la facultad en foco.
  // El foco es el del perfil —el mismo que ya gobierna «A quién hay que
  // agendar»—, no un selector propio del bloque.
  const respuestas = respuestasDeLaFacultad(desglose, facultadEnFoco);
  // La serie temporal del panel de abajo. El reparto por facultad lo hace el
  // motor —las respuestas no viajan—, así que aquí sólo se elige entre series
  // ya calculadas, sobre el mismo eje de días.
  const ritmoEnFoco = ritmoDeLaFacultad(
    (dashboard?.ritmo_diario ?? null) as RitmoDiario | null,
    (dashboard?.ritmo_por_facultad ?? null) as RitmoDeFacultad[] | null,
    facultadEnFoco,
  );
  return (
    <>
            {/* **Abre la pestaña porque es la pregunta anterior a todas.** Antes
                de cuánto se ha cumplido: de lo que ha entrado, qué cuenta. Y las
                que no cuentan, separadas por su razón — 37 que no son del
                operativo no piden nada y 68 que sí lo son y no pasan el criterio
                son trabajo hecho que no suma. El bloque viene del boceto del
                2026-09-09; el motor, de `monitoreo_aulas_respuestas_desglose.R`. */}
            {desglose?.total ? (
              <section
                className="mon-profile-panel"
                data-qa-geometry-group="monitoring-aulas-avance"
                data-qa-geometry-contract="intrinsic"
              >
                <div className="mon-profile-panel-head">
                  <h3>Respuestas</h3>
                  <span>cuáles cuentan, y por qué no cuentan las demás</span>
                </div>
                {/* El filtro por facultad viene del selector de la CABECERA
                    —`foco=facultad:…`—, no de un mando propio del bloque. */}
                <AulasResumenRespuestas
                  cuenta={respuestas?.cuenta}
                  sinAula={respuestas?.sinAula}
                  rotulo={respuestas?.rotulo ?? ""}
                />
              </section>
            ) : null}
            {/* **Las quince facultades de un vistazo**, que es lo que él pide de
                esta pestaña y no estaba: «quiero ver las respuestas efectivas de
                las facultades, quiero ver las aulas, quiero ver cuántas se han
                aplicado; es el primer alcance que tengo cuando entro a avance».
                El bloque de arriba da el TOTAL y filtra de una en una; éste las
                pone todas. Cruza dos bloques que el motor ya emite, sin calcular
                ninguna cifra nueva. */}
            {desglose?.facultades?.length ? (
              <section
                className="mon-profile-panel"
                data-qa-geometry-group="monitoring-aulas-avance"
                data-qa-geometry-contract="intrinsic"
              >
                <div className="mon-profile-panel-head">
                  <h3>Por facultad</h3>
                  {/* «Avance de los cursos-horario» describía la barra cuando la
                      barra dibujaba aplicadas sobre planificadas; desde
                      `94e378c0` la barra reparte las efectivas y ese avance vive
                      en las dos columnas de cifras. El rótulo dice lo que hay. */}
                  <span>efectivas y cursos-horario aplicados de cada facultad · ordenadas por efectivas</span>
                </div>
                <AulasResumenPorFacultad
                  respuestas={desglose.facultades}
                  aulas={dashboard.aulas_por_facultad}
                  facultadEnFoco={facultadEnFoco}
                />
              </section>
            ) : null}
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
                {/* «En respuestas» nombraba la UNIDAD, y el otro «Cumplimiento» de
                    Avance —el de Cuotas— también se mide en respuestas: el título no
                    separaba nada. Lo que de verdad distingue a este panel es que mide
                    AULA POR AULA, sin compensar entre aulas: por eso las 332 que
                    sobran en aulas ya cumplidas quedan fuera de su numerador y aquí
                    sale 72.4 % donde Cuotas saca 106.7 %. */}
                {/* **Convive con «Avance a la muestra 37,8 %» de la banda de
                    KPIs, dos centímetros más arriba, y dice 23,8 %.** Los dos
                    son correctos y salen de las mismas respuestas: aquél las
                    cuenta todas contra la cuota de alumnos; éste TOPA cada
                    curso-horario en su meta, así que las que sobran en los ya
                    cumplidos no le suman. Dos porcentajes de avance sin nada que
                    los separe es de lo que más desconfianza genera en un
                    tablero, así que el subtítulo lo dice antes que la cifra. */}
                {/* **El título decía la unidad equivocada.** Gonzalo, dos
                    veces: «no entiendo lo del cumplimiento por aula, no entiendo
                    por qué hay una meta de 3 233… no entiendo eso de cuántas
                    cumplen meta, cuántas faltan». «Cumplimiento aula por aula»
                    promete un recuento de AULAS y la cifra grande cuenta
                    RESPUESTAS; el rótulo y el número no hablaban de lo mismo. */}
                <h3>Respuestas que pide el plan, curso-horario a curso-horario</h3>
                {/* La meta del MOTOR: sumarla acá la calculaba sobre un payload
                    recortado a 500 filas. */}
                {/* Una meta de respuestas no puede ser fraccionaria: sale de
                    dividir la cuota entre la tasa y llegaba «3.491,4».
                    **Y por eso hay que decir de dónde sale.** Redondeada da 3.492
                    mientras la tarjeta «Cuota por recoger», tres centímetros más
                    arriba, dice 3.491: son dos cuentas distintas del mismo objetivo
                    —una suma metas por curso-horario, la otra objetivos de 30 celdas
                    sexo × facultad— y a 0,4 de distancia el redondeo las separa en
                    uno. Sin nombrar la procedencia, quien lee encuentra la diferencia
                    y desconfía de las dos, que es exactamente lo que la tarjeta de
                    cuota ya resuelve explicando su resta celda a celda. */}
                {/* El subtítulo obedece al foco igual que el panel: con una
                    facultad puesta seguía anunciando la meta de las quince. */}
                {/* **De dónde salen esos 3 233, en castellano.** «Suma de
                    metas por curso-horario, TOPADA en cada uno» es la definición
                    correcta y no la entiende nadie que no la haya escrito: dice
                    la operación y no lo que significa. Lo que significa es que a
                    cada curso-horario se le pide una cantidad y lo que sobra en
                    uno no tapa lo que falta en otro — la misma regla de la
                    brecha por celda del ADR 0079, aplicada al aula. */}
                <span>
                  {fmtCuenta(
                    (facultadEnFoco ? 0 : Number(dashboard?.cumplimiento_respuestas?.meta))
                    || avanceEnRespuestas(aulaRows as unknown as MonitoreoAulasPlanRow[]).meta,
                  )} respuestas: lo que se le pide a cada uno de los {fmt(aulaRows.length)}{" "}
                  cursos-horario, sumado. Lo que sobra en uno no cubre lo que falta en otro,
                  así que exige más que el «Avance a la muestra» de arriba
                </span>
              </div>
              <AulasAvanceEnRespuestas
                filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
                // **Con una facultad en foco el bloque del motor NO sirve**: lo
                // calcula sobre el plan entero y taparía las filas ya filtradas,
                // que es lo que hacía que este panel siguiera diciendo 3.233 con
                // Psicología puesta. Sin foco se prefiere el del motor, que corre
                // sobre las 1.392 filas y no sobre las 500 que viajan.
                resumen={facultadEnFoco ? null : (dashboard?.cumplimiento_respuestas ?? null)}
                // Y las válidas del DENOMINADOR también son las de la facultad
                // en foco. Con el KPI global, la línea de abajo decía «1.051 se
                // recogieron en eslabones que ya no son el que cuenta» dentro de
                // un panel que arriba hablaba de doce: la cifra era del operativo
                // entero y sólo la palabra «respuestas» las emparentaba.
                validasTotales={
                  (facultadEnFoco
                    ? Number(respuestas?.cuenta?.efectivas ?? 0)
                    : Number(dashboard.kpis?.respuestas_validas ?? 0)) || 0
                }
              />
            </section>
            {/* Va justo después del cumplimiento: primero CUÁNTO se lleva y en
                seguida CÓMO se llegó. Separarlos con el estado de aplicación en medio
                obligaba a recordar la cifra mientras se baja. */}
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
                  const dias = (ritmoEnFoco?.dias ?? []) as Array<{ validas?: unknown }>;
                  const conCampo = dias.filter((d) => Number(d?.validas ?? 0) > 0).length;
                  // **Y el NUMERADOR.** Este panel cuenta válidas de PLATAFORMA;
                  // los rankings de Rendimiento cuentan encuestas DEL PARTE, y sobre
                  // este corte las dos cifras se llevan más de mil. Mientras existió
                  // «Encuestas por día de cada facultad» eran dos «cuántas por día»
                  // con dos numeradores y ningún rótulo que los separara; ese panel
                  // se retiró, pero el rótulo hace falta igual: quien compara este
                  // ritmo con un ranking tiene que saber que no son la misma unidad.
                  const base = `${fmt(dias.length)} ${dias.length === 1 ? "día" : "días"}`;
                  const cuenta = conCampo && conCampo !== dias.length ? `${base} · ${fmt(conCampo)} con campo` : base;
                  return `${cuenta} · válidas de plataforma`;
                })()}</span>
              </div>
              {/* **El horizonte lo calcula la pestaña, que es quien ve los dos
                  gráficos.** Sin él, «Ritmo de la recolección» termina en la
                  última jornada con respuestas —tres, en el operativo— y
                  «Cuándo se termina de aplicar el plan», justo debajo, llega
                  hasta el cierre previsto: dos anchuras iguales midiendo
                  distancias distintas. Gonzalo, 2026-09-10: «los días del eje x
                  de cuándo se termina de aplicar el plan tienen que alinearse
                  con el ritmo de recolección». */}
              <AulasRitmoDiario
                ritmo={ritmoEnFoco}
                hasta={horizonteDelCierre}
              />
            </section>
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* **Vino de Rendimiento el 2026-09-08.** Allá desentonaba: esa
                    pestaña contesta «qué rinde más» y esto es un pronóstico del
                    operativo, que es lo que Resumen mide. Y aquí gana un vecino:
                    va pegado al ritmo diario, porque es su continuación —cómo
                    viene el ritmo, y a dónde lleva—. */}
                {/* **El título contestaba una pregunta que él no hacía.**
                    Gonzalo, sobre el panel anterior: «¿estamos viendo cuándo se
                    va a terminar de aplicar lo agendado, o cuándo vamos a llegar
                    a la meta?» (ítem 19). Eran dos, el gráfico contestaba la
                    primera y el título prometía las dos. Ahora contesta la que
                    decide —¿alcanza lo agendado?— y lo dice desde el rótulo. */}
                <h3>Hasta dónde llega lo agendado</h3>
                {/* La unidad, y el modelo. El ritmo de arriba extrapola el
                    pasado; esto NO extrapola: suma lo que se espera de cada
                    curso-horario ya agendado, el día que le toca. */}
                <span>respuestas acumuladas, curso-horario a curso-horario según su fecha</span>
              </div>
              {/* **El pronóstico deja de ser lineal.** Gonzalo, tres veces: «no
                  es que tengamos un pronóstico lineal de que si hoy aplicamos
                  treinta, mañana treinta; depende del RITMO DE LA AGENDA… y de
                  los esperables de esas aulas, contrastando el rendimiento
                  planificado con el que vamos encontrando». `cierrePorAgenda`
                  estaba escrito con ese modelo desde el 2026-09-10 y sólo se
                  usaba para sacar una fecha; ahora es el gráfico. */}
              <AulasCierrePorAgenda
                plan={agendaEnFoco}
                meta={(facultadEnFoco
                  ? filaDeLaFacultad(dashboard.efectividad_seguimiento, facultadEnFoco)?.cuota
                  : Number(dashboard.avance_cuota?.total?.cuota)) ?? null}
                corte={dashboard.generated_at ?? ""}
                // El eje empieza en la primera jornada de aplicación, no en la
                // primera cita pendiente: así este gráfico y el ritmo de arriba
                // comparten calendario, que es lo que él pidió al ver que «los
                // días del eje x tienen que alinearse con el ritmo».
                desde={ritmoEnFoco?.dias?.[0]?.fecha ?? ""}
              />
            </section>

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
                filas={agendaEnFoco as unknown as MonitoreoAulasPlanRow[]}
                partes={(dashboard?.partes_campo ?? []) as Array<Record<string, unknown>>}
                // El día del corte y NO `new Date()`: un panel que lee el reloj da un
                // resultado distinto cada vez que se abre y no hay forma de fijarlo en
                // un test ni de reproducir lo que vio el usuario.
                //
                // **Pero `generated_at` tampoco era el corte**: es cuándo se calculó
                // el tablero, o sea el mismo reloj por otra puerta. Medido: este panel
                // decía «al 27 de agosto» con el estudio sincronizado al 12/09/2026 y
                // concluía «174 aún por venir» con 78 ya aplicadas. El corte del
                // estudio es su último parte — `corteDelEstudio.ts`.
                corte={corteDelEstudio(
                  (dashboard?.partes_campo ?? []) as Array<Record<string, unknown>>,
                  dashboard?.generated_at,
                ).dia}
              />
            </section>
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                <h3>Estado de aplicación</h3>
                {/* El recorte del PAYLOAD se declara aquí. La tabla ya declara el
                    suyo, pero éste ocurre antes de que la tabla vea nada: el motor
                    manda 500 filas de las 2 615 del plan, y sin decirlo la pantalla
                    afirmaba que el estudio tiene 500 aulas. */}
                {/* **Qué lo distingue del gráfico de al lado**, que hasta ahora
                    llevaba EL MISMO subtítulo: los dos reparten los mismos N
                    cursos-horario en barras y nada decía que contestan preguntas
                    distintas. La razón vive en la cabecera de `AulasEstadoChart`
                    y no llegaba a la pantalla: «va antes que la cobertura porque
                    contesta la pregunta anterior… y sobre todo separa "sin
                    agendar" de "agendada y aún sin empezar", que la cobertura
                    mete en el mismo saco». */}
                {/* «cada uno»: la unidad recién nombrada es el curso-horario,
                    masculino (E17 — el contrato de género caza participios,
                    no pronombres, y éste se le escapó). */}
                <span>por rol, con el idioma del libro · en qué punto del circuito está cada uno</span>
              </div>
              {/* Los dos ejes van en paneles propios porque contestan preguntas
                  distintas y cada superficie declara qué es (C1): éste dice en qué
                  punto del circuito está cada aula —y cuántas ni se han agendado—, el
                  de abajo cuánto lleva recogido cada una. Los dos van ANTES de la
                  tabla: la tabla dice aula por aula y esto dice la forma del
                  conjunto. */}
              {/* **Por ROL, y el eje plano sólo como respaldo.** El reparto
                  anterior mezclaba tres cosas —el estado de agendamiento, el rol
                  en el sorteo y el desenlace— y por eso metía las 1 173 reservas
                  de cadena en un solo tramo. Gonzalo, 2026-09-10: «no entiendo
                  por qué en reserva hay mil ciento sesenta y nueve», y luego la
                  taxonomía entera: titulares sin agendar, rechazados, aplicados;
                  reemplazos utilizados, en cadena, al aire; y el banco.

                  El eje plano se conserva para los tableros generados antes de
                  que el motor publicara `course_status_rol_y_estado`: no es un
                  segundo panel, es el mismo panel dibujado con lo que haya. */}
              {dashboard.course_status_rol_y_estado ? (
                <AulasEstadoPorRol dashboard={dashboard} facultadEnFoco={facultadEnFoco} />
              ) : (
              <AulasEstadoChart
                filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
                resumen={dashboard.course_status_estados ?? null}
                totalDelPlan={totalAulas}
                desconocidasMotor={dashboard.course_status_estados_desconocidos}
                reservaMotor={dashboard.course_status_banco}
                dormidasMotor={dashboard.course_status_reservas_dormidas}
              />
              )}
            </section>
            {/* **AQUI HUBO UNA PAREJA DE DOS COLUMNAS Y AHORA NO.** El grid
                `aulas-avance-pareja` juntaba «Cursos-horario por cobertura» con
                «Donde falta mas»; al retirar el segundo (2026-09-08) el contenedor
                se quedo con UN hijo y sus dos columnas seguian reservadas, asi que
                la mitad derecha de la fila quedaba en blanco. Lo vio Gonzalo en
                pantalla el 2026-09-09.

                Se desenvuelve el panel en vez de tocar la hoja: `aulasMonitoreo.css`
                esta congelado a crecimiento y, sobre todo, un grid de dos columnas
                con UN solo miembro no es un layout que arreglar, es un contenedor
                que ya no tiene razon de existir. Si algun dia vuelven a ser dos,
                vuelve el envoltorio con ellas. */}
            {/* **Resumen resume también Rendimiento y Efectividad.** Gonzalo, dos
                veces: «no estás resumiendo la información ni de rendimiento ni de
                efectividad… si Resumen tiene que ser un resumen».

                Va aquí y no al final por la secuencia: el estado dice dónde está
                cada aula, esto dice cuánto rinde lo que ya se aplicó, y la
                cobertura de abajo, qué aulas se quedaron cortas — leído en ese
                orden, la cobertura deja de ser una lista y pasa a tener causa. Y
                no se mete entre la cobertura y «A quién hay que agendar», que él
                pidió expresamente que fueran juntos. */}
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                <h3>Rendimiento y efectividad</h3>
                <span>lo que supuso el diseño contra lo que está dando el campo</span>
              </div>
              <AulasRendimientoYEfectividad
                bloque={dashboard.efectividad_seguimiento}
                fila={filaDeLaFacultad(dashboard.efectividad_seguimiento, facultadEnFoco)}
                facultad={facultadEnFoco ?? ""}
              />
            </section>
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
                {/* Y ésta, cuánto lleva recogido cada una. Su cabecera dice por
                    qué existe: «el promedio esconde la forma —sesenta aulas al
                    50 % y sesenta al 100 % dan el mismo avance global que ciento
                    veinte al 75 %, y piden decisiones opuestas». */}
                {/* «cada uno»: la unidad recién nombrada es el curso-horario —
                    mismo pronombre que se le escapó al contrato en el
                    circuito (E17). */}
                {/* Y el reparto que se cuenta es el de la facultad en foco, no
                    el del estudio: el rótulo decía «55 cursos-horario» encima de
                    un gráfico que sólo repartía los de Derecho. */}
                <span>{contadorDelReparto(facultadEnFoco
                  ? delMapaPorFacultad(dashboard.course_status_cobertura_por_facultad, facultadEnFoco)?.cobertura
                  : dashboard.course_status_cobertura)} ya aplicados · cuánto lleva
                  recogido cada uno de su propia meta</span>
              </div>
              <AulasCoberturaChart
                filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
                // **El reparto de la facultad se le pide al MOTOR.** Filtrar
                // `course_status` aquí daría el reparto de las 500 filas que
                // viajan presentado como el de la facultad; el motor lo calcula
                // sobre el plan entero desde `60845ddb`.
                resumen={(facultadEnFoco
                  ? delMapaPorFacultad(dashboard.course_status_cobertura_por_facultad, facultadEnFoco)?.cobertura
                  : dashboard.course_status_cobertura) ?? null}
                // Para que el respaldo sepa si lo que le llegó es el plan
                // entero o el recorte de 500 filas.
                totalDelPlan={totalAulas}
                sinMetaMotor={dashboard.course_status_sin_meta}
                // La cuota contra la que se mide si con lo agendado se llega: la
                // de la facultad en foco, o la del estudio. Sale de
                // `avance_cuota`, que es su dueño (ADR 0079) — recalcularla aquí
                // daría una segunda cifra para la misma meta.
                cuota={(facultadEnFoco
                  ? filaDeLaFacultad(dashboard.efectividad_seguimiento, facultadEnFoco)?.cuota
                  : Number(dashboard.avance_cuota?.total?.cuota)) ?? null}
                // Para que el vacío pueda decir «4 esperan aplicación» en vez de
                // acusar al payload de no haber traído el reparto.
                sinAplicarMotor={facultadEnFoco
                  ? delMapaPorFacultad(dashboard.course_status_cobertura_por_facultad, facultadEnFoco)?.sin_aplicar
                  : dashboard.course_status_sin_aplicar}
                reservaMotor={dashboard.course_status_banco}
                dormidasMotor={dashboard.course_status_reservas_dormidas}
              />
            </section>
            {/* **«A quién hay que agendar» va pegado a la cobertura.** Gonzalo,
                2026-09-10: «a quién hay que agendar debería estar abajo en
                cursos-horario por cobertura, porque son temáticamente más
                relacionados… finalmente van de la mano». Y es cierto: cobertura
                dice qué aulas se quedaron cortas y ésta dice a quién hay que
                pedirle más, que es la acción que sale de leer la primera. */}
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* **También vino de Rendimiento.** Es el único panel de toda la
                    sección que pide una acción HOY, y estaba en la pestaña de los
                    rankings. Aquí va pegado a «vencidos sin aplicar», que es su
                    pareja natural: a quién hay que citar y a quién hay que ir a
                    reclamar se leen juntos o no se leen. */}
                <h3>A quién hay que agendar</h3>
                <span>cursos-horario por pedir, con la anticipación del operativo de 2025</span>
              </div>
              <AulasAlertaDeAnticipacion
                partes={partesConFacultad}
                agenda={agendaEnFoco}
                cuotas={deLaFacultad(
                  (dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[], facultadEnFoco) as MonitoreoRow[]}
                banco={dashboard.banco_extras?.por_facultad ?? []}
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
              />
            </section>
            {/* **«Dónde falta más» se retiró el 2026-09-08.** Medía cada facultad
                contra LA CUOTA DEL ESTUDIO —«contra la cuota del estudio, por sexo»,
                decía su propio subtítulo—, que es el denominador y la pregunta de
                «Metas», no de «Resumen»: esta pestaña mide el avance general DEL
                OPERATIVO.

                Y allá ya está contestada dos veces con más detalle: «Cumplimiento de
                la cuota del estudio» ordena las facultades por lo que falta con el
                carril proporcional a su cuota, y «Hombres y mujeres por facultad»
                abre cada una por sexo. Este panel lo hacía por un tercer camino
                —`avance_por_facultad` en vez de `avance_cuota`—, que es la forma más
                barata de que un día las tres digan cifras distintas.

                Con esto `AulasPerfilPorFacultad` queda SIN MONTAR —era su único
                sitio— y así está registrado, con su marca y su entrada en
                `componentesSinMontar.test.ts`. No se borra: tres archivos de test lo
                usan para fijar el molde de la lista por facultad, el vacío sin
                denominador y el foco que cruza la sección. */}
            {/* **«Avance por curso-horario» se retiró el 2026-09-10.** Es
                DETALLE fila a fila, y esta pestaña es un resumen: medido ese
                día, Resumen ocupaba 3,6 pantallas —2 809 px sobre 773
                visibles— y un resumen que exige tres scrolls deja de serlo.

                Su contenido no se pierde: la misma tabla, con más columnas y su
                buscador, vive en Consultas; y las dos preguntas que aquí
                contestaba de conjunto —en qué punto del circuito está cada uno y
                cuánto lleva recogido— las dicen los dos gráficos de arriba con
                la forma del conjunto, que es lo que un resumen necesita.

                La tabla es la compartida del perfil (`tabla`), así que esto no
                deja ningún componente huérfano. */}
    </>
  );
}
