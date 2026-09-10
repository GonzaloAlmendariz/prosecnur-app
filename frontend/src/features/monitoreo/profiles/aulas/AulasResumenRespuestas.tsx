import type { ReactNode } from "react";

import { fmt, pctPerfil } from "./kpisDeAulas";
import type { MonitoreoAulasRespuestasCuenta } from "../../../../api/monitoreo";
import "./aulasResumenRespuestas.css";

/**
 * De cuántas respuestas cuentan, y por qué no cuentan las demás.
 *
 * **Las dos razones van separadas, y ése es el bloque entero.** «944 de 1 049»
 * dejaba 105 en una resta muda, y esas 105 son dos cosas que piden lo
 * contrario: 37 que no son del operativo —otra ola, una prueba, un aula que no
 * está en el plan, y no piden nada— y 68 que sí lo son y no pasan el criterio,
 * que es trabajo hecho que no suma. Es el mismo error que el rótulo
 * «descartadas por el filtro», retirado del perfil el 2026-09-07.
 *
 * Por eso son DOS barras y no una de tres tramos: la segunda reparte sólo lo
 * que no cuenta, así que 68 sobre 105 se lee como dos tercios en vez de como el
 * 6 % del total, que es donde el problema desaparecía de la vista.
 */
export function AulasResumenRespuestas({
  cuenta, sinAula, rotulo = "", facultades = [], onFoco = null,
}: {
  cuenta: MonitoreoAulasRespuestasCuenta | null | undefined;
  /** Respuestas sin aula identificable. Se declara; no se esconde. */
  sinAula?: number;
  /** La facultad en foco, si la hay. Vacío = el conjunto. */
  rotulo?: string;
  /** Los nombres para las pastillas. El foco lo decide `onFoco`. */
  facultades?: ReadonlyArray<string>;
  /**
   * **El foco es el del perfil** (`foco=facultad:…`, param canónico), no un
   * selector propio: el boceto dibujaba su ◀ Facultad ▶ y habría sido un
   * segundo mando para lo mismo — y encima no enlazable. `null` = sólo lectura.
   */
  onFoco?: ((foco: { tipo: "facultad"; valor: string } | null) => void) | null;
}): ReactNode {
  if (!cuenta) return null;
  // Con una facultad en foco SÍ se pinta el cero: es su respuesta —«esta
  // facultad no tiene ninguna»— y callarla dejaría el bloque anterior en
  // pantalla como si fuera suyo. Sin foco, un cero es que no hay nada que
  // contar todavía.
  if (!cuenta.observadas && !rotulo) return null;
  const noCuentan = cuenta.fuera_del_operativo + cuenta.no_pasan_criterio;
  const ancho = (v: number, total: number) => `${total > 0 ? (100 * v) / total : 0}%`;
  return (
    <div className="aulas-resp">
      {facultades.length && onFoco ? (
        <div className="aulas-resp-facultades" role="group" aria-label="Ver las respuestas de una facultad">
          <button
            type="button" className="aulas-sexo-chip" aria-pressed={!rotulo}
            onClick={() => onFoco(null)}
          >
            Todas las facultades
          </button>
          {facultades.map((f) => (
            <button
              key={f} type="button" className="aulas-sexo-chip"
              aria-pressed={rotulo.trim().toUpperCase() === f.trim().toUpperCase()}
              onClick={() => onFoco({ tipo: "facultad", valor: f })}
            >
              {f}
            </button>
          ))}
        </div>
      ) : null}
      <p className="aulas-resp-titular">
        <strong>{fmt(cuenta.efectivas)}</strong> efectivas de {fmt(cuenta.observadas)} respuestas
        {cuenta.observadas > 0 ? (
          <span className="aulas-resp-pct">
            {pctPerfil((100 * cuenta.efectivas) / cuenta.observadas)}
          </span>
        ) : null}
        {rotulo ? <span className="aulas-resp-pct">en {rotulo}</span> : null}
      </p>
      <div className="aulas-resp-pila">
        <i
          className="aulas-resp-tramo" data-tramo="efectivas"
          style={{ width: ancho(cuenta.efectivas, cuenta.observadas) }}
        />
        <i
          className="aulas-resp-tramo" data-tramo="no-cuentan"
          style={{ width: ancho(noCuentan, cuenta.observadas) }}
        />
      </div>
      {noCuentan > 0 ? (
        <>
          <div className="aulas-resp-sub">
            <div className="aulas-resp-pila aulas-resp-pila-sub">
              <i
                className="aulas-resp-tramo" data-tramo="fuera"
                style={{ width: ancho(cuenta.fuera_del_operativo, noCuentan) }}
              />
              <i
                className="aulas-resp-tramo" data-tramo="criterio"
                style={{ width: ancho(cuenta.no_pasan_criterio, noCuentan) }}
              />
            </div>
            <span>de las <strong>{fmt(noCuentan)}</strong> que no cuentan</span>
          </div>
          <p className="aulas-resp-leyenda">
            <span>
              <i className="aulas-resp-swatch" data-tramo="fuera" />
              Fuera del operativo <strong>{fmt(cuenta.fuera_del_operativo)}</strong>
            </span>
            <span>
              <i className="aulas-resp-swatch" data-tramo="criterio" />
              No pasan el criterio <strong>{fmt(cuenta.no_pasan_criterio)}</strong>
            </span>
          </p>
        </>
      ) : null}
      {/* Se dice siempre que las haya: son respuestas que están en el total y
          en ninguna facultad, así que quien sume las facultades y no llegue al
          total tiene aquí la explicación en vez de un descuadre. */}
      {sinAula && sinAula > 0 ? (
        <p className="aulas-resp-nota">
          {fmt(sinAula)} sin curso-horario identificable: cuentan en el total y en
          ninguna facultad.
        </p>
      ) : null}
    </div>
  );
}
