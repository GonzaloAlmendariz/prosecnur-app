import { useState } from "react";
import type { ReactNode } from "react";

import { AulasAgendaPorDia } from "./AulasAgendaPorDia";
import { AulasAgendaPorFacultad } from "./AulasAgendaPorFacultad";
import { AulasMapaDeHoras } from "./AulasMapaDeHoras";
import { AulasCargaDeCampo } from "./AulasCargaDeCampo";
import { hayHorarioDeCurso } from "./cargaDeCampo";
import { AulasColaDeContacto } from "./AulasColaDeContacto";
import { AulasMedioDeContacto } from "./AulasMedioDeContacto";
import { AulasSelectorDeEslabon } from "./AulasSelectorDeEslabon";
import { descargarCargaDeCampo } from "./cargaDeCampoExcel";
import { eslabonVigente, filasDeReemplazo, opcionesDeEslabon } from "./eslabonDeLaAgenda";
import { fmt } from "./kpisDeAulas";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import type { TablaDelPerfil } from "./tablaDelPerfil";
import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * La sección «Modelo» del perfil de aulas: preparación, contacto, por facultad
 * y agenda.
 *
 * **Por qué esta sale por SECCIÓN y las otras salieron por pestaña.** Las cinco
 * anteriores eran bloques `pestana !== "…"` independientes. Aquí no: las tres
 * pestañas —`carga`, `contacto`, `facultad`— comparten una cabecera y conviven
 * con dos paneles de cajón de sastre cuya condición es
 * `pestana === "agenda" || (pestana !== "facultad" && … && …)`. Esa condición
 * NO es de las tres pestañas: las EXCLUYE. Partirla por pestaña habría roto el
 * reparto, que es el mismo tropiezo que su propio comentario documenta al
 * contar por qué el reparto se escribe en positivo desde que son tres.
 *
 * `renderAulasView` reparte por sección —fuentes, modelo, calidad, consultas— y
 * ésa es la unidad natural del corte.
 */
