import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { frenteDelOperativo } from "./frenteDelOperativo";

/**
 * A qué aulas hay que ir a reclamar hoy.
 *
 * Avance contesta cuánto se lleva; esta vista, qué se quedó atrás. Son preguntas
 * distintas: un operativo puede ir al 90 % de respuestas y tener treinta aulas
 * que pasaron su día sin que nadie las registrara.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

function fechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("es-PE", { weekday: "short" }).replace(".", "");
  return `${dia} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AulasFrenteDelOperativo({ filas, partes, corte }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  partes: ReadonlyArray<Record<string, unknown>>;
  corte: string;
}) {
  const f = useMemo(() => frenteDelOperativo(filas, partes, corte), [filas, partes, corte]);

  if (!f.conFecha) {
    return (
      <p className="mon-profile-muted">
        {f.sinFecha
          ? `Ninguno de los ${fmt(f.sinFecha)} cursos-horario del plan tiene fecha agendada, así que no se puede decir cuáles van con atraso.`
          : "La agenda todavía no declara fechas."}
      </p>
    );
  }

  const alDia = f.vencidas === f.vencidasConParte;
  const ancho = f.vencidas ? Math.round((100 * f.vencidasConParte) / f.vencidas) : 100;

  return (
    <div className="aulas-frente">
      <p className="aulas-frente-lectura">
        {f.vencidas === 0 ? (
          <>Todavía no vence ningún curso-horario: los <strong>{fmt(f.conFecha)}</strong> con fecha
            están por delante del corte.</>
        ) : alDia ? (
          <>Los <strong>{fmt(f.vencidas)}</strong> cursos-horario que ya pasaron su fecha tienen
            su parte en el libro.</>
        ) : (
          <>
            <strong>{fmt(f.pendientes.length)}</strong> de{" "}
            <strong>{fmt(f.vencidas)}</strong> cursos-horario que ya pasaron su fecha siguen sin
            parte en el libro
          </>
        )}
        {f.porVenir ? <> · <strong>{fmt(f.porVenir)}</strong> aún por venir</> : null}
        {/* Sin fecha DECLARADO aparte: no están al día ni atrasados, y meterlos
            en cualquiera de los dos lados inventaría un diagnóstico. */}
        {f.sinFecha ? <> · <strong>{fmt(f.sinFecha)}</strong> sin fecha en la agenda</> : null}
      </p>
      {f.vencidas ? (
        <div className="aulas-frente-carril" role="img"
          aria-label={`${f.vencidasConParte} de ${f.vencidas} aulas vencidas con parte`}>
          <i style={{ width: `${ancho}%`, background: COLOR_RESULTADO.efectiva }} />
          <i style={{ width: `${100 - ancho}%`, background: COLOR_RESULTADO.rechazo }} />
        </div>
      ) : null}
      {f.pendientes.length ? (
        <ul className="aulas-frente-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {f.pendientes.map((a) => (
            <li key={a.codigo}>
              {/* Los DÍAS delante: es lo que ordena la lista y lo que decide a
                  cuál ir primero. La fecha sola obliga a restar de cabeza. */}
              <span className="aulas-frente-dias">
                <strong>{fmt(a.dias)}</strong> {a.dias === 1 ? "día" : "días"}
              </span>
              <span className="aulas-frente-codigo">{a.codigo}</span>
              <span className="aulas-frente-facultad" title={a.facultad}>{a.facultad}</span>
              <span className="aulas-frente-cuando">
                {fechaCorta(a.fecha)}{a.hora ? <em> {a.hora}</em> : null}
              </span>
              {/* El `title` lleva el texto ENTERO del Excel —«LUN 16:00 V110»—
                  aunque la celda muestre solo el aula: el vocabulario del equipo
                  no se pierde, solo deja de repetirse al lado de la columna que
                  ya dice el dia y la hora. */}
              <span className="aulas-frente-donde" title={a.sesion || a.donde}>{a.donde || "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
