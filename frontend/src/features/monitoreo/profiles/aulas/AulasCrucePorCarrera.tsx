import { useMemo, useState } from "react";

import { fmt } from "./kpisDeAulas";
import { claseDeFacultad } from "./tonoDeFacultad";
import { Search, XCircle } from "../../../../vendor/lucide-react";

import "./aulasCrucePorCarrera.css";

/**
 * **El cruce de alumnos por código PUCP, y a quién alcanzó.**
 *
 * Gonzalo, 2026-09-22: «en validación tiene que estar el cruce por alumnos por
 * código PUCP, de la misma forma que en acreditación tenemos la lista de
 * actores y su estatus, pero no por actores —porque todos son estudiantes—
 * sino por la carrera a la que pertenecen». Después, mirándolo: «esto debe ser
 * más específico, ¿has revisado cómo lo hace acreditación? Es bastante
 * específico con hora y todo» · «a la tabla le falta límite de altura con
 * scroll, buen formato, deglebables, filtros selectores».
 *
 * De este cruce depende todo el avance de un estudio cuyo eje se resuelve por
 * persona: si un código no resuelve, su respuesta no cae en ningún grupo.
 *
 * Cuatro cosas que esta superficie tiene que DECIR, no sólo listar:
 *
 * 1. **Son personas, no respuestas.** La segunda respuesta de alguien no es
 *    alguien más: se cuenta aparte y se enseña en la carrera donde ocurrió.
 * 2. **La carrera sale del padrón**, no del curso-horario donde se recogió. Un
 *    curso-horario de Economía tiene alumnos de varias carreras; por eso una
 *    respuesta que no cruza NO tiene carrera y va a su propio bloque.
 * 3. **Cada motivo de no-cruce se arregla en un sitio distinto**, así que el
 *    número solo no sirve para actuar: se nombran.
 * 4. **Con el filtro puesto, la cifra que manda es la del filtro.** Un conteo
 *    total encima de una tabla recortada es la forma más barata de leer mal.
 *
 * La gramática —buscador con contador, plegables `<details>`, cabecera pegajosa
 * y zebra— es la de `AulasSenalesPorAula`, que resuelve la misma clase de
 * lectura unos paneles más allá. El parecido es deliberado: separarlas sería
 * empezar a tener dos tablas distintas para la misma pregunta.
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

export type FilaDeAlumno = {
  codigo: string;
  carrera: string;
  nivel: string;
  sexo: string;
  fecha: string;
  hora: string;
  curso_horario: string;
  respuesta?: string;
  respuesta_etiqueta?: string;
  estado: string;
  motivo?: string;
  motivo_etiqueta?: string;
};

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
  alumnos?: FilaDeAlumno[];
  tope?: number;
  truncado?: boolean;
};

/**
 * El estado de una fila, con su palabra. Tres y no dos: una repetida CRUZÓ
 * —su persona existe— y no cuenta, que es distinto de no haberse podido
 * identificar. Meterlas en la misma bolsa mandaría a revisar el código de quien
 * lo escribió bien.
 */
const ESTADOS: Array<{ clave: string; texto: string; tono: string }> = [
  { clave: "identificado", texto: "Identificado", tono: "ok" },
  { clave: "repetida", texto: "Ya había respondido", tono: "aviso" },
  { clave: "sin_identificar", texto: "Sin identificar", tono: "falla" },
];

/**
 * **Por qué cuenta o no cuenta**, que es otra pregunta que si se pudo atar a
 * alguien. Acreditación las publica en dos columnas por eso mismo, y Gonzalo
 * lo señaló sobre CH 18: «no es identificable porque fue un rechazo, eso la
 * tabla de acreditación ya lo sabe mostrar bien».
 *
 * El vocabulario es el del embudo que el panel de Respuestas ya publica
 * —efectivas, fuera del operativo, no pasan el criterio— más la huérfana, que
 * es efectiva y no tiene curso-horario. «Efectiva» va en voz baja porque es la
 * mayoría de las filas y gritarla taparía a las que piden algo.
 */
