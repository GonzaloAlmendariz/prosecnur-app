import type { CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { formatearEntero, formatearFechaUtc, hashCorto } from "./modelo";

const ESTRATOS_VISIBLES = 12;

/** Lo que quedó declarado: N, estratos con N_h y la huella del archivo. */
export function ResumenMarcoDeclarado({ marco }: { marco: CalcMuestraGeneralMarco }) {
  const conEstrato = Boolean(marco.columnas.estrato);
  const visibles = marco.estratos.slice(0, ESTRATOS_VISIBLES);
  const resto = marco.estratos.slice(ESTRATOS_VISIBLES);
  return (
    <div className="cmg-resumen-marco">
      <dl
        className="cmg-metricas"
        data-qa-geometry-group="calc-muestra/general-marco-metricas"
        data-qa-geometry-contract="equal"
      >
        <div className="cmg-metrica" data-qa-geometry-member>
          <dt>N del marco</dt>
          <dd>{formatearEntero(marco.N)}</dd>
        </div>
        <div className="cmg-metrica" data-qa-geometry-member>
          <dt>Estratos</dt>
          <dd>{conEstrato ? formatearEntero(marco.estratos.length) : "Sin estrato"}</dd>
        </div>
        <div className="cmg-metrica" data-qa-geometry-member>
          <dt>Columnas</dt>
          <dd className="cmg-columnas-declaradas">
            <code>{marco.columnas.id}</code>
            {marco.columnas.estrato && <> · <code>{marco.columnas.estrato}</code></>}
            {marco.columnas.tamano && <> · <code>{marco.columnas.tamano}</code></>}
          </dd>
        </div>
        <div className="cmg-metrica" data-qa-geometry-member>
          <dt>Huella</dt>
          <dd><code title={marco.marco_hash}>{hashCorto(marco.marco_hash)}</code></dd>
        </div>
      </dl>
      <p className="cmg-nota">
        {marco.hoja ? <>Hoja <strong>{marco.hoja}</strong> · </> : null}
        declarado {formatearFechaUtc(marco.declarado_at)}. El N del cálculo sale de este archivo.
      </p>
      {conEstrato && marco.estratos.length > 0 && (
        <div className="cmg-estratos-marco">
          <table className="cmg-tabla cmg-tabla--compacta">
            <caption className="cmg-sr-only">N por estrato del marco</caption>
            <thead>
              <tr><th scope="col">Estrato</th><th scope="col" className="cmg-num cmg-simbolo">N<sub>h</sub></th></tr>
            </thead>
            <tbody>
              {visibles.map((e) => (
                <tr key={e.clave}><td>{e.clave}</td><td className="cmg-num">{formatearEntero(e.N_h)}</td></tr>
              ))}
            </tbody>
          </table>
          {resto.length > 0 && (
            <details className="cmg-mas">
              <summary>Ver {resto.length} estratos más</summary>
              <table className="cmg-tabla cmg-tabla--compacta">
                <caption className="cmg-sr-only">N por estrato del marco (continuación)</caption>
                <tbody>
                  {resto.map((e) => (
                    <tr key={e.clave}><td>{e.clave}</td><td className="cmg-num">{formatearEntero(e.N_h)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
