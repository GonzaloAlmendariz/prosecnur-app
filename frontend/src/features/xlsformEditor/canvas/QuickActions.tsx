// =============================================================================
// canvas/QuickActions.tsx — toolbar flotante para la pregunta seleccionada
// =============================================================================
// Pegada arriba a la derecha de la card del preview, con acciones rápidas
// que el usuario espera tener a mano sin abrir el inspector:
//   - Mover ↑ / ↓ (siblings inmediatos)
//   - Eliminar
// La duplicación viene en sub-PRs siguientes cuando agreguemos esa acción
// al reducer.
// =============================================================================

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

export type QuickActionsProps = {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Si true, el botón Eliminar está deshabilitado (para selecciones
   *  especiales como settings que no se pueden borrar). */
  disableDelete?: boolean;
};

export function QuickActions({
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  disableDelete,
}: QuickActionsProps) {
  return (
    <div className="pulso-canvas-quickactions" role="toolbar" aria-label="Acciones rápidas">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        className="pulso-icon"
        title="Mover arriba"
        aria-label="Mover arriba"
      >
        <ArrowUp size={13} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        className="pulso-icon"
        title="Mover abajo"
        aria-label="Mover abajo"
      >
        <ArrowDown size={13} />
      </button>
      <span className="pulso-canvas-quickactions-sep" aria-hidden="true" />
      <button
        type="button"
        onClick={onDelete}
        disabled={disableDelete}
        className="pulso-icon-danger"
        title="Eliminar"
        aria-label="Eliminar"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
