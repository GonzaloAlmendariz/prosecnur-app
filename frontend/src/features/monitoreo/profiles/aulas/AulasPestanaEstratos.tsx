import type { ReactNode } from "react";

import { AulasBrechaConcentrada } from "./AulasBrechaConcentrada";
import { AulasRepresentatividad } from "./AulasRepresentatividad";
import { etiquetaDeEstrato } from "./etiquetaDeEstrato";
import { fmt } from "./kpisDeAulas";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import type { TablaDelPerfil } from "./tablaDelPerfil";

/**
 * La pestaña «estratos» del perfil de aulas.
 *
 * Corte de `renderAulasView`, la función de 1.610 líneas que tenía las ocho
 * pestañas dentro. Mismo patrón que las anteriores: los bloques eran
 * contiguos, la guarda repetida se vuelve una, y las derivaciones que sólo usa
 * esta pestaña vienen con ella.
 */
export function AulasPestanaEstratos({
  dashboard, pestana, tabla,
}: {
  /** No nulable: `renderAulasView` ya devolvió el vacío mucho antes. */
  dashboard: MonitoreoAulasDashboard;
  pestana: string;
  tabla: TablaDelPerfil;
}): ReactNode {
  if (pestana !== "estratos") return null;
  const Tabla = tabla;
  const estratoRows = (dashboard.avance_por_estrato ?? []) as Array<Record<string, unknown>>;
  // `stratum` es una CLAVE del motor —facultad / sexo predominante / tramo de
  // tamaño, pegados—, no una etiqueta. Se traduce para la vista y sólo para la
  // vista: el original sigue siendo el que empareja.
  const estratoRowsLegibles = estratoRows.map((fila) => {
    const clave = fila.stratum ?? fila.estrato;
    if (typeof clave !== "string" || !clave) return fila;
    return fila.stratum
      ? { ...fila, stratum: etiquetaDeEstrato(clave) }
      : { ...fila, estrato: etiquetaDeEstrato(clave) };
  });
  return (
    <>
            {/* **Estratos era una tabla de 73 filas y NADA MAS.** Gonzalo lo dijo
                mirandola el 2026-09-09: «ahora esta pestaña es una tabla gigante,
                nada que ver con los elementos visuales que prometiste». Tenia razon
                contra la vara de esta misma seccion —si la pregunta es «quien va
                peor», eso es un ranking—, y contra lo que abrio este revamp.

                El ranking va PRIMERO y la tabla se queda debajo, que es donde sirve:
                se lee buscando UNA fila concreta entre 73. Lo que no puede es ser la
                pestaña entera. */}
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                <h3>Dónde se concentra lo que falta</h3>
                <span>grupos de facultad y sexo con más por recoger · qué parte de lo que falta está en ellos</span>
              </div>
              <AulasBrechaConcentrada
                filas={(dashboard.avance_sexo_facultad ?? []) as Array<Record<string, unknown>>}
              />
            </section>
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* **El título dice el grano, porque ES el grano de la pestaña.**
                    Hasta el 2026-09-08 este panel se llamaba «Avance por facultad
                    y sexo» y encabezaba un gráfico de facultad×sexo: el tema de
                    Metas, puesto aquí. Estratos se quedaba con media pestaña de
                    lo suyo. El gráfico se mudó a Metas —donde además su lectura
                    se entiende, porque proyecta— y aquí queda el estrato. */}
                {/* **Ya no se llama «estrato», porque no lo es.** Gonzalo, dos
                    veces —2026-08-29 y 2026-09-09—: «los estratos son hombre y mujer
                    de cada facultad, punto». La clave de esta tabla es la del SORTEO
                    (`facultad / sexo dominante del aula / tramo de tamaño`) y ese
                    sexo es el del AULA, no el del alumno: «mayoría mujeres» no dice
                    nada de cuántas mujeres se recogieron. El estrato de verdad lo
                    dibuja el panel de arriba. Esto es el reparto con el que se
                    sorteó, que sigue siendo útil para ver si el sorteo cubrió sus
                    cortes, y se nombra por lo que es. */}
                <h3>Cómo se repartió el sorteo</h3>
                {/* El subtítulo decía «N filas», que es lo único que la tabla de
                    abajo ya enseña por sí sola. «Estrato» es la única palabra
                    técnica de esta pestaña que no se explica en ninguna parte:
                    los VALORES sí se traducen —`etiquetaDeEstrato()` convierte
                    «GESTIÓN Y ALTA DIRECCIÓN / F / G3» en algo legible— pero la
                    palabra no. Se dice qué es, sin nombrar las columnas del
                    corte: son configurables por estudio (`estratos_selector`) y
                    escribirlas aquí sería falso en cuanto alguien las cambie. */}
                {/* **El subtítulo declara el denominador, y no es cosmético.** La
                    columna «Respuestas que faltan» suma 3 076 sobre HSVG26ULT2
                    mientras la banda de KPIs, a dos paneles de aquí, dice «faltan
                    2 288». Las válidas coinciden (212) y los cursos-horario también
                    (174): no es un error de cuenta, es que el estrato mide contra la
                    meta POR CURSO-HORARIO y la cuota mide contra la del estudio. Sin
                    decirlo, quien encuentra la diferencia desconfía de las dos. */}
                <span>{fmt(estratoRows.length)} cortes del sorteo · lo que falta se mide contra la meta por curso-horario, no contra la cuota</span>
              </div>
              {/* **Una tabla, y con razón.** Es la única forma de la sección que
                  se lee buscando UNA fila concreta entre decenas de estratos; un
                  ranking diría quién va peor y callaría el resto, que es
                  justamente lo que aquí importa.

                  Enseñaba la clave cruda —«GESTIÓN Y ALTA DIRECCIÓN / F / G3»—
                  mientras el eje del gráfico que tenía encima, ya traducido,
                  decía otra cosa para la misma fila. Ese gráfico ya no está,
                  pero la traducción se queda: la clave del motor no es una
                  etiqueta. */}
              <Tabla rows={estratoRowsLegibles} empty="No hay avance por estrato preparado." />
            </section>
            <section
              className="mon-profile-panel"
              data-qa-geometry-group="monitoring-aulas-avance"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="mon-profile-panel-head">
                {/* **La otra mitad de la pestaña, y no existía.** La tabla de
                    arriba dice cuánto se ha recogido en cada estrato; esto dice
                    si lo que se está aplicando SE PARECE a lo que se sorteó, que
                    es otra pregunta y ninguna superficie de Avance la contestaba.

                    El bloque `representativity` lo calculaba el motor en cada
                    refresco y no lo leía nadie (censo del 2026-09-08). Al ir a
                    montarlo se descubrió que contaba el banco entero como muestra
                    efectiva; eso se arregló en `6d885d99` antes de pintarlo. */}
                <h3>Cuánto se ha movido la composición</h3>
                <span>lo que se está aplicando contra lo que sorteó el diseño, estrato por estrato</span>
              </div>
              <AulasRepresentatividad
                bloque={dashboard.representativity as Record<string, unknown> | undefined}
              />
            </section>
    </>
  );
}
