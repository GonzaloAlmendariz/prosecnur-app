import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { tonoCss } from "../lienzo/tonos";
import { nombreDistrito } from "../nombres";

/**
 * Gráficas preliminares de la selección en el inspector de Territorio (pedido de
 * Gonzalo: aprovechar el espacio). Barras CSS, sin Plotly: el peso de cada distrito
 * en la población y el perfil NSE de las viviendas de lo elegido. Cada distrito usa
 * su tono de identidad (B9) en el orden de confirmación.
 */

export const NSE: [number, string, string][] = [
  [1, "Alto", "--pulso-nse-seq-1"],
  [2, "Medio alto", "--pulso-nse-seq-2"],
  [3, "Medio", "--pulso-nse-seq-3"],
  [4, "Medio bajo", "--pulso-nse-seq-4"],
  [5, "Bajo", "--pulso-nse-seq-5"],
  [0, "Sin dato", "--pulso-nse-seq-0"],
];

export const pct = (x: number) =>
  x > 0 && x < 0.001 ? "<0.1 %" : `${(x * 100).toLocaleString("es-PE", { maximumFractionDigits: x < 0.1 ? 1 : 0 })} %`;
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

type Props = {
  elegidos: readonly HojasRutaTerritory[];
  confirmados: readonly string[];
  /** Viviendas por nivel NSE (0 = sin dato) de las manzanas cargadas de lo elegido; null si aún no hay geometría. */
  viviendasPorNse: Record<number, number> | null;
};

export function TerritorioGraficos({ elegidos, confirmados, viviendasPorNse }: Props) {
  if (!elegidos.length) return null;
  const total = elegidos.reduce((a, t) => a + t.poblacion, 0) || 1;
  const orden = [...elegidos].sort((a, b) => b.poblacion - a.poblacion);
  const max = orden[0]?.poblacion || 1;
  const nseTotal = viviendasPorNse ? Object.values(viviendasPorNse).reduce((a, v) => a + v, 0) : 0;
  return (
    <>
      <section className="hr-graf" aria-label="Peso de cada distrito en la población">
        <h3 className="hr-graf-titulo">Peso de cada distrito</h3>
        <ul className="hr-graf-barras">
          {orden.map((t) => {
            const i = confirmados.indexOf(t.ubigeo);
            const color = tonoCss(i);
            return (
              <li key={t.ubigeo}>
                <span className="hr-graf-nombre">{nombreDistrito(t.distrito)}</span>
                <span className="hr-graf-pista"><i style={{ width: `${(t.poblacion / max) * 100}%`, background: color }} /></span>
                <span className="hr-graf-valor">{pct(t.poblacion / total)}</span>
              </li>
            );
          })}
        </ul>
        <p className="hr-graf-nota">De {fmt(total)} habitantes (Censo 2017).</p>
      </section>
      <section className="hr-graf" aria-label="Perfil socioeconómico de las viviendas">
        <h3 className="hr-graf-titulo">Perfil socioeconómico</h3>
        {viviendasPorNse && nseTotal > 0 ? (
          <>
            <div className="hr-graf-apilada" role="img" aria-label={NSE.map(([n, l]) => `${l} ${pct((viviendasPorNse[n] ?? 0) / nseTotal)}`).join(", ")}>
              {NSE.map(([n, l, t]) => ((viviendasPorNse[n] ?? 0) > 0 ? <i key={n} title={`${l}: ${pct((viviendasPorNse[n] ?? 0) / nseTotal)}`} style={{ flexGrow: viviendasPorNse[n], background: `var(${t})` }} /> : null))}
            </div>
            <ul className="hr-graf-leyenda">
              {NSE.filter(([n]) => (viviendasPorNse[n] ?? 0) > 0).map(([n, l, t]) => (
                <li key={n}><i style={{ background: `var(${t})` }} />{l} <b>{pct((viviendasPorNse[n] ?? 0) / nseTotal)}</b></li>
              ))}
            </ul>
            <p className="hr-graf-nota">Viviendas de las manzanas de lo elegido, por nivel socioeconómico de la manzana.</p>
          </>
        ) : (
          <p className="hr-graf-nota">El perfil aparece cuando el mapa termina de cargar las manzanas de los distritos elegidos.</p>
        )}
      </section>
    </>
  );
}