const RESPUESTAS: Array<{ clave: string; texto: string; tono: string }> = [
  { clave: "efectiva", texto: "Efectiva", tono: "neutro" },
  { clave: "huerfana", texto: "Sin curso-horario del plan", tono: "aviso" },
  { clave: "rechaza", texto: "Rechazó participar", tono: "falla" },
  { clave: "no_criterio", texto: "No pasa el criterio", tono: "falla" },
  { clave: "fuera_operativo", texto: "Fuera del operativo", tono: "aviso" },
];

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Sin acentos y en minúscula: se teclea «economia» y sale «ECONOMÍA». */
const llave = (v: unknown) =>
  String(v ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");

export function AulasCrucePorCarrera({ bloque }: { bloque: BloqueDeCruce | null | undefined }) {
  const [respuesta, setRespuesta] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [carreraEnFoco, setCarreraEnFoco] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  const alumnos = useMemo(() => bloque?.alumnos ?? [], [bloque]);

  /**
   * **Los términos se exigen TODOS**, como en el buscador vecino: teclear
   * «economia 7» busca de esa carrera Y de ese nivel, no la unión. Con la
   * unión, cualquier término amplio devolvería la tabla entera y el buscador
   * dejaría de servir justo cuando hay muchas filas.
   */
  const visibles = useMemo(() => {
    const terminos = llave(busca).split(/\s+/).filter(Boolean);
    return alumnos.filter((a) => {
      if (respuesta && (a.respuesta ?? "") !== respuesta) return false;
      if (estado && a.estado !== estado) return false;
      if (carreraEnFoco && a.carrera !== carreraEnFoco) return false;
      if (!terminos.length) return true;
      const heno = llave([a.codigo, a.carrera, a.nivel, a.curso_horario, a.motivo_etiqueta].join(" "));
      return terminos.every((t) => heno.includes(t));
    });
  }, [alumnos, respuesta, estado, carreraEnFoco, busca]);

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
  const porRespuesta = (clave: string) => alumnos.filter((a) => (a.respuesta ?? "") === clave).length;
  const filtrado = Boolean(respuesta || estado || carreraEnFoco || busca.trim());

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
            <span>
              {total.sin_cruce === 1
                ? "1 respuesta sin identificar"
                : `${fmt(total.sin_cruce)} respuestas sin identificar`}
            </span>
          ) : null}
        </p>
      ) : null}

      {/* **Plegable y abierto.** Es el resumen que contesta «a quién estamos
          alcanzando», así que abre; y se pliega porque con la tabla de abajo
          el panel mide dos pantallas. */}
      {carreras.length ? (
        <details className="aulas-cxc-grupo" open>
          <summary>
            <strong>{fmt(carreras.length)}</strong>{" "}
            {carreras.length === 1 ? "carrera alcanzada" : "carreras alcanzadas"}
            <em> — cuántos de cada una y cuántos son en el padrón</em>
          </summary>
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
                    {/* La repetición se enseña DONDE ocurrió: en el total sola
                        no se puede ir a buscar. */}
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
        </details>
      ) : (
        <p className="mon-profile-muted">
          Ninguna respuesta ha cruzado todavía: abajo está por qué.
        </p>
      )}

      {/* **Cerrado por defecto**: es el desglose de una cifra que ya está
          arriba, y quien viene a arreglarlo lo abre. */}
      {motivos.length ? (
        <details className="aulas-cxc-grupo aulas-cxc-sincruce">
          <summary>
            <strong>{fmt(total.sin_cruce)}</strong>{" "}
            {total.sin_cruce === 1 ? "no se pudo identificar" : "no se pudieron identificar"}
            <em> — por qué, que es lo que dice dónde se arregla</em>
          </summary>
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
        </details>
      ) : null}

      {alumnos.length ? (
        <div className="aulas-cxc-detalle">
          <div className="aulas-cxc-detalle-head">
            <span className="aulas-cxc-rotulo">Quién respondió, uno por uno</span>
            <span className="aulas-cxc-pie">
              la más reciente primero
              {/* El recorte se dice: en silencio haría creer que el operativo
                  tiene las filas que se ven. */}
              {bloque?.truncado
                ? ` · se enseñan las ${fmt(alumnos.length)} últimas de ${fmt(total.consideradas)}`
                : null}
            </span>
          </div>

          {/* **Los filtros llevan su cuenta dentro.** Un chip que no dice
              cuántas filas deja no se puede elegir sin probarlo, y probarlos
              todos es el trabajo que el chip venía a evitar.

              **Los chips van por el EMBUDO y el cruce baja a un selector.**
              Desde que la tabla incluye las no efectivas, el primer corte es
              «¿ésta cuenta?» y el segundo «¿la pude identificar?»; con el cruce
              en los chips, las descartadas —que no tienen cruce— no se podían
              pedir. */}
          <div className="aulas-cxc-filtros">
            <div className="aulas-cxc-chips" role="group" aria-label="Filtrar por qué cuenta o no cuenta">
              <button
                type="button" className="aulas-cxc-filtro" aria-pressed={!respuesta}
                onClick={() => setRespuesta("")}
              >
                Todas <em>{fmt(alumnos.length)}</em>
              </button>
              {RESPUESTAS.map((e) => {
                const n = porRespuesta(e.clave);
                // **El chip de cero no se pinta.** Cinco estados es demasiado
                // para dejarlos todos en gris; los del embudo que este estudio
                // no produce —una huérfana, por ejemplo— no dicen nada
                // ocupando sitio. Es lo contrario que con el cruce, que tiene
                // tres y siempre significan algo.
                if (!n) return null;
                return (
                  <button
                    key={e.clave}
                    type="button"
                    className="aulas-cxc-filtro"
                    data-tono={e.tono}
                    aria-pressed={respuesta === e.clave}
                    onClick={() => setRespuesta(respuesta === e.clave ? "" : e.clave)}
                  >
                    {e.texto} <em>{fmt(n)}</em>
                  </button>
                );
              })}
            </div>

            {/* El selector de carrera sólo aparece con más de una: con una sola
                es un control que no puede cambiar nada. */}
            {carreras.length > 1 ? (
              <label className="aulas-cxc-select">
                <span>Carrera</span>
                <select
                  value={carreraEnFoco}
                  onChange={(e) => setCarreraEnFoco(e.currentTarget.value)}
                >
                  <option value="">Todas</option>
                  {carreras.map((c) => (
                    <option key={c.carrera} value={c.carrera}>{c.carrera}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="aulas-cxc-select">
              <span>Cruce</span>
              <select value={estado} onChange={(e) => setEstado(e.currentTarget.value)}>
                <option value="">Todos</option>
                {ESTADOS.map((e) => (
                  <option key={e.clave} value={e.clave}>{e.texto}</option>
                ))}
              </select>
            </label>

            <div className="aulas-cxc-buscador">
              <Search size={13} aria-hidden="true" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.currentTarget.value)}
                placeholder="Código, carrera, nivel o curso-horario"
                aria-label="Buscar un alumno por código, carrera, nivel o curso-horario"
              />
              {busca ? (
                <button type="button" onClick={() => setBusca("")} aria-label="Limpiar la búsqueda">
                  <XCircle size={13} />
                </button>
              ) : null}
            </div>
          </div>

          {/* **Con filtro puesto manda la cifra del filtro.** Un total encima de
              una tabla recortada es la forma más barata de leer mal. */}
          <p className="aulas-cxc-pie aulas-cxc-cuenta">
            {filtrado
              ? `${fmt(visibles.length)} de ${fmt(alumnos.length)} filas`
              : `${fmt(alumnos.length)} ${alumnos.length === 1 ? "fila" : "filas"}`}
          </p>

          {visibles.length ? (
            <div className="aulas-cxc-scroll">
              <table className="aulas-cxc-tabla">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Carrera y nivel</th>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Curso-horario</th>
                    <th scope="col">Respuesta</th>
                    <th scope="col">Cruce</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((a, i) => {
                    const e = ESTADOS.find((x) => x.clave === a.estado);
                    return (
                      <tr key={`${a.codigo}-${a.fecha}-${a.hora}-${i}`}>
                        <td className="aulas-cxc-codigo">{a.codigo || "—"}</td>
                        <td>
                          {a.carrera ? (
                            <span className={claseDeFacultad(a.carrera)}>{a.carrera}</span>
                          ) : null}
                          {a.nivel ? <em className="aulas-cxc-nivel">nivel {a.nivel}</em> : null}
                          {!a.carrera && !a.nivel ? <span className="aulas-cxc-debil">—</span> : null}
                        </td>
                        {/* Sin marca de tiempo, un guion: la fila sigue diciendo
                            quién y de qué carrera, y lo que falta es la hora. */}
                        <td className="aulas-cxc-cuando">
                          {a.fecha ? `${a.fecha} · ${a.hora || "--:--"}` : "—"}
                        </td>
                        <td className="aulas-cxc-ch">{a.curso_horario || "—"}</td>
                        <td>
                          {(() => {
                            const r = RESPUESTAS.find((x) => x.clave === a.respuesta);
                            // La etiqueta del motor manda si viene: así un
                            // estado nuevo no sale como su clave cruda.
                            const texto = a.respuesta_etiqueta || r?.texto || "";
                            if (!texto) return <span className="aulas-cxc-debil">—</span>;
                            return (
                              <span className="aulas-cxc-pill" data-tono={r?.tono ?? "neutro"}>
                                {texto}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          {a.estado ? (
                            <span className="aulas-cxc-pill" data-tono={e?.tono ?? "neutro"}>
                              {e?.texto ?? a.estado}
                            </span>
                          ) : (
                            // De una que no cuenta no se afirma el cruce: nunca
                            // iba a contar y «sin identificar» se leería como un
                            // problema que arreglar.
                            <span className="aulas-cxc-debil">—</span>
                          )}
                          {/* El motivo va pegado a SU fila: arriba se sabe
                              cuántas, aquí cuál.

                              **Salvo cuando la columna de al lado ya lo dijo.**
                              Con el rechazo, «Rechazó participar · Sin
                              identificar · Rechazó participar» en el mismo
                              renglón hace leer dos veces para entender que es
                              una sola cosa. */}
                          {a.motivo_etiqueta && a.motivo !== "rechazo_participar" ? (
                            <em className="aulas-cxc-motivo-fila"> · {a.motivo_etiqueta}</em>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mon-profile-muted">
              Ninguna fila coincide con el filtro. Se busca por código, carrera,
              nivel y curso-horario, y todos los términos tienen que aparecer.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
