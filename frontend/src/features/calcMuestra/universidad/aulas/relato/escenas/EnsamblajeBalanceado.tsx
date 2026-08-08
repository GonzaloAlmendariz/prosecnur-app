/**
 * Panel «El ensamblaje balanceado» (iteración cube, dirección 2026-08-07).
 *
 * Muestra QUÉ significa balancear: la composición de la muestra convergiendo a
 * la del marco en las variables de balance que la corrida DECLARÓ. Las barras
 * son CONTEOS de filas publicadas rotulados «composición» — la cifra oficial
 * de parecido es la que R publica (`representativity_score`); aquí no se
 * calcula ningún estimador ni se pondera por π (regla I20).
 *
 * La convergencia ya no corre con reloj propio: el tick de las barras lo
 * gobierna la bola ATERRIZADA del ensamblaje (prop `ensambladas`, polish
 * 2026-08-07) siguiendo el orden PUBLICADO de lectura — el sorteo balanceado
 * es simultáneo y la escena lo dice. Con `prefers-reduced-motion` el padre
 * pasa el total y las barras nacen en su composición final.
 */
import { fmtInt, fmtPct } from "../../../../sharedCore";
import {
  serieDeConvergencia,
  type RelatoBalance,
  type RelatoBalanceVariable,
} from "../relatoModel";
import { RelatoCifra } from "./relatoPartes";

/** Tope de categorías dibujadas por variable; el resto se declara en cifra. */
const CATEGORIAS_MAX = 8;

function BarrasVariable({
  variable,
  ensambladas,
}: {
  variable: RelatoBalanceVariable;
  /** Bolas ya ensambladas (índice de la serie de convergencia). */
  ensambladas: number;
}) {
  const serie = serieDeConvergencia(variable);
  const parcial = ensambladas > 0 ? serie[Math.min(ensambladas, serie.length) - 1] : {};
  const totalParcial = Object.values(parcial).reduce((a, b) => a + b, 0);
  const visibles = variable.categorias.slice(0, CATEGORIAS_MAX);
  const ocultas = variable.categorias.length - visibles.length;
  return (
    <div className="cmv2-relato-balance-variable">
      <h4 className="cmv2-relato-balance-titulo">{variable.etiqueta}</h4>
      <ul className="cmv2-relato-balance-lista">
        {visibles.map((categoria) => {
          const muestraParcialN = parcial[categoria.categoria] ?? 0;
          const muestraParcialPct = totalParcial > 0 ? muestraParcialN / totalParcial : 0;
          return (
            <li key={categoria.categoria} className="cmv2-relato-balance-fila">
              <span className="cmv2-relato-balance-cat">{categoria.categoria}</span>
              <span className="cmv2-relato-balance-barras">
                <span className="cmv2-relato-balance-pista" aria-hidden="true">
                  <span
                    className="cmv2-relato-balance-marco"
                    style={{ width: `${Math.round(categoria.marcoPct * 100)}%` }}
                  />
                </span>
                <span className="cmv2-relato-balance-pista" aria-hidden="true">
                  <span
                    className="cmv2-relato-balance-muestra"
                    style={{ width: `${Math.round(muestraParcialPct * 100)}%` }}
                  />
                </span>
              </span>
              <span className="cmv2-relato-balance-cifras">
                marco {fmtPct(categoria.marcoPct)} · muestra{" "}
                {ensambladas >= serie.length
                  ? `${fmtPct(categoria.muestraPct)} (${fmtInt(categoria.muestraN)})`
                  : fmtPct(muestraParcialPct)}
              </span>
            </li>
          );
        })}
      </ul>
      {ocultas > 0 && (
        <p className="cmv2-relato-nota">+{fmtInt(ocultas)} categorías más del marco.</p>
      )}
    </div>
  );
}

export function EnsamblajeBalanceado({
  balance,
  ensambladas,
}: {
  balance: RelatoBalance;
  /** Bolas ya aterrizadas en el ensamblaje: gobierna el tick de las barras. */
  ensambladas: number;
}) {
  return (
    <section className="cmv2-relato-balance" aria-label="Balance del ensamblaje: composición marco vs muestra">
      <div className="cmv2-relato-cifras">
        <RelatoCifra
          label="Calidad representativa (motor R)"
          valor={balance.score == null ? "—" : `${balance.score}`}
          detalle="cifra oficial del balance"
          realce
        />
        {balance.distancia != null && (
          <RelatoCifra label="Distancia ponderada" valor={`${balance.distancia}`} />
        )}
        <RelatoCifra
          label="Variables de balance declaradas"
          valor={balance.declaradas.length ? balance.declaradas.join(" · ") : "—"}
        />
      </div>
      <p className="cmv2-relato-nota">
        {balance.notaOrden} Las barras son composición por conteo de filas
        publicadas, no una prueba de equivalencia estadística.
      </p>
      {balance.dispersion != null && balance.dispersion.length > 0 && (
        <p className="cmv2-relato-nota">
          Dispersión aplicada con: {balance.dispersion.join(", ")}.
        </p>
      )}
      <div className="cmv2-relato-balance-leyenda" aria-hidden="true">
        <span className="is-marco">marco</span>
        <span className="is-muestra">muestra (composición)</span>
      </div>
      {balance.variables.map((variable) => (
        <BarrasVariable key={variable.variable} variable={variable} ensambladas={ensambladas} />
      ))}
    </section>
  );
}
