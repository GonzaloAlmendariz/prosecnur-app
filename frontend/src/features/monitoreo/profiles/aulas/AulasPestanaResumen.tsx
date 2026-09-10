import type { ReactNode } from "react";

import { AulasAvancePorCurso } from "./AulasAvancePorCurso";
import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import { AulasAvanceEnRespuestas } from "./AulasAvanceEnRespuestas";
import { AulasCoberturaChart } from "./AulasCoberturaChart";
import { AulasResumenRespuestas } from "./AulasResumenRespuestas";
import { respuestasDeLaFacultad } from "./respuestasDeLaFacultad";
import { AulasEstadoChart } from "./AulasEstadoChart";
import { AulasFrenteDelOperativo } from "./AulasFrenteDelOperativo";
import { AulasPronosticoDeCierre } from "./AulasPronosticoDeCierre";
import { AulasRitmoDiario, type RitmoDiario } from "./AulasRitmoDiario";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { corteDelEstudio } from "./corteDelEstudio";
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
  const partesConFacultad = parteDeCampo(
    (dashboard.partes_campo ?? []) as MonitoreoRow[],
    (dashboard.agenda ?? []) as MonitoreoRow[],
  ).filas as MonitoreoRow[];
  const aulaRows = (dashboard.course_status ?? []) as Array<Record<string, unknown>>;
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
  const contadorDelReparto = (resumenDelMotor: unknown) =>
    contadorDeLoQueReparte(resumenDelMotor, {
      total: totalAulas,
      filasQueViajan: aulaRows.length,
      deReservaAdicional: aulasExtra,
    });
  const desglose = dashboard.respuestas_desglose;
  // Qué cuenta enseña el bloque: la del conjunto o la de la facultad en foco.
  // El foco es el del perfil —el mismo que ya gobierna «A quién hay que
  // agendar»—, no un selector propio del bloque.
  const respuestas = respuestasDeLaFacultad(desglose, facultadEnFoco);
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
                <h3>Cumplimiento aula por aula</h3>
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
                <span>meta {fmtCuenta(
                  Number(dashboard?.cumplimiento_respuestas?.meta)
                  || avanceEnRespuestas(aulaRows as unknown as MonitoreoAulasPlanRow[]).meta,
                )} · suma de metas por curso-horario</span>
              </div>
              <AulasAvanceEnRespuestas
                filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
                resumen={dashboard?.cumplimiento_respuestas ?? null}
                validasTotales={Number(dashboard.kpis?.respuestas_validas ?? 0) || 0}
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
                  const dias = (dashboard?.ritmo_diario?.dias ?? []) as Array<{ validas?: unknown }>;
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
              <AulasRitmoDiario ritmo={(dashboard?.ritmo_diario ?? null) as RitmoDiario | null} />
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
                <h3>Cuándo se termina de aplicar el plan</h3>
                {/* La unidad en el subtítulo. Este panel cuenta CURSOS-HORARIO y el
                    ritmo de arriba cuenta ENCUESTAS: son dos preguntas distintas
                    —terminar de visitar no es llegar a la cuota— y sin decir la
                    unidad parecían el mismo gráfico dos veces. */}
                <span>cursos-horario del plan aplicados, al ritmo observado</span>
              </div>
              <AulasPronosticoDeCierre
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
              />
            </section>
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
                agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
                cuotas={(dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[]}
                banco={dashboard.banco_extras?.por_facultad ?? []}
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
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
                filas={(dashboard?.agenda ?? []) as MonitoreoAulasPlanRow[]}
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
                <span>{contadorDelReparto(dashboard.course_status_estados)} · en qué punto del circuito está cada uno</span>
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
                // Para que el respaldo sepa si le llegó el plan entero o el
                // recorte de 500 filas, igual que en cobertura.
                totalDelPlan={totalAulas}
                desconocidasMotor={dashboard.course_status_estados_desconocidos}
                // La reserva adicional, contada por el motor sobre TODAS las
                // filas: sin ella, el pie decía «2.109 de 2.109 cursos-horario
                // en juego» sobre un operativo de 193 visitas.
                reservaMotor={dashboard.course_status_banco}
                dormidasMotor={dashboard.course_status_reservas_dormidas}
              />
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
                <span>{contadorDelReparto(dashboard.course_status_cobertura)} · cuánto lleva recogido cada uno</span>
              </div>
              <AulasCoberturaChart
                filas={aulaRows as unknown as MonitoreoAulasPlanRow[]}
                resumen={dashboard.course_status_cobertura ?? null}
                // Para que el respaldo sepa si lo que le llegó es el plan
                // entero o el recorte de 500 filas.
                totalDelPlan={totalAulas}
                sinMetaMotor={dashboard.course_status_sin_meta}
                reservaMotor={dashboard.course_status_banco}
                dormidasMotor={dashboard.course_status_reservas_dormidas}
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
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                <h3>Avance por curso-horario</h3>
                {/* **La reparación no había llegado a esta tabla.** Los dos paneles
                    de arriba declaran el recorte del payload con
                    `contadorDeAulas` —«se ven 500 de 1,424 cursos-horario»— y éste
                    seguía diciendo «500 filas». Es el mismo defecto que la nota de
                    «Estado de aplicación» da por resuelto: «el motor manda 500 filas
                    de las 2 615 del plan, y sin decirlo la pantalla afirmaba que el
                    estudio tiene 500 aulas».

                    Aquí pesa más que en los gráficos, porque una tabla se lee como
                    un censo: quien la recorre hasta el final cree haber visto el
                    plan entero, y ha visto un tercio. «Filas» tampoco nombraba lo
                    que hay en cada una. */}
                <span>{contadorDeAulas(aulaRows.length)}</span>
              </div>
              {/* El orden, DICHO. La tabla no abre por código ni alfabéticamente: la
                  ordena el motor por dónde está el aula en el circuito —en campo,
                  lista, planificada— y dentro de cada tramo por brecha. Sin decirlo,
                  «CH 74, CH 99, CH 49» se lee como desorden y el lector busca un
                  control de orden que no existe. */}
              <p className="mon-profile-muted">
                Primero las que están en campo y con más brecha; la reserva adicional y las reservas dormidas, al final.
              </p>
              {/* El selector de rol y el recorte del plan viven en el componente:
                  `course_status` llega topeado a 500 filas de 1 392 y la tabla
                  además pinta 400 de esas 500, así que las 326 reservas que SÍ
                  llegaron no se alcanzaban nunca. Filtrando a un rol caben
                  enteras. */}
              <AulasAvancePorCurso
                filas={aulaRows}
                total={totalAulas}
                tabla={Tabla}
                preferredColumns={["operational_code", "faculty", "label", "respuestas_validas", "expected_valid", "brecha", "application_state"]}
              />
            </section>
    </>
  );
}
