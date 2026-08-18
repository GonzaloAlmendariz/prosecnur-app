import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { perfilPorFacultad } from "./perfilPorFacultad";

/**
 * Cada facultad contra su meta, ordenadas por lo que falta.
 *
 * Cierra la lectura de Avance: primero cuánto se cubrió en total, después en qué
 * punto está cada aula, y aquí a dónde hay que ir. La barra ocupa lo que esa
 * facultad pide del total, así que una facultad grande a medias se ve distinta
 * de una pequeña vacía sin leer una cifra.
 *
 * Barras en CSS, sin Plotly, como el resto de la sección.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasPerfilPorFacultad({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { facultades, sinFacultad, tope, cumplidas } = useMemo(
    () => perfilPorFacultad(filas),
    [filas],
  );

  if (!facultades.length) {
    return (
      <p className="mon-profile-muted">
        {sinFacultad
          ? `Ninguno de los ${fmt(sinFacultad)} cursos-horario del plan declara facultad.`
          : "El plan todavía no trae cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-facultades">
      <p className="aulas-facultades-lectura">
        <strong>{fmt(facultades.length)}</strong>{" "}
        {facultades.length === 1 ? "facultad" : "facultades"} ·{" "}
        <strong>{fmt(cumplidas)}</strong> con su meta cumplida
        {sinFacultad ? <> · {fmt(sinFacultad)} cursos-horario sin facultad declarada</> : null}
      </p>
      <ol className="aulas-facultades-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {facultades.map((f) => (
          <li key={f.facultad}>
            <span className="aulas-facultad-nombre">
              {f.facultad}
              {/* Con una sola aula la tasa es un caso, no una tendencia: se
                  dice, en vez de dejar que se lea como perfil de la facultad. */}
              <em>{f.aulas === 1 ? "1 curso-horario" : `${fmt(f.aulas)} cursos-horario`}</em>
            </span>
            <span
              className="aulas-facultad-carril"
              style={{ width: `${tope ? Math.max(8, (100 * f.meta) / tope) : 0}%` }}
              role="img"
              aria-label={`${f.facultad}: ${f.avance}% de su meta`}
            >
              <i
                style={{
                  width: `${f.meta ? Math.round((100 * f.cubierto) / f.meta) : 0}%`,
                  background: COLOR_RESULTADO.efectiva,
                }}
              />
            </span>
            <span className="aulas-facultad-cifra">
              {f.falta ? (
                <>
                  <strong>{fmt(f.falta)}</strong>
                  <em>faltan · {f.avance}%</em>
                </>
              ) : (
                <em className="es-cumplida">meta cumplida</em>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
