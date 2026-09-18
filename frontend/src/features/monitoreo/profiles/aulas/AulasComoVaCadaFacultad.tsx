import { useState, type ReactNode } from "react";

import { AulasMapaDeLaDeuda } from "./AulasMapaDeLaDeuda";
import { deudaPorFacultad, palabraDelVeredicto, repartoDeDeudas, type DeudaDeFacultad } from "./deudaPorFacultad";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { cierreDeLaFacultad, type CierreDeLaFacultad } from "./facultadesEnRiesgo";
import { filaDeLaFacultad } from "./resumenDeEfectividad";
import { palabraDelRumbo, rumboDeLaFacultad, type RumboDeFacultad } from "./rumboDeLaFacultad";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import "./aulasComoVaCadaFacultad.css";

/**
 * Cómo le va a cada facultad, y en qué sexo le va mal.
 *
 * Gonzalo, 2026-09-10: «¿qué tan bajo en comparación con qué, cómo va la
 * facultad? ¿Cuáles son las facultades a las que mejor les está yendo, a las
 * que peor? Puedo seleccionar una facultad a la que peor le está yendo y ver
 * por qué le está yendo tan mal […] ojo, no siempre es que le esté yendo mal a
 * nivel general, sino le puede estar yendo mal en un sexo en particular».
 *
 * Dos lecturas del mismo dato y las dos hacen falta: **el mapa** dice en qué
 * esquina está cada una —y cuáles deben de un solo sexo, que es lo que la cifra
 * global esconde—; **la lista** las ordena por lo que deben, que es la pregunta
 * con la que se entra. Pulsar un punto abre su fila: el mapa es el índice.
 */
export function AulasComoVaCadaFacultad({ bloque, porSexo, facultadEnFoco, onRefuerzo, partes = [], plan = [] }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  porSexo: ReadonlyArray<Record<string, unknown>> | null | undefined;
  /** La facultad de la cabecera abre su fila al entrar. */
  facultadEnFoco?: string;
  /**
   * **La puerta del refuerzo (C).** Gonzalo, 2026-09-10: «¿dónde asignamos los
   * refuerzos? […] el contexto de rendimiento no sólo nos muestra las aulas
   * bajas, sino nos permite también tener un espacio para poder precisamente
   * aplicar refuerzo».
   *
   * Aquí es donde tiene que estar, y no en la tabla de brechas, porque C no
   * arranca de un aula: arranca de una facultad que no va a cerrar su cuota. La
   * tabla de abajo abre el complemento (B) desde una fila; esta lista abre el
   * refuerzo desde una facultad. Son las dos puertas del mismo libro.
   */
  onRefuerzo?: (facultad: string) => void;
  /**
   * Los partes y el plan, para la serie por jornada de cada facultad.
   *
   * Es la nota «Una foto no dice el rumbo» del ensayo: la deuda de hoy no
   * separa a la que debe siete y venía debiendo veinte de la que debe siete y
   * venía en cero. La primera se está arreglando sola y pedirle un refuerzo
   * sería gastarlo de más.
   */
  partes?: ReadonlyArray<MonitoreoRow>;
  plan?: ReadonlyArray<MonitoreoRow>;
}): ReactNode {
  // El hook va antes de cualquier salida temprana: uno bajo la guarda se llama
  // en unos renders y no en otros, y eso es el React #300 que ya tumbó esto.
  const [abierta, setAbierta] = useState<string>("");
  const filas = deudaPorFacultad(bloque, porSexo);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El estudio todavía no publica la efectividad por facultad: sin ella no hay
        deuda que repartir.
      </p>
    );
  }

  const r = repartoDeDeudas(filas);
  const activa = abierta || facultadEnFoco || "";

  return (
    <div className="aulas-cvf" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cvf-lectura">
        {r.deben ? (
          <><strong>{fmt(r.deben)}</strong> {r.deben === 1 ? "facultad debe" : "facultades deben"} respuestas</>
        ) : (
          <>Ninguna facultad debe respuestas</>
        )}
        {/* El caso que la cifra global esconde, contado aparte. */}
        {r.deUnSoloSexo ? (
          <> · <strong>{fmt(r.deUnSoloSexo)}</strong> {r.deUnSoloSexo === 1 ? "sólo en un sexo" : "sólo en un sexo"}</>
        ) : null}
        {r.porEncima ? <> · <strong>{fmt(r.porEncima)}</strong> por encima de lo previsto</> : null}
        {r.sinCampo ? <> · <strong>{fmt(r.sinCampo)}</strong> sin campo todavía</> : null}
        {/* **«No se compensa entre facultades» sólo dice algo si hay más de
            una.** Con un estudio de una sola —CCSS— la frase enuncia una regla
            que no puede aplicarse, y ocupa el sitio de lo que sí hay que saber:
            que la cuota de ese estudio no se mide aquí. La regla es real (ADR
            0079) y se queda donde vale. */}
        {filas.length > 1
          ? ". La deuda no se compensa entre facultades: cada una cierra la suya."
          : ". El estudio tiene una sola facultad, así que no hay deuda que repartir entre ellas."}
      </p>

      <AulasMapaDeLaDeuda
        filas={filas}
        enFoco={activa}
        onFacultad={(f) => setAbierta((antes) => (antes === f ? "" : f))}
      />

      <ul className="aulas-cvf-lista">
        {filas.map((f) => (
          <FilaDeFacultad
            key={f.clave || f.facultad}
            f={f}
            abierta={activa === f.facultad}
            onAbrir={() => setAbierta((antes) => (antes === f.facultad ? "" : f.facultad))}
            onRefuerzo={onRefuerzo}
            rumbo={rumboDeLaFacultad(partes, plan, f.facultad, f.prevista)}
            // Cómo va a cerrar, del motor y no de una cuenta propia: es la
            // lectura que faltaba junto a la de rendimiento.
            cierre={cierreDeLaFacultad(filaDeLaFacultad(bloque, f.facultad))}
          />
        ))}
      </ul>
    </div>
  );
}

