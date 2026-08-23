import { useEffect, useMemo, useState } from "react";

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
/** Alto por debajo del cual la franja de días no cabe junto a una tabla usable. */
const ALTO_COMPACTO = 820;

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasAgendaPorDia({ filas, totalDelPlan = 0 }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** Cursos-horario que tiene el plan de verdad, sin el banco.
   *
   * `filas` llega recortada: `course_status` se topea a 500 antes de salir del
   * backend. Contar lo que llegó y llamarlo «los N cursos-horario» presentaba un
   * recorte de payload como si fuera el universo — medido: «ninguno de los 42»
   * sobre un plan de 686. */
  totalDelPlan?: number;
}) {
  // Se mide una vez y se escucha el cambio: el usuario redimensiona la ventana
  // y la franja tiene que abrirse o cerrarse con ella.
  const [compacto, setCompacto] = useState(
    () => typeof window !== "undefined" && window.innerHeight <= ALTO_COMPACTO,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-height: ${ALTO_COMPACTO}px)`);
    const alCambiar = () => setCompacto(mq.matches);
    alCambiar();
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  const { dias, diasDeCampo, tope, sinFecha, desde, hasta, leyenda } = useMemo(
    () => agendaPorDia(filas),
    [filas],
  );

  if (!dias.length) return null;

  // Sin ninguna fecha en el plan no hay calendario que dibujar; decirlo es más
  // útil que una barra única con todo dentro.
  if (!diasDeCampo) {
    // El total manda sobre lo que llegó; si no viene, se usa lo contado, que es
    // lo que había antes.
    const cuantos = totalDelPlan > 0 ? totalDelPlan : sinFecha;
    // Y cuando lo que llegó es menos que el plan, se dice: la agenda está
    // mirando una parte y callarlo haría creer que se vio todo.
    const parcial = totalDelPlan > 0 && sinFecha > 0 && sinFecha < totalDelPlan;
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Ninguno de los {fmt(cuantos)} cursos-horario tiene fecha de aplicación. Se
        declara en la columna «Fecha de aplicación» del libro.
        {parcial ? <> La agenda dibuja los {fmt(sinFecha)} que caben en esta vista.</> : null}
      </p>
    );
  }

  return (
    <div className="aulas-agenda-dias">
      {/* La franja va en un `details` y no suelta: en pantalla corta el panel
          baja a 180 px y no caben los diez días Y una tabla usable, así que
          antes la tabla se quedaba en tres filas de 236. Cerrado, el `summary`
          sigue diciendo lo que resume —cuántos días y de cuándo a cuándo— y el
          contrato reconoce el patrón: lo que cuelga de un `details` cerrado no
          cuenta como contenido inalcanzable, porque se abre. Se abre solo en
          escritorio, donde sí cabe. */}
      <details className="aulas-agenda-detalle" open={!compacto}>
        <summary className="aulas-agenda-lectura">
          <strong>{diasDeCampo}</strong> {diasDeCampo === 1 ? "día de campo" : "días de campo"}
          {desde ? <> · de {desde} a {hasta}</> : null}
          {sinFecha ? <> · <strong>{sinFecha}</strong> sin fecha</> : null}
        </summary>
      <ol className="aulas-agenda-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
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
              {/* El punto es un carácter de verdad y no un `::before`: el total
                  del día y los que no empezaron quedaban pegados —«19» y «3»—
                  y el texto se leía «193 sin empezar». */}
              <em>{" · "}{dia.sinEmpezar ? `${dia.sinEmpezar} sin empezar` : "todas con respuestas"}</em>
            </span>
          </li>
        ))}
      </ol>
      </details>
      {/* La leyenda va DEBAJO de las barras y no encima: primero se ve la forma
          del periodo y sólo después se pregunta qué es cada color. Lleva el
          total de cada tramo, así que además de descifrar las barras es la
          lectura del periodo entero. */}
      {leyenda.length > 1 ? (
        <ul className="aulas-agenda-leyenda">
          {leyenda.map((t) => (
            <li key={t.clave}>
              <i aria-hidden="true" style={{ background: t.color }} />
              {t.etiqueta} <strong>{t.aulas}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
