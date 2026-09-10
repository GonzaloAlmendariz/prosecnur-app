import type { ReactNode } from "react";

import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { fmt, pctPerfil, unDecimalPerfil } from "./kpisDeAulas";
import {
  lecturaDeEfectividad, proyeccionDeLaFacultad, repartoDeSenales, riesgoDeCierre,
} from "./resumenDeEfectividad";
import "./aulasRendimientoYEfectividad.css";

/**
 * El resumen de Rendimiento y Efectividad, que Resumen no tenía.
 *
 * Gonzalo, dos veces: «no estás resumiendo la información ni de rendimiento ni
 * de efectividad… si Resumen tiene que ser un resumen». Las dos pestañas
 * contestan la misma pregunta en dos granos —cuánto deja cada curso-horario— y
 * hasta ahora había que abrirlas para saber si el operativo va a alcanzar con
 * los cursos-horario que tiene.
 *
 * **Resumir no es escribirlo en prosa.** La primera versión fue una frase
 * corrida, un carril de catorce píxeles y dos líneas de pie en gris: «le falta
 * muchísimo formato», y era cierto — el panel de al lado, «Estado de
 * aplicación», pone la cifra grande delante, reparte una barra por grupo y da a
 * cada tramo su color y su nota. Éste dice lo mismo con la misma gramática:
 * las dos tasas como cifras enfrentadas, el contraste como chip, el reparto de
 * facultades como barra con su leyenda, y la base y el cierre abajo.
 *
 * Todas las cifras salen de `efectividad_seguimiento` (ADR 0082), calculado por
 * el motor: aquí no se divide nada.
 */

/** El tono del contraste. Ir por encima de la vara NO es una alerta. */
const TONO_DEL_CONTRASTE: Record<string, string> = {
  sobre: COLOR_RESULTADO.efectiva,
  conforme: COLOR_RESULTADO.parcial,
  bajo: COLOR_RESULTADO.rechazo,
};

const TONO_DE_SENAL = {
  conforme: COLOR_RESULTADO.parcial,
  sobre: COLOR_RESULTADO.efectiva,
  bajo: COLOR_RESULTADO.rechazo,
  // Sin vara todavía no es un estado del rendimiento: es ausencia de medida, y
  // gastarle color sería contarla entre las que ya dicen algo.
  sinVara: "var(--pulso-border)",
} as const;

