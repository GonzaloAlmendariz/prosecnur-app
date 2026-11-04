import type { ExploradorCruceCaja } from "../../../../api/validacionExplorar";
import { ALTO_DEL_EJE_DE_FECHAS, EjeDeFechas } from "../../../monitoreo/core/ejeDeFechas";
import { escalaLinda, fechaCorta, proyectar } from "./escalas";
import { esResidual, fmtN, fmtPct, fmtValor } from "./explorarModelo";
import { useAncho } from "./useAncho";

/** Bajo este número de casos el grupo se atenúa: su caja es frágil. */
export const GRUPO_CHICO = 30;
const ALTO_FILA = 46;

const sumarDias = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + Math.round(d) * 864e5).toISOString().slice(0, 10);

/** Tono de cada caja: con tres grupos o menos, el de cada grupo; con más, todas en navy; las residuales, en gris. */
function tonoDe(g: ExploradorCruceCaja, i: number, total: number): string {
  if (esResidual(g.etiqueta)) return "var(--vx-resid)";
  if (total > 3) return "var(--vx-mayor)";
  return ["var(--vx-g1)", "var(--vx-g2)", "var(--vx-g3)"][i] ?? "var(--vx-resto)";
}

/**
 * Diferencia entre dos fechas (E8g) cuando casi toda vale cero: una caja aplastada contra el 0 no dice nada, así
 * que se dice en cifras. Con IQR cero, todo caso que no coincide es un atípico del motor.
 */
export function diferenciaEnCifras(g: ExploradorCruceCaja): { coinciden: number; distintos: number; pctCoinciden: number } | null {
  if (g.p25 !== 0 || g.p75 !== 0 || g.mediana !== 0) return null;
  const distintos = g.min === 0 && g.max === 0 ? 0 : g.n_atipicos;
  return { coinciden: g.n - distintos, distintos, pctCoinciden: g.n > 0 ? (100 * (g.n - distintos)) / g.n : 0 };
}

/**
 * E8e, E8f — cajas por grupo en una escala común con su rejilla: la caja es la mitad central (p25 a p75), la línea
 * gruesa la mediana (rotulada), los bigotes van del mínimo al máximo y el n queda junto a su caja. Un grupo con menos
 * de 30 casos se atenúa. Con una fecha, el eje es el de dos líneas de Monitoreo sobre la fecha de origen.
 */
