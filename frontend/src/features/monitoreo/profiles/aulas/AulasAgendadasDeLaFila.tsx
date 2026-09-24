import type { ReactNode } from "react";

import { Popover } from "../../../../components/Popover";
import { fmt } from "./kpisDeAulas";
import type { MonitoreoAulasAgendadaDeLaFila } from "../../../../api/monitoreo";
import "./aulasAgendadasDeLaFila.css";

/**
 * «N agendados», con el detalle al pasar el cursor.
 *
 * Gonzalo, 2026-09-24, sobre «Metas y aulas»: «necesito también saber con un
 * hover o algo esas aulas agendadas cuáles son y cuándo están agendadas, en qué
 * fecha y a qué hora, y cuántos hombres y mujeres tiene».
 *
 * La lista la arma el motor con la MISMA máscara que la cifra, así que el
 * desplegable no puede enseñar otra cantidad. También abre con el foco del
 * teclado (el Popover escucha focus/blur).
 */

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «2026-09-14» → «lun 14/09». Sin fecha legible, lo que venga. */
function diaCorto(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha || "sin fecha";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DIAS[d.getDay()]} ${m[3]}/${m[2]}`;
}

function hoyIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const suma = (xs: ReadonlyArray<number | null>) =>
  xs.some((x) => x == null) ? null : xs.reduce<number>((t, x) => t + (x ?? 0), 0);

export function AulasAgendadasDeLaFila({ total, agendadas }: {
  total: number;
  agendadas: ReadonlyArray<MonitoreoAulasAgendadaDeLaFila> | undefined;
}): ReactNode {
  const texto = `${fmt(total)} ${total === 1 ? "agendado" : "agendados"}`;
  // Sin detalle (un tablero anterior) o sin agendados, la cifra sola.
  if (!total || !agendadas?.length) return <>{texto}</>;
  const hoy = hoyIso();
  const hombres = suma(agendadas.map((a) => a.hombres));
  const mujeres = suma(agendadas.map((a) => a.mujeres));
  const vencidas = agendadas.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha < hoy).length;
  return (
    <Popover
      openOn="hover"
      side="bottom"
      align="start"
      maxWidth={540}
      className="aulas-agendadas-pop"
      ariaLabel={`Cursos-horario agendados: ${texto}`}
      trigger={<button type="button" className="aulas-agendadas-disparo">{texto}</button>}
    >
      <header className="aulas-agendadas-cabeza">
        <div>
          <p className="aulas-agendadas-titulo">
            {fmt(total)} {total === 1 ? "curso-horario agendado" : "cursos-horario agendados"}
          </p>
          <p className="aulas-agendadas-sub">
            todavía sin aplicar: son lo proyectado de la barra
            {vencidas ? <> · <b>{fmt(vencidas)} con la fecha ya pasada</b></> : null}
          </p>
        </div>
        <dl className="aulas-agendadas-totales" aria-label="Elegibles en total">
          <div data-sexo="hombres"><dt>Hombres</dt><dd>{hombres == null ? "—" : fmt(hombres)}</dd></div>
          <div data-sexo="mujeres"><dt>Mujeres</dt><dd>{mujeres == null ? "—" : fmt(mujeres)}</dd></div>
        </dl>
      </header>
      <table className="aulas-agendadas-tabla">
        <thead>
          <tr>
            <th>Cuándo</th>
            <th>Curso-horario</th>
            <th className="es-num" data-sexo="hombres">H</th>
            <th className="es-num" data-sexo="mujeres">M</th>
          </tr>
        </thead>
        <tbody>
          {agendadas.map((a) => {
            // Una fecha que ya pasó sin respuestas se sigue proyectando: se
            // marca, porque es la que hay que confirmar hoy.
            const vencida = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha < hoy;
            return (
              <tr key={a.codigo} className={vencida ? "es-vencida" : undefined}>
                <td className="es-cuando">
                  <b>{diaCorto(a.fecha)}</b>
                  {a.hora ? <span>{a.hora}</span> : null}
                </td>
                <td className="es-curso">
                  <span className="aulas-agendadas-codigo">{a.codigo}</span>
                  <b>{[a.curso, a.seccion].filter(Boolean).join(" · ") || "—"}</b>
                  {a.lugar ? <span className="es-lugar">{a.lugar}</span> : null}
                  {vencida ? <em>Fecha pasada y sin respuestas: confirmar si se aplicó</em> : null}
                </td>
                <td className="es-num" data-sexo="hombres">{a.hombres == null ? "—" : fmt(a.hombres)}</td>
                <td className="es-num" data-sexo="mujeres">{a.mujeres == null ? "—" : fmt(a.mujeres)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="aulas-agendadas-pie">H y M: elegibles del padrón en cada curso-horario.</p>
    </Popover>
  );
}
