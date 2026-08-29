import type { MonitoreoAulasReservaDirigida } from "../../../../api/monitoreo";
import { fmtCuenta } from "./kpisDeAulas";

/**
 * A qué aula del banco ir por cada celda de cuota que no va a llegar.
 *
 * El motor lo calculaba desde hace tiempo —`monitoreo_aulas_reserva_dirigida.R`,
 * con su propio test— y **ningún archivo del frontend leía
 * `reserva_dirigida`**: comprobado por grep sobre `frontend/src/` entero. Lo que
 * la pantalla enseñaba era el agregado por facultad (`reservas_alcanzan`,
 * `reservas_libres`), que va un nivel más arriba y puede decir que las reservas
 * alcanzan mientras la celda de mujeres de esa misma facultad no tiene ni un
 * aula de banco que ayude.
 *
 * Se pinta sólo donde hay decisión que tomar. Sin celdas en déficit no hay
 * superficie: un panel vacío diciendo «todo bien» compite por la atención con
 * las que sí piden acción.
 */
export function AulasReservaDirigida({ celdas }: { celdas: ReadonlyArray<MonitoreoAulasReservaDirigida> }) {
  const conDecision = celdas.filter((c) => c && Number(c.brecha) > 0);
  if (!conDecision.length) return null;

  // Primero las que NO se cierran con el banco: son las que obligan a hacer algo
  // distinto —pedir aulas, mover cuota— y no sólo a activar una reserva.
  const orden = [...conDecision].sort((a, b) =>
    Number(a.alcanza) - Number(b.alcanza) || Number(b.brecha) - Number(a.brecha));

  return (
    <section
      className="aulas-reserva-dirigida"
      data-qa-geometry-group="aulas-reserva-dirigida"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="aulas-reserva-dirigida-head">
        <h4>A qué aula del banco ir</h4>
        <span>
          {orden.length === 1 ? "1 celda" : `${fmtCuenta(orden.length)} celdas`} de cuota que hoy no llega
        </span>
      </header>

      <ul className="aulas-reserva-dirigida-lista">
        {orden.map((celda) => {
          const clave = `${celda.faculty}‧${celda.sex}`;
          return (
            <li
              key={clave}
              className="aulas-reserva-dirigida-celda"
              data-alcanza={celda.alcanza ? "si" : "no"}
            >
              <div className="aulas-reserva-dirigida-celda-head">
                <strong>{celda.faculty || "Sin facultad"}</strong>
                <span className="aulas-reserva-dirigida-sexo">
                  {celda.sex === "F" ? "mujeres" : celda.sex === "M" ? "hombres" : celda.sex}
                </span>
                <span className="aulas-reserva-dirigida-brecha">faltan {fmtCuenta(celda.brecha)}</span>
              </div>

              {/* La frase la redacta el motor con las dos cifras que deciden
                  —cuánto aportan y cuánto falta—; reescribirla aquí sería una
                  segunda lectura del mismo dato. */}
              <p className="aulas-reserva-dirigida-etiqueta">{celda.etiqueta}</p>

              {celda.candidatos.length ? (
                <ul className="aulas-reserva-dirigida-candidatos">
                  {celda.candidatos.map((cand) => (
                    <li key={`${clave}‧${cand.classroom_id}`}>
                      <code>{cand.classroom_id}</code>
                      <span>{cand.motivo}</span>
                      {/* Sin padrón el solape es estimado, y decirlo es la
                          diferencia entre un número y un supuesto. */}
                      {cand.solape_medible ? null : (
                        <em className="aulas-reserva-dirigida-estimado">solape estimado</em>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
