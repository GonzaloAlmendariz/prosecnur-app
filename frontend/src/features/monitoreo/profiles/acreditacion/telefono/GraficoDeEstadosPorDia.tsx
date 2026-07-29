/**
 * La barra apilada de estados telefónicos por día.
 *
 * Va debajo del ritmo diario, que cuenta efectivas Kobo: son dos lecturas
 * distintas del mismo periodo —producción arriba, composición del barrido
 * abajo— y por eso comparten eje pero no escala.
 */

import { useState, type CSSProperties } from "react";

import type { AcreditacionDeclaracionEstado } from "../AcreditacionEstadosLlamada";
import type { AcreditacionPhoneDailyStatusSeries } from "../AcreditacionPhoneDailyTrend";
import { construirApiladoDeEstados, detalleDeSegmento, resumenDelDia } from "./apiladoDeEstados";

import "./apiladoDeEstados.css";

export function GraficoDeEstadosPorDia({
  series,
  declaraciones = [],
}: {
  series: readonly AcreditacionPhoneDailyStatusSeries[];
  declaraciones?: readonly AcreditacionDeclaracionEstado[];
}) {
  const apilado = construirApiladoDeEstados(series, declaraciones);
  // El día bajo el cursor. El `title` nativo tarda cerca de un segundo, no
  // sigue al puntero y se pinta como tooltip del sistema: sobre un segmento de
  // 4 px eso es no tener hover. El detalle se lee aquí, en el sitio fijo donde
  // ya estaba el total, y aparece al instante.
  const [diaEnFoco, setDiaEnFoco] = useState<string | null>(null);
  if (!apilado.dias.length) return null;

  const foco = apilado.dias.find((dia) => dia.dia === diaEnFoco) ?? null;

  return (
    <section className="mon-apilado" aria-label="Estados telefónicos por día">
      <header className="mon-apilado-head">
        <div>
          <span>Barrido telefónico</span>
          <strong>Estados registrados por día</strong>
          {/* Se dice qué mide, para que nadie lo lea como el estado de toda la
              base: la matriz reparte cada caso en el día de su última lectura. */}
          <small>Cada barra es lo que se registró ese día, no el estado de toda la base.</small>
        </div>
        <em>{apilado.total.toLocaleString("es-PE")} casos con fecha</em>
      </header>

      <ul className="mon-apilado-leyenda">
        {apilado.familias.map((familia) => (
          <li key={familia.familia}>
            <i style={{ background: familia.color }} aria-hidden="true" />
            <span>{familia.etiqueta}</span>
            <b>{familia.casos.toLocaleString("es-PE")}</b>
          </li>
        ))}
      </ul>

      {/* Línea de lectura, siempre presente aunque no haya foco: si apareciera
          solo al apuntar, la cabecera saltaría al entrar y salir del gráfico
          (C2). Sin foco nombra el gesto que la llena (R4). */}
      <p className={`mon-apilado-foco${foco ? " is-foco" : ""}`} aria-live="polite">
        {foco ? resumenDelDia(foco) : "Pasa el cursor por un día para ver su reparto."}
      </p>

      {/* `is-enfocando` la pone React, no `:hover`. Con el selector de CSS, el
          cursor dentro del gráfico pero en el hueco entre dos columnas no daba
          foco a ningún día y la regla `:not(.is-foco)` atenuaba TODAS: el
          gráfico entero se apagaba al pasar por encima. */}
      <div
        className={`mon-apilado-grafico${diaEnFoco ? " is-enfocando" : ""}`}
        role="img"
        aria-label={`Composición diaria de ${apilado.total} casos barridos`}
      >
        {apilado.dias.map((dia) => (
          <div
            className={`mon-apilado-dia${dia.dia === diaEnFoco ? " is-foco" : ""}`}
            key={dia.dia}
            // El foco viaja por el día entero, no por el segmento: apuntar a una
            // franja de 4 px con el ratón es lo que hacía inútil el hover.
            onMouseEnter={() => setDiaEnFoco(dia.dia)}
            onMouseLeave={() => setDiaEnFoco((actual) => (actual === dia.dia ? null : actual))}
            onFocus={() => setDiaEnFoco(dia.dia)}
            onBlur={() => setDiaEnFoco((actual) => (actual === dia.dia ? null : actual))}
            tabIndex={0}
            aria-label={resumenDelDia(dia)}
          >
            <div
              className="mon-apilado-columna"
              // La altura relativa deja comparables los días entre sí; los
              // segmentos reparten esa altura por porcentaje.
              style={{ "--apilado-alto": `${Math.max(6, (dia.total / apilado.maximo) * 100)}%` } as CSSProperties}
            >
              {dia.segmentos.map((segmento) => (
                <span
                  key={`${dia.dia}-${segmento.familia}`}
                  className="mon-apilado-segmento"
                  style={{
                    background: segmento.color,
                    height: `${segmento.porcentaje}%`,
                  }}
                  title={detalleDeSegmento(dia, segmento)}
                >
                  <span className="pulso-sr-only">{detalleDeSegmento(dia, segmento)}</span>
                </span>
              ))}
            </div>
            <em title={`${dia.etiqueta}: ${dia.total.toLocaleString("es-PE")} casos`}>{dia.etiquetaEje}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
