import { Plus } from "lucide-react";
import { fmt } from "../formato";
import { marcasDeEje } from "./avanceModelo";
import type { VariableDeControl } from "./composicionModelo";

const UNA_DECIMAL = (valor: number) => valor.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function pp(valor: number | null) {
  if (valor == null) return "—";
  return `${valor > 0 ? "+" : ""}${UNA_DECIMAL(valor)} pp`;
}

/**
 * Composición de una variable de control sin meta: por categoría, el % del
 * universo (anillo) frente al % de las efectivas (punto lleno), en la misma
 * escala, con la diferencia en puntos al lado.
 */
export function PesasDeComposicion({ variable, onDefinirCuota }: { variable: VariableDeControl; onDefinirCuota: () => void }) {
  const maximo = Math.max(1, ...variable.filas.flatMap((fila) => [fila.pctBase ?? 0, fila.pctEfectivas ?? 0]));
  const marcas = marcasDeEje(maximo);
  const tope = marcas.at(-1) ?? 100;
  const x = (valor: number) => `${Math.min(100, (valor / tope) * 100)}%`;
  return (
    <section className="acr-av-panel acr-ps-tabla acr-pc-detalle" aria-label={`Composición de ${variable.actor} por ${variable.variable}`}>
      <header className="acr-av-panel-cabecera">
        <h3>
          {`${variable.actor}, ${variable.variable}`}
          <span className="acr-av-chip">Sin meta</span>
          <span className="acr-av-tenue" title="Mayor diferencia entre el % de las efectivas y el % del universo">{`Máx. ${pp(variable.maxDelta)}`}</span>
        </h3>
        <button type="button" className="acr-av-boton" onClick={onDefinirCuota}><Plus size={14} aria-hidden="true" /> Definir cuota en Modelo</button>
      </header>
      <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
        <div className="acr-pc-pesas" role="table" aria-label={`% del universo frente a % de las efectivas por ${variable.variable}`}>
          <div className="acr-pc-fila is-eje" role="row">
            <span role="columnheader">Categoría</span>
            <span role="columnheader" className="acr-pc-escala">
              <span className="acr-pc-eje-titulo">% del público</span>
              {marcas.map((valor, indice) => <span key={valor} className="acr-pc-marca" style={{ left: x(valor), transform: indice === 0 ? "none" : indice === marcas.length - 1 ? "translateX(-100%)" : undefined }}>{fmt(valor)}</span>)}
            </span>
            <span role="columnheader" className="is-num">Diferencia</span>
          </div>
          {variable.filas.map((fila) => (
            <div key={fila.categoria} className="acr-pc-fila" role="row">
              <span role="rowheader" title={fila.categoria}>{fila.categoria}</span>
              <span
                role="cell"
                className="acr-pc-pista"
                aria-label={`${fila.pctBase == null ? "—" : `${UNA_DECIMAL(fila.pctBase)} %`} del universo, ${fila.pctEfectivas == null ? "—" : `${UNA_DECIMAL(fila.pctEfectivas)} %`} de las efectivas`}
              >
                {fila.pctBase != null && fila.pctEfectivas != null ? (
                  <i className="acr-pc-tramo" style={{ left: x(Math.min(fila.pctBase, fila.pctEfectivas)), width: `calc(${x(Math.abs(fila.pctEfectivas - fila.pctBase))})` }} />
                ) : null}
                {fila.pctBase != null ? <i className="acr-pc-anillo" style={{ left: x(fila.pctBase) }} /> : null}
                {fila.pctEfectivas != null ? <i className="acr-pc-punto" style={{ left: x(fila.pctEfectivas) }} /> : null}
              </span>
              <b role="cell" className={`is-num acr-av-num${fila.delta != null && Math.abs(fila.delta) >= 2 ? " is-marcada" : ""}`}>{pp(fila.delta)}</b>
            </div>
          ))}
        </div>
      </div>
      <ul className="acr-pc-leyenda" aria-label="Lectura">
        <li><i className="acr-pc-anillo" aria-hidden="true" /> % del universo</li>
        <li><i className="acr-pc-punto" aria-hidden="true" /> % de las efectivas</li>
      </ul>
    </section>
  );
}
