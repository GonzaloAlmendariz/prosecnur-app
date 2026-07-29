/**
 * La barra apilada de estados telefónicos por día.
 *
 * Va debajo del ritmo diario, que cuenta efectivas Kobo: son dos lecturas
 * distintas del mismo periodo —producción arriba, composición del barrido
 * abajo— y por eso comparten eje pero no escala.
 */

import type { CSSProperties } from "react";

import type { AcreditacionDeclaracionEstado } from "../AcreditacionEstadosLlamada";
import type { AcreditacionPhoneDailyStatusSeries } from "../AcreditacionPhoneDailyTrend";
import { construirApiladoDeEstados, detalleDeSegmento } from "./apiladoDeEstados";

import "./apiladoDeEstados.css";

export function GraficoDeEstadosPorDia({
  series,
  declaraciones = [],
}: {
  series: readonly AcreditacionPhoneDailyStatusSeries[];
  declaraciones?: readonly AcreditacionDeclaracionEstado[];
}) {
  const apilado = construirApiladoDeEstados(series, declaraciones);
  if (!apilado.dias.length) return null;

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

      <div className="mon-apilado-grafico" role="img" aria-label={`Composición diaria de ${apilado.total} casos barridos`}>
        {apilado.dias.map((dia) => (
          <div className="mon-apilado-dia" key={dia.dia}>
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
