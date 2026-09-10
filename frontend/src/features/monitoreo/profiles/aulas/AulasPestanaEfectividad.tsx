import type { ReactNode } from "react";

import { deLaFacultad } from "./deLaFacultad";
import { AulasEfectividadPorDia } from "./AulasEfectividadPorDia";
import { AulasEfectividadSeguimiento } from "./AulasEfectividadSeguimiento";
import { AulasSenalesPorAula } from "./AulasSenalesPorAula";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../api/monitoreo";


/**
 * La pestaña «efectividad» del perfil de aulas.
 *
 * Corte de `renderAulasView`, la función de 1.610 líneas que tenía las ocho
 * pestañas dentro. Mismo patrón que las anteriores: los bloques eran
 * contiguos, la guarda repetida se vuelve una, y las derivaciones que sólo usa
 * esta pestaña vienen con ella.
 */
export function AulasPestanaEfectividad({
  dashboard, pestana, facultadEnFoco, onFoco,
}: {
  /** No nulable: `renderAulasView` ya devolvió el vacío mucho antes. */
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  facultadEnFoco: string | undefined;
  onFoco: (foco: FocoDeCuota) => void;
}): ReactNode {
  if (pestana !== "efectividad") return null;


  return (
    <>
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* C1: el título dice contra qué se mide, no «Efectividad» a secas.
                    El rótulo corto de la pestaña es sinónimo de «Rendimiento» en
                    castellano y lo que las separa es el numerador; aquí se declara. */}
                <h3>El campo contra la tasa que dimensionó la muestra</h3>
                {/* EL ORDEN DE LECTURA, dicho donde se lee. Esta vista y «Lo que
                    falta para cerrar» contestan preguntas distintas, y la de aquí
                    manda por lo que midió el ADR 0082 sobre el campo 2025: de 196
                    aulas agendadas sólo 2 no se aplicaron, así que perder un aula ya
                    lo resuelven las cadenas de reemplazo. Lo que ninguna cadena
                    cubre es que la asistencia baje en general, y eso sólo se ve
                    sumando la facultad: con τ un 5 % por debajo de lo previsto,
                    EE.GG. Ciencias cierra 4,1 alumnos corta sin que ningún aula
                    suelta lo anuncie. Por eso el déficit se acumula por facultad y
                    no se compensa entre ellas (ADR 0079). */}
                {/* **El numerador, porque es lo único que separa esta pestaña de
                    Rendimiento.** El catálogo de navegación lo dice con todas sus
                    letras: «las dos miden efectivas sobre elegibles y ahí se acaba el
                    parecido… ésta con el numerador de PLATAFORMA», aquél con el del
                    parte. Esa distinción vivía en el catálogo y en los comentarios,
                    no en la pantalla. */}
                <span>efectivas de plataforma sobre elegibles, por facultad · decide si hay que activar reservas</span>
              </div>
              <AulasEfectividadSeguimiento
                bloque={dashboard.efectividad_seguimiento}
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
                // El mismo dato al grano de facultad × sexo. Lo calcula el
                // motor sobre el plan entero: repartir aquí el padrón por sexo
                // exigiría `course_status`, que viaja recortado a 500 filas.
                porSexo={dashboard.efectividad_por_sexo ?? null}
              />
            </section>
            {/* **La tendencia, que es lo que faltaba.** Gonzalo, 2026-09-09:
                «si la efectividad era baja al principio pero ahora se está
                recuperando: patrones, tendencias». Los otros dos paneles son
                fotos —una por facultad y otra por curso-horario— y ninguna dice
                hacia dónde va. Medido sobre el operativo, va: 54,1 % → 58,6 %
                → 88,9 % en tres jornadas.

                Va DESPUÉS del agregado por facultad y ANTES del detalle por
                curso-horario: quien entra quiere saber cómo va el campo antes
                de bajar a una fila. */}
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                <h3>Hacia dónde va la efectividad</h3>
                <span>jornada a jornada · dice si el campo está mejorando o si hay que intervenir</span>
              </div>
              {/* El recorte va en la ENTRADA, como en Resumen: las dos listas
                  traen `faculty`, así que el panel no necesita saber nada del
                  selector para responderle. */}
              <AulasEfectividadPorDia
                partes={deLaFacultad(
                  (dashboard.partes_campo ?? []) as unknown as Array<Record<string, unknown>>,
                  facultadEnFoco,
                ) as unknown as MonitoreoRow[]}
                plan={deLaFacultad(
                  (dashboard.agenda ?? []) as unknown as Array<Record<string, unknown>>,
                  facultadEnFoco,
                ) as unknown as MonitoreoRow[]}
              />
            </section>
            {/* La MISMA pregunta un grano más abajo: es el «en paralelo» del
                mandato B3 —la granular junto a la agregada—. Arriba la facultad
                dice si la cuota cierra; aquí cada curso-horario se compara con
                SU tasa prevista y con la tasa prevista de su facultad en la misma fila,
                porque el agregado esconde lo que muerde fila a fila. */}
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* C1: el título nombra la unidad Y el margen, que es lo que este
                    panel añade sobre el de arriba; el numerador se declara en el
                    subtítulo porque en este perfil conviven tres homónimos. */}
                <h3>Cada curso-horario contra su propio margen</h3>
                <span>
                  efectivas de plataforma —el parte respalda— contra la tasa
                  prevista de cada uno, con la tasa prevista de su facultad al lado
                </span>
              </div>
              <AulasSenalesPorAula
                bloque={dashboard.dos_tasas}
                facultadEnFoco={facultadEnFoco}
                relevos={dashboard.reserva_de_la_cadena}
              />
            </section>
    </>
  );
}
