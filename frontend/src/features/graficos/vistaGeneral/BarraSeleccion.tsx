// Barra de selección del Informe (I7 del rediseño, 2026-10-14): aparece flotando sobre el pie del clasificador cuando hay
// láminas elegidas y lleva lo que se hace con ellas —mover a un capítulo, duplicar, eliminar (con confirmación) y soltar—
// con sus atajos a la vista. Flota: no empuja el contenido (C2). Mover y eliminar avisan con «Deshacer» (toast).

import { useState } from "react";
import { Copy, ListTree, Trash2, X } from "../../../vendor/lucide-react";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";

const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = esMac ? "⌘" : "Ctrl+";

type Props = {
  filas: readonly FilaVistaGeneral[];
  seleccionadas: number;
  /** Destinos válidos para la selección (con un separador elegido, sólo otros capítulos: viaja el capítulo entero). */
  destinosHabilitados: ReadonlySet<string>;
  onMoverA: (filaId: string) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onVaciar: () => void;
};

export function BarraSeleccion({ filas, seleccionadas, destinosHabilitados, onMoverA, onDuplicar, onEliminar, onVaciar }: Props) {
  const [destino, setDestino] = useState("");
  if (seleccionadas === 0) return null;
  const habilitadas = filas.filter((f) => destinosHabilitados.has(f.id));
  const destinoValido = habilitadas.some((f) => f.id === destino) ? destino : habilitadas[0]?.id ?? "";
  return (
    <div className="pulso-f6-vg-selbar" role="toolbar" aria-label="Acciones sobre las láminas elegidas">
      <span className="pulso-f6-vg-selbar-n" aria-live="polite">
        <strong>{seleccionadas}</strong> {seleccionadas === 1 ? "lámina elegida" : "láminas elegidas"}
      </span>
      <label className="pulso-f6-vg-mover">
        <span className="pulso-sr-only">Capítulo de destino</span>
        <select value={destinoValido} onChange={(e) => setDestino(e.target.value)} disabled={!habilitadas.length}>
          {filas.map((f) => <option key={f.id} value={f.id} disabled={!destinosHabilitados.has(f.id)}>{f.rotulo}</option>)}
        </select>
      </label>
      <button type="button" className="pulso-f6-vg-selbar-btn" disabled={!destinoValido} onClick={() => onMoverA(destinoValido)}>
        <ListTree size={14} aria-hidden="true" />
        Mover
      </button>
      <button type="button" className="pulso-f6-vg-selbar-btn" onClick={onDuplicar} aria-keyshortcuts={esMac ? "Meta+D" : "Control+D"}>
        <Copy size={14} aria-hidden="true" />
        Duplicar <kbd>{MOD}D</kbd>
      </button>
      <button type="button" className="pulso-f6-vg-selbar-btn is-peligro" onClick={onEliminar} aria-keyshortcuts="Delete">
        <Trash2 size={14} aria-hidden="true" />
        Eliminar <kbd>Supr</kbd>
      </button>
      <span className="pulso-f6-vg-selbar-hint">Alt+↑↓ mueve · Enter abre</span>
      <button type="button" className="pulso-f6-vg-selbar-x" onClick={onVaciar} aria-label="Soltar la selección" title="Soltar la selección (Esc)">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
