import { Calculator, Loader2 } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { normalizeCalcMuestraMemoriaCalculo } from "../../../api/calcMuestraGeneral";
import { EmptyState } from "../../../components/States";
import { esTecnicaDeElementos } from "./modelo";
import { lineaDeAsignacion } from "./modeloParametros";
import "./general.css";

/**
 * Método › Memoria de cálculo: la cadena que va de Cochran al n a campo y al
 * error alcanzado, con la fórmula, los valores puestos en ella y el
 * resultado. Vive en Método, bajo los parámetros, porque es la consecuencia
 * directa de lo que se acaba de fijar; cambiar un parámetro borra el
 * resultado y la memoria cae con él, así que nunca describe otros valores.
 *
 * Sólo las técnicas de elementos tienen esta cadena: a las demás no se les
 * pinta una defensa que no es la suya.
 */
export function MemoriaCalculoGeneral({
  comp,
  calculando,
  onCalcular,
}: {
  comp: CalcMuestraComponente;
  calculando: boolean;
  onCalcular: () => void;
}) {
  if (!esTecnicaDeElementos(comp.tecnica)) return null;
  const pasos = normalizeCalcMuestraMemoriaCalculo(comp.resultado?.memoria_calculo);
  const calculado = Boolean(comp.resultado);
  const asignacion = lineaDeAsignacion(comp);

  return (
    <section className="cmv2-panel cmg-memoria" aria-labelledby="cmg-memoria-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Memoria de cálculo</span>
          <strong id="cmg-memoria-titulo">Cómo sale el n</strong>
        </div>
      </div>
      {asignacion && <p className="cmg-nota">{asignacion}</p>}
      {pasos.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Calculator size={18} aria-hidden="true" />}
          title={calculado ? "Este resultado no trae memoria" : "Aún no hay cálculo"}
          hint={calculado
            ? "Se calculó antes de que el motor publicara la memoria. Recalcula para verla."
            : "Calcula para ver la fórmula con estos parámetros sustituidos."}
          cta={(
            <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={calculando}>
              {calculando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Calculator size={14} aria-hidden="true" />}
              {calculado ? "Recalcular" : "Calcular"}
            </button>
          )}
        />
      ) : (
        <div className="cmg-tabla-wrap">
          <table className="cmg-tabla cmg-memoria-tabla">
            <caption className="cmg-sr-only">Memoria de cálculo del n</caption>
            <thead>
              <tr>
                <th scope="col">Paso</th>
                <th scope="col">Fórmula</th>
                <th scope="col">Sustitución</th>
                <th scope="col" className="cmg-num">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((p, i) => (
                <tr key={`${i}-${p.paso}`}>
                  <th scope="row">{p.paso}</th>
                  <td><code>{p.formula}</code></td>
                  <td><code>{p.sustitucion}</code></td>
                  <td className="cmg-num"><strong>{p.resultado}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
