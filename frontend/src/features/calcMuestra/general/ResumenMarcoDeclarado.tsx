import type { CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { fmtInt } from "../sharedCore";
import { CifraFila, CifraMotor } from "../universidad/ui";
import { formatearFechaLocal, hashCorto } from "./modelo";
import "./mesa.css";

const ESTRATOS_VISIBLES = 12;

/** Lo que quedó declarado: N, estratos con N_h y la huella del archivo. */
export function ResumenMarcoDeclarado({ marco }: { marco: CalcMuestraGeneralMarco }) {
  const conEstrato = Boolean(marco.columnas.estrato);
  const visibles = marco.estratos.slice(0, ESTRATOS_VISIBLES);
  const resto = marco.estratos.slice(ESTRATOS_VISIBLES);
  const columnas = [marco.columnas.id, marco.columnas.estrato, marco.columnas.tamano].filter(Boolean).join(" · ");
  return (
    <div className="cmg-resumen-marco">
      <CifraFila>
        <CifraMotor label="Tamaño del marco (N)" value={fmtInt(marco.N)} detalle="unidades en el archivo" hero />
        <CifraMotor
          label="Estratos"
          value={conEstrato ? fmtInt(marco.estratos.length) : "Sin estrato"}
          detalle={conEstrato ? `columna ${marco.columnas.estrato}` : "un solo grupo"}
        />
        <CifraMotor label="Columnas" value={columnas} detalle="id · estrato · tamaño" monospace />
        <CifraMotor
          label="Declarado"
          value={formatearFechaLocal(marco.declarado_at)}
          detalle={marco.hoja ? `hoja ${marco.hoja}` : undefined}
        />
      </CifraFila>
      <p className="cmg-nota">
        Huella <code className="cmg-huella" title={marco.marco_hash}>{hashCorto(marco.marco_hash)}</code>
        {" "}(SHA-256). El N del cálculo sale de este archivo.
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
                <tr key={e.clave}><td>{e.clave}</td><td className="cmg-num">{fmtInt(e.N_h)}</td></tr>
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
                    <tr key={e.clave}><td>{e.clave}</td><td className="cmg-num">{fmtInt(e.N_h)}</td></tr>
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
