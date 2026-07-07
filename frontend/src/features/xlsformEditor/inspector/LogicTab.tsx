// =============================================================================
// inspector/LogicTab.tsx — tab Lógica con builder visual
// =============================================================================
// La tab Lógica ofrece edición visual real para `relevant` (F2-2) y
// `constraint` (F2-3). Los demás campos (calculation no-calc,
// choice_filter) siguen como read-only — F2-4 los sube al builder.
//
// Reglas que cumple:
//   - Builder visual cuando la expresión encaja en formas planas.
//   - Caja read-only con CTA "Reemplazar" cuando es muy compleja para
//     plana (NOT, anidados, mezclas y/o, llamadas no-`selected`).
//   - "Quitar" disponible siempre.
//   - Para constraint, el mensaje de error inline en el mismo bloque
//     porque va siempre de la mano con la regla.
// =============================================================================

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { BuilderNode } from "../types";
import type { LogicScope } from "../logic";
import TechTerm from "../helpers/TechTerm";
import { InspectorBlock, InspectorField } from "./InspectorPrimitives";
import { LogicBuilder } from "./logic/LogicBuilder";
import { ConstraintBuilder } from "./logic/ConstraintBuilder";

export type LogicTabProps = {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
};

export function LogicTab({ node, scope, onFieldChange }: LogicTabProps) {
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const isCalculate = node.kind === "calculate";
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isNote = node.kind === "note";
  const targetNoun = isSection ? "este bloque" : "esta pregunta";

  // El constraint solo aplica a preguntas reales (no notas, no calc, no
  // secciones). Lo mostramos solo cuando tiene sentido.
  const showConstraint = !isCalculate && !isSection && !isNote;

  const constraintMessage =
    (node as BuilderNode & { constraint_message?: string }).constraint_message ?? "";

  // Bloques aún read-only (calculation huérfano, choice_filter).
  const readonlyBlocks: Array<{
    field: string;
    title: ReactNode;
    hint: string;
    value: string;
  }> = [];
  if (!isCalculate && node.calculation) {
    readonlyBlocks.push({
      field: "calculation",
      title: <>Fórmula heredada <TechTerm t="calculation" /></>,
      hint: "Importada en una fila no-calculate; se preserva al exportar.",
      value: node.calculation,
    });
  }
  if (isSelect && node.choiceFilter) {
    readonlyBlocks.push({
      field: "choice_filter",
      title: <>Filtro de opciones <TechTerm t="choice_filter" /></>,
      hint: "Filtro importado; la edición visual llega con F2-4.",
      value: node.choiceFilter,
    });
  }

  return (
    <div className="pulso-inspector-tab">
      <InspectorBlock>
        <LogicBuilder
          expression={node.relevant}
          scope={scope}
          fieldLabel={<>Condición para mostrarse <TechTerm t="relevant" /></>}
          hint={`Si se cumple, ${targetNoun} se muestra al encuestado.`}
          targetNoun={targetNoun}
          techTerm="relevant"
          onChange={(next) => onFieldChange("relevant", next)}
        />
      </InspectorBlock>

      {showConstraint && (
        <InspectorBlock>
          <ConstraintBuilder
            expression={node.constraint}
            scope={scope}
            baseType={node.typeInfo.base}
            listName={node.typeInfo.listName || undefined}
            fieldLabel={<>Regla de validación <TechTerm t="constraint" /></>}
            hint="Condición que debe cumplir la respuesta para aceptarse."
            techTerm="constraint"
            onChange={(next) => onFieldChange("constraint", next)}
            onApplyPreset={({ expression, message }) => {
              onFieldChange("constraint", expression);
              onFieldChange("constraint_message", message);
            }}
          />
          {/* El mensaje de error vive aquí: aparece solo si hay validación
              definida o si el usuario ya tenía un mensaje desde el .xlsx
              importado — no contaminamos el builder vacío con un input
              extra. */}
          {(node.constraint || constraintMessage) && (
            <InspectorField
              label={<>Mensaje de error <TechTerm t="constraint_message" /></>}
              hint="Lo ve el encuestado si su respuesta no cumple la regla."
            >
              <input
                type="text"
                value={constraintMessage}
                onChange={(event) =>
                  onFieldChange("constraint_message", event.target.value)
                }
                placeholder="Ej. Ingresa un valor entre 18 y 65."
              />
            </InspectorField>
          )}
        </InspectorBlock>
      )}

      {readonlyBlocks.length > 0 && (
        <InspectorBlock>
          {readonlyBlocks.map((block) => (
            <InspectorField key={block.field} label={block.title} hint={block.hint}>
              <div className="pulso-inspector-logic-readout">
                <span className="pulso-xfi-code-head" aria-hidden="true">
                  Código Kobo <TechTerm t={block.field} />
                </span>
                <pre>{block.value}</pre>
                <button
                  type="button"
                  className="pulso-inspector-logic-clear"
                  onClick={() => onFieldChange(block.field, "")}
                  title="Quitar esta lógica"
                >
                  <Trash2 size={12} /> Quitar
                </button>
              </div>
            </InspectorField>
          ))}
        </InspectorBlock>
      )}
    </div>
  );
}
