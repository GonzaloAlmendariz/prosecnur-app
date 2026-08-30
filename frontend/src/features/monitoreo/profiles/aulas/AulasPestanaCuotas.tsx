import type { ReactNode } from "react";

import { AulasAvanceCuota } from "./AulasAvanceCuota";
import { AulasAvanceParaCliente } from "./AulasAvanceParaCliente";
import { AulasAvanceProyectado } from "./AulasAvanceProyectado";
import { AulasCuotasResumen, type FocoDeCuota } from "./AulasCuotasResumen";
import { AulasPiramideCuota } from "./AulasPiramideCuota";
import { avanceCuota } from "./avanceCuota";
import { fmt } from "./kpisDeAulas";
import { ordenarPorFacultadYSexo } from "./ordenFacultadSexo";
import { parteDeCampo } from "./parteDeCampo";
import type {
  MonitoreoAulasDashboard,
  MonitoreoAulasReservaDirigida,
  MonitoreoRow,
} from "../../../../api/monitoreo";
import type { TablaDelPerfil } from "./tablaDelPerfil";
import { AulasReservaDirigida } from "./AulasReservaDirigida";

/**
 * La pestaña «cuotas» del perfil de aulas.
 *
 * Corte de `renderAulasView`, la función de 1.610 líneas que tenía las ocho
 * pestañas dentro. Mismo patrón que las anteriores: los bloques eran
 * contiguos, la guarda repetida se vuelve una, y las derivaciones que sólo usa
 * esta pestaña vienen con ella.
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
  const Tabla = tabla;
  // Las tres derivaciones vienen CON la pestaña: `quotaRows`, `quotaEnFoco` y
  // `cuotaDiseno` sólo las usaba ella, comprobado por grep antes de mover.
  const quotaRows = ordenarPorFacultadYSexo(
    (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
    (fila) => Number(fila.missing ?? 0),
  );
  // El detalle de abajo obedece al corte elegido arriba. Sin foco se ven las
  // doce celdas; con foco, sólo las de esa facultad o ese sexo.
  const quotaEnFoco = !foco ? quotaRows : quotaRows.filter((fila) => (
    foco.tipo === "facultad" ? String(fila.faculty ?? "") === foco.valor
      : String(fila.sex ?? "") === foco.valor
  ));
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
                {/* La tabla que se entrega, y la misma que va al PDF y a la hoja
                    «Cómo va el campo» del libro: un contenido en tres soportes. Va
                    PRIMERO en la pestaña porque es la lectura de conjunto; el detalle
                    grupo a grupo viene después.

                    El título decía «El avance que ve el cliente». Nombraba al lector
                    en tercera persona desde dentro del equipo, y esta pantalla es
                    justamente la que ese lector abre: quien la recibe leía un rótulo
                    que hablaba de él como si no estuviera delante. El título dice
                    ahora de qué trata la tabla, que es lo que un encabezado debe
                    hacer.

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
                    nombraba la tabla, que ahora puede ir filtrada; «celdas» nombraba
                    bien el cruce pero es vocabulario de tabla estadística, y esta
                    pantalla la abre quien no diseñó la muestra. */}
                <span>{fmt(quotaRows.length)} grupos</span>
              </div>
              {/* La cuota del estudio en PERSONAS: «2/12 celdas» no distingue faltar
                  una respuesta de faltar doscientas. Sólo el total y su lectura — los
                  dos desagregados que había aquí decían lo mismo que la pirámide, y
                  dos gráficos del mismo cruce le quitaban protagonismo al que sí
                  contesta la pregunta. */}
              <AulasCuotasResumen filas={quotaRows as MonitoreoRow[]} />
              {/* Y justo debajo, la otra pregunta: **¿va a llegar?** El resumen de
                  arriba dice dónde está cada celda; ésta proyecta lo que aportarán
                  las aulas que faltan por aplicar y avisa si el campo está rindiendo
                  distinto de lo previsto. Es el único panel del perfil que manda a
                  alguien a un aula, y por eso encabeza por lo que exige decisión. */}
              <AulasAvanceProyectado
                celdas={(dashboard.avance_sexo_facultad ?? []) as Array<Record<string, unknown>>}
              />
              {/* Y pegado a él, el remedio: a qué aula del banco ir para cerrar
                  justo esas celdas. Estaba en la sección de abajo y el runner lo
                  medía en y=4930, o sea a tres mil píxeles del panel que dice
                  «no va a llegar». Diagnóstico y remedio se leen juntos o no se
                  leen. No se solapan: aquél proyecta con las aulas del PLAN que
                  faltan por aplicar, éste manda al BANCO, que es otro recurso y
                  otra decisión. Y va un nivel por debajo de `reservas_alcanzan`,
                  que es por facultad y no por celda. */}
              <AulasReservaDirigida
                celdas={(dashboard.reserva_dirigida ?? []) as MonitoreoAulasReservaDirigida[]}
              />
              {/* Pirámide: una facultad por fila y un sexo a cada lado, cada uno
                  contra SU propia meta. Se ve de qué lado va corta cada facultad, que
                  es la pregunta con la que se sale a campo, y es además quien lleva el
                  foco: elegir una facultad enfoca el detalle de abajo y el foco viaja
                  en la URL (`?foco=facultad:Derecho`) para que la vista siga siendo
                  enlazable.

                  Recibe TODAS las filas, no las enfocadas: es el control, y filtrada
                  se quedaría en una sola fila sin forma de elegir otra ni de soltar el
                  foco. Quien se filtra es la tabla, que es el detalle. */}
              <AulasPiramideCuota
                filas={quotaRows as MonitoreoRow[]}
                foco={foco}
                onFoco={onFoco}
                agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
                partes={parteDeCampo(
                  (dashboard.partes_campo ?? []) as MonitoreoRow[],
                  (dashboard.agenda ?? []) as MonitoreoRow[],
                ).filas as MonitoreoRow[]}
              />
              {/* La tabla filtrada lo dice: la cabecera del panel cuenta las 12 celdas
                  del estudio y con un foco puesto abajo se ven dos. Un contador que no
                  cuadra con lo que hay debajo es lo que llevo el día arreglando. */}
              {foco ? (
                <p className="mon-profile-muted">
                  Detalle de <strong>{foco.valor}</strong> · {quotaEnFoco.length} de {quotaRows.length} grupos.
                  Vuelve a pulsar su fila en la pirámide para ver todas.
                </p>
              ) : null}
              {/* El vacío de la tabla, en términos de tabla. La causa la explica el
                  resumen que encabeza la sección: repetirla aquí la convertía en la
                  tercera copia literal de la misma frase en la misma pantalla. */}
              <Tabla rows={quotaEnFoco} empty="Sin grupos de cuota que listar." />
            </section>
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* La OTRA vara de la pestaña: arriba, las celdas de sexo del plan;
                    aquí, lo recogido contra la cuota de ALUMNOS del cálculo de
                    muestra —más baja que la meta del plan por diseño—, con
                    titulares caídos y reservas incluidos. «… contra el diseño» y no
                    «… por facultad» ni «… de la cuota»: esas colas ya tienen dueño
                    y el guard de títulos caza a quien termina igual que un vecino. */}
                {/* **El título dice contra QUÉ**, porque hay otro «Cumplimiento» en
                    Resumen y las dos cifras no se parecen: aquí 2.668 de 2.500
                    —106.7 %— y allá 2.336 de 3.227 —72.4 %—. Las dos son correctas y
                    parten de las MISMAS 2.668 respuestas; lo que cambia es contra qué
                    se miden y qué se deja fuera. Ésta las cuenta todas contra la cuota
                    de alumnos del cálculo de muestra; la otra topa cada aula en su
                    meta, así que las 332 que sobran en aulas ya cumplidas no le suman
                    (2.336 + 332 = 2.668).

                    Con los nombres viejos —«contra el diseño» y «en respuestas»— un
                    lector que pase de una pestaña a otra ve 106.7 % y 72.4 % sin nada
                    que le diga por qué, y la conclusión razonable es que una de las
                    dos está mal. */}
                <h3>Cumplimiento de la cuota del estudio</h3>
                {/* El chip declara el denominador —y su degradación, si la hay—; el
                    porqué viaja en el title, como el `detalle` de los KPIs. */}
                <span title={cuotaDiseno.procedencia.detalle || undefined}>
                  {cuotaDiseno.procedencia.chip}
                </span>
              </div>
              <AulasAvanceCuota vista={cuotaDiseno} />
            </section>
    </>
  );
}
