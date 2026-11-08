// Acciones sobre la lámina seleccionada en la Estructura (F6.1, parte 2): insertar después, duplicar, subir, bajar y
// eliminar (con deshacer). Siempre visibles para la lámina activa, no sólo al pasar el mouse: se alcanzan con teclado.
// Atajos equivalentes del editor: Alt+↑/↓ mueve, Cmd/Ctrl+D duplica, Cmd/Ctrl+Z deshace.

import { nombreDeAtajo, rotuloDeAtajo } from "../../../lib/teclado";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  posicion: number;
  total: number;
  onInsertar: () => void;
  onDuplicar: () => void;
  onMover: (dir: "up" | "down") => void;
  onEliminar: () => void;
};


export function AccionesLamina({ posicion, total, onInsertar, onDuplicar, onMover, onEliminar }: Props) {
  return (
    <div className="pulso-f6-acciones-lamina" role="toolbar" aria-label={`Acciones de la lámina ${posicion}`}>
      <span className="pulso-f6-acciones-rotulo">Lámina {posicion}</span>
      <PulsoButton variant="icon" tone="quiet" size="md" onClick={onInsertar}
        aria-label="Insertar una lámina después" title="Insertar una lámina después">
        <Plus aria-hidden="true" />
      </PulsoButton>
      <PulsoButton variant="icon" tone="quiet" size="md" onClick={onDuplicar}
        aria-label="Duplicar" title={rotuloDeAtajo("Duplicar", "D")}>
        <Copy aria-hidden="true" />
      </PulsoButton>
      <PulsoButton variant="icon" tone="quiet" size="md" onClick={() => onMover("up")} disabled={posicion <= 1}
        aria-label="Subir" title="Subir (Alt+↑)">
        <ArrowUp aria-hidden="true" />
      </PulsoButton>
      <PulsoButton variant="icon" tone="quiet" size="md" onClick={() => onMover("down")} disabled={posicion >= total}
        aria-label="Bajar" title="Bajar (Alt+↓)">
        <ArrowDown aria-hidden="true" />
      </PulsoButton>
      <PulsoButton variant="icon" tone="quiet" size="md" intent="remove" onClick={onEliminar}
        aria-label="Eliminar" title={`Eliminar (se deshace con ${nombreDeAtajo("Z")})`}>
        <Trash2 aria-hidden="true" />
      </PulsoButton>
    </div>
  );
}
