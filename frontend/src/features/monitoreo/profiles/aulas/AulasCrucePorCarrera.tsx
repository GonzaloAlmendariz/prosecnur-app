import { fmt } from "./kpisDeAulas";
import { claseDeFacultad } from "./tonoDeFacultad";

import "./aulasCrucePorCarrera.css";

/**
 * **El cruce de alumnos por código PUCP, y a quién alcanzó.**
 *
 * Gonzalo, 2026-09-22: «en validación tiene que estar el cruce por alumnos por
 * código PUCP, de la misma forma que en acreditación tenemos la lista de
 * actores y su estatus, pero no por actores —porque todos son estudiantes—
 * sino por la carrera a la que pertenecen».
 *
 * De este cruce depende todo el avance de un estudio cuyo eje se resuelve por
 * persona: si un código no resuelve, su respuesta no cae en ningún grupo. Hasta
 * aquí sólo se publicaba el total —«1 sin nivel»— sin decir de quiénes.
 *
 * Tres cosas que esta superficie tiene que DECIR, no sólo listar:
 *
 * 1. **Son personas, no respuestas.** La segunda respuesta de alguien no es
 *    alguien más: se cuenta aparte y se enseña en la carrera donde ocurrió.
 * 2. **La carrera sale del padrón**, no del curso-horario donde se recogió. Un
 *    curso-horario de Economía tiene alumnos de varias carreras; por eso una
 *    respuesta que no cruza NO tiene carrera y va a su propio bloque.
 * 3. **Cada motivo de no-cruce se arregla en un sitio distinto**, así que el
 *    número solo no sirve para actuar: se nombran.
 */

export type FilaDeCarrera = {
  carrera: string;
  carrera_key?: string;
  personas: number;
  duplicadas?: number;
  /** Cuántos son en total en el padrón; `null` cuando no se sabe. */
  poblacion?: number | null;
};

export type MotivoSinCruce = { motivo: string; etiqueta: string; respuestas: number };

export type BloqueDeCruce = {
  total: {
    consideradas: number;
    personas: number;
    duplicadas: number;
    sin_cruce: number;
    tasa: number | null;
  };
  carreras: FilaDeCarrera[];
  sin_cruce: MotivoSinCruce[];
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function AulasCrucePorCarrera({ bloque }: { bloque: BloqueDeCruce | null | undefined }) {
  const total = bloque?.total;
  /**
   * C3: la superficie contiene su propio vacío, y lo CLASIFICA. «Todavía no hay
   * respuestas que cruzar» y «el estudio no cruza por código» piden cosas
   * distintas: la primera es esperar, la segunda es declarar la columna.
   */
  if (!total || total.consideradas === 0) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Todavía no hay respuestas con las que cruzar el padrón.
      </p>
    );
  }

  const carreras = bloque?.carreras ?? [];
  const motivos = bloque?.sin_cruce ?? [];
  const techo = Math.max(...carreras.map((c) => numero(c.personas)), 1);
  const tasa = total.tasa == null ? null : Math.round(numero(total.tasa) * 1000) / 10;

  return (
    <div className="aulas-cxc" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cxc-titular">
        <strong>{fmt(total.personas)}</strong> alumnos distintos identificados por su código
        {tasa != null ? <span className="aulas-cxc-pct"> · cruzó el {tasa} % de {fmt(total.consideradas)}</span> : null}
      </p>
      {/* Las dos notas del total. Sólo cuando existen: un «0 repetidos»
          permanente es ruido, y con el padrón entero resolviendo no hay nada
          que arreglar. */}
      {total.duplicadas > 0 || total.sin_cruce > 0 ? (
        <p className="aulas-cxc-notas">
          {total.duplicadas > 0 ? (
            <span>
              {total.duplicadas === 1
                ? "1 persona respondió dos veces"
                : `${fmt(total.duplicadas)} personas respondieron dos veces`}
            </span>
          ) : null}
          {total.sin_cruce > 0 ? (
            <span>{fmt(total.sin_cruce)} respuestas sin identificar</span>
          ) : null}
        </p>
      ) : null}

      {carreras.length ? (
        <ul className="aulas-cxc-lista" role="table" aria-label="Alumnos identificados en cada carrera">
          <li role="row" className="aulas-cxc-cab">
            <span role="columnheader">Carrera</span>
            <span role="columnheader">Alumnos</span>
            <span role="columnheader">Reparto de los alumnos</span>
            <span role="columnheader">En el padrón</span>
          </li>
          {carreras.map((c) => {
            const personas = numero(c.personas);
            const poblacion = c.poblacion == null ? null : numero(c.poblacion);
            const dup = numero(c.duplicadas);
            return (
              <li key={c.carrera} role="row">
                <span role="cell">
                  <span className={claseDeFacultad(c.carrera)}>{c.carrera}</span>
                  {/* La repetición se enseña DONDE ocurrió: en el total sola no
                      se puede ir a buscar. */}
                  {dup > 0 ? (
                    <em className="aulas-cxc-dup">
                      {dup === 1 ? " · 1 repetida" : ` · ${fmt(dup)} repetidas`}
                    </em>
                  ) : null}
                </span>
                <span role="cell" className="aulas-cxc-num aulas-cxc-fuerte">{fmt(personas)}</span>
                <span role="cell" className="aulas-cxc-barra">
                  {/* Cero no dibuja un hilo de cortesía: se leería como «algo hay». */}
                  {personas > 0 ? (
                    <i style={{ width: `${Math.max(1.5, (100 * personas) / techo)}%` }} />
                  ) : null}
                </span>
                {/* Sin población del padrón, un guion: «no lo sé» y «son cero»
                    no son lo mismo. */}
                <span role="cell" className="aulas-cxc-num aulas-cxc-debil">
                  {poblacion == null ? "—" : `de ${fmt(poblacion)}`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mon-profile-muted">
          Ninguna respuesta ha cruzado todavía: abajo está por qué.
        </p>
      )}

      {motivos.length ? (
        <div className="aulas-cxc-sincruce">
          <span className="aulas-cxc-sincruce-rotulo">
            Por qué {fmt(total.sin_cruce)} no se pudieron identificar
          </span>
          <ul className="aulas-cxc-motivos">
            {motivos.map((m) => (
              <li key={m.motivo}>
                <span className="aulas-cxc-num aulas-cxc-fuerte">{fmt(numero(m.respuestas))}</span>
                <span>{m.etiqueta}</span>
              </li>
            ))}
          </ul>
          {/* Lo que este panel NO cubre, dicho: sin esto se lee como si el cruce
              fuera un problema de los alumnos, y la causa más cara —la columna
              del código mal declarada, o un padrón de otra extracción— es del
              estudio. */}
          <p className="aulas-cxc-pie">
            Un código bien declarado resuelve casi todo. Si no resuelve casi
            ninguno, mira la columna declarada en Fuentes y la vigencia del
            padrón antes que a los alumnos.
          </p>
        </div>
      ) : null}
    </div>
  );
}
