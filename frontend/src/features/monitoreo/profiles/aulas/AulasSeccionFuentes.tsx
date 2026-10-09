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
  dashboard, operations, fuentes, volumen, criterioDeEfectiva, comoMide = null,
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
  /**
   * Las tres declaraciones de «cómo mide este estudio», ya construidas por la
   * página. `null` mientras no se pueda guardar todavía.
   */
  comoMide?: ReactNode;
  /** `minutos` es nulable: sin declarar no hay umbral, y un 0 diría que lo hay. */
  umbralDeDuracion: { declarado: boolean; minutos: number | null };
  /** Nulo cuando la página no sabe guardar todavía; el panel lo contempla. */
  onDeclararUmbralDeDuracion: ((minutos: number) => void | Promise<void>) | null;
}): ReactNode {
    // Las operaciones (importar plan / sincronizar campo) se muestran incluso
    // sin dashboard: importar el plan es justamente la acción de arranque.
    // El conteo del tramo `reemplazada` —el titular sustituido—, que es lo que
    // el embudo promete cuando dice «con reemplazo activado».
    //
    // **Del reparto del MOTOR, no de `agenda`.** El primer intento contó sobre
    // `agenda` con `estadoDeAplicacion()` y salió 0, así que la frase entera
    // desapareció de la pantalla.
    //
    // El payload trae TRES cosas distintas y confundirlas es lo que costó ese
    // intento:
    //
    //   · `agenda` — el plan ENTERO (`.monitoreo_aulas_records(plan_df)`), sin
    //     recortar, pero **sin `application_state`**: ese campo lo deriva el
    //     motor más tarde y sobre otro objeto
    //     (`monitoreo_aulas_universitarias.R:1332`). Por eso el conteo dio 0.
    //   · `course_status` — recortado a 500 filas, con el estado ya derivado.
    //   · `course_status_estados` — el REPARTO del motor sobre todas las filas,
    //     que es el que pinta los tramos en Avance y donde se leen las 18.
    //
    // Se usa el tercero.
    const reemplazadas = ((dashboard?.course_status_estados ?? []) as Array<{ clave?: string; aulas?: number }>)
      .find((e) => e.clave === "reemplazada")?.aulas ?? null;
    const embudo = embudoDelOperativo(dashboard?.kpis, reemplazadas);
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
            // El grupo FALTABA, y sin él la declaración de contrato era letra
            // muerta: `ui-quick-check` recorre `[data-qa-geometry-group]` y a
            // esta sección no la veía. Tres del perfil estaban así.
            data-qa-geometry-group="monitoring-aulas-embudo"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Del plan a las encuestas que cuentan</h3>
              <span>dónde está cada curso-horario ahora mismo</span>
            </div>
            {/* `capacity="owned"` NO basta: el runner elige miembros con
                `querySelectorAll("[data-qa-geometry-member]")` y sin ese atributo
                cae a TODOS los hijos visibles del grupo, donde el
                `mon-profile-panel-head` entra como si fuera datos y sus 5 px de
                padding salen como `capacity-drift`. Son dos atributos distintos:
                uno dice quién posee el vacío, el otro quién se mide. */}
            <div data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
              <FlujoVertical
                etapas={embudo}
                orientacion="horizontal"
                ariaLabel="Recorrido del operativo: del plan a las encuestas efectivas"
              />
              {/* **La explicación debajo de las cifras**, patrón 5 del catálogo.
                  Cálculo pone bajo su cadena de conversión un párrafo que explica
                  por qué el divisor son elegibles y por qué las reservas no
                  cambian la muestra; un analista que lo abre entiende el cálculo.
                  Aquí cada frase corresponde a una regla del motor, no a una
                  intuición — las referencias están en `embudoDelOperativo.ts`. */}
              {explicacionDelEmbudo(dashboard?.kpis, reemplazadas).map((frase) => (
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
        data-qa-geometry-group="monitoring-aulas-fuentes"
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
        {/* **Cómo mide este estudio.** Tres decisiones que gobiernan lo que el
            tablero SIGNIFICA —contra qué se mide la cuota, por qué dimensión se
            resume el operativo y desde cuándo lo recogido es campo— y que
            existían sólo en el motor: se ponían por API y el estudio en marcha
            no podía tocar su propia definición.

            Van aquí, encima del criterio, porque se deciden ANTES: de qué son
            las celdas manda sobre qué cuenta para ellas. */}
        {comoMide ? (
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-criterio-efectiva"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Cómo mide este estudio</h3>
              <span className="mon-profile-panel-hint">
                de qué son los grupos, cómo se agrupa el resumen y desde cuándo es campo
              </span>
            </div>
            {/* `member` declarado por el mismo motivo que abajo: sin él el runner
                mide el encabezado como si fuera el contenedor de datos. */}
            <div data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
              {comoMide}
            </div>
          </section>
        ) : null}
        {/* **Qué cuenta como efectiva**, aquí y no en otra sección: Fuentes es la
            que promete decir de dónde salen las respuestas, y de qué vale cada
            una es parte de eso. Hasta ahora no se podía declarar en aulas —los
            perfiles hermanos sí— y el motor sólo admitía una condición. */}
        {criterioDeEfectiva ? (
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-criterio-efectiva"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Qué cuenta como encuesta efectiva</h3>
              <span className="mon-profile-panel-hint">
                hasta cuatro condiciones, y se cumplen todas
              </span>
            </div>
            {/* El contenedor de datos del panel, declarado: sin `member` el
                runner cae a los hijos directos del `section` y mide el
                encabezado como si lo fuera —`capacity-drift` con 5 px, séptima
                vez del mismo patrón—. */}
            <div data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
              {criterioDeEfectiva}
            </div>
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