/** El mayor desvío del corte fija la escala común a todas las barras. */
const TOPE_BARRA = 48;

function BarraDeSexo({ letra, valor }: { letra: string; valor: number }): ReactNode {
  const ancho = Math.min(100, (Math.abs(valor) / TOPE_BARRA) * 100) / 2;
  const clase = valor < 0 ? "es-debe" : valor > 0 ? "es-sobra" : "es-cero";
  return (
    <span className="aulas-cvf-barra">
      <span className="aulas-cvf-letra">{letra}</span>
      {/* El carril tiene el cero en el centro: a la izquierda lo que se debe, a
          la derecha lo que sobra. Cruzarlo es lo que separa deber de sobrar, y
          una barra que crece siempre hacia el mismo lado no lo dice. */}
      <span className="aulas-cvf-carril">
        {valor === 0 ? null : <i className={clase} style={{ width: `${ancho}%` }} />}
      </span>
      <b className={clase}>{valor > 0 ? `+${fmt(valor)}` : valor < 0 ? `−${fmt(Math.abs(valor))}` : "0"}</b>
    </span>
  );
}

function FilaDeFacultad({ f, abierta, onAbrir, onRefuerzo, rumbo, cierre }: {
  f: DeudaDeFacultad; abierta: boolean; onAbrir: () => void;
  onRefuerzo?: (facultad: string) => void;
  /** Su serie por jornada, ya calculada arriba. */
  rumbo?: RumboDeFacultad;
  /** Cómo va a cerrar su cuota, leído del motor. */
  cierre?: CierreDeLaFacultad | null;
}): ReactNode {
  const sinCampo = f.veredicto === "sin_campo";
  const pct = (v: number | null) => (v == null ? "—" : pctPerfil(v * 100));
  return (
    <li className={abierta ? "es-abierta" : ""}>
      <button type="button" className="aulas-cvf-fila" aria-expanded={abierta} onClick={onAbrir}>
        <span className="aulas-cvf-nombre">
          <b>{f.facultad}</b>
          <span>{sinCampo ? "sin cursos-horario aplicados" : `${fmt(f.aulas)} aplicados`}</span>
        </span>
        <span className={`aulas-cvf-deuda ${f.deuda < 0 ? "es-debe" : f.deuda > 0 ? "es-sobra" : "es-cero"}`}>
          {sinCampo ? "—" : f.deuda > 0 ? `+${fmt(f.deuda)}` : f.deuda < 0 ? `−${fmt(Math.abs(f.deuda))}` : "0"}
          <small>hasta ahora</small>
        </span>
        <span className="aulas-cvf-sexos">
          <BarraDeSexo letra="M" valor={f.mujeres} />
          <BarraDeSexo letra="H" valor={f.hombres} />
        </span>
        <span className="aulas-cvf-tasa">
          <b className={sinCampo ? "" : (f.observada ?? 0) >= (f.prevista ?? 0) ? "es-ok" : "es-bajo"}>
            {sinCampo ? "—" : pct(f.observada)}
          </b>
          <span>de {pct(f.prevista)} previsto</span>
        </span>
        <span className={`aulas-cvf-veredicto es-${f.veredicto}`}>{palabraDelVeredicto(f.veredicto)}</span>
      </button>
      {abierta ? (
        <div className="aulas-cvf-porque">
          {/* **Tres columnas y no una.** Gonzalo, 2026-09-11, con el detalle
              delante: «aquí la idea está súper bien pero aún puedes asegurar que
              se vea mejor, que ocupe todo el ancho, te sea más robusto e
              informativo».

              Tenía razón: la sparkline ocupaba un tercio y el resto era hueco.
              Ahora el ancho se reparte entre las tres preguntas que se hacen
              aquí y que hasta ahora contestaba sólo la primera: **qué pasó** (el
              rumbo), **dónde duele** (el desglose por sexo contra su vara) y
              **qué se hace** (el consejo y la puerta al refuerzo). */}
          <div className="aulas-cvf-columna">
            <h5>Situación</h5>
            <p>{f.frase}</p>
            {rumbo?.verbo ? <Rumbo r={rumbo} /> : (
              <p className="aulas-cvf-sinrumbo">
                {f.aulas
                  ? "Con una sola jornada aplicada no hay tendencia que evaluar."
                  : "Sin jornadas aplicadas."}
              </p>
            )}
          </div>

          <div className="aulas-cvf-columna">
            <h5>Rendimiento hasta ahora</h5>
            <table className="aulas-cvf-desglose">
              <tbody>
                <tr className={f.mujeres < 0 ? "es-debe" : ""}>
                  <th scope="row">Mujeres</th>
                  <td>{f.mujeres > 0 ? `+${fmt(f.mujeres)}` : f.mujeres < 0 ? `−${fmt(Math.abs(f.mujeres))}` : "0"}</td>
                  <td><em>{f.mujeres < 0 ? "bajo lo previsto" : f.mujeres > 0 ? "sobre lo previsto" : "en lo previsto"}</em></td>
                </tr>
                <tr className={f.hombres < 0 ? "es-debe" : ""}>
                  <th scope="row">Hombres</th>
                  <td>{f.hombres > 0 ? `+${fmt(f.hombres)}` : f.hombres < 0 ? `−${fmt(Math.abs(f.hombres))}` : "0"}</td>
                  <td><em>{f.hombres < 0 ? "bajo lo previsto" : f.hombres > 0 ? "sobre lo previsto" : "en lo previsto"}</em></td>
                </tr>
                <tr className="es-tasa">
                  <th scope="row">Rinde</th>
                  <td>{f.observada == null ? "—" : pctPerfil(f.observada * 100)}</td>
                  <td><em>de {f.prevista == null ? "—" : pctPerfil(f.prevista * 100)} previsto</em></td>
                </tr>
                <tr className="es-tasa">
                  <th scope="row">Aplicados</th>
                  <td>{fmt(f.aulas)}</td>
                  <td><em>cursos-horario con parte</em></td>
                </tr>
              </tbody>
            </table>
            {/* **Qué mide esta columna y qué NO.** Gonzalo, 2026-09-11: «dice
                déficit de 65 pero en la otra ventana el déficit es de 6, no
                entiendo». Las dos cifras son ciertas y miden cosas distintas:
                aquí, cómo rindió lo que YA se aplicó; en el popover de refuerzo,
                cuánto falta para cerrar la cuota contando lo que aún no se ha
                visitado. Sin decirlo, la segunda parece desmentir a la primera. */}
            {/* **Las dos lecturas, juntas.** Gonzalo, 2026-09-11: «por un lado
                a Derecho no le va mal y por otro a Derecho le falta muchísimo […]
                ninguno se complementa ni me dice si aquello es necesario».
                Remitir a «otra cifra» sin darla obligaba a cruzar dos pantallas
                para entender que una facultad puede rendir bien y estar corta de
                campo — que es el caso más común y el que decide a quién llamar. */}
            {(() => {
              const c = cierre;
              if (!c || !c.meta) {
                return (
                  <p className="aulas-cvf-aclara">
                    Sobre los <strong>{fmt(f.aulas)}</strong> ya aplicados: mide si lo
                    aplicado rindió, no si se va a llegar a la cuota.
                  </p>
                );
              }
              return (
                <p className="aulas-cvf-aclara">
                  Sobre los <strong>{fmt(f.aulas)}</strong> ya aplicados: mide si lo
                  aplicado rindió, no si se va a llegar.{" "}
                  {c.falta === 0
                    ? <>Su cuota de <strong>{fmt(c.meta)}</strong> ya está cubierta.</>
                    : <>Para cerrar su cuota de <strong>{fmt(c.meta)}</strong> le faltan{" "}
                        <strong>{fmt(c.falta)}</strong> respuestas
                        {c.cursosEnCamino
                          ? <>, y sus <strong>{fmt(c.cursosEnCamino)}</strong> cursos-horario
                              agendados esperan traer <strong>{fmt(c.enCamino)}</strong></>
                          : <>, y no tiene ningún curso-horario agendado</>}
                        {c.quedaria > 0
                          ? <>: <strong>quedarían {fmt(c.quedaria)}</strong>.</>
                          : <>: con eso cierra.</>}</>}
                  {c.loQueToca === "agendar" ? (
                    <> Rinde lo previsto y va corta de campo:{" "}
                      {c.cursosSinAgendar
                        ? <>le quedan <strong>{fmt(c.cursosSinAgendar)}</strong> cursos-horario
                            del plan por agendar, y ahí está el hueco</>
                        : <>el hueco es de agenda, no de aforo</>}.</>
                  ) : c.loQueToca === "reforzar" ? (
                    <> Ni agendando el resto de su plan llegaría: aquí sí hace falta
                      refuerzo.</>
                  ) : null}
                </p>
              );
            })()}
          </div>

          <div className="aulas-cvf-columna">
            <h5>Qué corresponde</h5>
            {f.veredicto === "debe_mujeres" || f.veredicto === "debe_hombres" ? (
              <p className="aulas-cvf-consejo">
                Un relevo aquí sólo es útil si aporta {f.veredicto === "debe_mujeres" ? "mujeres" : "hombres"}:
                uno del otro sexo consume una reserva sin reducir el déficit.
              </p>
            ) : null}
            {f.veredicto === "debe_en_los_dos" ? (
              <p className="aulas-cvf-consejo">
                Registra déficit en ambos sexos: cualquier relevo de su facultad
                contribuye, y el más eficaz es el que más se acerque a las dos cifras.
              </p>
            ) : null}
            {f.deuda >= 0 ? (
              <p className="aulas-cvf-consejo es-calma">
                No registra déficit: sus reservas quedan disponibles para la
                facultad que las necesite.
              </p>
            ) : null}
            {onRefuerzo && f.deuda < 0 ? (
              <button
                type="button"
                className="aulas-cvf-refuerzo"
                onClick={(e) => { e.stopPropagation(); onRefuerzo(f.facultad); }}
              >
                Buscar refuerzo para {facultadCorta(f.facultad)}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * La serie por jornada de una facultad: su deuda al cierre de cada día.
 *
 * Dibujada a mano y no con una librería: son tres o cuatro puntos y lo que se
 * compara es la FORMA —si baja, se está arreglando—, no el valor exacto de
 * cada uno. La línea del cero está porque cruzarla es lo que separa deber de ir
 * sobrado, igual que en el mapa.
 */
function Rumbo({ r }: { r: RumboDeFacultad }): ReactNode {
  const AN = 190, AL = 42, M = 4;
  const valores = r.jornadas.map((j) => j.deuda);
  const tope = Math.max(1, ...valores.map((v) => Math.abs(v)));
  const x = (i: number) => M + (AN - 2 * M) * (r.jornadas.length < 2 ? 0.5 : i / (r.jornadas.length - 1));
  const y = (v: number) => M + (AL - 2 * M) * (1 - (v + tope) / (2 * tope));
  const linea = r.jornadas.map((j, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(j.deuda).toFixed(1)}`).join(" ");

  return (
    <p className={`aulas-cvf-rumbo es-${r.verbo}`}>
      <svg viewBox={`0 0 ${AN} ${AL}`} role="img"
        aria-label={`Deuda por jornada: ${r.jornadas.map((j) => `${j.fecha}: ${j.deuda}`).join(", ")}`}>
        <line className="aulas-cvf-rumbo-cero" x1={M} y1={y(0).toFixed(1)} x2={AN - M} y2={y(0).toFixed(1)} />
        <path className="aulas-cvf-rumbo-linea" d={linea} fill="none" />
        {r.jornadas.map((j, i) => (
          <circle key={j.fecha} cx={x(i).toFixed(1)} cy={y(j.deuda).toFixed(1)}
            r={i === r.jornadas.length - 1 ? 3.2 : 2}
            className={i === r.jornadas.length - 1 ? "aulas-cvf-rumbo-hoy" : "aulas-cvf-rumbo-punto"} />
        ))}
      </svg>
      <span>{palabraDelRumbo(r)}</span>
    </p>
  );
}
