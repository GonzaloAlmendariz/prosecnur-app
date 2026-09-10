import { useMemo, type ReactNode } from "react";

import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasPronosticoDeCierre } from "./AulasPronosticoDeCierre";
import { AulasRendimientoPorFacultad } from "./AulasRendimientoPorFacultad";
import { rendimientoPorFacultad } from "./rendimientoPorFacultad";
import { AulasSerieDeRendimiento } from "./AulasSerieDeRendimiento";
import { graficoDelDia } from "./graficoDelDia";
import { useTablasDeAvance } from "./useTablasDeAvance";
import { numeroONulo } from "./avanceCuota";
import { parteDeCampo } from "./parteDeCampo";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import type {
  MonitoreoAulasDashboard, MonitoreoAulasPlanRow, MonitoreoRow,
} from "../../../../api/monitoreo";

/**
 * La pestaña «Rendimiento» del perfil de aulas.
 *
 * **Por qué vive en su propio archivo.** `AulasMonitoreoPage.tsx` iba por 2.949
 * líneas, y 1.610 de ellas eran una sola función de render —`renderAulasView`—
 * con las ocho pestañas dentro. Gonzalo lo pidió por su nombre: «la idea es que
 * no se genere un archivo gigante, sino que cada uno tenga el suyo».
 *
 * Los siete paneles eran contiguos en el original y cada uno repetía la misma
 * guarda `pestana !== "rendimiento"`. Aquí la guarda es una sola y el render es
 * idéntico: al estar contiguos, moverlos juntos no cambia el orden del DOM.
 */
