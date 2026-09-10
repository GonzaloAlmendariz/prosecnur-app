import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { etiquetaDeFecha } from "./agendaPorDia";
import type { SeguimientoDeFacultad } from "./seguimientoDeFacultad";
import "./aulasSeguimientoDeFacultad.css";

/**
 * El seguimiento desgranado de UNA facultad, en Resumen.
 *
 * Gonzalo, 2026-09-10, siete preguntas de una tirada: «si estamos viendo una
 * facultad en particular en el resumen, sería interesante ver cuántas aulas
 * tienen agendadas, cuántas faltan, cuándo se van a llenar todas las aulas que
 * tenemos planificadas, si es que hay alguna aula adicional que estamos
 * planteando o debería plantearse, si se están llegando las cuotas con las aulas
 * agendadas hasta ahora, si se está llegando a la cuota de hombres, si se está
 * llegando a la cuota de mujeres».
 *
 * **Sólo aparece con una facultad puesta**, que es su premisa. Sin ella, la
 * pestaña ya contesta lo mismo para las quince en sus otros paneles y este
 * bloque sería una decimosexta copia.
 *
 * El cálculo no vive aquí: lo hace `seguimientoDeFacultad`, que junta lo que ya
 * publican el motor de metas, el pronóstico por agenda y la reserva de la
 * cadena. Este componente sólo lo pone en la pregunta.
 */
export function AulasSeguimientoDeFacultad({ seguimiento }: {
  seguimiento: SeguimientoDeFacultad | null;
}): ReactNode {
  if (!seguimiento) return null;
  const s = seguimiento;
  const pendientes = s.agendados + s.sinAgendar;

  return (
    <div className="aulas-segfac" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-segfac-lectura">
        {/* Las tres primeras preguntas, en una frase: cuántas agendadas, cuántas
            faltan y hasta cuándo llega lo que ya tiene fecha. */}
        <strong>{fmt(s.agendados)}</strong> {s.agendados === 1 ? "curso-horario agendado" : "cursos-horario agendados"}
        {s.sinAgendar ? <> · <strong>{fmt(s.sinAgendar)}</strong> sin fecha todavía</> : null}
        {s.ultimaFecha ? <> · lo agendado se termina de aplicar el {etiquetaDeFecha(s.ultimaFecha)}</> : null}
        {!pendientes ? <> · no le queda nada por aplicar</> : null}
      </p>

      {s.cuotas.length ? (
        <ul className="aulas-segfac-cuotas">
          {s.cuotas.map((c) => {
            // El ancho del carril es la META; lo conseguido y lo proyectado se
            // apilan dentro. Por encima del 100 % se recorta el dibujo, no la
            // cifra: la barra dice «llega», el número dice cuánto sobra.
            const base = c.meta > 0 ? c.meta : 1;
            const hecho = Math.min(100, (100 * c.obtenidas) / base);
            const viene = c.proyectadas == null ? 0
              : Math.max(0, Math.min(100 - hecho, (100 * c.proyectadas) / base));
            return (
              <li key={c.clave} className={c.brecha != null && c.brecha < 0 ? "es-corta" : ""}>
                <span className="aulas-segfac-etiqueta">{c.etiqueta}</span>
                <span className="aulas-segfac-carril" role="img"
                  aria-label={`${c.etiqueta}: ${fmt(c.obtenidas)} conseguidas de ${fmt(c.meta)}`}>
                  <i style={{ width: `${hecho}%` }} />
                  {/* Lo que traerá lo ya agendado, en el mismo carril y con otro
                      tono: es una previsión, no una respuesta en mano. */}
                  <b style={{ width: `${viene}%`, left: `${hecho}%` }} />
                </span>
                <span className="aulas-segfac-cifras">
                  <strong>{fmt(c.obtenidas)}</strong>
                  {c.proyectadas ? <em>+{fmt(Math.round(c.proyectadas))}</em> : null}
                  <i>de {fmt(c.meta)}</i>
                </span>
                <span className={`aulas-segfac-brecha${
                  c.brecha == null ? " es-muda" : c.brecha < 0 ? " es-corta" : " es-sobra"}`}>
                  {c.brecha == null ? "sin proyección"
                    : c.brecha < 0 ? `faltan ${fmt(Math.abs(Math.round(c.brecha)))}`
                      : `sobran ${fmt(Math.round(c.brecha))}`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mon-profile-muted">
          {s.facultad} no tiene cuota declarada en el diseño, así que no hay meta
          contra la que proyectar lo agendado.
        </p>
      )}

      <p className="aulas-segfac-pie">
        {/* La cuarta pregunta —«¿hay alguna aula adicional que estamos planteando
            o debería plantearse?»— se contesta con lo que ya está sorteado antes
            que con aulas nuevas: primero el relevo de la cadena, después el
            banco de extras. */}
        {s.faltaAlguna ? (
          <>
            <strong>Con lo agendado no llega.</strong>{" "}
            {s.relevosVivos || s.extrasDisponibles ? (
              <>
                Antes de pedir aulas nuevas quedan{" "}
                {s.relevosVivos ? <><strong>{fmt(s.relevosVivos)}</strong> relevos de la cadena</> : null}
                {s.relevosVivos && s.extrasDisponibles ? " y " : null}
                {s.extrasDisponibles ? <><strong>{fmt(s.extrasDisponibles)}</strong> del banco de extras</> : null}
                {" "}que se pueden activar.
              </>
            ) : (
              <>No le quedan relevos ni extras sorteados: cerrar exige aulas nuevas.</>
            )}
          </>
        ) : (
          <>
            Con lo agendado llega a sus tres metas.
            {s.relevosVivos ? <> Le quedan <strong>{fmt(s.relevosVivos)}</strong> relevos de la cadena sin usar.</> : null}
          </>
        )}
      </p>
    </div>
  );
}
