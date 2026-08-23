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
    // El vacío declara lo mismo que la rama con datos: es miembro del grupo y
    // posee su hueco. Sin esto, cuando el panel no tiene nada que pintar el
    // único miembro visible pasa a ser el encabezado de la sección y el gate
    // canta `capacity-drift` sobre sus 5 px de padding.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {f.sinFecha
          ? `Ninguno de los ${fmt(f.sinFecha)} cursos-horario del plan tiene fecha agendada, así que no se puede decir cuáles van con atraso.`
          : "La agenda todavía no declara fechas."}
      </p>
    );
  }

  const alDia = f.vencidas === f.vencidasConParte;
  // «Ya pasaron su fecha» respecto de CUÁNDO. El corte es el sello del tablero,
  // no el reloj del navegador, así que un proyecto reabierto días después
  // contaba el atraso contra un día que el panel no nombraba en ninguna parte.
  const diaDelCorte = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) return "";
    const [a, m, d] = corte.split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString("es-PE",
      { day: "numeric", month: "long" });
  })();
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
        {/* Va en el flujo con el mismo separador que el resto del panel: es una
            calificación de todas las cifras de la frase, no un dato aparte. */}
        {diaDelCorte ? <> · <span className="aulas-frente-corte">al {diaDelCorte}</span></> : null}
      </p>
      {f.vencidas ? (
        <div className="aulas-frente-carril" role="img"
          aria-label={`${fmt(f.vencidasConParte)} de ${fmt(f.vencidas)} aulas vencidas con parte`}>
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