export function AulasRendimientoYEfectividad({ bloque, fila, facultad = "" }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  /** La facultad en foco, si la hay. Sin ella se lee el conjunto. */
  fila?: MonitoreoAulasEfectividadFacultad | null;
  facultad?: string;
}): ReactNode {
  const lectura = lecturaDeEfectividad(bloque, fila ?? null);
  if (!lectura) {
    return (
      // La anatomía del vacío del perfil: el wrap exento declara su capacidad.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          Este estudio no trae el seguimiento de la tasa prevista, así que no se
          puede contrastar lo que supuso el diseño con lo que está dando el campo.
        </p>
      </div>
    );
  }

  /**
   * **Con una facultad puesta se enseña lo suyo Y lo del conjunto.**
   *
   * Gonzalo, 2026-09-10: «debe ser capaz de mostrar lo general pero también lo
   * específico por facultad cuando el selector esté sobre una facultad en
   * específico». La primera versión sustituía una lectura por otra, y entonces
   * el 57,3 % de Derecho quedaba sin referencia: no se podía saber si esa
   * facultad va como el operativo o se despega de él.
   *
   * El conjunto no se recalcula: es la misma lectura de siempre, leída del
   * total del bloque.
   */
  const delEstudio = facultad ? lecturaDeEfectividad(bloque, null) : null;
  // El riesgo del operativo se enseña SIEMPRE: es la conclusión general y no
  // deja de ser cierta porque se esté mirando una facultad.
  const riesgo = riesgoDeCierre(bloque);
  const proyeccion = facultad ? proyeccionDeLaFacultad(fila) : null;
  // Con una facultad puesta, la columna de la derecha es SU proyección; sin
  // ella, el reparto de las quince.
  const reparto = facultad ? null : repartoDeSenales(bloque);
  const unDecimal = (v: number) => unDecimalPerfil(Math.round(v * 1000) / 10);
  const intervalo = lectura.bandaBajo != null && lectura.bandaAlto != null
    ? `${unDecimal(lectura.bandaBajo)} – ${unDecimal(lectura.bandaAlto)} %`
    : "";
  /**
   * **El mismo redondeo que usa el helper para restar.**
   *
   * Con `toFixed(1)`, 0,5135 sale «51.3» —el binario cae por debajo del medio
   * punto— mientras `puntosEntre()` redondea a 51,4 y publica «+6,7 pts». En
   * pantalla se leía «51.3 % → 58.1 % · +6.7 pts», y 58,1 − 51,3 son 6,8: el
   * panel se contradecía a sí mismo en la misma línea. Redondear en un solo
   * sitio es la regla de la casa y aquí había dos.
   */
  const pct = (v: number | null) =>
    v == null ? "—" : pctPerfil(Math.round(v * 1000) / 10);

  /**
   * **Cómo se calculó el intervalo, al alcance del cursor.**
   *
   * No es decoración metodológica: es lo que impide leer un IC ancho como un
   * problema de la facultad en vez de como lo que es —pocos cursos-horario
   * aplicados todavía—.
   */
  const comoSeCalcula = "Intervalo de confianza al 95 % de la tasa observada (τ = efectivas ÷ elegibles), "
    + "estimador de razón con los cursos-horario como conglomerados: los elegibles de uno comparten "
    + "profesor, hora y sala, así que no son ensayos independientes. Con menos de dos cursos-horario "
    + "aplicados no hay dispersión que medir y el intervalo no se publica.";

  const tramosDelReparto = reparto ? ([
    { clave: "conforme", n: reparto.conforme, etiqueta: "como lo previsto", nota: "su intervalo contiene la tasa del diseño", color: TONO_DE_SENAL.conforme },
    { clave: "sobre", n: reparto.sobre, etiqueta: "por encima de su vara", nota: "rinden más de lo que se supuso al dimensionar", color: TONO_DE_SENAL.sobre },
    { clave: "bajo", n: reparto.bajo, etiqueta: "por debajo de su vara", nota: "con evidencia que lo sostiene, no por el punto", color: TONO_DE_SENAL.bajo },
    { clave: "sin", n: reparto.sinVara, etiqueta: "sin vara todavía", nota: "sin campo o sin tasa prevista: no se sabe", color: TONO_DE_SENAL.sinVara },
  ].filter((t) => t.n > 0)) : [];

  return (
    <div className="aulas-rye" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <div className="aulas-rye-cuerpo">
        <div className="aulas-rye-contraste">
          {/* **Un porcentaje sin su denominador no se entiende.** Gonzalo,
              mirando el panel: «francamente no se entiende qué es cada cosa,
              está muy poco claro». Y era verdad: «56,8 % → 57,3 %» no dice
              porcentaje DE QUÉ, y sin eso las dos cifras son dos números. El
              rótulo del bloque lo nombra en los términos del operativo, que es
              como se habla del dato en la reunión de la mañana. */}
          <p className="aulas-rye-titulo">
            Respuestas por cada 100 estudiantes elegibles
            {facultad ? <em>en {facultad}</em> : <em>en el operativo</em>}
          </p>
          {/* **Las dos tasas como cifras, no dentro de una frase.** Es la
              gramática del panel de al lado: el número grande delante y su
              rótulo debajo. Una frase corrida obliga a leerla entera para sacar
              dos cifras que se comparan de un vistazo. */}
          <p className="aulas-rye-par">
            <span className="aulas-rye-tasa is-previsto">
              <strong>{pct(lectura.previsto)}</strong>
              <em>contaba el diseño</em>
            </span>
            <span className="aulas-rye-flecha" aria-hidden="true">→</span>
            <span className="aulas-rye-tasa is-observado">
              <strong>{pct(lectura.observado)}</strong>
              <em>está llegando</em>
            </span>
            {lectura.puntos != null && lectura.tono ? (
              <span
                className="aulas-rye-delta"
                style={{ "--aulas-rye-tono": TONO_DEL_CONTRASTE[lectura.tono] ?? "var(--pulso-border)" } as Record<string, string>}
              >
                {lectura.tono === "conforme"
                  ? "dentro del intervalo"
                  : `${lectura.puntos > 0 ? "+" : "−"}${unDecimalPerfil(Math.abs(lectura.puntos))} pts`}
              </span>
            ) : null}
          </p>

          {/* La regla, con la tasa del diseño y la del campo sobre la misma
              escala. Va de 0 a 100 % porque eso es lo que puede valer una tasa;
              comprimirla al tramo con datos exageraría la distancia que este
              panel viene a medir. */}
          {lectura.previsto != null && lectura.observado != null ? (
            <div className="aulas-rye-regla">
              <div className="aulas-rye-carril" role="img" aria-label={lectura.frase}>
                <span className="aulas-rye-tick" style={{ left: "25%" }} />
                <span className="aulas-rye-tick" style={{ left: "50%" }} />
                <span className="aulas-rye-tick" style={{ left: "75%" }} />
                {lectura.bandaBajo != null && lectura.bandaAlto != null ? (
                  <span
                    className="aulas-rye-banda"
                    title={`IC 95 %: ${intervalo}. ${comoSeCalcula}`}
                    style={{
                      left: `${Math.min(100, Math.max(0, lectura.bandaBajo * 100))}%`,
                      width: `${Math.min(100, Math.max(0, (lectura.bandaAlto - lectura.bandaBajo) * 100))}%`,
                    }}
                  />
                ) : null}
                <span
                  className="aulas-rye-marca is-previsto"
                  title={`El diseño supuso ${pct(lectura.previsto)}`}
                  style={{ left: `${Math.min(100, Math.max(0, lectura.previsto * 100))}%` }}
                />
                {/* La tasa del OPERATIVO como tercera marca, sólo con una
                    facultad puesta: es lo que permite decir si ésta va con el
                    conjunto o se despega. Sin foco sobraría — sería la misma
                    marca dos veces. */}
                {delEstudio?.observado != null ? (
                  <span
                    className="aulas-rye-marca is-estudio"
                    title={`El operativo entero está dando ${pct(delEstudio.observado)}`}
                    style={{ left: `${Math.min(100, Math.max(0, delEstudio.observado * 100))}%` }}
                  />
                ) : null}
                <span
                  className="aulas-rye-marca is-observado"
                  title={`El campo está dando ${pct(lectura.observado)}`}
                  style={{ left: `${Math.min(100, Math.max(0, lectura.observado * 100))}%` }}
                />
              </div>
              <p className="aulas-rye-escala">
                <span>0</span>
                <span>100 respuestas por cada 100 elegibles</span>
              </p>
              {/* **Cada marca, con su nombre y su cifra.** Sin esto el carril
                  eran tres rayas y una mancha rosa: quien lo mira no puede saber
                  cuál es el diseño, cuál esta facultad y cuál el operativo, y la
                  banda no se sabe qué mide. La leyenda es lo que convierte el
                  dibujo en una lectura. */}
              <ul className="aulas-rye-claves">
                <li>
                  <i className="es-previsto" />
                  <span>{pct(lectura.previsto)} <em>contaba el diseño</em></span>
                </li>
                <li>
                  <i className="es-observado" />
                  <span>{pct(lectura.observado)} <em>está llegando {facultad ? "en esta facultad" : "en el operativo"}</em></span>
                </li>
                {delEstudio?.observado != null ? (
                  <li>
                    <i className="es-estudio" />
                    <span>{pct(delEstudio.observado)} <em>el operativo entero</em></span>
                  </li>
                ) : null}
                {intervalo ? (
                  <li className="es-ancha" title={comoSeCalcula}>
                    <i className="es-banda" />
                    <span>
                      {intervalo} <em>
                        margen de la medición
                        {lectura.margen != null ? ` (±${unDecimalPerfil(lectura.margen)} pts, IC 95 %)` : " (IC 95 %)"}
                        {lectura.aulas < 8 ? `: es ancho porque sólo hay ${fmt(lectura.aulas)} cursos-horario aplicados` : ""}
                      </em>
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        {proyeccion ? (
          /* **Lo específico de la facultad**: a dónde llega con lo que tiene.
             Es la mitad accionable de «predecir para cada facultad cómo nos
             irá», y va donde sin foco está el reparto de las quince — la
             columna contesta siempre «¿y las partes?», sólo cambia cuál. */
          <div className="aulas-rye-reparto">
            <p className="aulas-rye-titulo">
              Si el rendimiento se mantiene<em>a dónde llega esta facultad</em>
            </p>
            <p className="aulas-rye-cabeza">
              <strong>{fmt(proyeccion.central)}</strong> respuestas
              <em>frente a las {fmt(proyeccion.cuota)} que le pide el diseño</em>
            </p>
            {/* La barra mide contra el TECHO de las dos cifras, no contra la
                cuota: una facultad que proyecta 499 sobre 363 rebasaría el
                carril y su barra se leería igual que otra que apenas cierra. */}
            {(() => {
              const techo = Math.max(proyeccion.cuota, proyeccion.alto ?? proyeccion.central, proyeccion.central) || 1;
              const en = (v: number | null) => (v == null ? null : `${Math.min(100, Math.max(0, (100 * v) / techo))}%`);
              return (
                <span className="aulas-rye-proy" role="img" aria-label={proyeccion.frase}>
                  {/* El intervalo de la proyección, para que el central no se
                      lea como una promesa. */}
                  {proyeccion.bajo != null && proyeccion.alto != null ? (
                    <i
                      className="es-rango"
                      title={`Entre ${fmt(proyeccion.bajo)} y ${fmt(proyeccion.alto)}`}
                      style={{ left: en(proyeccion.bajo) ?? "0%", width: `${Math.min(100, (100 * (proyeccion.alto - proyeccion.bajo)) / techo)}%` }}
                    />
                  ) : null}
                  <i className="es-central" style={{ left: en(proyeccion.central) ?? "0%" }} />
                  <i className="es-cuota" style={{ left: en(proyeccion.cuota) ?? "0%" }} />
                </span>
              );
            })()}
            <ul className="aulas-rye-leyenda">
              <li>
                <i className="es-marca-central" />
                <span><strong>{fmt(proyeccion.central)}</strong> respuestas al terminar</span>
                <em>
                  {proyeccion.bajo != null && proyeccion.alto != null
                    ? `entre ${fmt(proyeccion.bajo)} y ${fmt(proyeccion.alto)} según se mantenga el rendimiento`
                    : "al rendimiento observado hasta ahora"}
                </em>
              </li>
              <li>
                <i className="es-marca-cuota" />
                <span><strong>{fmt(proyeccion.cuota)}</strong> le pide el diseño</span>
                <em>su cuota: si queda a la izquierda de la marca negra, la alcanza</em>
              </li>
            </ul>
          </div>
        ) : null}
        {tramosDelReparto.length ? (
          /* **El reparto por facultad, con la misma gramática que el panel de
             al lado**: una barra que reparte el grupo al 100 % y su leyenda con
             cifra, etiqueta y nota. El carril contesta si el operativo rinde lo
             que se supuso; esto, si eso es parejo — una media de 58 % puede ser
             quince facultades en 58 o siete en 40 y ocho en 75. */
          <div className="aulas-rye-reparto">
            <p className="aulas-rye-titulo">
              Cómo va cada facultad<em>contra la tasa que el diseño le supuso a ella</em>
            </p>
            <p className="aulas-rye-cabeza">
              <strong>{fmt(reparto?.total ?? 0)}</strong> facultades
              <em>ninguna se compara con la media: cada una con su vara</em>
            </p>
            <span
              className="aulas-rye-barra"
              role="img"
              aria-label={reparto?.frase ?? ""}
            >
              {tramosDelReparto.map((t) => (
                <i
                  key={t.clave}
                  style={{ width: `${(100 * t.n) / (reparto?.total || 1)}%`, background: t.color }}
                />
              ))}
            </span>
            <ul className="aulas-rye-leyenda">
              {tramosDelReparto.map((t) => (
                <li key={t.clave}>
                  <i style={{ background: t.color }} />
                  <span><strong>{fmt(t.n)}</strong> {t.etiqueta}</span>
                  <em>{t.nota}</em>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="aulas-rye-base">
        {/* De dónde sale la observada. Una tasa sin su base se lee como exacta,
            y con tres cursos-horario aplicados no lo es — por eso viaja su
            intervalo de confianza. */}
        Sobre {fmt(lectura.aulas)} {lectura.aulas === 1 ? "curso-horario aplicado" : "cursos-horario aplicados"}
        {" · "}{fmt(lectura.efectivas)} efectivas de {fmt(lectura.elegibles)} elegibles
      </p>
      {riesgo ? (
        <p className={`aulas-rye-cierre ${riesgo.facultadesEnRiesgo ? "es-alerta" : "es-ok"}`}>
          {riesgo.frase}
        </p>
      ) : null}
      {proyeccion ? (
        <p className={`aulas-rye-cierre ${proyeccion.cierra ? "es-ok" : "es-alerta"}`}>
          {proyeccion.frase}
        </p>
      ) : null}
    </div>
  );
}
