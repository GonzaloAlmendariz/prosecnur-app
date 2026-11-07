import type { ExploradorCrucePunto } from "../../../../api/validacionExplorar";
import { ALTO_DEL_EJE_DE_FECHAS, EjeDeFechas } from "../../../monitoreo/core/ejeDeFechas";
import EjesSvg, { anchoUtil, type Marco, yDe } from "./EjesSvg";
import { escalaDesdeCero, escalaLinda, fechaCorta } from "./escalas";
import { fmtN, fmtPct, fmtValor } from "./explorarModelo";
import { barrasApiladas, casosPorDia, DIA_CHICO, ordenDeSeries, pctDelPeriodo, rangoDeDias, type ModoSerie } from "./serieModelo";

/** Los puntos en tramos de días seguidos: una línea no cruza un día sin casos como si lo hubiera. */
function tramosSeguidos<T extends { fecha: string }>(puntos: readonly T[], fechas: readonly string[]): T[][] {
  const tramos: T[][] = [];
  let previo = -2;
  for (const p of puntos) {
    const i = fechas.indexOf(p.fecha);
    if (i !== previo + 1 || !tramos.length) tramos.push([]);
    tramos[tramos.length - 1].push(p);
    previo = i;
  }
  return tramos;
}
import { useAncho } from "./useAncho";

const ALTO = 300;
const ALTO_MAX = 520;
/** Panel de una opción (E8k): alto del trazo, sin contar su título. */
const ALTO_PANEL = 96;

/** Tono de cada grupo: navy, azul y el gris de las residuales; con más de tres, el apoyo. */
const TONOS = ["var(--vx-g1)", "var(--vx-g2)", "var(--vx-g3)"];
const tonoDe = (k: number) => TONOS[k] ?? "var(--vx-resto)";

const plural = (n: number) => `${fmtN(n)} ${n === 1 ? "caso" : "casos"}`;

/**
 * E8 — serie por fecha, con el eje de dos líneas de Monitoreo (día bajo cada barra, mes donde empieza). Única:
 * casos por día apilados por categoría, con el día con más casos rotulado (E8j). Múltiple: un panel por opción,
 * cada uno con su escala y su tope escrito, porque la pregunta es cómo se mueve cada opción y no cuál pesa más —eso
 * lo dice su promedio— (E8k). Numérica: la mediana del día con su mitad central (E8l y E8i, los dos sentidos del
 * par). Los días con menos de 30 casos se marcan: ahí el % o la mediana saltan con uno o dos casos.
 */
export default function CruceSerie({ puntos, modo = "mediana" }: { puntos: readonly ExploradorCrucePunto[]; modo?: ModoSerie }) {
  if (!puntos.length) return <p className="vx-pie">Sin fechas que dibujar.</p>;
  if (modo === "apilada") return <SerieApilada puntos={puntos} />;
  if (modo === "porcentaje") return <SeriePorOpcion puntos={puntos} />;
  return <SerieMediana puntos={puntos} />;
}

function geometria(fechas: readonly string[], ancho: number, alto: number, izq = 44) {
  const marco: Marco = { W: Math.max(320, ancho), H: Math.min(ALTO_MAX, Math.max(ALTO, alto)), izq, der: 10, arr: 24, aba: ALTO_DEL_EJE_DE_FECHAS + 6 };
  const paso = anchoUtil(marco) / Math.max(1, fechas.length);
  const centro = (i: number) => marco.izq + (i + 0.5) * paso;
  return { marco, paso, centro };
}

