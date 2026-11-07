import { ALTO_DEL_EJE_DE_FECHAS, EjeDeFechas } from "../../../monitoreo/core/ejeDeFechas";
import EjesSvg, { anchoUtil, type Marco, yDe } from "./EjesSvg";
import { escalaDesdeCero, fechaCorta } from "./escalas";
import { fmtN } from "./explorarModelo";
import { useAncho } from "./useAncho";

const ALTO = 260;
/** D3: si la tarjeta se estira (la ficha de al lado es más alta), el gráfico la llena hasta este tope. */
const ALTO_MAX = 520;

const esDomingo = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;

/**
 * E6 — fecha: una barra por día, en la escala de casos con su rejilla. El día con
 * más casos va en navy y se rotula; los domingos, en el tono claro; un día sin
 * casos queda como hueco, no desaparece. El eje es el de los gráficos diarios de
 * Monitoreo (core/ejeDeFechas, pedido de Gonzalo del 3/11): el número del día bajo
 * su barra y el mes en una segunda línea, sólo donde empieza.
 */
export default function DistribucionFecha({ dias }: { dias: readonly { fecha: string; n: number }[] }) {
  const [ref, ancho, alto] = useAncho<HTMLDivElement>();
  if (!dias.length) {
    // Un campo de hora (`time`) llega como fecha sin día legible: no hay eje que dibujar.
    return <p className="vx-pie">Sin fechas legibles que contar: si el campo registra sólo la hora, no hay días que dibujar.</p>;
  }
  const marco: Marco = { W: Math.max(320, ancho), H: Math.min(ALTO_MAX, Math.max(ALTO, alto)), izq: 44, der: 8, arr: 24, aba: ALTO_DEL_EJE_DE_FECHAS + 6 };
  const pico = dias.reduce((m, d) => (d.n > m.n ? d : m), dias[0]);
  const y = escalaDesdeCero(pico.n, 4);
  const paso = anchoUtil(marco) / dias.length;
  const ancho1 = Math.max(2, Math.min(28, paso * 0.72));
  const centro = (i: number) => marco.izq + (i + 0.5) * paso;
  const ip = dias.indexOf(pico);
  const hayDomingo = dias.some((d) => esDomingo(d.fecha));
  return (
    <>
    <div ref={ref} className="vx-svg-caja is-llena" style={{ minHeight: ALTO }}>
      <svg
        className="vx-svg"
        width={marco.W}
        height={marco.H}
        viewBox={`0 0 ${marco.W} ${marco.H}`}
        role="img"
        aria-label={`Casos por día del ${fechaCorta(dias[0].fecha)} al ${fechaCorta(dias[dias.length - 1].fecha)}; el día con más casos es el ${fechaCorta(pico.fecha)}, con ${fmtN(pico.n)}`}
      >
        <EjesSvg marco={marco} y={y} rotuloY={fmtN} marcasX={[]} />
        {dias.map((d, i) => {
          const domingo = esDomingo(d.fecha);
          const clase = d === pico ? "is-mayor" : domingo ? "is-claro" : "";
          return (
            <rect
              key={d.fecha}
              className={`vx-svg-columna ${clase}`}
              x={centro(i) - ancho1 / 2}
              y={yDe(marco, d.n, y)}
              width={ancho1}
              height={Math.max(0, yDe(marco, 0, y) - yDe(marco, d.n, y))}
              rx={Math.min(3, ancho1 / 4)}
            >
              <title>{`${fechaCorta(d.fecha)}${domingo ? ", domingo" : ""}: ${fmtN(d.n)} ${d.n === 1 ? "caso" : "casos"}`}</title>
            </rect>
          );
        })}
        <text className="vx-svg-anota" x={centro(ip)} y={yDe(marco, pico.n, y) - 7} textAnchor="middle">
          {`${fmtN(pico.n)}, ${fechaCorta(pico.fecha)}`}
        </text>
        <EjeDeFechas fechas={dias.map((d) => d.fecha)} paso={paso} x={centro} alto={marco.H} />
      </svg>
    </div>
    {hayDomingo && (
      <div className="vx-leyenda">
        <span><i className="vx-muestra is-claro" aria-hidden />Domingo</span>
      </div>
    )}
    </>
  );
}
