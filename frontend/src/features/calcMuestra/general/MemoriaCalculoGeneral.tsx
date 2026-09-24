import { Calculator, Loader2 } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { normalizeCalcMuestraMemoriaCalculo } from "../../../api/calcMuestraGeneral";
import { Math as LatexMath } from "../../../components/Math";
import { EmptyState } from "../../../components/States";
import { FormulaLatex } from "../universidad/ui";
import { latexDeFormula, terminosDeMemoria } from "./memoriaLatex";
import { esTecnicaDeElementos } from "./modelo";
import { lineaDeAsignacion } from "./modeloParametros";
import "./general.css";
import "./mesa.css";

/**
 * Método › Memoria de cálculo: la cadena que va de Cochran al n a campo y al
 * error alcanzado, con la fórmula, los valores puestos en ella y el
 * resultado. Vive en Método, bajo los parámetros, porque es la consecuencia
 * directa de lo que se acaba de fijar; cambiar un parámetro borra el
 * resultado y la memoria cae con él, así que nunca describe otros valores.
 *
 * La primera fórmula se pinta grande con su glosario (`FormulaLatex` +
 * `TerminoChip`, como en aulas); los pasos siguientes, en línea. KaTeX pinta
 * HTML sin MathML, así que cada fórmula lleva su texto plano para lectores de
 * pantalla.
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
  const principal = pasos.find((p) => latexDeFormula(p.formula) != null) ?? null;
  const latexPrincipal = principal ? latexDeFormula(principal.formula) : null;

  return (
    <section className="cmv2-panel cmg-memoria" aria-labelledby="cmg-memoria-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Memoria de cálculo</span>
          <h3 id="cmg-memoria-titulo" className="cmg-panel-titulo">Cómo sale el n</h3>
        </div>
        {pasos.length > 0 && <span className="cmv2-pill-soft">{pasos.length} pasos</span>}
      </div>
      {asignacion && <p className="cmg-nota">{asignacion}</p>}
      {pasos.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Calculator size={18} aria-hidden="true" />}
          title={calculado ? "Sin memoria de cálculo" : "Aún no hay cálculo"}
          hint={calculado
            ? "Calcula para ver la fórmula con estos parámetros."
            : "Calcula para ver la fórmula con estos parámetros sustituidos."}
          cta={(
            <button type="button" className="cmv2-primary" onClick={() => onCalcular()} disabled={calculando}>
              {calculando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Calculator size={14} aria-hidden="true" />}
              {calculado ? "Recalcular" : "Calcular"}
            </button>
          )}
        />
      ) : (
        <div className="cmg-memoria-cuerpo-general">
          {principal && latexPrincipal && (
            <div className="cmg-memoria-principal">
              <FormulaLatex
                expression={latexPrincipal}
                caption={principal.paso}
                badge="validado"
                terms={terminosDeMemoria(comp)}
                nota={<>Con estos valores: <code>{principal.sustitucion}</code> = <strong>{principal.resultado}</strong></>}
              />
              <span className="pulso-sr-only">Fórmula: {principal.formula}</span>
            </div>
          )}
          <ol
            className="cmg-memoria-pasos"
            aria-label="Pasos del cálculo"
            data-qa-geometry-group="calc-muestra/general-memoria-pasos"
            data-qa-geometry-contract="intrinsic"
          >
            {pasos.map((p, i) => {
              const latex = latexDeFormula(p.formula);
              return (
                <li key={`${i}-${p.paso}`} className="cmg-memoria-paso" data-paso={i + 1} data-qa-geometry-member>
                  <span className="cmg-memoria-num" aria-hidden="true">{i + 1}</span>
                  <div className="cmg-memoria-que">
                    <h4 className="cmg-memoria-paso-titulo">{p.paso}</h4>
                    {latex ? (
                      <span className="cmg-memoria-formula">
                        <span aria-hidden="true"><LatexMath expression={latex} /></span>
                        <span className="pulso-sr-only">{p.formula}</span>
                      </span>
                    ) : p.formula ? (
                      <code className="cmg-memoria-formula-texto">{p.formula}</code>
                    ) : null}
                  </div>
                  <div className="cmg-memoria-con">
                    <span className="cmg-memoria-rotulo">Sustitución</span>
                    <code className="cmg-memoria-sustitucion">{p.sustitucion}</code>
                  </div>
                  <div className="cmg-memoria-resultado">
                    <span className="cmg-memoria-rotulo">Resultado</span>
                    <strong>{p.resultado}</strong>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
