// Acciones sobre la lámina seleccionada en la Estructura (F6.1, parte 2): insertar después, duplicar, subir, bajar y
// eliminar (con deshacer). Siempre visibles para la lámina activa, no sólo al pasar el mouse: se alcanzan con teclado.
// Atajos equivalentes del editor: Alt+↑/↓ mueve, Cmd/Ctrl+D duplica, Cmd/Ctrl+Z deshace.

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "../../../vendor/lucide-react";

type Props = {
  posicion: number;
  total: number;
  onInsertar: () => void;
  onDuplicar: () => void;
  onMover: (dir: "up" | "down") => void;
  onEliminar: () => void;
};

const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = esMac ? "⌘" : "Ctrl+";

export function AccionesLamina({ posicion, total, onInsertar, onDuplicar, onMover, onEliminar }: Props) {
  return (
    <div className="pulso-f6-acciones-lamina" role="toolbar" aria-label={`Acciones de la lámina ${posicion}`}>
      <span className="pulso-f6-acciones-rotulo">Lámina {posicion}</span>
      <button type="button" className="pulso-f6-icono-boton" onClick={onInsertar}
        aria-label="Insertar una lámina después" title="Insertar una lámina después">
        <Plus size={16} aria-hidden="true" />
      </button>
      <button type="button" className="pulso-f6-icono-boton" onClick={onDuplicar}
        aria-label="Duplicar" title={`Duplicar (${MOD}D)`}>
        <Copy size={15} aria-hidden="true" />
      </button>
      <button type="button" className="pulso-f6-icono-boton" onClick={() => onMover("up")} disabled={posicion <= 1}
        aria-label="Subir" title="Subir (Alt+↑)">
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button type="button" className="pulso-f6-icono-boton" onClick={() => onMover("down")} disabled={posicion >= total}
        aria-label="Bajar" title="Bajar (Alt+↓)">
        <ArrowDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className="pulso-f6-icono-boton is-peligro" onClick={onEliminar}
        aria-label="Eliminar" title={`Eliminar (se deshace con ${MOD}Z)`}>
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
