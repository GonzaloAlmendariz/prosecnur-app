// Una opción de la lista en la pestaña «Listas de opciones»: etiqueta y código en una fila, ordenable por arrastre.
// Se guarda al salir del campo o con Enter; Escape devuelve el valor guardado. Sin chips de borrador ni botones
// «Aplicar» por fila, que recargaban la tabla del panel anterior (catalogs/SortableChoiceRow.tsx).

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { GripVertical, Trash2 } from "../../../vendor/lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChoiceItem } from "../types";

type Props = {
  opcion: ChoiceItem;
  posicion: number;
  onCambio: (next: { label: string; name: string }) => void;
  onQuitar: () => void;
  /** Mueve la opción un lugar arriba (-1) o abajo (1) desde el asa, con ↑/↓ o Alt+↑/↓. */
  onMoverTecla?: (delta: -1 | 1) => void;
  /** Campo que toma el foco al montar o al cambiar: la etiqueta de una opción nueva o el asa tras moverla. */
  enfocar?: "etiqueta" | "asa" | null;
  onEnfocado?: () => void;
};

export function OpcionFila({ opcion, posicion, onCambio, onQuitar, onMoverTecla, enfocar, onEnfocado }: Props) {
  const asa = useRef<HTMLButtonElement | null>(null);
  const campoEtiqueta = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!enfocar) return;
    const el = enfocar === "asa" ? asa.current : campoEtiqueta.current;
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
    onEnfocado?.();
  }, [enfocar, onEnfocado]);
  const [etiqueta, setEtiqueta] = useState(opcion.label);
  const [codigo, setCodigo] = useState(opcion.name);
  useEffect(() => { setEtiqueta(opcion.label); setCodigo(opcion.name); }, [opcion.label, opcion.name]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opcion.rowIndex });

  const guardar = () => {
    const nombre = codigo.trim();
    if (!nombre) { setCodigo(opcion.name); return; }
    if (etiqueta !== opcion.label || nombre !== opcion.name) onCambio({ label: etiqueta, name: nombre });
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") { setEtiqueta(opcion.label); setCodigo(opcion.name); }
  };
  const teclaAsa = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!onMoverTecla || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    onMoverTecla(e.key === "ArrowUp" ? -1 : 1);
  };
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "xfo-fila is-arrastre" : "xfo-fila"} data-qa-geometry-member>
      <button type="button" ref={asa} className="xfo-fila__asa" {...attributes} {...listeners} onKeyDown={teclaAsa}
        aria-label={`Mover la opción ${posicion}`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Arrastra o usa ↑ y ↓ para moverla">
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <span className="xfo-fila__n" aria-hidden="true">{posicion}</span>
      <input ref={campoEtiqueta} className="xfo-fila__etiqueta" value={etiqueta} title={etiqueta || undefined} placeholder="Lo que lee el encuestado"
        aria-label={`Texto de la opción ${posicion}`} onChange={(e) => setEtiqueta(e.target.value)} onBlur={guardar} onKeyDown={tecla} />
      <input className="xfo-fila__codigo" value={codigo} title={codigo || undefined} placeholder="código" spellCheck={false}
        aria-label={`Código de la opción ${posicion}`} onChange={(e) => setCodigo(e.target.value)} onBlur={guardar} onKeyDown={tecla} />
      <button type="button" className="xfo-fila__quitar" onClick={onQuitar} aria-label={`Quitar la opción ${posicion}`}>
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
