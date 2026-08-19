import { useMemo, useState } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { personasPorAula, personasProyectadas } from "./redondeoConservador";
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
  // El hover de verdad. El `title` nativo tarda un segundo, no se puede estilar y
  // en un punto de 7 px es casi imposible de acertar: «el hover tiene que
  // funcionar en los gráficos».
  const [pista, setPista] = useState<{ x: number; y: number; lineas: string[] } | null>(null);

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

  // La vista general con veinte líneas verdes era una maraña —«el gráfico general
  // no se entiende bien», y era verdad—. Veinte series iguales no se leen una por
  // una, así que lo que se lee es la DISPERSIÓN: la banda entre el cuartil 1 y el
  // 3 de cada día, la mediana encima, y las veinte al fondo muy tenues para no
  // perder el detalle. Y con color, las dos que deciden: la que más rinde y la
  // que menos.
  const cuartiles = elegida ? [] : aplicadas.map((_, i) => {
    const v = facultades
      .map((f) => f.dias[i]?.porAula)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    if (!v.length) return null;
    const en = (q: number) => v[Math.min(v.length - 1, Math.floor(q * (v.length - 1)))];
    return { p25: en(0.25), p50: en(0.5), p75: en(0.75) };
  });
  const conBanda = cuartiles.filter(Boolean).length >= 2;
  const extremos = elegida || facultades.length < 4
    ? []
    : [facultades[0], facultades[facultades.length - 1]];

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
            <strong>{elegida.facultad}</strong> deja <strong>{personasPorAula(elegida.observadoFinal)}</strong>{" "}
            encuestas por aula en {fmt(elegida.aulas)} {elegida.aulas === 1 ? "aula" : "aulas"} ·
            se espera <strong>{personasPorAula(elegida.esperadoFinal)}</strong> de la siguiente
            {elegida.aulas < 5 ? " (con tan pocas aulas, el esperado se apoya en la media del estudio)" : ""}
          </>
        ) : (
          <>
            <strong>{fmt(facultades.length)}</strong> facultades ·{" "}
            <strong>{personasPorAula(mediaDelEstudio)}</strong> encuestas por aula de media del estudio ·
            de <strong>{personasPorAula(facultades[0].esperadoFinal)}</strong>{" "}
            ({facultades[0].facultad}) a{" "}
            <strong>{personasPorAula(facultades[facultades.length - 1].esperadoFinal)}</strong>{" "}
            ({facultades[facultades.length - 1].facultad}) esperadas
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
              {f.facultad} · {personasPorAula(f.esperadoFinal)} esperadas
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
            {/* La banda de dispersión, debajo de todo: entre el cuartil 1 y el 3
                de cada día está la mitad central de las facultades. */}
            {conBanda ? (
              <polygon
                points={[
                  ...cuartiles.map((c, i) => (c ? `${x(i)},${y(c.p75)}` : null)).filter(Boolean),
                  ...cuartiles.map((c, i) => (c ? `${x(i)},${y(c.p25)}` : null)).filter(Boolean).reverse(),
                ].join(" ")}
                fill={COLOR_RESULTADO.efectiva} opacity="0.1" />
            ) : null}
            {dibujadas.map((f) => (
              <polyline key={f.facultad} points={trazo(f.dias)} fill="none"
                stroke={COLOR_RESULTADO.efectiva}
                strokeWidth={elegida ? 2.5 : 1}
                opacity={elegida ? 1 : 0.16}
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
            ))}
            {extremos.map((f, k) => (
              <polyline key={`extremo-${f.facultad}`} points={trazo(f.dias)} fill="none"
                stroke={k === 0 ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.rechazo}
                strokeWidth="2" opacity="0.9"
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
            ))}
            {/* La mediana del día, que es la línea que de verdad se lee. */}
            {conBanda ? (
              <polyline
                points={cuartiles.map((c, i) => (c ? `${x(i)},${y(c.p50)}` : null)).filter(Boolean).join(" ")}
                fill="none" stroke={COLOR_RESULTADO.efectiva} strokeWidth="3"
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
            ) : null}
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
            {/* Las BARRAS de elegibles: el techo de cada día agendado, o sea toda
                la gente que PODRÍA responder en esas aulas. La línea de esperado
                va por debajo, y la distancia entre las dos es la efectividad
                prevista. Gonzalo: «hay que diferenciar cuánto se espera llegar
                con las aulas versus cuántos matriculados o elegibles hay [...]
                los elegibles como barras y lo esperado como líneas, y las barras
                un poquito más opacas».
                En elegibles POR AULA, que es la unidad del eje; los totales del
                día van en el hover, que es donde caben sin mentir la escala. */}
            {proyectada ? proyectada.dias.map((d, i) => {
              if (!d.elegibles || !d.aulas) return null;
              const techo = d.elegibles / d.aulas;
              const ancho = fechas.length > 1 ? (UTIL / (fechas.length - 1)) * 0.55 : 6;
              return (
                <rect key={`techo-${d.fecha}`}
                  x={x(corte + 1 + i) - ancho / 2} y={y(techo)}
                  width={ancho} height={Math.max(0, MARGEN + UTIL - y(techo))}
                  fill={COLOR_RESULTADO.pendiente} opacity="0.18" />
              );
            }) : null}
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
              un círculo sale elipse. Y son los que llevan el hover: cada uno dice
              su fecha, sus aulas, sus encuestas y si eso es observado o inferido.
              Sólo con una facultad elegida: veinte series de puntos son una nube,
              no un dato. */}
          {elegida ? elegida.dias.map((d, i) => (d.porAula == null ? null : (
            <span key={d.fecha} className="aulas-serie-punto" tabIndex={0} role="img"
              style={{ left: `${x(i)}%`, top: `${y(d.porAula)}%` }}
              aria-label={`${dm(d.fecha)}, observado, ${fmt(d.efectivas)} encuestas en ${fmt(d.aulas)} aulas`}
              onMouseEnter={() => setPista({ x: x(i), y: y(d.porAula!), lineas: [
                `${dm(d.fecha)} · observado`,
                `${fmt(d.aulas)} ${d.aulas === 1 ? "aula" : "aulas"} · ${fmt(d.efectivas)} encuestas`,
                `${personasPorAula(d.porAula)} por aula`,
              ] })}
              onFocus={() => setPista({ x: x(i), y: y(d.porAula!), lineas: [
                `${dm(d.fecha)} · observado`,
                `${fmt(d.aulas)} ${d.aulas === 1 ? "aula" : "aulas"} · ${fmt(d.efectivas)} encuestas`,
                `${personasPorAula(d.porAula)} por aula`,
              ] })}
              onMouseLeave={() => setPista(null)}
              onBlur={() => setPista(null)} />
          ))) : null}
          {proyectada ? proyectada.dias.map((d, i) => {
            const lineas = [
              `${dm(d.fecha)} · inferido de la agenda`,
              `${fmt(d.aulas)} ${d.aulas === 1 ? "aula agendada" : "aulas agendadas"}`,
              d.elegibles ? `${fmt(d.elegibles)} elegibles · ~${personasProyectadas(d.esperadas)} esperadas` : `~${personasProyectadas(d.esperadas)} esperadas`,
            ];
            const px = x(corte + 1 + i);
            const py = y(proyectada.esperadoPorAula);
            return (
              <span key={d.fecha} className="aulas-serie-punto es-inferido" tabIndex={0} role="img"
                style={{ left: `${px}%`, top: `${py}%` }}
                aria-label={lineas.join(", ")}
                onMouseEnter={() => setPista({ x: px, y: py, lineas })}
                onFocus={() => setPista({ x: px, y: py, lineas })}
                onMouseLeave={() => setPista(null)}
                onBlur={() => setPista(null)} />
            );
          }) : null}
          {pista ? (
            <div className="aulas-serie-pista" role="status"
              style={{ left: `${pista.x}%`, top: `${pista.y}%` }}>
              {pista.lineas.map((l, k) => <span key={k}>{l}</span>)}
            </div>
          ) : null}
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

      {/* Las DOS metas de la facultad, que es lo que decide si se sale a agendar.
          Gonzalo: «cada facultad tiene una meta por hombre y por mujer [...]
          tengo que ver si voy a llegar a la cuota, y si lo que tengo agendado ya
          es suficiente para llegar a esa meta o no. ¿Y cuándo llegaría?».
          Sólo con una facultad elegida: en la vista general son cuarenta filas y
          ninguna pregunta. */}
      {elegida && proyectada && proyectada.cuotas.length ? (
        <table className="aulas-serie-cuotas">
          <caption>
            Cuota de {elegida.facultad} y lo que aportan sus aulas agendadas
            {proyectada.reparto === "meta" ? (
              <em>
                {" "}· el reparto por sexo sale de la META, porque esta facultad
                todavía no tiene respuestas propias con sexo declarado
              </em>
            ) : null}
          </caption>
          <thead>
            <tr>
              <th scope="col">Sexo</th>
              <th scope="col">Meta</th>
              <th scope="col">Conseguidas</th>
              <th scope="col">Faltan</th>
              <th scope="col">De la agenda</th>
              <th scope="col">Con lo agendado</th>
            </tr>
          </thead>
          <tbody>
            {proyectada.cuotas.map((c) => (
              <tr key={c.sexo} className={c.faltan === 0 ? "es-cumplida" : c.alcanza ? "es-llega" : "es-corta"}>
                <th scope="row">{c.sexo}</th>
                <td>{fmt(c.meta)}</td>
                <td>{fmt(c.observadas)}</td>
                <td>{c.faltan === 0 ? "—" : fmt(c.faltan)}</td>
                <td>{proyectada.aulasAgendadas ? `~${personasProyectadas(c.esperadasDeLaAgenda)}` : "—"}</td>
                <td>
                  {c.faltan === 0
                    ? "cuota cumplida"
                    : c.fechaDeCruce
                      ? `llega el ${dm(c.fechaDeCruce)}`
                      : `no llega · faltarían ${fmt(c.faltanAlCerrarAgenda)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

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
          : "La línea gruesa es la mediana del día y la banda, la mitad central de las facultades; detrás están las veinte, una por facultad. En verde y en granate, las dos que deciden: la que más rinde y la que menos. La raya horizontal es la media del estudio. Elige una facultad para ver su esperado y lo que se infiere de su agenda."}
      </p>
    </div>
  );
}
