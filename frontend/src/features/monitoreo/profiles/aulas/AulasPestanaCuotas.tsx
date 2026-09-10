import { useState, type ReactNode } from "react";

import { AulasAvanceCuota } from "./AulasAvanceCuota";
import { AulasMetasAvance } from "./AulasMetasAvance";
import { AulasMetasBarras } from "./AulasMetasBarras";
import { AulasMetasCinta } from "./AulasMetasCinta";
import { AulasMetasMandos } from "./AulasMetasMandos";
import { AulasMetasYAulas } from "./AulasMetasYAulas";
import { cintaDeMetas, facultadesQueNoLlegan, tasasQueSeApartan } from "./metasDeLaPestana";
import {
  proyeccionElegida, respaldoDeLaTasa, supuestosAlPie,
  type MandoMeta, type MandoTasa,
} from "./proyeccionDeMetas";
import { AulasBarrasPorFacultad } from "./AulasBarrasPorFacultad";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasCuotasResumen, type FocoDeCuota } from "./AulasCuotasResumen";
import { avanceCuota } from "./avanceCuota";
import { fmt } from "./kpisDeAulas";
import { ordenarPorFacultadYSexo } from "./ordenFacultadSexo";
import type {
  MonitoreoAulasDashboard,
  MonitoreoAulasPlanRow,
  MonitoreoAulasReservaDirigida,
  MonitoreoRow,
} from "../../../../api/monitoreo";
import type { TablaDelPerfil } from "./tablaDelPerfil";
import { AulasReservaDirigida } from "./AulasReservaDirigida";

/**
 * La pestaña «Metas» del perfil de aulas (hasta 2026-09-08, «Cuotas»).
 *
 * Corte de `renderAulasView`, la función de 1.610 líneas que tenía las ocho
 * pestañas dentro. Mismo patrón que las anteriores: los bloques eran
 * contiguos, la guarda repetida se vuelve una, y las derivaciones que sólo usa
 * esta pestaña vienen con ella.
 *
 * ORDEN VERTICAL (dictado de Gonzalo, 2026-09-08, «Correcciones Parte 1»):
 *
 *   1. **Cumplimiento de la cuota del estudio** — «este debería estar al inicio
 *      antes del desglose por sexo». Es la lectura de conjunto: cuánto se lleva
 *      del total y cómo va cada facultad contra su cuota.
 *   2. **Hombres y mujeres por facultad** — el desglose por sexo, con una barra
 *      apilada por carril.
 *   3. **Qué metas van a cerrar y cuáles no** — la proyección por celda. Vino de
 *      Estratos el 2026-09-08: allá se llamaba «Avance por facultad y sexo» y el
 *      nombre escondía que proyecta. Va DESPUÉS del punto 2 a propósito: primero
 *      dónde estamos, después dónde vamos a terminar.
 *   4. **Pirámide de metas** — sección PROPIA, «no estar pegada a lo que tenga
 *      arriba», porque cumple una función distinta: dimensiona la magnitud de
 *      lo que pide cada facultad, que las barras de arriba (todas del mismo
 *      largo) deliberadamente no muestran.
 *
 * Las cinco tablas de «Avance de campo» estuvieron aquí como punto 2 del orden
 * de arriba y se fueron a Salidas el mismo día, en `AulasVistaPreviaDelLibro`:
 * ninguna aportaba una cifra que esta sección no pintara ya, y su forma es la
 * del libro, no la de una pantalla.
 *
 * Lo que salió antes: el panel «Desempeño del trabajo de campo» (lo quita el chrome),
 * el aviso de conversación con el Sheets, la proyección «va a llegar, con
 * margen» —la predicción pertenece a otra pestaña— y la tabla FACULTAD / SEXO /
 * META / ESTADO, que decía lo mismo que la pirámide una vez que ésta lo enseña
 * al pasar el cursor.
 */
