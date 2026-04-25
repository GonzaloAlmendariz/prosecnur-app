// =============================================================================
// canvas/PreviewCanvas.tsx — vista central del editor
// =============================================================================
// Reemplaza al `QuestionCanvas` del monolito. Muestra:
//   1. Breadcrumb arriba con la jerarquía hasta el ítem seleccionado.
//   2. PreviewQuestionCard con el render fiel del input (radio, checkbox,
//      input number, etc.).
//   3. QuickActions flotante arriba-derecha sobre la card.
//   4. Sección "Cómo se comporta" debajo (si la pregunta tiene lógica F1
//      heredada del XLSForm — relevant/constraint/calculation).
//
// Reglas:
//   - Si la selección es una sección (begin_group/repeat) → la card del
//     PreviewQuestionCard ya reconoce el tipo y muestra un placeholder
//     "Sección" / "Bloque repetido" descriptivo.
//   - Si la selección es settings → este componente NO se renderiza; el
//     monolito muestra `SettingsCanvas` aparte.
// =============================================================================

import type { ReactNode } from "react";
import type { BuilderNode, BuilderStructure, ChoiceItem } from "../types";
import { Breadcrumb } from "./Breadcrumb";
import { PreviewQuestionCard } from "./PreviewQuestionCard";
import { QuickActions } from "./QuickActions";

export type PreviewCanvasProps = {
  node: BuilderNode;
  structure: BuilderStructure;
  choices: ChoiceItem[];
  /** Bloques narrativos de lógica F1 (relevant, constraint, calc, choice_filter)
   *  que el monolito ya construye con `logicSummary(node)`. */
  logicBlocks: Array<{ title: string; text: string; icon: ReactNode }>;
  onSelectByRow: (rowIndex: number | "settings") => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function PreviewCanvas({
  node,
  structure,
  choices,
  logicBlocks,
  onSelectByRow,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: PreviewCanvasProps) {
  // Posición 1-indexed de esta pregunta dentro del outline (excluyendo
  // begin_*/end_* que no son preguntas reales). Se calcula contando filas
  // del outline antes de la actual que sean question/note/calculate.
  const position = computePosition(structure, node.rowIndex);

  return (
    <div className="pulso-canvas-frame">
      <Breadcrumb rowIndex={node.rowIndex} structure={structure} onSelect={onSelectByRow} />

      <div className="pulso-canvas-card-wrapper">
        <PreviewQuestionCard node={node} choices={choices} position={position ?? undefined} />
        <div className="pulso-canvas-quickactions-anchor">
          <QuickActions
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        </div>
      </div>

      {logicBlocks.length > 0 && (
        <section className="pulso-canvas-logic">
          <header className="pulso-canvas-logic-header">
            <span className="pulso-section-eyebrow">Cómo se comporta</span>
            <span className="pulso-canvas-logic-hint">
              Lógica importada del XLSForm. La edición visual llega en la Fase 2.
            </span>
          </header>
          <div className="pulso-canvas-logic-grid">
            {logicBlocks.map((block) => (
              <div key={block.title} className="pulso-canvas-logic-item">
                <span className="pulso-canvas-logic-icon">{block.icon}</span>
                <div>
                  <strong style={{ fontSize: 12, color: "var(--pulso-text)" }}>{block.title}</strong>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 11,
                      color: "var(--pulso-text-soft)",
                      lineHeight: 1.55,
                      fontFamily: "ui-monospace, monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    {block.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function computePosition(structure: BuilderStructure, rowIndex: number): number | null {
  let count = 0;
  for (const n of structure.outline) {
    if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") {
      count += 1;
    }
    if (n.rowIndex === rowIndex) {
      // Si el actual no es pregunta (es section/repeat) no le ponemos número.
      if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") return count;
      return null;
    }
  }
  return null;
}
