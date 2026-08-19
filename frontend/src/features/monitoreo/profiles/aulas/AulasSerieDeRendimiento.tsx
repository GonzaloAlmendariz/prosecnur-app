import { useMemo, useState } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
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

export function AulasSerieDeRendimiento({ partes, agenda = [], cuotas = [] }: {
  partes: ReadonlyArray<MonitoreoRow>;
  agenda?: ReadonlyArray<MonitoreoRow>;
  cuotas?: ReadonlyArray<MonitoreoRow>;
}) {
  const modelo = useMemo(() => serieDeRendimiento(partes), [partes]);
  const proyeccion = useMemo(
    () => proyeccionPorAgenda(agenda, partes, cuotas),
    [agenda, partes, cuotas],
  );
  const [foco, setFoco] = useState("");

  if (!modelo.fechas.length || !modelo.facultades.length) {
    return (
      <p className="mon-profile-muted">
        Todavía no hay partes de campo con fecha: sin ellos no se puede medir
        cuánto deja cada visita.
      </p>
    );
  }

  const { fechas: aplicadas, facultades, mediaDelEstudio } = modelo;
  const elegida = facultades.find((f) => f.facultad === foco) ?? null;
  const dibujadas = elegida ? [elegida] : facultades;
  const proyectada = elegida ? proyeccion.find((p) => p.facultad === elegida.facultad) ?? null : null;

  // Los días de la AGENDA que vienen después del último con parte. Sólo esos: la
  // inferencia no pasa de donde llega lo agendado, y donde no hay agenda no hay
  // línea —que es información, no un hueco: significa que no queda nada que
  // aplicar y hay que salir a agendar—.
  const porVenir = proyectada ? proyectada.dias.map((d) => d.fecha) : [];
  const fechas = [...aplicadas, ...porVenir];

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
  const corte = aplicadas.length - 1;

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
            {/* La frontera: a la izquierda lo que pasó, a la derecha lo que se
                infiere de la agenda. Sin esta raya las dos mitades se leen igual. */}
            {porVenir.length ? (
              <line x1={x(corte)} y1={MARGEN} x2={x(corte)} y2={MARGEN + UTIL}
                stroke="var(--pulso-border)" strokeWidth="1" strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke" />
            ) : null}
            {/* Lo INFERIDO. Arranca en el último día con parte para que se vea de
                dónde sale, y sólo llega hasta donde llega la agenda. */}
            {proyectada && porVenir.length ? (
              <polyline
                points={[`${x(corte)},${y(elegida!.esperadoFinal)}`,
                  ...porVenir.map((_, i) => `${x(corte + 1 + i)},${y(proyectada.esperadoPorAula)}`)].join(" ")}
                fill="none" stroke={COLOR_RESULTADO.parcial} strokeWidth="2.5"
                strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          {/* Los puntos van en HTML y no como `<circle>`: en un viewBox estirado
              un círculo sale elipse. Y son los que llevan el hover —«un poquito
              de hover», dijo—: cada uno dice su fecha, sus aulas, sus encuestas y
              si eso es observado o inferido. Sólo con una facultad elegida:
              veinte series de puntos son una nube, no un dato. */}
          {elegida ? elegida.dias.map((d, i) => (d.porAula == null ? null : (
            <span key={d.fecha} className="aulas-serie-punto"
              style={{ left: `${x(i)}%`, top: `${y(d.porAula)}%` }}
              title={`${dm(d.fecha)} · observado · ${fmt(d.aulas)} ${d.aulas === 1 ? "aula" : "aulas"} · ${fmt(d.efectivas)} encuestas · ${fmt(d.porAula)} por aula`} />
          ))) : null}
          {proyectada ? proyectada.dias.map((d, i) => (
            <span key={d.fecha} className="aulas-serie-punto es-inferido"
              style={{ left: `${x(corte + 1 + i)}%`, top: `${y(proyectada.esperadoPorAula)}%` }}
              title={`${dm(d.fecha)} · inferido de la agenda · ${fmt(d.aulas)} ${d.aulas === 1 ? "aula agendada" : "aulas agendadas"} · ~${fmt(d.esperadas)} encuestas esperadas`} />
          )) : null}
        </div>
      {/* El eje por día, con UNA marca por fecha. Gonzalo: «el eje que es
          importantísimo, porque yo tengo que saber qué días aplicó». Tres
          etiquetas en los extremos no contestaban eso. Las etiquetas se alternan
          cuando hay muchas, pero las marcas están todas. */}
      <ol className="aulas-serie-dias" aria-hidden="true">
        {fechas.map((f, i) => (
          <li key={f} className={i > corte ? "es-agenda" : ""}
            style={{ left: `${x(i)}%` }}>
            <i />
            {fechas.length <= 14 || i % 2 === 0 ? <span>{dm(f)}</span> : null}
          </li>
        ))}
      </ol>
      </div>

      {/* Sin repetir la última fecha: ya está en el eje por día, dos líneas más
          arriba, y verla dos veces se lee como dos datos distintos. */}
      <p className="aulas-serie-eje">
        <span>{fmt(aplicadas.length)} días con parte</span>
        {porVenir.length
          ? <span>{fmt(porVenir.length)} días agendados por delante</span>
          : <span>sin días agendados por delante</span>}
      </p>

      {/* Que una facultad no tenga NADA agendado por delante no es un hueco del
          gráfico: es la noticia. Es el momento en que hay que salir a agendar, y
          callarlo deja la pantalla igual que si la agenda estuviera llena. */}
      {elegida && proyectada && !proyectada.aulasAgendadas ? (
        <p className="aulas-serie-aviso">
          <strong>{elegida.facultad}</strong> no tiene ninguna aula agendada por delante:
          sin agenda no hay nada que inferir, y lo que falte de su cuota no va a llegar solo.
          {proyectada.cuotas.some((c) => c.faltan > 0)
            ? ` Le faltan ${fmt(proyectada.cuotas.reduce((n, c) => n + c.faltan, 0))} encuestas de cuota.`
            : ""}
        </p>
      ) : null}

      <p className="mon-profile-muted aulas-serie-pie">
        {elegida
          ? "La línea sólida es lo que dejó cada día; la punteada gris, lo que cabe esperar de la siguiente aula según lo que lleva —encogido hacia la media del estudio cuando tiene pocas—. La raya horizontal es esa media. Lo ámbar, a la derecha de la línea de corte, es lo que se infiere de las aulas YA AGENDADAS: ni un día más allá de donde llega la agenda."
          : "Una línea por facultad, y la raya gris horizontal es la media del estudio. Elige una facultad para ver su esperado y lo que se infiere de su agenda."}
      </p>
    </div>
  );
}
