import type { ReactNode } from "react";

import { AulasFuentesDelEstudio, type ReciboDelLibro } from "./AulasFuentesDelEstudio";
import { AulasUmbralDeDuracion } from "./AulasUmbralDeDuracion";
import { embudoDelOperativo, explicacionDelEmbudo } from "./embudoDelOperativo";
import { fmt } from "./kpisDeAulas";
import { FlujoVertical } from "../../../calcMuestra/universidad/ui/FlujoVertical";
import type { MonitoreoAulasDashboard, MonitoreoSource } from "../../../../api/monitoreo";

/**
 * La sección «fuentes» del perfil de aulas.
 *
 * Corte de `renderAulasView`, que repartía las cuatro secciones y las ocho
 * pestañas en una sola función. La sección es la unidad natural: las pestañas
 * de dentro comparten cabeceras y condiciones, y partirlas por separado rompe
 * el reparto.
 */
export function AulasSeccionFuentes({
  dashboard, operations, fuentes, volumen, criterioDeEfectiva,
  umbralDeDuracion, onDeclararUmbralDeDuracion,
}: {
  /**
   * NULABLE aquí y sólo aquí: `renderAulasView` hace `if (!dashboard) return
   * vacioSinTablero` DESPUÉS de esta sección, porque importar el plan es la
   * acción de arranque y sus operaciones se muestran sin tablero.
   */
  dashboard: MonitoreoAulasDashboard | null;
  /** Ya construidas por la página: esta sección no ve el estado ni sabe guardar. */
  operations: ReactNode;
  fuentes: ReadonlyArray<MonitoreoSource>;
  volumen: { filas?: number; columnas?: number };
  criterioDeEfectiva: ReactNode;
  /** `minutos` es nulable: sin declarar no hay umbral, y un 0 diría que lo hay. */
  umbralDeDuracion: { declarado: boolean; minutos: number | null };
  /** Nulo cuando la página no sabe guardar todavía; el panel lo contempla. */
  onDeclararUmbralDeDuracion: ((minutos: number) => void | Promise<void>) | null;
}): ReactNode {
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
              {/* **La explicación debajo de las cifras**, patrón 5 del catálogo.
                  Cálculo pone bajo su cadena de conversión un párrafo que explica
                  por qué el divisor son elegibles y por qué las reservas no
                  cambian la muestra; un analista que lo abre entiende el cálculo.
                  Aquí cada frase corresponde a una regla del motor, no a una
                  intuición — las referencias están en `embudoDelOperativo.ts`. */}
              {explicacionDelEmbudo(dashboard?.kpis).map((frase) => (
                <p className="aulas-embudo-prosa" key={frase.slice(0, 32)}>{frase}</p>
              ))}
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
            {/* **El umbral de duración también se declara aquí, al principio.**
                Gonzalo: «el umbral es menos de 5 minutos, configurable a 8 u
                otros números, pero **lo ideal es definirlos al principio**».
                Una respuesta contestada en dos minutos no vale, igual que una
                sin consentimiento: es parte de «de qué vale cada una», que es lo
                que esta sección promete. En Validación está el MISMO control,
                junto a la distribución, porque el número se afina viendo la
                forma del dato — pero el sitio para fijarlo antes de que llegue
                la primera respuesta es éste. */}
            {onDeclararUmbralDeDuracion ? (
              <AulasUmbralDeDuracion
                declarado={umbralDeDuracion.declarado}
                minutos={umbralDeDuracion.minutos}
                onDeclarar={onDeclararUmbralDeDuracion}
                leyenda={umbralDeDuracion.declarado
                  ? `Ahora se marcan las de menos de ${umbralDeDuracion.minutos} min.`
                  : "Cuánto tiene que durar una respuesta para contar."}
              />
            ) : null}
          </section>
        ) : null}
      </div>
  );
}
