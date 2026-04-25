// =============================================================================
// inspector/LogicTab.tsx — tab Lógica con builder visual (F2-2: relevant)
// =============================================================================
// La tab Lógica ahora ofrece edición visual real para `relevant`
// (visibilidad condicional). Los otros campos (constraint, calculation
// no-calc, choice_filter) siguen como read-only por ahora — F2-3/4
// los suben al builder con la misma forma.
//
// Reglas que cumple:
//   - Builder visual cuando la expresión encaja en formas planas.
//   - Caja read-only con CTA "Reemplazar" cuando es muy compleja para
//     plana (NOT, anidados, mezclas y/o, llamadas no-`selected`).
//   - "Quitar" disponible siempre.
//   - Para secciones: solo se muestra `relevant` (su único campo lógico).
// =============================================================================

import { Trash2 } from "lucide-react";
import type { BuilderNode } from "../types";
import type { LogicScope } from "../logic";
import { InspectorBlock, InspectorField } from "./InspectorPrimitives";
import { LogicBuilder } from "./logic/LogicBuilder";

export type LogicTabProps = {
  node: BuilderNode;
  scope: LogicScope;
  onFieldChange: (field: string, value: string) => void;
};

export function LogicTab({ node, scope, onFieldChange }: LogicTabProps) {
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const isCalculate = node.kind === "calculate";

  // Bloques que aún no tienen builder visual — quedan read-only y se
  // preservan tal cual al exportar.
  const readonlyBlocks: Array<{
    field: string;
    title: string;
    hint: string;
    value: string;
  }> = [];
  if (node.constraint) {
    readonlyBlocks.push({
      field: "constraint",
      title: "Cómo se valida la respuesta",
      hint: "Validación importada del .xlsx. La edición visual llega con F2-3.",
      value: node.constraint,
    });
  }
  if (!isCalculate && node.calculation) {
    readonlyBlocks.push({
      field: "calculation",
      title: "Fórmula heredada",
      hint: "Esta fila tiene una fórmula importada en una pregunta no-calculate. Se preserva al exportar.",
      value: node.calculation,
    });
  }
  if (isSelect && node.choiceFilter) {
    readonlyBlocks.push({
      field: "choice_filter",
      title: "Cómo se filtran las opciones",
      hint: "Filtro del catálogo importado. La edición visual llega con F2-4.",
      value: node.choiceFilter,
    });
  }

  return (
    <div className="pulso-inspector-tab">
      <InspectorBlock>
        <LogicBuilder
          expression={node.relevant}
          scope={scope}
          fieldLabel="Cuándo aparece"
          hint="Define la condición que tiene que cumplirse para que esta pregunta se le muestre al encuestado."
          onChange={(next) => onFieldChange("relevant", next)}
        />
      </InspectorBlock>

      {readonlyBlocks.length > 0 && (
        <InspectorBlock>
          {readonlyBlocks.map((block) => (
            <InspectorField key={block.field} label={block.title} hint={block.hint}>
              <div className="pulso-inspector-logic-readout">
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
