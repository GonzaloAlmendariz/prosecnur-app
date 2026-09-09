import type { ReactNode } from "react";

import { AulasAvanceCuota } from "./AulasAvanceCuota";
import { AulasBarrasPorFacultad } from "./AulasBarrasPorFacultad";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasCuotasResumen, type FocoDeCuota } from "./AulasCuotasResumen";
import { AulasPiramideCuota } from "./AulasPiramideCuota";
import { AulasSexoPorFacultadChart } from "./AulasSexoPorFacultadChart";
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
  if (pestana !== "cuotas") return null;
  void tabla;
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
          <span>{fmt(quotaRows.length)} grupos</span>
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
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* **Vino de Estratos el 2026-09-08, y el rótulo es la mitad de la
              mudanza.** Allá se llamaba «Avance por facultad y sexo» —un nombre
              que sólo prometía otra vista de lo mismo— y por eso nadie miraba lo
              que de verdad trae: su bloque `avance_sexo_facultad`
              (`api/R/monitoreo_aulas_calibracion.R:350`) publica lo logrado, lo
              PREVISTO, lo PROYECTADO y si el campo se está comportando como el
              modelo dice.

              Es decir: contesta «¿va a llegar esta celda?», que es la pregunta
              de Gonzalo —«lo que me interesa es que TODAS LAS FACULTADES CUMPLAN
              CON SU CUOTA DE SEXO»— y no la contestaba nada más en la sección.
              El título ahora la hace.

              No duplica al panel de arriba: aquél mide lo CONSEGUIDO contra la
              meta, mirando hacia atrás; éste suma lo que traerán los
              cursos-horario que siguen en juego y enseña el déficit que
              quedaría aun así. Retrospectivo y prospectivo, en ese orden. */}
          <h3>Qué metas van a cerrar y cuáles no</h3>
          <span>lo recogido, lo que traerán los cursos-horario en juego y el déficit que quedaría</span>
        </div>
        <AulasSexoPorFacultadChart
          celdas={(dashboard.avance_sexo_facultad ?? []) as MonitoreoRow[]}
        />
      </section>
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
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* Sección propia (Gonzalo, 2026-09-08): «la pirámide debe ser su
              propia sección y no estar pegada a lo que tenga arriba, y aquí se
              cumple una funcionalidad distinta». Arriba se compara el avance
              con carriles iguales; aquí el largo es proporcional a lo que pide
              cada facultad, así que se ve de un vistazo dónde está el volumen.

              El título no repite «por facultad»: el guard de títulos caza a
              quien termina igual que un vecino, y arriba ya hay dos. */}
          <h3>Tamaño de cada meta</h3>
          <span>de la facultad más pequeña a la más grande</span>
        </div>
        <AulasPiramideCuota
          filas={quotaRows as MonitoreoRow[]}
          foco={foco}
          onFoco={onFoco}
        />
      </section>
    </>
  );
}
