import { useState, type ReactNode } from "react";

import { AulasAvanceCuota } from "./AulasAvanceCuota";
import { AulasBolsasDelAvance } from "./AulasBolsasDelAvance";
import { AulasComposicionReferencial } from "./AulasComposicionReferencial";
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
import { deLaFacultad } from "./deLaFacultad";
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
import { AulasTresLecturas } from "./AulasTresLecturas";

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
  const proyeccionDelEstudio = proyeccionElegida(dashboard.proyeccion_metas, meta, tasa);
  /**
   * **Con una facultad puesta, la pestaña entera es la de ESA facultad.**
   *
   * Gonzalo, 2026-09-10: «mejor todo Avance debería tener el selector de
   * facultad, y absolutamente todos los gráficos deben ajustarse y ser robustos
   * a mostrar o todas las facultades o una específica».
   *
   * Se filtra la ENTRADA y no cada panel: la cinta, las tres barras y el pie
   * salen todos de `proyeccion`, así que recortarla una vez los deja
   * coherentes sin tocar cinco componentes ni inventar cinco formas de comparar
   * dos nombres de facultad. Es la misma decisión que ya tomó `deLaFacultad`
   * para Resumen.
   *
   * Vacío en vez de `[]`: un array vacío es `truthy` y montaría la sección
   * entera con cero barras. Aquí «esta facultad no tiene cuota declarada» y «el
   * estudio no declaró cuotas» son cosas distintas y se dicen distinto (C3).
   */
  const proyeccionEnFoco = facultadEnFoco
    ? (deLaFacultad(
        proyeccionDelEstudio as unknown as ReadonlyArray<Record<string, unknown>>,
        facultadEnFoco,
      ) as unknown as typeof proyeccionDelEstudio)
    : proyeccionDelEstudio;
  const proyeccion = proyeccionEnFoco?.length ? proyeccionEnFoco : null;
  const cinta = cintaDeMetas(proyeccion);
  const alcance = facultadesQueNoLlegan(proyeccion);
  const respaldo = respaldoDeLaTasa(proyeccion);
  const supuestos = supuestosAlPie(proyeccion);
  // Las derivaciones vienen CON la pestaña: sólo las usa ella, comprobado por
  // grep antes de mover.
  const quotaRows = ordenarPorFacultadYSexo(
    deLaFacultad(
      (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
      facultadEnFoco,
    ) as Array<Record<string, unknown>>,
    (fila) => Number(fila.missing ?? 0),
  );
  // **El mismo filtro que aplica `AulasReservaDirigida` para decidir si tiene
  // algo que decir** (`brecha > 0`), y sobre las mismas celdas que recibe —las
  // de la facultad en foco, no las de todas—. Con el filtro sin aplicar, una
  // facultad cuyas celdas ya cierran pintaba el panel y el hijo devolvía
  // `null`: encabezado con nada debajo, que es justo lo que ese `null` existe
  // para evitar.
  const hayReservaDirigida = (deLaFacultad(
    (dashboard.reserva_dirigida ?? []) as Array<Record<string, unknown>>,
    facultadEnFoco,
  ) as Array<Record<string, unknown>>).some((c) => c && Number(c.brecha ?? 0) > 0);

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
      {/* **El marco se queda aunque la facultad no tenga cuota** (C2). Antes la
          sección simplemente no se montaba y el lector veía una pantalla más
          corta sin saber por qué; con un selector de facultad encima eso pasa a
          ser lo normal, no la excepción. El vacío va DENTRO del panel y bajo su
          propio título: un segundo panel con el mismo rótulo lo cazó el guard
          `titulosDePanel` en el acto, y con razón — dos «Metas por facultad y
          sexo» en la misma pantalla no son un vacío, son un duplicado. */}
      {proyeccion || (facultadEnFoco && proyeccionDelEstudio?.length) ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-avance"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Metas por facultad y sexo</h3>
            {/* **La procedencia del denominador viaja con el bloque que lo
                usa.** Venía del panel «Cumplimiento de la cuota del estudio»,
                retirado en esta misma poda: era lo único suyo que no dice
                nadie más —de dónde sale la cuota y si está degradada—, y sin
                ella la cinta publicaría un 2 500 sin decir de quién es. */}
            <span title={cuotaDiseno.procedencia.detalle || undefined}>
              {/* Con una facultad puesta, «1 de 1 facultades llegan» es una
                  cuenta correcta y una frase inútil: se dice de ella. */}
              {alcance && facultadEnFoco
                ? `${alcance.noLlegan ? "no llega" : "llega"} con lo que ya tiene agendado · `
                : null}
              {alcance && !facultadEnFoco
                ? `${fmt(alcance.total - alcance.noLlegan)} de ${fmt(alcance.total)} facultades llegan con lo que ya tienen agendado · `
                : null}
              {cuotaDiseno.procedencia.chip}
            </span>
          </div>
          {!proyeccion ? (
            <p className="mon-profile-muted">
              {facultadEnFoco} no tiene cuota declarada en el diseño, así que no
              hay meta contra la que proyectar. El resto del estudio sí la tiene:
              quita la facultad del selector para verlo.
            </p>
          ) : (
          <>
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
          </>
          )}
        </section>
      ) : null}
      {/* **«Cumplimiento de la cuota del estudio» se retiró el 2026-09-09**, con
          autorización de Gonzalo sobre el revamp: «los bocetos a veces son
          versiones mejoradas de los originales y los anteriores se van».

          Publicaba «944 de 2.500 personas · 37,8 %» y esa MISMA pareja salía ya
          dos veces más en la pantalla: en la banda de KPIs («Avance a la
          muestra 37,8 %») y en la cinta del bloque nuevo (Muestra 2.500 ·
          Efectivas 944). Su desglose por facultad —«CIENCIAS E INGENIERIA, 326
          faltan»— lo dice «Avance por facultad y sexo» con más grano, porque
          además lo parte por sexo, que es la pregunta de Gonzalo.

          Lo único suyo que no decía nadie más era la PROCEDENCIA del
          denominador, y se mudó al encabezado del bloque nuevo, que es el que
          publica el 2.500. El componente `AulasAvanceCuota` sigue en el árbol:
          esto es una desconexión, no un borrado. */}
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
      {/* **«Hombres y mujeres por facultad» se retiró el 2026-09-09**, misma
          autorización. Sus dos piezas quedaron cubiertas por «Avance por
          facultad y sexo», que es un superconjunto: aquéllas pintaban el
          PORCENTAJE de avance por sexo en carriles del mismo largo, y ésta da
          el porcentaje, las efectivas, la meta, lo que falta y —lo que ninguna
          daba— las aulas aplicadas y planificadas de cada facultad.

          `AulasCuotasResumen` y `AulasBarrasPorFacultad` siguen en el árbol.

          **Lo que NO se fue es el remedio**: «A qué aula del banco ir» no lo
          dice nadie más, así que baja al panel de la reserva, junto a «Consumo
          de la reserva», que habla de lo mismo. Diagnóstico y remedio se leen
          juntos o no se leen. */}
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
        {/* **El diagnóstico, JUSTO ENCIMA de su remedio.** Gonzalo, 2026-09-10:
            «dale con la superficie, que las tres se vean juntas».

            Las tres lecturas —lo recogido, lo que traerá lo agendado, y el
            techo de todo el plan— salen del MISMO motor y una contiene a la
            otra por construcción, así que no pueden contradecirse. Ya hubo un
            panel que enseñaba sólo la de lo agendado —«Metas y aulas»— y se
            desconectó el 2026-09-09 porque discrepaba con ésta en 28 de las 30
            celdas: ninguno mentía, contaban universos distintos y nadie lo
            decía. Eso es lo que este bloque resuelve.

            Va aquí y no en Consultas —que fue donde Gonzalo lo propuso— porque
            la pregunta es «¿cierra la cuota?», que es el propósito declarado de
            esta pestaña, y porque su remedio ya vive dos líneas más abajo.
            Separarlos obligaría a cambiar de pestaña entre el diagnóstico y la
            acción. */}
        {/* SECCIÓN PROPIA, y no un bloque dentro de «Consumo de la reserva».
            Montado ahí, el panel salía bajo un título que no es el suyo —C1: una
            superficie declara qué es— y quien lo mirara leería «consumo de la
            reserva» sobre unas barras que hablan de cuotas. Visto en pantalla el
            2026-09-10. */}
        {/* **Y su cuerpo volvió a este panel el mismo día.** Al sacar las tres
            lecturas se llevó por delante a `AulasConsumoDelBanco`, que acabó
            dentro de «A qué aula del banco ir»: «Consumo de la reserva» quedaba
            como un título sin nada debajo y el panel de al lado publicaba
            «ningún curso-horario ha sido reemplazado todavía» bajo el rótulo
            equivocado. Dos veces la misma avería —un cuerpo bajo un título
            ajeno— y las dos se vieron sólo en pantalla. */}
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
          <h3>Qué grupos no llegan, y con qué remedio</h3>
          <span>lo recogido, lo que traerá lo agendado y el techo de todo el plan</span>
        </div>
        {/* **Las cuatro bolsas, sobre los grupos que no llegan.**
            Aquí y no en el panel de metas de arriba, que es donde las puse
            primero: ese panel se monta sólo si el estudio publica
            `proyeccion_metas`, y CCSS no lo publica — visto en pantalla el
            2026-09-17, con las bolsas otra vez en un sitio que nadie pinta.
            Éste no tiene guarda y es el que declara la lectura de la cuota, así
            que las respuestas que no entran en ninguna meta se leen junto a los
            grupos que no la alcanzan. Ver la nota de `AulasBolsasDelAvance`. */}
        {cuotaDiseno.total ? <AulasBolsasDelAvance total={cuotaDiseno.total} /> : null}
        <AulasTresLecturas
          celdas={deLaFacultad(
            (dashboard.avance_sexo_facultad ?? []) as Array<Record<string, unknown>>,
            facultadEnFoco,
          ) as Array<Record<string, unknown>>}
          eje={(dashboard as { avance_cuota?: { eje?: Record<string, unknown> | null } })?.avance_cuota?.eje}
        />
      </section>
      {/* **El panel entero desaparece cuando no hay a qué ir.** `AulasReservaDirigida`
          devuelve `null` sin decisiones —decisión deliberada, con dos contratos
          que la fijan: «un "todo bien" compite por la atención»—, y sin esta
          guarda la section pintaba su encabezado igual: un título con nada
          debajo. Si la intención es no ocupar sitio, quien no debe ocuparlo es
          el panel.

          El `capacity-drift` que se veía aquí NO era eso —el cuerpo estaba,
          254 px con dos grupos en déficit— sino el encabezado midiéndose como
          contenedor de datos; se arregla declarando la capacidad en el hijo. */}
      {hayReservaDirigida ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>A qué aula del banco ir</h3>
          <span>candidatos para cerrar cada grupo que no llega</span>
        </div>
        {/* El remedio, que venía de «Hombres y mujeres por facultad»: a qué aula
            del banco ir para cerrar justo las celdas que no llegan. */}
        <AulasReservaDirigida
          celdas={deLaFacultad(
            (dashboard.reserva_dirigida ?? []) as unknown as Array<Record<string, unknown>>,
            facultadEnFoco,
          ) as unknown as MonitoreoAulasReservaDirigida[]}
          porDebajoHoy={quotaRows.filter((f) => Number(f.missing ?? 0) > 0).length}
          eje={(dashboard as { avance_cuota?: { eje?: Record<string, unknown> | null } })?.avance_cuota?.eje}
        />
      </section>
      ) : null}
      {/* **El panel referencial de sexo y carrera** (decisión 8 del plan del eje
          declarable). Va aquí, al final y no entre «Qué grupos no llegan» y «A
          qué aula del banco ir»: ésos son diagnóstico y remedio y se leen
          juntos, y esto es contexto — a quién se está alcanzando, sin exigirle
          nada a nadie.

          El motor lo calcula desde el 2026-09-17 y hasta hoy no lo pintaba
          nadie. Ver la nota de `AulasComposicionReferencial`, con el porqué de
          que aquí no haya umbrales ni avisos de desvío. */}
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-avance"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>A quién se está alcanzando</h3>
          <span>sexo y carrera contra la población, como marco de comparación y no como cuota</span>
        </div>
        <AulasComposicionReferencial avanceCuota={dashboard.avance_cuota} />
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
