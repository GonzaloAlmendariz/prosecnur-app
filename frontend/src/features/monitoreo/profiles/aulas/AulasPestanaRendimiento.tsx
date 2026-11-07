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
import { BloqueDeMonitoreo } from "../../core/BloqueDeMonitoreo";

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
  /* **El ancho ya no lo decide una condición: el ranking de aplicadores se lo
     lleva siempre.** Hubo un trío fijo, y después una regla que devolvía el trío
     cuando las dos lentes de tiempo comparaban. El 2026-09-10 se midió en el DOM
     lo que hacía el trío con el operativo real: el panel daba 386 px de caja y
     la lista pedía 615 —la tabla se salía 229 px por la derecha, y la del día
     más allá del viewport—. Son 21 filas con nombres de treinta caracteres.

     Con ello se fueron `filasDeLaLente` y `lentesQueComparan`, que existían sólo
     para elegir entre los dos repartos, y las dos pasadas extra que costaban
     sobre los partes del corte. */

  const panelAplicador = (
            <BloqueDeMonitoreo
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
              titulo="Quién consigue más"
              bajada="a quién apoyar y de quién copiar, «por visita» depende de cuántos alumnos tenía el curso-horario que le tocó"
            >
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                clave="applied_by"
                unidad="Aplicador"
                /* Las columnas ya las explica «Qué está rindiendo más», dos paneles
                   más arriba y en esta misma pantalla. */
                explicaLasColumnas={false}
              />
            </BloqueDeMonitoreo>
  );

  const panelFranja = (
            <BloqueDeMonitoreo
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
              titulo="Franja horaria del operativo"
              bajada="a qué hora conviene agendar, el volumen de cada franja va en «cursos-horario»"
            >
              {/* Las franjas son las del libro —hoja «planilla»—, no unas nuestras. */}
              {/* «A qué hora se consigue más» terminaba igual que «Quién consigue
                  más» y el guard lo tumbó. El título nombra la unidad, que además es
                  la del libro. */}
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                clave="franja"
                unidad="Franja"
                explicaLasColumnas={false}
              />
            </BloqueDeMonitoreo>
  );

  const panelDia = (
            <BloqueDeMonitoreo
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
              titulo="Día de la semana"
              bajada="qué días conviene cargar de citas, el volumen de cada día va en «cursos-horario»"
            >
              {/* La cuarta unidad de esfuerzo, y la única sobre la que el equipo
                  decide al agendar: la hora la pone el curso, el aplicador lo pone
                  la asignación, la facultad la pone la muestra — el día se elige.

                  Y no es una curiosidad: el pronóstico de cierre proyecta «al ritmo
                  observado de N aulas por día de campo», o sea tratando todos los
                  días como iguales. Si un martes rinde el doble que un viernes, dos
                  agendas con el mismo número de aulas dan resultados distintos.

                  El título nombra la unidad y no termina como ningún otro, que es
                  la regla que el guard de títulos sujeta. */}
              <AulasRendimientoPorFacultad
                partes={partesConFacultad}
                plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
                clave="dia_semana"
                unidad="Día"
                explicaLasColumnas={false}
              />
            </BloqueDeMonitoreo>
  );

  return (
    <>
            {/* **«A quién hay que agendar» se fue a Resumen** el 2026-09-08. Era el
                único panel de esta pestaña que pedía una acción hoy, y esta pestaña
                contesta «qué rinde más». Allá quedó pegado a «Cursos-horario vencidos
                sin aplicar», que es su pareja: a quién citar y a quién reclamar. */}
            <BloqueDeMonitoreo
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
              titulo="Rendimiento diario de las facultades"
              bajada="el día a día en efectivas de plataforma y el acumulado en encuestas del parte, contra lo esperado"
            >
              {/* El ranking de arriba dice QUIÉN rinde más; esto, cómo le fue día a
                  día y qué cabe esperar de su próxima aula. Son preguntas distintas
                  y por eso son dos paneles: el ranking se mira para repartir hoy, la
                  serie para ver si una facultad se está apagando. */}
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
            </BloqueDeMonitoreo>
            <BloqueDeMonitoreo
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
              titulo="Qué está rindiendo más"
              bajada="encuestas del parte, por curso-horario visitado"
            >
              {/* El título son SUS palabras —«qué nos está rindiendo más, qué no
                  está rindiendo más»— y además esquiva el guard: «Rendimiento por
                  facultad» terminaría igual que «Cuota sexo por facultad». */}
              {/* «del parte»: estas encuestas son las que el equipo anotó aula por
                  aula —4 863 sobre este corte— y no las respuestas de Kobo que la
                  pestaña vecina cuenta como VÁLIDAS —3 700—. Sin nombrar la fuente,
                  dos cifras separadas por una pestaña y con 1 163 de diferencia se
                  leen como la misma. */}
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
            </BloqueDeMonitoreo>
            {/* Las otras TRES unidades de esfuerzo, en paneles propios y no tras un
                selector: se leen juntas —una facultad rinde poco Y su aplicador rinde
                bien— y un control las escondería de a dos.

                Y ahora en FILA, que es lo que hace verdad esa frase. Apiladas medían
                920 px dentro de una pestaña de 7,5 pantallas de scroll, así que para
                comparar la franja con el día había que recordar el primero. La cuarta
                —por facultad— se queda encima a todo lo ancho: son 21 filas contra 7 y
                a un tercio de ancho sus nombres no caben. */}
            {/* **El ranking de aplicadores SIEMPRE a todo lo ancho.** Hubo un
                reparto en trío cuando las dos lentes de tiempo comparaban, y el
                2026-09-10 se midió en el DOM lo que hacía: el panel daba 386 px
                de caja y la lista pedía 615, así que la tabla se salía 229 px
                por la derecha y la del día se iba más allá del viewport. Son 21
                filas con nombres de treinta caracteres; a un tercio no caben, y
                el CSS que lo repartía ya lo decía en su propio comentario.

                Las dos lentes de tiempo se quedan en la pareja, que les da unos
                580 px cada una: ahí sí caben sus cinco columnas. */}
            {panelAplicador}
            <div
              className="aulas-avance-pareja"
              data-qa-geometry-group="monitoring-aulas-pareja"
              data-qa-geometry-contract="intrinsic"
            >
              {panelFranja}
              {panelDia}
            </div>
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