export default function CruceCajas({
  grupos,
  origen = null,
  unidad = "",
}: {
  grupos: readonly ExploradorCruceCaja[];
  /** Día cero de una fecha: el eje se rotula con fechas y la mediana con su día. */
  origen?: string | null;
  /** Unidad del valor, escrita junto a la mediana (« días»). */
  unidad?: string;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  if (!grupos.length) return <p className="vx-pie">Sin grupos con valores para comparar.</p>;
  const W = Math.max(320, ancho);
  const largo = Math.max(...grupos.map((g) => g.etiqueta.length));
  const izq = Math.min(Math.round(W * 0.3), Math.max(90, largo * 7.4 + 20));
  const der = 70;
  const util = W - izq - der;
  const min = Math.min(...grupos.map((g) => g.min));
  const max = Math.max(...grupos.map((g) => g.max));
  const e = escalaLinda(min, max, origen ? 5 : 6);
  const X = (v: number) => izq + proyectar(v, e, util);
  const arr = 22;
  const altoFilas = grupos.length * ALTO_FILA;
  const abajo = arr + altoFilas;
  const aba = origen ? ALTO_DEL_EJE_DE_FECHAS + 6 : 28;
  const H = abajo + aba;
  const rotulo = (v: number) => (origen ? fechaCorta(sumarDias(origen, v)) : `${fmtValor(v)}${unidad}`);
  // Con fechas: un rótulo por día, del primero al último del rango, y el eje de Monitoreo decide cuáles caben.
  const dias = origen ? Array.from({ length: Math.floor(e.hasta) - Math.ceil(e.desde) + 1 }, (_, i) => Math.ceil(e.desde) + i) : [];
  const pasoDia = dias.length > 1 ? X(dias[1]) - X(dias[0]) : util;
  return (
    <div ref={ref} className="vx-svg-caja">
      <svg className="vx-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cajas de ${grupos.length} grupos en la misma escala`}>
        {(origen ? [] : e.marcas).map((v) => (
          <g key={`m${v}`}>
            <line className="vx-svg-rejilla is-vertical" x1={X(v)} x2={X(v)} y1={arr - 8} y2={abajo} />
            <text className="vx-svg-marca" x={X(v)} y={abajo + 18} textAnchor="middle">{rotulo(v)}</text>
          </g>
        ))}
        {origen &&
          dias
            .filter((d) => new Date(Date.parse(`${sumarDias(origen, d)}T00:00:00Z`)).getUTCDay() === 1)
            .map((d) => <line key={`s${d}`} className="vx-svg-rejilla is-vertical" x1={X(d)} x2={X(d)} y1={arr - 8} y2={abajo} />)}
        <line className="vx-svg-eje" x1={izq} x2={izq + util} y1={abajo} y2={abajo} />
        {grupos.map((g, i) => {
          const y = arr + i * ALTO_FILA + ALTO_FILA / 2 + 4;
          const tono = tonoDe(g, i, grupos.length);
          const chico = g.n < GRUPO_CHICO;
          return (
            <g key={`${g.etiqueta}-${i}`} className={`vx-svg-grupo${chico ? " is-chico" : ""}`}>
              <title>
                {[
                  g.etiqueta,
                  `Mediana ${rotulo(g.mediana)} · mitad central ${rotulo(g.p25)} a ${rotulo(g.p75)}`,
                  `Mínimo ${rotulo(g.min)} · máximo ${rotulo(g.max)}${g.n_atipicos ? ` · ${fmtN(g.n_atipicos)} atípicos` : ""}`,
                  `${fmtN(g.n)} ${g.n === 1 ? "caso" : "casos"}${chico ? " · base chica" : ""}`,
                ].join("\n")}
              </title>
              <text className="vx-svg-categoria" x={izq - 14} y={y + 4} textAnchor="end">{g.etiqueta}</text>
              <line className="vx-svg-bigote" x1={X(g.min)} x2={X(g.p25)} y1={y} y2={y} />
              <line className="vx-svg-bigote" x1={X(g.p75)} x2={X(g.max)} y1={y} y2={y} />
              <line className="vx-svg-bigote" x1={X(g.min)} x2={X(g.min)} y1={y - 6} y2={y + 6} />
              <line className="vx-svg-bigote" x1={X(g.max)} x2={X(g.max)} y1={y - 6} y2={y + 6} />
              <rect x={X(g.p25)} y={y - 11} width={Math.max(3, X(g.p75) - X(g.p25))} height={22} rx={5} style={{ fill: tono, fillOpacity: 0.16, stroke: tono, strokeWidth: 1.4 }} />
              <line x1={X(g.mediana)} x2={X(g.mediana)} y1={y - 13} y2={y + 13} style={{ stroke: tono, strokeWidth: 3, strokeLinecap: "round" }} />
              <text className="vx-svg-valor" x={X(g.mediana)} y={y - 18} textAnchor="middle">{rotulo(g.mediana)}</text>
              <text className="vx-svg-marca" x={X(g.max) + 10} y={y + 4}>{`n ${fmtN(g.n)}`}</text>
            </g>
          );
        })}
        {origen && <EjeDeFechas fechas={dias.map((d) => sumarDias(origen, d))} paso={pasoDia} x={(i) => X(dias[i])} alto={H} />}
      </svg>
    </div>
  );
}

/** E8g — la diferencia entre dos fechas dicha en cifras, cuando casi toda es cero. */
export function DiferenciaEnCifras({ cifras, mediana }: { cifras: NonNullable<ReturnType<typeof diferenciaEnCifras>>; mediana: number }) {
  return (
    <div className="vx-cifras-grandes">
      <div><b>{fmtPct(cifras.pctCoinciden)}</b><small>coinciden en el día</small></div>
      <div><b>{fmtN(cifras.distintos)}</b><small>{cifras.distintos === 1 ? "caso con otro día" : "casos con otro día"}</small></div>
      <div><b>{`${fmtValor(mediana)} días`}</b><small>diferencia mediana</small></div>
    </div>
  );
}