export function AulasPestanaCuotas({
  dashboard, pestana, foco, facultadEnFoco, onFoco, tabla, diasDeCampoDelCorte,
}: {
  /** No nulable: `renderAulasView` ya devolvió el vacío mucho antes. */
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  foco: FocoDeCuota;
  facultadEnFoco: string | undefined;
  onFoco: (foco: FocoDeCuota) => void;
  tabla: TablaDelPerfil;
  /** Se recibe en vez de importarse: vive en el page-file y se moverá con él.
      Llegó con «Consumo de la reserva» desde Rendimiento. */
  diasDeCampoDelCorte: (partes: ReadonlyArray<MonitoreoRow>) => number;
}): ReactNode {
  // **Los dos mandos son estado local, no dirección.** La regla del contrato v3
  // —«un overlay nuevo se conecta con `usePanelDireccionable`, no con un
  // `useState` suelto»— habla de PANELES y overlays, que son navegación; esto
  // es qué escenario se lee de un payload que ya trae los cuatro calculados.
  // Mismo trato que el toggle de rol de `AulasAvancePorCurso`.
  const [meta, setMeta] = useState<MandoMeta>("muestra");
  const [tasa, setTasa] = useState<MandoTasa>("diseno");
  if (pestana !== "cuotas") return null;
  void tabla;
  // La combinación elegida sale del motor; la pantalla no deriva ninguna.
  const proyeccion = proyeccionElegida(dashboard.proyeccion_metas, meta, tasa);
  const cinta = cintaDeMetas(proyeccion);
  const alcance = facultadesQueNoLlegan(proyeccion);
  const respaldo = respaldoDeLaTasa(proyeccion);
  const supuestos = supuestosAlPie(proyeccion);
  // Las derivaciones vienen CON la pestaña: sólo las usa ella, comprobado por
  // grep antes de mover.
  const quotaRows = ordenarPorFacultadYSexo(
    (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
    (fila) => Number(fila.missing ?? 0),
  );
  // El view-model del cumplimiento contra el diseño se calcula UNA vez y
  // alimenta el chip del encabezado y el cuerpo del panel: los dos no pueden
  // discrepar. La lógica vive en `avanceCuota.ts`, no aquí.
  const cuotaDiseno = avanceCuota(dashboard.avance_cuota);
  return (
    <>
      {/* **Los cinco bloques del boceto del 2026-09-09**, en su orden dictado:
          el mando de la meta primero —porque cambia todo lo que hay debajo—,
          la cinta, el avance por facultad y sexo con sus columnas de aulas, las
          barras de escala común y, al final, «Metas y aulas» con su propio
          mando de tasa dentro, que es el único bloque que la consume.

          Sin cuotas declaradas el motor no emite proyección y `proyeccionElegida`
          devuelve `null`: la sección entera no se monta y la pestaña sigue
          diciendo lo que sí sabe. Es la distinción que importa — «no se sabe» no
          es «no llega» (C3). */}
      {proyeccion ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-avance"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Metas por facultad y sexo</h3>
            <span>
              {alcance
                ? `${fmt(alcance.total - alcance.noLlegan)} de ${fmt(alcance.total)} facultades llegan con lo que ya tienen agendado`
                : null}
            </span>
          </div>
          <AulasMetasMandos
            rotulo="Meta"
            opciones={[
              ["muestra", "Muestra", "La cuota del diseño, tal como se calculó"],
              ["sobremuestra", "Sobremuestra", "La cuota escalada al objetivo con sobremuestra"],
            ] as const}
            valor={meta}
            onCambio={setMeta}
          />
          <AulasMetasCinta cinta={cinta} meta={meta} />

          <div className="mon-profile-panel-head">
            <h4>Avance por facultad y sexo</h4>
            <span>efectivas conseguidas contra la cuota de cada sexo</span>
          </div>
          <AulasMetasAvance filas={proyeccion} aulas={dashboard.aulas_por_facultad} />

          <div className="mon-profile-panel-head">
            <h4>Metas por facultad</h4>
            <span>todas en la misma escala: el alto compara el tamaño del trabajo</span>
          </div>
          <AulasMetasBarras filas={proyeccion} />

          <div className="mon-profile-panel-head">
            <h4>Metas y aulas</h4>
            <span>lo aplicado más lo que cabe esperar de los cursos-horario que ya tienen día</span>
          </div>
          <AulasMetasMandos
            rotulo="Proyectar lo agendado con"
            opciones={[
              ["diseno", "Tasa del diseño", "La tasa con la que se dimensionó la muestra"],
              ["obtenida", "Tasa obtenida", "Lo que el campo lleva rindiendo hasta hoy"],
            ] as const}
            valor={tasa}
            onCambio={setTasa}
          />
          <AulasMetasYAulas filas={proyeccion} />

          {/* El pie: los supuestos salen del DATO —el motor los emite con cada
              fila— y el respaldo de la tasa obtenida se enseña como material,
              no como semáforo: ninguna medición encontró un umbral que la
              vuelva fiable, así que se dice sobre cuánto descansa. */}
          <div className="aulas-metas-pie">
            {tasa === "obtenida" && respaldo ? (
              <p>
                La tasa obtenida descansa en{" "}
                <strong>{fmt(respaldo.aulas)} cursos-horario aplicados</strong> y{" "}
                <strong>{fmt(respaldo.elegibles)} elegibles</strong>, y en{" "}
                {fmt(tasasQueSeApartan(proyeccion))} facultades se aparta más de veinte puntos
                porcentuales de la del diseño. No hay número de cursos-horario que la vuelva estable:
                se enseña como escenario, no como pronóstico.
              </p>
            ) : null}
            {supuestos.map((frase) => <p key={frase}>{frase}</p>)}
          </div>
        </section>
      ) : null}
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* **El título dice contra QUÉ**, porque hay otro «Cumplimiento» en
              Resumen y las dos cifras no se parecen: aquí 2.668 de 2.500
              —106.7 %— y allá 2.336 de 3.227 —72.4 %—. Las dos son correctas y
              parten de las MISMAS 2.668 respuestas; lo que cambia es contra qué
              se miden y qué se deja fuera. Ésta las cuenta todas contra la cuota
              de alumnos del cálculo de muestra; la otra topa cada aula en su
              meta, así que las 332 que sobran en aulas ya cumplidas no le suman
              (2.336 + 332 = 2.668). */}
          <h3>Cumplimiento de la cuota del estudio</h3>
          {/* El chip declara el denominador —y su degradación, si la hay—; el
              porqué viaja en el title, como el `detalle` de los KPIs. */}
          <span title={cuotaDiseno.procedencia.detalle || undefined}>
            {cuotaDiseno.procedencia.chip}
          </span>
        </div>
        <AulasAvanceCuota vista={cuotaDiseno} />
      </section>
      {/* **Aquí vivían las cinco tablas de «Avance de campo», y se fueron a
          Salidas** (Gonzalo, 2026-09-08): «se supone que aquí todo debe ser
          visual y con gráficos, y las has metido como tablas como sea cuando
          deberían muchas de ellas ser gráficos mejor diseñados y visuales».

          El censo le dio la razón con números: NINGUNA de las cinco aportaba
          una cifra que esta sección no pintara ya. «Avance general» es la banda
          de KPIs; «Avance por facultad» —veinte columnas— es esta misma pestaña
          en barras por sexo; «Rendimiento por facultad» y «Producción por
          aplicador» son dos rankings de Rendimiento; «Avance diario» es el
          gráfico del día. Cinco tablas, cero números nuevos.

          Nacieron para el libro y el Sheets, donde la tabla es la forma
          correcta porque alguien las lee celda por celda, las filtra y las
          copia. Su sitio es la pestaña donde se decide publicar, y ahí están:
          `AulasVistaPreviaDelLibro`, montada en Salidas.

          El endpoint NO se toca: el gráfico del día de Rendimiento agrega la
          tabla `diario` con su propio `useTablasDeAvance()`. */}
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Hombres y mujeres por facultad</h3>
          {/* En GRUPOS, que es la unidad del cruce de facultad y sexo y la que
              usa la lectura de abajo («5 de 12 grupos cumplidos»). «Filas»
              nombraba la tabla; «celdas» nombraba bien el cruce pero es
              vocabulario de tabla estadística, y esta pantalla la abre quien no
              diseñó la muestra. */}
          {/* El denominador, no sólo el conteo: cada grupo se mide contra SU
              cuota del diseño —la del cálculo de muestra—, y pasarse en uno no
              cubre lo que falta en otro (ADR 0079). */}
          <span>{fmt(quotaRows.length)} grupos · cada uno contra su cuota del diseño</span>
        </div>
        {/* La cuota del estudio en PERSONAS: «2/12 celdas» no distingue faltar
            una respuesta de faltar doscientas. */}
        <AulasCuotasResumen filas={quotaRows as MonitoreoRow[]} />
        {/* Una fila por facultad, un carril por sexo, todos del MISMO largo:
            aquí se compara el PORCENTAJE de avance, no la magnitud. La magnitud
            la enseña la pirámide, abajo, y por eso son dos gráficos y no uno.

            Este panel mira HACIA ATRÁS: lo conseguido contra la meta. La
            proyección —lo que traerán los cursos-horario en juego— es el panel
            de abajo, que vino de Estratos. Hasta el 2026-09-08 este comentario
            decía «la predicción vive en otra pestaña»; vivía, y por eso no la
            miraba nadie. */}
        <AulasBarrasPorFacultad
          filas={quotaRows as MonitoreoRow[]}
          foco={foco}
          onFoco={onFoco}
        />
        {/* Y pegado a él, el remedio: a qué aula del banco ir para cerrar
            justo esas celdas. Diagnóstico y remedio se leen juntos o no se
            leen. */}
        <AulasReservaDirigida
          celdas={(dashboard.reserva_dirigida ?? []) as MonitoreoAulasReservaDirigida[]}
          porDebajoHoy={quotaRows.filter((f) => Number(f.missing ?? 0) > 0).length}
        />
      </section>
      {/* **«Qué metas van a cerrar y cuáles no» queda SIN MONTAR desde el
          2026-09-09**, y el componente y su bloque del payload siguen ahí: esto
          no es un borrado, es una desconexión mientras Gonzalo decide.

          Medido ese día (`dos_motores.R`): este panel y «Metas y aulas» —el que
          entró con el boceto— discrepan en 28 de las 30 celdas facultad × sexo,
          y no por decimales: DERECHO/F 152,9 contra 300,9; EE.GG. LETRAS/F 235,5
          contra 370,4; ARQUITECTURA/F 73,8 contra 166,8.

          Ninguno miente. Cuentan universos distintos: `proyeccion_metas` proyecta
          sólo lo AGENDADO —«con lo que ya tengo agendado, ¿llego?», que es la
          pregunta que él hizo— y `avance_sexo_facultad` cuenta TODOS los
          cursos-horario en juego, y hay 33 aulas titulares planificadas sin
          fecha (52 aplicadas · 89 agendadas · 33 sin fecha). Encima la tasa no
          sale del mismo sitio: aquélla de las cuotas del diseño, ésta de los
          esperados por aula del plan.

          Pero dos «proyectado» por celda con el doble de diferencia, en la
          misma pantalla, es exactamente lo que no puede quedarse. Lo que este
          panel dice y el otro no es la CALIBRACIÓN —«el campo está rindiendo un
          X % menos de lo previsto»—, y ésa es la pieza que merece sobrevivir,
          como lectura y no como un segundo panel de proyección. */}
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* **Vino de Rendimiento el 2026-09-08.** Habla del banco, igual que «A
              qué aula del banco ir» de arriba: separados, había que cambiar de
              pestaña para leer el diagnóstico —qué celdas no van a llegar— y su
              remedio —cuánto aguanta la reserva que las cubriría—.

              Sin «por facultad» en el título: el guard de títulos lo cazó por
              terminar igual que «Cuota sexo por facultad». La unidad va en el
              subtítulo. */}
          <h3>Consumo de la reserva</h3>
          <span>por facultad, al ritmo de reemplazos observado</span>
        </div>
        {/* Los días de campo salen de los PARTES —los días en que el operativo
            salió de verdad— y no de `ritmo_diario`, que cuenta días con
            respuestas: una caída sólo puede ocurrir un día en que se sale. */}
        <AulasConsumoDelBanco
          filas={(dashboard.agenda ?? []) as MonitoreoAulasPlanRow[]}
          diasDeCampo={diasDeCampoDelCorte((dashboard.partes_campo ?? []) as MonitoreoRow[])}
          facultadEnFoco={facultadEnFoco}
          onFoco={onFoco}
        />
      </section>
      {/* **La pirámide «Tamaño de cada meta» se retiró el 2026-09-08**, con
          decisión de Gonzalo («toma decisiones por mí viendo lo mejor y más
          intuitivo y profesional»).

          Su función declarada era dimensionar la magnitud de lo que pide cada
          facultad, «que las barras de arriba (todas del mismo largo)
          deliberadamente no muestran». Esa magnitud hoy se lee en DOS sitios de
          esta misma pestaña: el carril de «Cumplimiento de la cuota» es
          proporcional a la cuota de cada facultad contra la más alta, y «Qué
          metas van a cerrar y cuáles no» —que entró hoy— publica las cifras
          absolutas por facultad y sexo con la cuota marcada.

          Con cinco paneles en la pestaña, uno de ellos era tinta repetida.
          El componente queda declarado y sin montar. */}
    </>
  );
}