function SerieApilada({ puntos }: { puntos: readonly ExploradorCrucePunto[] }) {
  const [ref, ancho, alto] = useAncho<HTMLDivElement>();
  const { fechas, series, barras, max } = barrasApiladas(puntos);
  const { marco, paso, centro } = geometria(fechas, ancho, alto);
  const y = escalaDesdeCero(max, 4);
  const bw = Math.max(2, Math.min(28, paso * 0.72));
  const ip = barras.findIndex((b) => b.total === max);
  return (
    <>
      <div ref={ref} className="vx-svg-caja is-llena" style={{ minHeight: ALTO }}>
        <svg
          className="vx-svg"
          width={marco.W}
          height={marco.H}
          viewBox={`0 0 ${marco.W} ${marco.H}`}
          role="img"
          aria-label={`Casos por día del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}, apilados por ${series.join(", ")}; el día con más casos es el ${fechaCorta(fechas[ip])}, con ${fmtN(max)}`}
        >
          <EjesSvg marco={marco} y={y} rotuloY={fmtN} marcasX={[]} />
          {barras.map((b, i) => (
            <g key={b.fecha} className="vx-svg-dia">
              <title>
                {[`${fechaCorta(b.fecha)}: ${plural(b.total)}`, ...b.tramos.filter((t) => t.n > 0).map((t) => `${t.serie || "Sin categoría"}: ${fmtN(t.n)} (${fmtPct(b.total > 0 ? (100 * t.n) / b.total : 0)})`)].join("\n")}
              </title>
              {b.tramos.map((t, k) =>
                t.n > 0 ? (
                  <rect
                    key={t.serie || "serie"}
                    className="vx-svg-barra"
                    x={centro(i) - bw / 2}
                    y={yDe(marco, t.hasta, y)}
                    width={bw}
                    height={Math.max(0, yDe(marco, t.desde, y) - yDe(marco, t.hasta, y))}
                    style={{ fill: tonoDe(k) }}
                  />
                ) : null,
              )}
            </g>
          ))}
          {ip >= 0 && (
            <text className="vx-svg-anota" x={centro(ip)} y={yDe(marco, max, y) - 7} textAnchor="middle">
              {`${fmtN(max)}, ${fechaCorta(fechas[ip])}`}
            </text>
          )}
          <EjeDeFechas fechas={fechas} paso={paso} x={centro} alto={marco.H} />
        </svg>
      </div>
      {series.length > 1 && (
        <div className="vx-leyenda">
          {series.map((s, k) => (
            <span key={s || "serie"}>
              <i style={{ background: tonoDe(k) }} aria-hidden />
              {s || "Sin categoría"}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function SerieMediana({ puntos }: { puntos: readonly ExploradorCrucePunto[] }) {
  const [ref, ancho, alto] = useAncho<HTMLDivElement>();
  const p = [...puntos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechas = rangoDeDias(p.map((x) => x.fecha));
  const { marco, paso, centro } = geometria(fechas, ancho, alto);
  const cx = (x: ExploradorCrucePunto) => centro(fechas.indexOf(x.fecha));
  const tramos = tramosSeguidos(p, fechas);
  const valores = p.flatMap((x) => [x.valor, x.baja, x.alta].filter((v): v is number => v !== null));
  const y = escalaLinda(Math.min(...valores), Math.max(...valores), 5);
  const chico = (x: ExploradorCrucePunto) => x.n !== null && x.n < DIA_CHICO;
  const bandas = tramos
    .map((t) => t.filter((x) => x.baja !== null && x.alta !== null))
    .filter((t) => t.length > 1)
    .map((t) => [...t.map((x) => `${cx(x)},${yDe(marco, x.alta ?? x.valor, y)}`), ...[...t].reverse().map((x) => `${cx(x)},${yDe(marco, x.baja ?? x.valor, y)}`)].join(" "));
  const banda = bandas.length > 0;
  const hayChicos = p.some(chico);
  return (
    <>
      <div ref={ref} className="vx-svg-caja is-llena" style={{ minHeight: ALTO }}>
        <svg
          className="vx-svg"
          width={marco.W}
          height={marco.H}
          viewBox={`0 0 ${marco.W} ${marco.H}`}
          role="img"
          aria-label={`Mediana por día del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}, con la mitad central de cada día`}
        >
          <EjesSvg marco={marco} y={y} rotuloY={fmtValor} marcasX={[]} />
          {bandas.map((b, i) => <polygon key={`b${i}`} className="vx-svg-banda-central" points={b} />)}
          {tramos.map((t, i) => <polyline key={`t${i}`} className="vx-svg-traza" points={t.map((x) => `${cx(x)},${yDe(marco, x.valor, y)}`).join(" ")} />)}
          {p.map((x) => (
            <circle key={x.fecha} className={`vx-svg-nodo-mediana${chico(x) ? " is-chico" : ""}`} cx={cx(x)} cy={yDe(marco, x.valor, y)} r={chico(x) ? 3.6 : 4.5}>
              <title>
                {[
                  `${fechaCorta(x.fecha)}: mediana ${fmtValor(x.valor)}`,
                  x.baja !== null && x.alta !== null ? `Mitad central ${fmtValor(x.baja)} a ${fmtValor(x.alta)}` : null,
                  x.n !== null ? `${plural(x.n)}${chico(x) ? ", base chica" : ""}` : null,
                ].filter(Boolean).join("\n")}
              </title>
            </circle>
          ))}
          <EjeDeFechas fechas={fechas} paso={paso} x={centro} alto={marco.H} />
        </svg>
      </div>
      <div className="vx-leyenda">
        <span><i className="vx-muestra is-traza" aria-hidden />Mediana del día</span>
        {banda && <span><i className="vx-muestra is-banda" aria-hidden />Mitad central (p25 a p75)</span>}
        {hayChicos && <span><i className="vx-muestra is-chico" aria-hidden />Día con menos de {DIA_CHICO} casos</span>}
      </div>
    </>
  );
}

function SeriePorOpcion({ puntos }: { puntos: readonly ExploradorCrucePunto[] }) {
  const orden = ordenDeSeries(puntos, "porcentaje");
  const fechas = rangoDeDias(puntos.map((p) => p.fecha));
  const casos = casosPorDia(puntos);
  const diasChicos = fechas.filter((f) => {
    const n = casos.get(f);
    return n !== null && n !== undefined && n < DIA_CHICO;
  });
  return (
    <>
      <div className="vx-multiples">
        {orden.map((s, i) => (
          <PanelOpcion
            key={s || "serie"}
            serie={s}
            mayor={i === 0}
            fechas={fechas}
            chicos={diasChicos}
            puntos={puntos.filter((p) => (p.serie ?? "") === s)}
            pct={pctDelPeriodo(puntos, s)}
          />
        ))}
      </div>
      {diasChicos.length > 0 && (
        <div className="vx-leyenda">
          <span><i className="vx-muestra is-dia-chico" aria-hidden />Día con menos de {DIA_CHICO} casos</span>
        </div>
      )}
    </>
  );
}

function PanelOpcion({
  serie,
  mayor,
  fechas,
  chicos,
  puntos,
  pct,
}: {
  serie: string;
  mayor: boolean;
  fechas: readonly string[];
  chicos: readonly string[];
  puntos: readonly ExploradorCrucePunto[];
  pct: number;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>(220);
  const W = Math.max(120, ancho);
  const H = ALTO_PANEL;
  const tope = escalaDesdeCero(Math.max(1, ...puntos.map((p) => p.valor)), 4).hasta;
  const paso = fechas.length > 1 ? W / (fechas.length - 1) : W;
  const X = (f: string) => fechas.indexOf(f) * paso;
  const Y = (v: number) => 14 + (H - 17) * (1 - v / tope);
  const p = [...puntos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const linea = p.map((x) => `${X(x.fecha)},${Y(x.valor)}`).join(" ");
  const tramos = tramosSeguidos(p, fechas);
  return (
    <div className={`vx-multiple${mayor ? " is-mayor" : ""}`}>
      <div className="vx-multiple-t">
        {serie || "Sin categoría"}
        <span>{fmtPct(pct).replace(/\.\d%$/, "%")} en el periodo</span>
      </div>
      <div ref={ref} className="vx-svg-caja">
        <svg className="vx-svg" width={W} height={H + 2} viewBox={`0 0 ${W} ${H + 2}`} role="img" aria-label={`${serie}: % que la marca cada día, de 0 a ${fmtN(tope)}%`}>
          {chicos.map((f) => (
            <rect key={f} className="vx-svg-dia-chico" x={X(f) - paso / 2} y={Y(tope)} width={paso} height={Y(0) - Y(tope)} />
          ))}
          <line className="vx-svg-rejilla" x1={0} x2={W} y1={Y(tope)} y2={Y(tope)} />
          <text className="vx-svg-marca" x={W} y={Y(tope) - 4} textAnchor="end">{`${fmtN(tope)}%`}</text>
          <line className="vx-svg-rejilla" x1={0} x2={W} y1={Y(tope / 2)} y2={Y(tope / 2)} />
          <line className="vx-svg-eje" x1={0} x2={W} y1={Y(0)} y2={Y(0)} />
          <polygon className="vx-svg-area" points={`0,${Y(0)} ${linea} ${X(p[p.length - 1]?.fecha ?? fechas[0])},${Y(0)}`} />
          {tramos.map((t, i) => <polyline key={i} className="vx-svg-chispa" points={t.map((x) => `${X(x.fecha)},${Y(x.valor)}`).join(" ")} />)}
          {p.map((x) => (
            <circle key={x.fecha} className="vx-svg-toque" cx={X(x.fecha)} cy={Y(x.valor)} r={5}>
              <title>{`${fechaCorta(x.fecha)}: ${fmtPct(x.valor)} la marca${x.n !== null ? `, ${plural(x.n)}` : ""}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="vx-multiple-fechas" aria-hidden>
        <span>{fechaCorta(fechas[0])}</span>
        <span>{fechaCorta(fechas[fechas.length - 1])}</span>
      </div>
    </div>
  );
}
