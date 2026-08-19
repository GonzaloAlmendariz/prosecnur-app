import { useMemo, useState } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { serieDeRendimiento } from "./serieDeRendimiento";

/**
 * El rendimiento diario de cada facultad, y el que cabe esperar de la próxima
 * aula suya.
 *
 * Gonzalo lo pidió así y hay que leerlo entero: «no veo los gráficos de línea
 * separados por facultades que vayan midiendo el rendimiento diario y el cálculo
 * inferencial de aquel rendimiento»; y sobre la idea de recortar el número de
 * líneas: «no entiendo por qué veinte gráficos no entrarían, y en todo caso, si
 * veinte no entran, no se puede tener como una especie de botón o slider que
 * permita ir de facultad en facultad, y un gráfico también general».
 *
 * Así que son las dos vistas, no una:
 *
 * - **Todas**: una línea fina por facultad, para ver la dispersión de un golpe.
 *   Veinte líneas en un gráfico de líneas es lo que un gráfico de líneas hace.
 * - **Una**: su serie en grueso, **su esperado en punteado gris** y la media del
 *   estudio de referencia, que es cuando se puede leer de verdad.
 *
 * El esperado no es un suavizado: es la media posterior Gamma-Poisson de
 * `serieDeRendimiento`, o sea cuánto cabe esperar de la SIGUIENTE aula de esa
 * facultad dado lo que lleva. Por eso va en punteado y en gris: no es lo que
 * pasó.
 */

const MARGEN = 4;
const UTIL = 100 - MARGEN * 2;
const fmt = (n: number) => n.toLocaleString("es-PE");
const dm = (fecha: string) => {
  const m = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : fecha;
};

