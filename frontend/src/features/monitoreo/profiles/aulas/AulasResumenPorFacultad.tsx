import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { resumenPorFacultad } from "./resumenPorFacultad";
import { claseDeFacultad } from "./tonoDeFacultad";
import type {
  MonitoreoAulasPorFacultad,
  MonitoreoAulasRespuestasCuenta,
} from "../../../../api/monitoreo";
import "./aulasResumenPorFacultad.css";

/**
 * El primer alcance de Avance: las quince facultades de un vistazo.
 *
 * Contesta las tres cosas que Gonzalo pide de esta pestaña —«las respuestas
 * efectivas de las facultades, las aulas, cuántas se han aplicado»— y ninguna
 * estaba: el bloque de respuestas daba el total y filtraba de una en una.
 *
 * **La barra dibuja lo mismo que ordena la lista: las efectivas.** Primero
 * midió el avance de las aulas (aplicadas sobre planificadas) mientras la lista
 * bajaba por efectivas, y el resultado en pantalla el 2026-09-10 era el defecto
 * que Gonzalo ya había señalado en Rendimiento: ARQUITECTURA, cuarta por
 * efectivas con 99, tenía la barra MÁS LARGA de la tabla —6 de 8 aulas, 75 %—
 * y CIENCIAS E INGENIERÍA, primera con 202, la tenía a media asta. Una lista
 * descendente con barras que suben y bajan se lee como un error de datos, y el
 * rótulo de la columna —«Cursos-horario aplicados»— prometía además un CONTEO
 * y dibujaba una fracción.
 *
 * Las dos lecturas siguen estando, cada una donde no se contradice: el avance
 * de las aulas en sus dos columnas de cifras —12 de 37— y, entero, en
 * «Cursos-horario por cobertura», más abajo en esta misma pestaña.
 */
export function AulasResumenPorFacultad({ respuestas, aulas, facultadEnFoco, grupo }: {
  respuestas: ReadonlyArray<MonitoreoAulasRespuestasCuenta & { facultad: string }> | null | undefined;
  aulas: ReadonlyArray<MonitoreoAulasPorFacultad> | null | undefined;
  /**
   * Con una facultad en foco, esta lista se queda en SU fila.
   *
   * Aquí el foco FILTRA y no resalta, al revés que en las otras pestañas, y no
   * es una incoherencia: allí los paneles son rankings —lo que aportan es dónde
   * cae una facultad entre las otras— y aquí es un resumen. Gonzalo,
   * 2026-09-10: «cuando yo selecciono una facultad, debería mostrarme sólo la de
   * esa facultad». El mando, además, sólo existe en esta pestaña desde a8d903a8.
   */
  facultadEnFoco?: string;
  /**
   * Cómo se llama lo que agrupa estas filas. El motor las agrupa por lo que el
   * estudio declara —facultad por defecto, carrera en uno que vive dentro de
   * UNA facultad— y el campo sigue llamándose `facultad` por contrato. Sin
   * valor, «Facultad»: idéntico a lo de siempre.
   */
  grupo?: string;
}): ReactNode {
  const todas = resumenPorFacultad(respuestas, aulas);
  const filas = facultadEnFoco
    ? todas.filter((f) => f.facultad.trim().toUpperCase() === facultadEnFoco.trim().toUpperCase())
    : todas;
  if (!filas.length) return null;
  const etiqueta = (grupo ?? "").trim() || "Facultad";
  return (
    <div className="aulas-rpf" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <ul className="aulas-rpf-lista" role="table"
        aria-label={`Respuestas efectivas y aulas de cada ${etiqueta.toLocaleLowerCase("es")}`}>
        <li role="row" className="aulas-rpf-cab">
          <span role="columnheader">{etiqueta}</span>
          <span role="columnheader">Efectivas</span>
          {/* La barra es el reparto de la MISMA cifra de la columna anterior:
              el rótulo lo dice para que nadie la lea como otra medida. */}
          <span role="columnheader">Reparto de las efectivas</span>
          <span role="columnheader">Aplicados</span>
          <span role="columnheader">Planificados</span>
        </li>
        {/* El techo es la facultad con más efectivas, no la suma: con la suma
            como denominador la primera barra ocuparía un 21 % del carril y las
            once últimas serían hilos indistinguibles. */}
        {(() => {
          const techo = Math.max(...filas.map((f) => f.efectivas), 1);
          return filas.map((f) => {
          const parte = (100 * f.efectivas) / techo;
          return (
            <li key={f.facultad} role="row">
              <span role="cell">
                <span className={claseDeFacultad(f.facultad)}>{f.facultad}</span>
              </span>
              <span role="cell" className="aulas-rpf-num aulas-rpf-efectivas">
                {fmt(f.efectivas)}
              </span>
              <span role="cell" className="aulas-rpf-barra">
                {/* Cero efectivas NO dibuja un mínimo de cortesía: un hilo
                    donde no hay nada se lee como «algo hay». El carril vacío
                    con su cifra en 0 al lado ya lo dice. */}
                {f.efectivas > 0 ? <i style={{ width: `${Math.max(1.5, parte)}%` }} /> : null}
              </span>
              <span role="cell" className="aulas-rpf-num">
                {f.aplicadas === null ? "—" : fmt(f.aplicadas)}
              </span>
              <span role="cell" className="aulas-rpf-num aulas-rpf-debil">
                {f.planificadas === null ? "—" : fmt(f.planificadas)}
              </span>
            </li>
          );
          });
        })()}
      </ul>
    </div>
  );
}
