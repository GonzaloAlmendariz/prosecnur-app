import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { agendaPorDia } from "./agendaPorDia";

/**
 * La agenda de campo, día por día.
 *
 * Encabeza la sección porque contesta lo primero que se pregunta ahí —¿qué se
 * aplica y cuándo?— y la tabla se queda debajo, que es donde se busca un
 * curso-horario concreto.
 *
 * Barras en CSS a propósito: la sección no debe arrastrar el bundle de Plotly
 * por una lectura de diez filas. Es la misma decisión del histórico del cálculo
 * de muestra.
 */
export function AulasAgendaPorDia({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { dias, diasDeCampo, tope, sinFecha, desde, hasta } = useMemo(
    () => agendaPorDia(filas),
    [filas],
  );

  if (!dias.length) return null;

  // Sin ninguna fecha en el plan no hay calendario que dibujar; decirlo es más
  // útil que una barra única con todo dentro.
  if (!diasDeCampo) {
    return (
      <p className="mon-profile-muted">
        Ninguno de los {sinFecha} cursos-horario tiene fecha de aplicación. Se
        declara en la columna «Fecha de aplicación» del libro.
      </p>
    );
  }

  return (
    <div className="aulas-agenda-dias">
      <p className="aulas-agenda-lectura">
        <strong>{diasDeCampo}</strong> {diasDeCampo === 1 ? "día de campo" : "días de campo"}
        {desde ? <> · de {desde} a {hasta}</> : null}
        {sinFecha ? <> · <strong>{sinFecha}</strong> sin fecha</> : null}
      </p>
      <ol className="aulas-agenda-lista">
        {dias.map((dia) => (
          <li key={dia.fecha || "sin-fecha"} className={dia.fecha ? "" : "es-sin-fecha"}>
            <span className="aulas-agenda-dia">{dia.etiqueta}</span>
            {/* La barra mide el día contra el más cargado, así que la carga
                relativa se ve sin leer una cifra; el reparto interno dice en qué
                estado llega ese día. */}
            <span
              className="aulas-agenda-barra"
              style={{ width: `${tope ? Math.max(6, (100 * dia.aulas) / tope) : 0}%` }}
              role="img"
              aria-label={`${dia.aulas} cursos-horario, ${dia.cumplen} cumplen`}
            >
              {dia.tramos.filter((t) => t.aulas > 0).map((tramo) => (
                <i
                  key={tramo.clave}
                  style={{ flexGrow: tramo.aulas, background: tramo.color }}
                  title={`${tramo.etiqueta}: ${tramo.aulas}`}
                />
              ))}
            </span>
            <span className="aulas-agenda-cifra">
              <strong>{dia.aulas}</strong>
              {dia.sinEmpezar ? <em>{dia.sinEmpezar} sin empezar</em> : <em>todas con respuestas</em>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