export function AulasSerieDeRendimiento({ partes }: { partes: ReadonlyArray<MonitoreoRow> }) {
  const modelo = useMemo(() => serieDeRendimiento(partes), [partes]);
  const [foco, setFoco] = useState("");

  if (!modelo.fechas.length || !modelo.facultades.length) {
    return (
      <p className="mon-profile-muted">
        Todavía no hay partes de campo con fecha: sin ellos no se puede medir
        cuánto deja cada visita.
      </p>
    );
  }

  const { fechas, facultades, mediaDelEstudio } = modelo;
  const elegida = facultades.find((f) => f.facultad === foco) ?? null;
  const dibujadas = elegida ? [elegida] : facultades;

  // El techo del eje: lo más alto que se llega a dibujar, con un respiro. Se
  // calcula sobre lo que SE VE, no sobre todo el modelo, para que al elegir una
  // facultad la escala se ajuste a ella.
  const valores = dibujadas.flatMap((f) => [
    ...f.dias.map((d) => d.porAula ?? 0),
    ...(elegida ? f.dias.map((d) => d.esperado) : []),
  ]);
  const tope = Math.max(1, Math.ceil(Math.max(...valores, mediaDelEstudio) / 5) * 5);
  const x = (i: number) => (fechas.length > 1 ? MARGEN + (UTIL * i) / (fechas.length - 1) : 50);
  const y = (v: number) => MARGEN + UTIL - (UTIL * v) / tope;

  /** Sólo los días en que esa facultad fue a algún aula: un hueco no es un cero. */
  const trazo = (dias: ReadonlyArray<{ porAula: number | null }>) => dias
    .map((d, i) => (d.porAula == null ? null : `${x(i)},${y(d.porAula)}`))
    .filter(Boolean)
    .join(" ");

  const indice = elegida ? facultades.indexOf(elegida) : -1;
  const mover = (paso: number) => {
    if (!facultades.length) return;
    const siguiente = indice < 0
      ? (paso > 0 ? 0 : facultades.length - 1)
      : (indice + paso + facultades.length) % facultades.length;
    setFoco(facultades[siguiente].facultad);
  };

  return (
    <div className="aulas-serie" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cadenas-lectura">
        {elegida ? (
          <>
            <strong>{elegida.facultad}</strong> deja <strong>{fmt(elegida.observadoFinal ?? 0)}</strong>{" "}
            encuestas por aula en {fmt(elegida.aulas)} {elegida.aulas === 1 ? "aula" : "aulas"} ·
            se espera <strong>{fmt(elegida.esperadoFinal)}</strong> de la siguiente
            {elegida.aulas < 5 ? " (con tan pocas aulas, el esperado se apoya en la media del estudio)" : ""}
          </>
        ) : (
          <>
            <strong>{fmt(facultades.length)}</strong> facultades ·{" "}
            <strong>{fmt(mediaDelEstudio)}</strong> encuestas por aula de media del estudio ·
            de <strong>{fmt(facultades[0].esperadoFinal)}</strong> a{" "}
            <strong>{fmt(facultades[facultades.length - 1].esperadoFinal)}</strong> esperadas
          </>
        )}
      </p>

      <div className="aulas-serie-mando">
        <button type="button" className={foco ? "" : "is-activa"} onClick={() => setFoco("")}>
          Todas
        </button>
        <button type="button" aria-label="Facultad anterior" onClick={() => mover(-1)}>‹</button>
        <select value={foco} onChange={(e) => setFoco(e.currentTarget.value)} aria-label="Facultad">
          <option value="">Todas las facultades</option>
          {facultades.map((f) => (
            <option key={f.facultad} value={f.facultad}>
              {f.facultad} · {fmt(f.esperadoFinal)} esperadas
            </option>
          ))}
        </select>
        <button type="button" aria-label="Facultad siguiente" onClick={() => mover(1)}>›</button>
      </div>

      <div className="aulas-serie-plot">
        <ul className="aulas-serie-y" aria-hidden="true">
          {[tope, Math.round(tope / 2), 0].map((m) => <li key={m}>{fmt(m)}</li>)}
        </ul>
        <div className="aulas-serie-lienzo">
          <svg className="aulas-serie-grafico" viewBox="0 0 100 100" preserveAspectRatio="none"
            role="img"
            aria-label={elegida
              ? `Rendimiento diario de ${elegida.facultad}; esperado ${elegida.esperadoFinal} encuestas por aula`
              : `Rendimiento diario de ${facultades.length} facultades; media del estudio ${mediaDelEstudio}`}>
            {[0, Math.round(tope / 2), tope].map((m) => (
              <line key={m} x1={MARGEN} y1={y(m)} x2={100 - MARGEN} y2={y(m)}
                stroke="var(--pulso-border-soft)" strokeWidth="1"
                vectorEffect="non-scaling-stroke" opacity={m === 0 ? 1 : 0.55} />
            ))}
            {/* La media del estudio, siempre visible: es contra lo que se compara
                cualquier facultad, y es el prior del esperado. */}
            <line x1={MARGEN} y1={y(mediaDelEstudio)} x2={100 - MARGEN} y2={y(mediaDelEstudio)}
              stroke={COLOR_RESULTADO.revision} strokeWidth="1.2" strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke" opacity="0.7" />
            {dibujadas.map((f) => (
              <polyline key={f.facultad} points={trazo(f.dias)} fill="none"
                stroke={COLOR_RESULTADO.efectiva}
                strokeWidth={elegida ? 2.5 : 1.2}
                opacity={elegida ? 1 : 0.45}
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
            ))}
            {/* El esperado sólo con una facultad elegida: veinte líneas punteadas
                sobre veinte sólidas no se leen, y encima el esperado es lo que se
                mira DESPUÉS de decidir a quién mirar. */}
            {elegida ? (
              <polyline points={elegida.dias.map((d, i) => `${x(i)},${y(d.esperado)}`).join(" ")}
                fill="none" stroke={COLOR_RESULTADO.pendiente} strokeWidth="2"
                strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
        </div>
      </div>

      <p className="aulas-serie-eje">
        <span>{dm(fechas[0])}</span>
        <span>{fmt(fechas.length)} días de campo</span>
        <span>{dm(fechas[fechas.length - 1])}</span>
      </p>

      <p className="mon-profile-muted aulas-serie-pie">
        {elegida
          ? "La línea sólida es lo que dejó cada día; la punteada, lo que cabe esperar de la siguiente aula según lo que lleva —encogido hacia la media del estudio cuando tiene pocas—. La raya gris horizontal es esa media."
          : "Una línea por facultad, y la raya gris horizontal es la media del estudio. Elige una facultad para ver su esperado."}
      </p>
    </div>
  );
}
