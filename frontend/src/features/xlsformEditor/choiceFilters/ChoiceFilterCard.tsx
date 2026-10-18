// =============================================================================
// choiceFilters/ChoiceFilterCard.tsx — una ficha de la vista «Filtros de opciones»
// =============================================================================
// Cuatro estratos de lo humano a lo técnico (spec §6):
//   1. Contexto (sección) — antetítulo discreto.
//   2. La pregunta — etiqueta humana como título; el código detrás, atenuado.
//   3. La explicación en una frase — lenguaje natural.
//   4. La correspondencia — tabla semántica antecedente → opción habilitada,
//      o, cuando no es derivable (spec §9), la lista de antecedentes.
// Al pie, «Ver regla técnica», plegado por defecto, y el `pie` que ponga la
// pestaña («Editar en Constructor»). Un antecedente que también tiene filtro se
// elige ahí mismo (ítem 50: nada de esta ficha navega al Constructor).
// =============================================================================

import { useState, type ReactNode } from "react";
import { ArrowRight, ChevronRight, Filter } from "../../../vendor/lucide-react";
import type { ChoiceFilterCard as Card } from "./buildChoiceFilterModel";
import { TituloLegible } from "../kit/CuerpoPanelMarca";

type Props = {
  card: Card;
  /** Elige, en la misma pestaña, el filtro de un antecedente que también tiene uno. */
  onElegirAntecedente?: (rowIndex: number) => void;
  esElegible?: (rowIndex: number) => boolean;
  /** Pie de la ficha: «Editar en Constructor». */
  pie?: ReactNode;
};

function Antecedente({ rowIndex, label, onElegir, esElegible }: {
  rowIndex: number | null;
  label: string;
  onElegir?: (rowIndex: number) => void;
  esElegible?: (rowIndex: number) => boolean;
}) {
  if (rowIndex == null || !onElegir || !esElegible?.(rowIndex)) return <span><TituloLegible texto={label} /></span>;
  return (
    <button type="button" className="pulso-xcf-jump" onClick={() => onElegir(rowIndex)} title="Ver el filtro de esta pregunta">
      <TituloLegible texto={label} />
      <ChevronRight size={11} aria-hidden="true" />
    </button>
  );
}

export function ChoiceFilterCard({ card, onElegirAntecedente, esElegible, pie }: Props) {
  const [ruleOpen, setRuleOpen] = useState(false);

  return (
    <article className="pulso-xcf-card">
      <header className="pulso-xcf-card-head">
        {card.sectionLabel ? (
          <span className="pulso-xcf-eyebrow">{card.sectionLabel}</span>
        ) : null}
        <h3 className="pulso-xcf-title">
          <span className="pulso-xcf-title-icon" aria-hidden="true">
            <Filter size={15} />
          </span>
          <span className="pulso-xcf-title-text"><TituloLegible texto={card.questionLabel} /></span>
          {card.questionCode ? (
            <span className="pulso-xcf-code" aria-hidden="true">
              {card.questionCode}
            </span>
          ) : null}
        </h3>
        <p className="pulso-xcf-explanation">{card.explanation}</p>
        {/* El aviso del motor (comillas tipográficas…) va aparte de la frase, igual que en el detalle sin respuestas. */}
        {card.aviso ? <p className="pulso-xcf-explanation pulso-xcf-aviso-motor" role="note">{card.aviso}</p> : null}
      </header>

      {card.mode === "matrix" && card.pairs.length > 0 ? (
        <table className="pulso-xcf-table">
          <colgroup>
            <col className="pulso-xcf-col-antecedent" />
            <col className="pulso-xcf-col-arrow" />
            <col className="pulso-xcf-col-option" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Si la persona reportó…</th>
              <th scope="col" className="pulso-xcf-th-arrow" aria-hidden="true"></th>
              <th scope="col">…puede elegir esta opción</th>
            </tr>
          </thead>
          <tbody>
            {card.pairs.map((pair, idx) => (
                <tr key={`${pair.optionName}-${idx}`} className="pulso-xcf-row">
                  <td className="pulso-xcf-cell-antecedent">
                    <Antecedente rowIndex={pair.antecedent.rowIndex} label={pair.antecedent.label}
                      onElegir={onElegirAntecedente} esElegible={esElegible} />
                  </td>
                  <td className="pulso-xcf-cell-arrow" aria-hidden="true">
                    <ArrowRight size={14} />
                  </td>
                  <td className="pulso-xcf-cell-option"><TituloLegible texto={pair.optionLabel} /></td>
                </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="pulso-xcf-antecedents">
          <span className="pulso-xcf-antecedents-label">
            {card.antecedents.length === 1
              ? "Depende de la respuesta a:"
              : "Depende de las respuestas a:"}
          </span>
          <ul className="pulso-xcf-antecedents-list">
            {card.antecedents.map((antecedent) => (
                <li key={antecedent.varName}>
                  <Antecedente rowIndex={antecedent.rowIndex} label={antecedent.label}
                    onElegir={onElegirAntecedente} esElegible={esElegible} />
                </li>
            ))}
          </ul>
          {card.antecedents.length === 0 ? (
            <p className="pulso-xcf-antecedents-empty">
              El detalle exacto está en la regla técnica.
            </p>
          ) : null}
        </div>
      )}

      <div className="pulso-xcf-rule">
        <button
          type="button"
          className="pulso-xcf-rule-toggle"
          aria-expanded={ruleOpen}
          onClick={() => setRuleOpen((v) => !v)}
        >
          <ChevronRight
            size={13}
            aria-hidden="true"
            className={ruleOpen ? "pulso-xcf-rule-caret is-open" : "pulso-xcf-rule-caret"}
          />
          Ver regla técnica
        </button>
        {ruleOpen ? (
          <div className="pulso-xcf-rule-body">
            <code className="pulso-xcf-rule-code">{card.rawExpression}</code>
            <span className="pulso-xcf-rule-meta">
              lista de opciones: <code>{card.listName || "—"}</code>
            </span>
          </div>
        ) : null}
      </div>
      {pie}
    </article>
  );
}
