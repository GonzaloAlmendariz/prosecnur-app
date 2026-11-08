// Las tarjetas del mazo en su grilla, ordenables arrastrando por el asa (o con espacio y flechas). El orden que deja el
// analista es el de inserción; los números de las tarjetas lo siguen.

import type { CSSProperties } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { anunciosArrastre, instruccionesArrastre } from "./anunciosArrastre";
import { AsaMazo } from "./AsaMazo";
import { moverA, type PropuestaMazo } from "./modeloMazo";
import { TarjetaMazo } from "./TarjetaMazo";
import { useArrastreMazo } from "./useArrastreMazo";

type Props = {
  propuestas: readonly PropuestaMazo[];
  elegidas: Readonly<Record<string, true>>;
  editando: string | null;
  scope: "active" | "consolidated";
  idLateral: string;
  onAlternar: (id: string) => void;
  onEditar: (id: string) => void;
  onOrdenar: (ids: string[]) => void;
};

type PropsItem = Omit<Props, "propuestas" | "elegidas" | "editando" | "onOrdenar"> & {
  numero: number;
  propuesta: PropuestaMazo;
  elegida: boolean;
  editando: boolean;
};

function ItemOrdenable({ numero, propuesta: p, elegida, editando, scope, idLateral, onAlternar, onEditar }: PropsItem) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const estilo: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <li ref={setNodeRef} style={estilo} className={isDragging ? "is-arrastrando" : undefined} data-qa-geometry-member>
      <TarjetaMazo
        numero={numero}
        propuesta={p}
        elegida={elegida}
        editando={editando}
        scope={scope}
        idLateral={idLateral}
        onAlternar={() => onAlternar(p.id)}
        onEditar={() => onEditar(p.id)}
        asa={<AsaMazo ref={setActivatorNodeRef} etiqueta={`Mover ${p.nombre}`} {...attributes} {...listeners} />}
      />
    </li>
  );
}

export function ListaTarjetasMazo({ propuestas, elegidas, editando, onOrdenar, ...resto }: Props) {
  const { sensores, alEmpezar, alTerminar } = useArrastreMazo();
  const ids = propuestas.map((p) => p.id);
  const nombre = (id: string) => propuestas.find((p) => p.id === id)?.nombre ?? id;
  const soltar = ({ active, over }: DragEndEvent) => {
    alTerminar();
    if (over && active.id !== over.id) onOrdenar(moverA(ids, String(active.id), String(over.id)));
  };
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragStart={alEmpezar}
      onDragEnd={soltar}
      onDragCancel={alTerminar}
      accessibility={{ announcements: anunciosArrastre({ que: "la lámina", ids, nombre }), screenReaderInstructions: instruccionesArrastre("la lámina") }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ul
          className="pulso-f6-mazo-tarjetas"
          aria-label="Láminas propuestas"
          data-qa-geometry-group="graficos/f6-mazo-tarjetas"
          data-qa-geometry-contract="equal"
        >
          {propuestas.map((p, i) => (
            <ItemOrdenable key={p.id} numero={i + 1} propuesta={p} elegida={!!elegidas[p.id]} editando={editando === p.id} {...resto} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
