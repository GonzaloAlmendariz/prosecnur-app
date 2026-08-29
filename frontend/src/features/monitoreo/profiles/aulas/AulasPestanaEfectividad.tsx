import type { ReactNode } from "react";

import { AulasEfectividadSeguimiento } from "./AulasEfectividadSeguimiento";
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
                <span>por facultad. Primera lectura: decide si hay que activar reservas</span>
              </div>
              <AulasEfectividadSeguimiento
                bloque={dashboard.efectividad_seguimiento}
                facultadEnFoco={facultadEnFoco}
                onFoco={onFoco}
              />
            </section>
    </>
  );
}
