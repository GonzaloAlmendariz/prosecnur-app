import type { ReactNode } from "react";

import { AulasAvanceCuota } from "./AulasAvanceCuota";
import { AulasAvanceParaCliente } from "./AulasAvanceParaCliente";
import { AulasBarrasPorFacultad } from "./AulasBarrasPorFacultad";
import { AulasCuotasResumen, type FocoDeCuota } from "./AulasCuotasResumen";
import { AulasPiramideCuota } from "./AulasPiramideCuota";
import { avanceCuota } from "./avanceCuota";
import { fmt } from "./kpisDeAulas";
import { ordenarPorFacultadYSexo } from "./ordenFacultadSexo";
import type {
  MonitoreoAulasDashboard,
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
 *   2. **Avance en tablas** — el detalle que se entrega, y el mismo que va al
 *      PDF y a la hoja «Avance de campo» del libro.
 *   3. **Hombres y mujeres por facultad** — el desglose por sexo, con una barra
 *      apilada por carril.
 *   4. **Pirámide de metas** — sección PROPIA, «no estar pegada a lo que tenga
 *      arriba», porque cumple una función distinta: dimensiona la magnitud de
 *      lo que pide cada facultad, que las barras de arriba (todas del mismo
 *      largo) deliberadamente no muestran.
 *
 * Lo que salió: el panel «Desempeño del trabajo de campo» (lo quita el chrome),
 * el aviso de conversación con el Sheets, la proyección «va a llegar, con
 * margen» —la predicción pertenece a otra pestaña— y la tabla FACULTAD / SEXO /
 * META / ESTADO, que decía lo mismo que la pirámide una vez que ésta lo enseña
 * al pasar el cursor.
 */
export function AulasPestanaCuotas({
  dashboard, pestana, foco, facultadEnFoco, onFoco, tabla,
}: {
  /** No nulable: `renderAulasView` ya devolvió el vacío mucho antes. */
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  foco: FocoDeCuota;
  facultadEnFoco: string | undefined;
  onFoco: (foco: FocoDeCuota) => void;
  tabla: TablaDelPerfil;
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
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* La tabla que se entrega, y la misma que va al PDF y a la hoja
              «Avance de campo» del libro: un contenido en tres soportes.

              No se llama «Avance por facultad y sexo» porque ese nombre ya es
              el del gráfico de Estratos, y el guard de títulos lo rechaza con
              razón: dos paneles homónimos en un mismo perfil obligan a abrir
              los dos para saber cuál se está citando. */}
          <h3>Cuota asignada y encuestas logradas</h3>
          <span>contra la cuota del diseño, por sexo</span>
        </div>
        <AulasAvanceParaCliente
          avanceCuota={dashboard.avance_cuota}
          celdasSexo={(dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[]}
          efectividad={dashboard.efectividad_seguimiento}
          avancePorFacultad={(dashboard.avance_por_facultad ?? []) as MonitoreoRow[]}
          diseno={dashboard.avance_cuota}
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
            Sustituye a la proyección «va a llegar, con margen», que además de
            no medir nada mientras no hay aulas aplicadas era predicción, y la
            predicción vive en otra pestaña. */}
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
