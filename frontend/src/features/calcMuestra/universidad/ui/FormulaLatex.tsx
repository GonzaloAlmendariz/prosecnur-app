/**
 * Fórmula matemática en LaTeX (KaTeX) con procedencia y términos explicados:
 * la expresión se renderiza con el componente Math de la enciclopedia, y cada
 * símbolo puede llevar un chip interactivo (glosario + valor vivo del motor).
 * Regla del recorrido: si los valores sustituidos vienen del preview TS, el
 * badge debe ser "preview"; si vienen del motor R, "validado".
 */
import { Math as LatexMath } from "../../../../components/Math";
import { BadgeMotor } from "../../didactica/PasoDidactico";
import { TerminoChip } from "./TerminoChip";
import "./ui.css";

export type FormulaTermino = {
  /** Símbolo tal como aparece en la fórmula (ej. "z", "deff", "π_i"). */
  symbol: string;
  /** Término del GLOSARIO que lo explica. */
  termino: string;
  /** Valor vivo (formateado) del motor o preview. */
  value?: string;
};

export function FormulaLatex({
  expression,
  display = true,
  terms,
  badge,
  caption,
}: {
  expression: string;
  display?: boolean;
  terms?: FormulaTermino[];
  badge?: "validado" | "preview" | "error";
  caption?: string;
}) {
  return (
    <figure className="cmv2-uni-formula" role="group" aria-label={caption ?? "Fórmula"}>
      {(caption || badge) && (
        <div className="cmv2-uni-formula-head">
          {caption ? <span className="cmv2-uni-formula-caption">{caption}</span> : <span />}
          {badge && <BadgeMotor estado={badge} />}
        </div>
      )}
      <div className="cmv2-uni-formula-body">
        <LatexMath expression={expression} display={display} />
      </div>
      {terms && terms.length > 0 && (
        <div className="cmv2-uni-formula-terms" aria-label="Términos de la fórmula">
          {terms.map((term) => (
            <TerminoChip
              key={term.symbol}
              termino={term.termino}
              valor={term.value}
              triggerClassName="cmv2-uni-formula-term"
            >
              <code>{term.symbol}</code>
              {term.value != null && <strong>{term.value}</strong>}
            </TerminoChip>
          ))}
        </div>
      )}
    </figure>
  );
}