export function AulasPestanaRendimiento({
  dashboard, pestana, facultadEnFoco, onFoco, diasDeCampoDelCorte,
}: {
  /**
   * NO admite `null`. En el original, `renderAulasView` hacía
   * `if (!dashboard) return vacioSinTablero` mucho antes de estos paneles, así
   * que aquí ya estaba estrechado; declararlo nulable obligaría a inventar un
   * vacío que la pestaña nunca llega a mostrar.
   */
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  facultadEnFoco: string | undefined;
  onFoco: (foco: FocoDeCuota) => void;
  /** Se recibe en vez de importarse: vive en el page-file y se moverá con él. */
  diasDeCampoDelCorte: (partes: ReadonlyArray<MonitoreoRow>) => number;
}): ReactNode {
  // **Las jornadas salen del motor, no se recalculan aquí.** Son las mismas
  // «Efectivas del día» y «Efectivas esperadas» de la tabla «Avance diario» que
  // van al libro y al Sheets, así que el gráfico y la tabla no pueden decir
  // cifras distintas del mismo día.
  const { tablas } = useTablasDeAvance();
  // **El parte, cruzado con el plan UNA vez.** `parteDeCampo()` une cada fila
  // del parte con la facultad de su curso-horario recorriendo las 1 392 del
  // plan, y esta pestaña lo pedía CINCO veces por render con los mismos dos
  // argumentos: una por cada lente del ranking y otra por cada panel que se
  // mudó. Nada de eso cambiaba entre llamadas.
  const partesConFacultad = useMemo(
    () => parteDeCampo(
      (dashboard.partes_campo ?? []) as MonitoreoRow[],
      (dashboard.agenda ?? []) as MonitoreoRow[],
    ).filas as MonitoreoRow[],
    [dashboard.partes_campo, dashboard.agenda],
  );
  const jornadas = useMemo(
    () => graficoDelDia(tablas?.find((t) => t.clave === "diario"), facultadEnFoco),
    [tablas, facultadEnFoco],
  );
  if (pestana !== "rendimiento") return null;
  /* **El ancho lo deciden los DATOS, no un trio fijo.** El comentario original
     midio «7, 3 y 7 filas» y sobre eso repartio tres columnas iguales. El
     2026-09-09, con el operativo recien arrancado, eran 5, 1 y 1: el ranking de
     aplicadores partia cada nombre en CUATRO lineas («Chamorro Rodriguez, Rosa
     Alejandrin/a») a un tercio de ancho, mientras franja y dia gastaban una
     columna entera para UNA fila. Gonzalo lo vio y lo dijo en dos palabras: «se
     ve fatal».

     La regla que sustituye al trio fijo: **una lente con una sola fila no es una
     comparacion, es un dato.** Si las dos lentes de tiempo comparan (>= 2 filas
     cada una) vuelve el trio tal como se midio; si no, el ranking se lleva el
     ancho completo —que es donde los nombres caben— y las dos lentes cortas se
     reparten una pareja. Ninguna clase nueva: `aulasMonitoreo.css` esta
     congelado y las dos rejillas ya existen. */
  // **Sin `useMemo`, y no por ahorro: por corrección.** Esta línea vive DESPUÉS
  // del `if (pestana !== "rendimiento") return null` de arriba, así que un hook
  // aquí se llama en unos renders y en otros no. Eso es React #310 —«rendered
  // more hooks than during the previous render»— y tumba la app entera al
  // cambiar de pestaña, con el error boundary tapando también las pestañas
  // siguientes. Pasó el 2026-09-09: los 3 535 tests siguieron en verde porque
  // el test de este panel siempre pinta con `pestana="rendimiento"` y el conteo
  // de hooks nunca cambiaba. Lo caza `hooksDespuesDeLaGuarda.contract.test.ts`.
  //
  // El coste es dos pasadas sobre los partes del corte —decenas de filas, no
  // miles— y sólo cuando esta pestaña se pinta.
  const filasDeLaLente = (clave: "franja" | "dia_semana") =>
    rendimientoPorFacultad(partesConFacultad, (dashboard.agenda ?? []) as MonitoreoRow[], clave).length;
  const lentesQueComparan =
    (filasDeLaLente("franja") >= 2 ? 1 : 0) + (filasDeLaLente("dia_semana") >= 2 ? 1 : 0);

  const panelAplicador = (
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                <h3>Quién consigue más</h3>
                <span>qué parte de los elegibles recoge cada persona · «por visita» depende de cuántos alumnos tenía el curso-horario que le tocó</span>
              </div>
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                clave="applied_by"
                unidad="Aplicador"
                /* Las columnas ya las explica «Qué está rindiendo más», dos paneles
                   más arriba y en esta misma pantalla. */
                explicaLasColumnas={false}
              />
            </section>
  );

  const panelFranja = (
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
                <span>qué parte de los elegibles se recoge en cada franja · el volumen de cada una va en «cursos-horario»</span>
              </div>
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                clave="franja"
                unidad="Franja"
                explicaLasColumnas={false}
              />
            </section>
  );

  const panelDia = (
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
                <span>qué parte de los elegibles se recoge según el día · el volumen de cada día va en «cursos-horario»</span>
              </div>
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                clave="dia_semana"
                unidad="Día"
                explicaLasColumnas={false}
              />
            </section>
  );

  return (
    <>
            {/* **«A quién hay que agendar» se fue a Resumen** el 2026-09-08. Era el
                único panel de esta pestaña que pedía una acción hoy, y esta pestaña
                contesta «qué rinde más». Allá quedó pegado a «Cursos-horario vencidos
                sin aplicar», que es su pareja: a quién citar y a quién reclamar. */}
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
                <h3>Rendimiento diario de las facultades</h3>
                {/* **El subtítulo estaba caducado.** Decía «encuestas por curso-horario
                    visitado», y este panel dejó de medir por curso-horario el
                    2026-09-08: Gonzalo pidió que el día a día contara la JORNADA
                    —«me importa cuántas efectivas se hicieron en el día y cuántas se
                    tenían mapeadas»— y desde entonces la barra es lo esperado del día
                    y la línea lo conseguido. El rótulo se quedó describiendo el
                    gráfico anterior. */}
                {/* **El panel tiene DOS bloques con DOS fuentes** y el subtítulo lo dice,
                    porque sus cifras no cuadran entre sí y eso desconcierta antes de
                    informar: el día a día suma efectivas de plataforma —494 el
                    2026-09-08— y el acumulado suma encuestas del parte de campo
                    —298—. Cada bloque lo repite en su propio rótulo. */}
                <span>el día a día en efectivas de plataforma y el acumulado en encuestas del parte, contra lo esperado</span>
              </div>
              <AulasSerieDeRendimiento
                jornadas={jornadas}
                // La facultad elegida viaja en la URL, igual que en la
                // pirámide: sin esto la serie de una facultad no se puede
                // enlazar ni capturar.
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
                partes={partesConFacultad}
                agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
                cuotas={(dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[]}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                control={(dashboard.control_calidad ?? []) as MonitoreoRow[]}
                // **Estaba esperando este dato desde que se escribió.** El
                // gráfico dibuja la sobremuestra como referencia y hasta ahora
                // decía «no declarada por el estudio», porque nadie se la
                // pasaba: el diseño la calcula pero no llegaba a Monitoreo.
                // Viaja con las metas por facultad y con su misma vigencia.
                //
                // Y se normaliza AQUÍ, en la frontera del payload: con «Todas
                // las facultades» el JSON de R mandó el STRING "NA", el `?? null`
                // no lo capturaba y el techo del eje se volvía NaN — el
                // «Acumulado por día» quedó en blanco bajo una leyenda con
                // cifras (A17, 2026-08-31). Número finito o null, nada más.
                sobremuestra={numeroONulo(dashboard.avance_cuota?.meta_operativa)}
              />
            </section>
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
                <span>encuestas del parte, por curso-horario visitado</span>
              </div>
              {/* Las filas del parte YA UNIDAS a su facultad, que es lo que devuelve
                  `parteDeCampo`. Pasando el parte crudo salían las 210 aulas bajo
                  «Sin facultad»: la hoja «Aulas Aplicadas (Campo)» no tiene columna de
                  facultad y la une el mismo helper que la tabla de Consultas — usar el
                  suyo evita que las dos superficies discrepen en de qué facultad es un
                  aula. */}
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
              />
            </section>
            {/* Las otras TRES unidades de esfuerzo, en paneles propios y no tras un
                selector: se leen juntas —una facultad rinde poco Y su aplicador rinde
                bien— y un control las escondería de a dos.

                Y ahora en FILA, que es lo que hace verdad esa frase. Apiladas medían
                920 px dentro de una pestaña de 7,5 pantallas de scroll, así que para
                comparar la franja con el día había que recordar el primero. La cuarta
                —por facultad— se queda encima a todo lo ancho: son 21 filas contra 7 y
                a un tercio de ancho sus nombres no caben. */}
            {lentesQueComparan === 2 ? (
              <div
                className="aulas-lentes-trio"
                data-qa-geometry-group="monitoring-aulas-lentes"
                /* `intrinsic`: apiladas bajo 1180 px cada una vuelve a su alto
                   propio, asi que `equal` seria una promesa que no cumplen. */
                data-qa-geometry-contract="intrinsic"
              >
                {panelAplicador}
                {panelFranja}
                {panelDia}
              </div>
            ) : (
              <>
                {panelAplicador}
                <div
                  className="aulas-avance-pareja"
                  data-qa-geometry-group="monitoring-aulas-pareja"
                  data-qa-geometry-contract="intrinsic"
                >
                  {panelFranja}
                  {panelDia}
                </div>
              </>
            )}
            {/* **«Encuestas por día de cada facultad» se retiró el 2026-09-08.**
                Su propio comentario ya lo pedía: «son la misma pregunta a dos
                escalas y conviene decidir si sobra uno».

                Sobraba, y además contaba OTRA COSA con el mismo nombre: este panel
                sumaba efectivas del PARTE mientras «Ritmo de la recolección», en
                Resumen, suma válidas de PLATAFORMA. Dos «cuántas por día» con dos
                numeradores en la misma sección.

                Manda la plataforma: es el numerador de la banda de KPIs y el de la
                meta —494 efectivas—, y no depende de que alguien llene un parte.
                Y el eje de días por facultad ya lo cubre «Rendimiento diario de las
                facultades», arriba, con lo esperado de fondo.

                El componente queda declarado y sin montar. */}
            {/* **«Cuándo se termina de aplicar el plan» se fue a Resumen.** Es un
                pronóstico del operativo, no una medida de rendimiento, y allá va
                pegado al ritmo diario: cómo viene el ritmo y a dónde lleva. */}
            {/* **«Consumo de la reserva» se fue a Metas**, junto a «A qué aula del
                banco ir»: las dos hablan del banco y del remedio de la brecha, y
                separadas obligaban a cambiar de pestaña para leer el diagnóstico y su
                remedio. */}
    </>
  );
}