export function AulasSeccionModelo({
  dashboard, pestana, facultadEnFoco, onFoco, tabla, traza, agendaRows, agendaReservas,
  onFijarReparto = null,
}: {
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  facultadEnFoco: string | undefined;
  onFoco: (foco: FocoDeCuota) => void;
  tabla: TablaDelPerfil;
  /** El panel de traza del handoff, que sigue viviendo en el page-file. */
  traza: ReactNode;
  agendaRows: (dashboard: MonitoreoAulasDashboard | null) => Array<Record<string, unknown>>;
  agendaReservas: (dashboard: MonitoreoAulasDashboard | null) => number;
  /** Fijar/soltar el aplicador de una cita del reparto (B36); llega a Asignación. */
  onFijarReparto?: ((mapa: Record<string, string>) => void | Promise<void>) | null;
}): ReactNode {
  const Tabla = tabla;
  // B27, dictado (2026-09-01): «podría seleccionarse reemplazo 1 o reemplazo 2
  // y que muestre esas columnas». En el libro cada eslabón es un bloque de
  // columnas; en el plan es un juego de FILAS (`sample_role` +
  // `replacement_order`), así que el desplegable conmuta qué eslabón lista la
  // tabla, con las mismas columnas del agendador.
  //
  // Estado LOCAL a propósito: el eslabón no es un panel (no hay overlay para
  // `usePanelDireccionable`) ni un `foco` (no identifica una entidad), y
  // abrirle un parámetro a la gramática por una lente de tabla no tiene
  // precedente barato. Vive aquí y no en el page-file, que ya carga decenas de
  // `useState`.
  const [eslabonElegido, setEslabonElegido] = useState(0);
  const { opciones, sinOrden } = opcionesDeEslabon(
    (dashboard.agenda ?? []) as unknown as Array<Record<string, unknown>>,
  );
  // Si un Recargar encoge las cadenas, la elección cae a titulares en vez de
  // dejar la tabla mirando un eslabón que ya no existe.
  const eslabon = eslabonVigente(opciones, eslabonElegido);
  // Titulares por `agendaRows` —la MISMA fuente de siempre, compartida con la
  // carga, el contacto y la ruta—; los reemplazos por el helper, que les da el
  // mismo tratamiento (qué toca, status legible, orden de cadena).
  const filasDeLaAgenda = eslabon === 0
    ? agendaRows(dashboard)
    : filasDeReemplazo(dashboard, eslabon);
  return (
      // La franja de traza acompaña a las dos pestañas: dice de dónde viene el
      // plan, y eso importa igual consultándolo que registrando sobre él. Lo que
      // ya no compite es la tabla contra el registro.
      // El reparto es POSITIVO —«¿es esta pestaña?»— desde que son tres. Con dos
      // bastaba negar la otra; al llegar la tercera, «no es registro» incluye
      // «por facultad» y la agenda se pintaba también ahí. Es literalmente el
      // mismo tropiezo que ya costó el reparto de Consultas al llegar su cuarta
      // pestaña, y por eso acá se escribe positivo desde el principio.
      <div className={`mon-profile-stack aulas-agenda-stack${
        pestana === "facultad" ? " is-ruta" : ""}`}>
        {/* La preparación NO entra en «Por facultad». A 1366x768 la sección
            entera dispone de 367 px y ese panel se lleva 158: a la ruta le
            quedaban 198, o sea una ventana de 104 px para 5 538 de contenido
            —el «scroll interno muy agresivo» que ya costó una queja en la
            agenda—. Sin él, la ruta se queda con los 367. No se pierde nada:
            el mismo panel está en las otras dos pestañas de la sección, a un
            click. */}
        {/* La preparación NO entra en «Por facultad» ni en «Contacto». En las
            dos la sección dispone de 367 px a 1366x768 y ese panel se lleva
            159: en la ruta dejaba la lista en 104 px y en Contacto ahogaba el
            bloque de medios. Y en ninguna de las dos aporta —una dice a dónde
            ir y la otra a quién llamar—; el mismo panel sigue en la pestaña
            Agenda, a un click. */}
        {pestana === "facultad" || pestana === "contacto" || pestana === "carga"
          ? null
          : traza}
        {pestana === "carga" ? (
          <section
            // **`intrinsic` era la declaración correcta y el CSS no la
            // cumplía.** El stack de Agenda reparte con `grid-template-rows:
            // auto minmax(0, 1fr)` —regla necesaria para que la tabla de «Aulas
            // agendadas» no se quede en 88 px— y aquí esa segunda fila es este
            // panel: sin malla que dibujar, un aviso de 60 px recibía un marco
            // de ~1.000, con 940 de vacío sin dueño. El gate no lo ve, y hace
            // bien: el `capacity` va en el contenedor de datos, nunca en el
            // panel, así que el hueco del marco no lo mira nadie.
            // `aulas-carga-panel` (hoja aulasCargaDeCampo.css): la pestaña es
            // intrínseca —malla de filas fijas, detalle, pie— y el reparto de
            // alto del stack la aplastaba a 1024x600: panel de 221 px con 654
            // de contenido derramándose sin dueño, medido el 2026-09-02 con la
            // base real. El mínimo es su contenido y el sobrante lo recorre
            // mon-workbench-content (patrón B25).
            className={`mon-profile-panel aulas-carga-panel${
              hayHorarioDeCurso(agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[])
                ? "" : " es-sin-malla"}`}
            data-qa-geometry-group="aulas-carga-panel"
            data-qa-geometry-contract="intrinsic"
          >
            <AulasCargaDeCampo
              filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]}
              // Las ventanas del motor: la posición horaria de los confirmados
              // sale de aquí, nunca del `scheduled_time` crudo (bug 8:00pm).
              franjas={dashboard.franjas}
              // Los bloques de B29: la oferta de los aplicadores y su reparto
              // vigente. Ausentes cuando la sesión no cargó la disponibilidad;
              // las vistas Disponibilidad y Asignación declaran ese vacío.
              disponibilidad={dashboard.disponibilidad}
              reparto={dashboard.reparto}
              onExportar={(opciones) =>
                descargarCargaDeCampo(agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[], opciones)
              }
              onFijarReparto={onFijarReparto}
            />
          </section>
        ) : null}
        {pestana === "contacto" ? (
        <section
          // Clase propia: el stack de Agenda reparte el alto entre DOS filas con
          // `height: 100%`, y esta pestaña mete dos paneles en uno. Sin ella, a
          // 1024x600 la seccion quedaba en 54 px, el bloque de medios en CERO y
          // 421 px de contenido desbordaban SIN NINGUN dueño de scroll —medido—.
          // El gate no lo vio: da ok=true porque no hay grupo declarado que se
          // viole ni dueño que auditar. Un contenido que desborda sin dueño es
          // invisible para el.
          className="mon-profile-panel aulas-contacto-panel"
        >
          <div className="mon-profile-panel-head">
            {/* El título cubre las DOS cosas que hay dentro. Decía «Qué medio
                agenda mejor», que es sólo la primera: quien buscara «a quién
                llamo hoy» no lo encontraba ahí, y la superficie no declaraba lo
                que contiene (C1). Cada bloque lleva ahora su propio rótulo. */}
            <h3>Agendamiento de la cita</h3>
            <span>el medio y la cola de contacto</span>
          </div>
          {/* Los dos dentro de UN dueño de scroll, no cada uno con el suyo: la
              pantalla tiene que tener un solo recorrido. */}
          {/* El grupo va en el CUERPO y no en la sección: puesto arriba, los
              px de padding del encabezado se leen como capacidad inflada, que
              es la trampa que el contrato de superficie documenta. Antes no
              estaba en ninguno de los dos y el panel era invisible para el
              gate —ni conforme ni no conforme, no medido—, justo lo que su
              propio comentario dice que hay que evitar. */}
          <div
            className="aulas-contacto-cuerpo"
            data-qa-geometry-group="monitoring-aulas-contacto"
            data-qa-geometry-contract="intrinsic"
          >
            <AulasMedioDeContacto filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]} />
            {/* Y a quién toca llamar. Los dos contestan «cómo consigo la cita»,
                por eso comparten pestaña; el medio dice con qué y la cola con
                quién. */}
            <AulasColaDeContacto
              filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]}
              facultadEnFoco={facultadEnFoco}
              onFoco={onFoco}
            />
          </div>
        </section>
        ) : null}
        {pestana === "facultad" ? (
        <section
          // `mon-profile-panel` a secas y NO `aulas-agenda-panel`: aquella clase
          // tiene su grid afinado a TRES hijos —cabecera, banda de días y
          // tabla— y este panel tiene dos. Reusándola, la lista recibía la fila
          // del medio —118 px para 5 538 de contenido, cuatro filas visibles— y
          // quedaban 223 px muertos debajo. Medido antes de cambiarla.
          className="mon-profile-panel aulas-ruta-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* «Ruta por facultad» terminaba igual que «Cuota sexo por
                facultad» y el guard de títulos lo tumbó. El nombre dice ahora lo
                que la vista CONTESTA —a dónde hay que ir cada día—; que sea por
                facultad ya lo dice la pestaña. */}
            <h3>A dónde ir cada día</h3>
            {/* La MISMA fuente que la tabla de la pestaña de al lado: si cada
                una sacara sus filas por su cuenta, las dos vistas de la misma
                agenda podrían enseñar cuentas distintas. */}
            <span>{(() => {
              const n = agendaRows(dashboard).length;
              return n ? `${n.toLocaleString("es-PE")} cursos-horario` : "sin agenda";
            })()}</span>
          </div>
          <AulasAgendaPorFacultad filas={agendaRows(dashboard) as unknown as MonitoreoAulasPlanRow[]} />
        </section>
        ) : null}
        {pestana === "agenda"
          || (pestana !== "facultad" && pestana !== "contacto" && pestana !== "carga") ? (
        <>
        <section
          // `aulas-agenda-panel`: este panel tiene TRES filas —cabecera, lectura
          // por día y tabla— y la regla común declara dos. Un hijo de más se
          // lleva una fila declarada y se dibuja encima del siguiente; medido:
          // los días se pintaban sobre la tabla. Es el mismo tropiezo que ya
          // costó el reparto de alto del banner de KPIs.
          className="mon-profile-panel aulas-agenda-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* La hoja del libro se llama así y estas son sus filas: las
                escribe `aulas_libro_hoja_agendadas()` y las vuelve a leer
                `aulas_agendadas_leer()`. */}
            {/* **No se renombra a «Cursos-horario agendados», y el guard tiene
                razón.** «Aulas agendadas» es el nombre de una HOJA del libro que
                el equipo llena en Excel —junto a «Aulas Aplicadas (Campo)» y
                «Base de control», las tres que Fuentes enumera—, y llamarla como
                la hoja es lo que deja reconocerla sin explicación.

                El subtítulo sí dice «174 cursos-horario», que es la unidad. Que
                el título nombre la hoja y el subtítulo la unidad no es una
                contradicción: son dos cosas distintas y cada una en su sitio. */}
            <h3>Aulas agendadas</h3>
            {/* B27: el eslabón que la tabla lista. Va en la cabecera de ESTE
                panel y no en la del workbench, porque manda sobre esta tabla y
                el selector de facultad manda sobre la sección entera. */}
            <AulasSelectorDeEslabon
              opciones={opciones}
              valor={eslabon}
              onCambio={setEslabonElegido}
            />
            {/* Cuenta lo que la tabla ENSEÑA, no lo que trae el payload. Y las
                reservas se declaran al lado en vez de listarse: existen, pero no
                son trabajo del agendador hasta que una titular se cae. */}
            {/* Con un eslabón de reemplazo en vista, la UNIDAD cambia con el
                número —«en reemplazo 2»—, no sólo la cifra: es lo que impide
                que el denominador cambie en silencio bajo el mismo rótulo. Una
                reserva sin `replacement_order` válido no cae en ningún eslabón
                y se declara aquí en vez de desaparecer de todas las vistas. */}
            <span>
              {eslabon === 0 ? (
                <>
                  {fmt(filasDeLaAgenda.length)} cursos-horario
                  {agendaReservas(dashboard)
                    ? ` · ${fmt(agendaReservas(dashboard))} reservas detrás`
                    : ""}
                </>
              ) : (
                <>
                  {fmt(filasDeLaAgenda.length)} cursos-horario en reemplazo {eslabon}
                  {sinOrden
                    ? ` · ${fmt(sinOrden)} reservas sin eslabón declarado`
                    : ""}
                </>
              )}
            </span>
          </div>
          {/* Primero cuándo se aplica cada cosa —que es lo que se pregunta al
              entrar a Agenda— y después la tabla, que es donde se busca un
              curso-horario concreto. La tabla NO se va: en esta sección sirve. */}
          {/* La franja por día es GLOBAL a propósito: lee `course_status` con
              titulares y reservas juntos y no obedece al eslabón elegido. Es la
              forma del periodo, no la lista del eslabón; su recorte ya declara
              su propio denominador («contado sobre X de Y»), y el contador de
              la cabecera es quien nombra lo que la TABLA enseña. */}
          {/* Sin la reserva adicional, por lo mismo: un aula sin fecha no tiene día en el
              que contarse, y las 40 caían en el tramo «sin fecha». */}
          <AulasAgendaPorDia
            filas={((dashboard.course_status ?? []) as MonitoreoAulasPlanRow[])
              .filter((f) => String((f as { sample_role?: unknown }).sample_role ?? "") !== "extra_reserve_pool")}
            // El plan de verdad, no lo que cupo en el payload: `course_status`
            // llega topeado a 500 filas y contar las recibidas hacía decir
            // «ninguno de los 42» sobre un plan de 686.
            //
            // Y son los TITULARES, no el plan entero: desde que la agenda lista
            // titulares, decir «ninguno de los 700» al pie de una tabla de 193
            // vuelve a poner dos denominadores en la misma pantalla. Es el mismo
            // efecto colateral que dejó «Libro de 2616 aulas» sobre un libro de
            // 190: al cambiar lo que se cuenta hay que revisar quién lo cuenta.
            totalDelPlan={
              Number(dashboard.kpis?.aulas_titulares ?? 0)
              || Number(dashboard.course_status_total_plan ?? 0)
              || 0
            }
            // El recorte se calcula AQUÍ, que es donde se ven las dos cifras:
            // cuántas filas trajo el payload y cuántas hay de verdad. El panel
            // no puede deducirlo de `totalDelPlan`, que cuenta titulares
            // mientras `filas` trae además las reservas encadenadas.
            recorte={{
              recibidas: ((dashboard.course_status ?? []) as unknown[]).length,
              total: Number(dashboard.course_status_total ?? 0),
            }}
          />
          {/* **La cola de las gestiones, que la mediana esconde.** Los dos tiles
              de arriba dicen «cuestan más de una» y «van por la tercera», pero
              con la mediana no se ve cuántas están en la cola cara: en 2025 la
              mediana fue 2 y aun así 33 de 170 llegaron a la cuarta llamada. La
              distribución ya la calculaba `agendamiento.ts`; sólo publicaba su
              centro. */}
          <Tabla
            rows={filasDeLaAgenda}
            // C3: un eslabón sin filas —el hueco de una cadena profunda— deja
            // su vacío dentro del marco de la tabla, y el copy nombra QUÉ
            // eslabón está vacío en vez de decir que no hay agenda.
            empty={eslabon === 0
              ? "No hay agenda importada para cursos-horario."
              : `Ninguna cadena llega al reemplazo ${eslabon} en este plan.`}
            // El rol y a quién reemplaza van delante de la sección y el
            // responsable: con una cadena de seis, las siete filas del mismo
            // titular sólo se distinguían por su código. La tabla recorta a
            // ocho columnas y lo declara, así que el orden decide qué se ve.
            // La AGENDA enseña lo que la agenda recoge. Medido: la hoja «Aulas
            // Agendadas» trae 20 campos por eslabón —el ciclo de contacto
            // entero: a quién se llama, por qué medio, qué día, cuántos
            // intentos, en qué quedó y para cuándo— y la tabla no mostraba NI
            // UNO: enseñaba curso, facultad, rol, a quién reemplaza, sesiones,
            // nombre del curso, horario, ficha y estado de ficha. Todo eso se
            // puede mirar en otras superficies; el ciclo de contacto sólo vive
            // aquí. El orden es el de quien agenda: a quién llamo, cómo, cuándo
            // llamé, cuántas veces, en qué quedó, para cuándo quedó.
            maxColumns={14}
            // «Qué toca» va DELANTE del status: la acción manda sobre el
            // estado del que sale. Es el orden que ya usa la tabla de Cálculo,
            // donde «A coordinar» cierra la fila con lo accionable.
            // `scheduled_venue` tras la hora (B30, dictado: el LUGAR tecleado
            // «tiene que nutrir a las demás pestañas/hojas y la app»): quien
            // agenda cierra fecha + hora + LUGAR, y la tabla del ciclo no lo
            // enseñaba — vivía solo en Carga y en la ficha. El tope sube a 13
            // para que el enlace de la ficha no se caiga por la columna nueva.
            // `replacement_note` = la observación DE AGENDACIÓN (B42): viaja
            // plegada en su botón (NotaEnCelda) y no ocupa espacio de fila.
            preferredColumns={["operational_code", "que_toca", "faculty", "teacher", "teacher_phone", "contact_medium", "contact_date", "contact_attempts", "sample_status", "scheduled_date", "scheduled_time", "scheduled_venue", "replacement_note", "link", "label"]}
          />
        </section>
        {/* El «Mapa de horas» (dictado 2026-09-01: «que el gráfico de la
            separación de tiempo… se vea mejor»): por día, la ventana de cada
            cita sobre un eje horario y el pico de carga simultánea — el
            número que dimensiona a los aplicadores. Panel PROPIO debajo de la
            tabla: es lectura del mismo plan, no otra navegación, y la sección
            entera scrollea en `mon-workbench-content`, que ya declara ese
            alto como capacidad suya (B25). En el stack cae en fila implícita
            `auto`: mide su contenido, sin pelear el `1fr` de la tabla. */}
        <section
          className="mon-profile-panel aulas-mapa-horas-panel"
          data-qa-geometry-group="aulas-mapa-horas"
          data-qa-geometry-contract="intrinsic"
        >
          <AulasMapaDeHoras franjas={dashboard.franjas} />
        </section>
        </>
        ) : null}
        {/* B25(b), dictado 2026-09-01: el panel «Cuánto cuesta cerrar un
            curso-horario» salió de esta sección — «aporta información no muy
            buena… no tiene sentido» aquí, donde se viene a agendar. El motor
            (agendamiento/colaDeContacto) y AulasGestionesPorAula quedan con
            sus tests; si el costo de cierre vuelve, será en una superficie de
            análisis, no en la agenda. */}
      </div>
  );
}
