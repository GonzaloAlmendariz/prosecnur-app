// =============================================================================
// inspector/LogicTab.tsx — cuarta tab: lógica avanzada (placeholder F2)
// =============================================================================
// La lógica visual (relevant / constraint / calculation / choice_filter)
// con builder visual es trabajo de Fase 2. En esta Fase 1:
//
//   - Si la pregunta YA tiene esa lógica (importada de un .xlsx existente)
//     se muestra read-only con sintaxis monospace y un aviso explicando que
//     se conserva al exportar.
//   - Hay un botón "Quitar lógica" por si el usuario quiere borrarla.
//   - Si la pregunta NO tiene lógica todavía, banner informativo con
//     "Próximamente — el constructor visual de condiciones llega en Fase 2".
//
// Esta tab no aparece para secciones (sus reglas no usan la mayoría de
// estos campos), aunque sí soporta `relevant`.
// =============================================================================

import { Sparkles, Trash2 } from "lucide-react";
import type { BuilderNode } from "../types";
import { InspectorBlock, InspectorField } from "./InspectorPrimitives";

export type LogicTabProps = {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
};

export function LogicTab({ node, onFieldChange }: LogicTabProps) {
  const isSelect =
    node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const isCalculate = node.kind === "calculate";

  const blocks: Array<{
    field: string;
    title: string;
    hint: string;
    value: string;
  }> = [];

  if (node.relevant) {
    blocks.push({
      field: "relevant",
      title: "Cuándo aparece",
      hint: "La pregunta solo se muestra si esta condición se cumple.",
      value: node.relevant,
    });
  }
  if (node.constraint) {
    blocks.push({
      field: "constraint",
      title: "Cómo se valida",
      hint: "La respuesta solo se acepta si cumple esta condición.",
      value: node.constraint,
    });
  }
  if (isCalculate && node.calculation) {
    blocks.push({
      field: "calculation",
      title: "Cómo se calcula",
      hint: "Fórmula que el sistema evalúa para llenar el campo.",
      value: node.calculation,
    });
  }
  if (isSelect && node.choiceFilter) {
    blocks.push({
      field: "choice_filter",
      title: "Cómo se filtran las opciones",
      hint: "Filtro aplicado al catálogo según otras respuestas.",
      value: node.choiceFilter,
    });
  }

  return (
    <div className="pulso-inspector-tab">
      <InspectorBlock>
        <div className="pulso-inspector-coming">
          <span className="pulso-inspector-coming-icon">
            <Sparkles size={16} />
          </span>
          <div>
            <strong>El constructor visual de lógica llega en una próxima fase.</strong>
            <p>
              Por ahora, las condiciones (cuándo aparece, cómo se valida, cómo se
              calcula) se importan desde el .xlsx y se preservan tal cual al
              exportar. La edición visual estará disponible en la siguiente
              iteración.
            </p>
          </div>
        </div>
      </InspectorBlock>

      {blocks.length === 0 ? (
        <InspectorBlock>
          <p className="pulso-inspector-empty-logic">
            Esta pregunta no tiene lógica avanzada definida. Cuando este editor
            la soporte podrás configurar visibilidad condicional, validaciones y
            fórmulas desde aquí.
          </p>
        </InspectorBlock>
      ) : (
        <InspectorBlock>
          {blocks.map((block) => (
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
