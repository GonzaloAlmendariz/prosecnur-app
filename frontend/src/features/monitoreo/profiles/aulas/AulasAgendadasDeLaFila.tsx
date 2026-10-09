import type { ReactNode } from "react";

import { Popover } from "../../../../components/Popover";
import { fmt } from "./kpisDeAulas";
import type { MonitoreoAulasAgendadaDeLaFila } from "../../../../api/monitoreo";
import "./aulasAgendadasDeLaFila.css";

/**
 * «N agendados», con el detalle al hacer clic.
 *
 * Gonzalo, 2026-09-24, sobre «Metas y aulas»: «necesito también saber con un
 * hover o algo esas aulas agendadas cuáles son y cuándo están agendadas, en qué
 * fecha y a qué hora, y cuántos hombres y mujeres tiene».
 *
 * La lista la arma el motor con la MISMA máscara que la cifra, así que el
 * desplegable no puede enseñar otra cantidad. Es un botón: también abre con
 * Enter o espacio desde el teclado.
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

/** Plumber manda la lista con nombre como objeto, y vacía como `[]`. */
function nivelesDe(a: MonitoreoAulasAgendadaDeLaFila): Record<string, number> {
  const v = a.niveles;
  if (!v || Array.isArray(v) || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    const x = Number(n);
    if (Number.isFinite(x)) out[k] = x;
  }
  return out;
}

const porNumero = (a: string, b: string) =>
  (Number(a) - Number(b)) || a.localeCompare(b, "es");

export function AulasAgendadasDeLaFila({ total, agendadas, nivel, rotulo }: {
  total: number;
  /** El texto del disparo, si no es «N agendados». */
  rotulo?: string;
  agendadas: ReadonlyArray<MonitoreoAulasAgendadaDeLaFila> | undefined;
  /**
   * El nivel de la fila, cuando la cuota va por nivel curricular (CCSS,
   * 2026-09-24: «en vez de hombres y mujeres, alumnos de los niveles»). Con él
   * las columnas son los niveles de cada aula y el suyo va resaltado.
   */
  nivel?: string;
}): ReactNode {
  const texto = rotulo ?? `${fmt(total)} ${total === 1 ? "agendado" : "agendados"}`;
  // Sin detalle (un tablero anterior) o sin agendados, la cifra sola.
  if (!total || !agendadas?.length) return <>{texto}</>;
  return (
    // **Clic y no hover** (Gonzalo, 2026-09-24): con diez aulas la lista es
    // alta y hay que desplazarse dentro; con hover se cerraba al mover el
    // cursor hacia ella. Se cierra con clic fuera o Esc.
    <Popover
      openOn="click"
      side="bottom"
      align="start"
      maxWidth={540}
      className="aulas-agendadas-pop"
      ariaLabel={`Cursos-horario agendados: ${texto}`}
      trigger={<button type="button" className="aulas-agendadas-disparo">{texto}</button>}
    >
      <DetalleDeAgendadas total={total} agendadas={agendadas} nivel={nivel} />
    </Popover>
  );
}

/** El contenido del desplegable, aparte para poder probarlo sin abrirlo. */
export function DetalleDeAgendadas({ total, agendadas, nivel }: {
  total: number;
  agendadas: ReadonlyArray<MonitoreoAulasAgendadaDeLaFila>;
  nivel?: string;
}): ReactNode {
  const hoy = hoyIso();
  const hombres = suma(agendadas.map((a) => a.hombres));
  const mujeres = suma(agendadas.map((a) => a.mujeres));
  const composiciones = agendadas.map(nivelesDe);
  const niveles = nivel != null
    ? [...new Set(composiciones.flatMap((c) => Object.keys(c)))].sort(porNumero)
    : [];
  const modoNivel = niveles.length > 0;
  const delNivel = modoNivel
    ? composiciones.reduce((t, c) => t + (c[String(nivel)] ?? 0), 0) : 0;
  const elegiblesTotal = agendadas.reduce((t, a) => t + (a.elegibles ?? 0), 0);
  const vencidas = agendadas.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha < hoy).length;
  return (
    <>
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
        {modoNivel ? (
          <dl className="aulas-agendadas-totales" aria-label="Alumnos elegibles">
            <div data-foco=""><dt>Nivel {nivel}</dt><dd>{fmt(delNivel)}</dd></div>
            <div><dt>Todos los niveles</dt><dd>{fmt(elegiblesTotal)}</dd></div>
          </dl>
        ) : (
          <dl className="aulas-agendadas-totales" aria-label="Elegibles en total">
            <div data-sexo="hombres"><dt>Hombres</dt><dd>{hombres == null ? "—" : fmt(hombres)}</dd></div>
            <div data-sexo="mujeres"><dt>Mujeres</dt><dd>{mujeres == null ? "—" : fmt(mujeres)}</dd></div>
          </dl>
        )}
      </header>
      <table className="aulas-agendadas-tabla">
        <thead>
          <tr>
            <th>Cuándo</th>
            <th>Curso-horario</th>
            {modoNivel ? niveles.map((k) => (
              <th key={k} className="es-num" data-foco={k === String(nivel) ? "" : undefined}>Niv. {k}</th>
            )) : (
              <>
                <th className="es-num" data-sexo="hombres">H</th>
                <th className="es-num" data-sexo="mujeres">M</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {agendadas.map((a, i) => {
            // Una fecha que ya pasó sin respuestas se sigue proyectando: se
            // marca, porque es la que hay que confirmar hoy.
            const vencida = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha < hoy;
            return (
              <tr key={`${a.codigo}-${i}`} className={vencida ? "es-vencida" : undefined}>
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
                {modoNivel ? niveles.map((k) => {
                  const n = composiciones[i][k];
                  return (
                    <td key={k} className="es-num" data-foco={k === String(nivel) ? "" : undefined}>
                      {n ? fmt(n) : <span className="es-cero">·</span>}
                    </td>
                  );
                }) : (
                  <>
                    <td className="es-num" data-sexo="hombres">{a.hombres == null ? "—" : fmt(a.hombres)}</td>
                    <td className="es-num" data-sexo="mujeres">{a.mujeres == null ? "—" : fmt(a.mujeres)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="aulas-agendadas-pie">
        {modoNivel
          ? "Alumnos elegibles de cada nivel curricular en cada curso-horario, del marco."
          : "H y M: elegibles del padrón en cada curso-horario."}
      </p>
    </>
  );
}
