import { useMemo, type ReactNode } from "react";

import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasPronosticoDeCierre } from "./AulasPronosticoDeCierre";
import { AulasRendimientoPorFacultad } from "./AulasRendimientoPorFacultad";
import { AulasRitmoPorFacultad } from "./AulasRitmoPorFacultad";
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
  const jornadas = useMemo(
    () => graficoDelDia(tablas?.find((t) => t.clave === "diario"), facultadEnFoco),
    [tablas, facultadEnFoco],
  );
  if (pestana !== "rendimiento") return null;
  return (
    <>
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
                <span>encuestas por curso-horario visitado · y lo que cabe esperar</span>
              </div>
              <AulasSerieDeRendimiento
                jornadas={jornadas}
                // La facultad elegida viaja en la URL, igual que en la
                // pirámide: sin esto la serie de una facultad no se puede
                // enlazar ni capturar.
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
                partes={parteDeCampo(
                  (dashboard.partes_campo ?? []) as MonitoreoRow[],
                  (dashboard.agenda ?? []) as MonitoreoRow[],
                ).filas as MonitoreoRow[]}
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
                partes={parteDeCampo(
                  (dashboard.partes_campo ?? []) as MonitoreoRow[],
                  (dashboard.agenda ?? []) as MonitoreoRow[],
                ).filas as MonitoreoRow[]}
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
                <span>encuestas por curso-horario, según quién aplicó</span>
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
                <span>encuestas por curso-horario, según cuándo se aplicó</span>
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
                <span>encuestas por curso-horario, según qué día se aplicó</span>
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
                <span>producción diaria, sin dividir por curso-horario</span>
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
    </>
  );
}
