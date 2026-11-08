// Los públicos de la franja del mazo como chips: el interruptor dice si entran y el asa los ordena arrastrando (o con
// espacio y flechas). El orden es el de las filas del panorama y de la cobertura, y el del par del contraste.

import type { CSSProperties } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChipControl, CLASE_CHIP_CON_CONTROLES } from "../../../../components/ChipConControles";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { GripVertical } from "../../../../vendor/lucide-react";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import { anunciosArrastre, instruccionesArrastre } from "./anunciosArrastre";
import { publicoEnFrase } from "./modeloMazo";
import { useArrastreMazo } from "./useArrastreMazo";

type Props = {
  bases: readonly string[];
  publicos: readonly string[];
  onPublico: (base: string) => void;
  onMoverPublico: (desde: string, hasta: string) => void;
};

const nombreDe = (b: string) => nombrePublico(publicoEnFrase(b));

function Chip({ base, entra, unico, ordenable, onPublico }: { base: string; entra: boolean; unico: boolean; ordenable: boolean; onPublico: (b: string) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: base, disabled: !ordenable });
  const estilo: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const nombre = nombreDe(base);
  return (
    <li ref={setNodeRef} style={estilo}
      className={`${CLASE_CHIP_CON_CONTROLES} pulso-f6-mazo-publico${entra ? " is-entra" : ""}${isDragging ? " is-arrastrando" : ""}`}>
      <PulsoSwitch size="sm" label={nombre} checked={entra} disabled={unico} onCheckedChange={() => onPublico(base)} />
      {ordenable && (
        <ChipControl ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Mover ${nombre}`}
          className="pulso-f6-mazo-asa-chip" title="Arrastra para cambiar el orden (o espacio y flechas)">
          <GripVertical size={13} aria-hidden="true" />
        </ChipControl>
      )}
    </li>
  );
}

export function ChipsPublicos({ bases, publicos, onPublico, onMoverPublico }: Props) {
  const { sensores, alEmpezar, alTerminar } = useArrastreMazo();
  const ordenable = bases.length > 1;
  const soltar = ({ active, over }: DragEndEvent) => {
    alTerminar();
    if (over && active.id !== over.id) onMoverPublico(String(active.id), String(over.id));
  };
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragStart={alEmpezar}
      onDragEnd={soltar}
      onDragCancel={alTerminar}
      accessibility={{ announcements: anunciosArrastre({ que: "el público", ids: bases, nombre: nombreDe }), screenReaderInstructions: instruccionesArrastre("el público") }}
    >
      <SortableContext items={[...bases]} strategy={rectSortingStrategy}>
        <ol className="pulso-f6-mazo-publicos">
          {bases.map((b) => (
            <Chip key={b} base={b} entra={publicos.includes(b)} unico={publicos.length === 1 && publicos.includes(b)}
              ordenable={ordenable} onPublico={onPublico} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
