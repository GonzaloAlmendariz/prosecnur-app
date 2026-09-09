import type { ReactNode } from "react";

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
                <h3>Avance y brecha por estrato del sorteo</h3>
                {/* El subtítulo decía «N filas», que es lo único que la tabla de
                    abajo ya enseña por sí sola. «Estrato» es la única palabra
                    técnica de esta pestaña que no se explica en ninguna parte:
                    los VALORES sí se traducen —`etiquetaDeEstrato()` convierte
                    «GESTIÓN Y ALTA DIRECCIÓN / F / G3» en algo legible— pero la
                    palabra no. Se dice qué es, sin nombrar las columnas del
                    corte: son configurables por estudio (`estratos_selector`) y
                    escribirlas aquí sería falso en cuanto alguien las cambie. */}
                <span>{fmt(estratoRows.length)} estratos de diseño · cada uno con sus cursos-horario, sus válidas y su brecha</span>
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
    </>
  );
}
