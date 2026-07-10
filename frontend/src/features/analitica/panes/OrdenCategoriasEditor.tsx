import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import type { DataReviewOption, VariableInstrumento } from "../../../api/client";
import { useAnaliticaStore } from "../store";
import {
  enviarEspecialesAlFinal,
  esValorEspecial,
  moverAbajo,
  moverAlFinal,
  moverAlInicio,
  moverArriba,
  ordenesIguales,
  sembrarOrden,
} from "./ordenCategoriasModel";

// Editor de orden de categorías para UN `list_name`.
//
// Reordena la secuencia de códigos de choice que se persiste en
// `orden_categorias[list_name]`. Reutiliza el patrón drag-and-drop de
// `dimensiones/shared/ListaMappingEditor` pero opera sobre el store principal
// de Analítica (no sobre el draft del wizard de Dimensiones).
//
// Semántica:
//   • Con override guardado → se respeta tal cual.
//   • Sin override → orden del instrumento con los valores especiales
//     (90/94/95/96/97/98/99) empujados al final como sugerencia de la casa.
//   • Reordenar/Invertir/Enviar especiales → persiste la secuencia explícita.
//   • Restaurar → borra el override (el instrumento vuelve a mandar).

type Props = {
  listName: string;
  // Choices de la lista (code + label + count) resueltas desde data-review.
  opciones: DataReviewOption[];
  // Variables del instrumento que comparten este list_name (heredan el orden).
  varsCompartidas: VariableInstrumento[];
};

export function OrdenCategoriasEditor({ listName, opciones, varsCompartidas }: Props) {
  const saved = useAnaliticaStore((s) => s.config.orden_categorias[listName]);
  const setOrdenCategorias = useAnaliticaStore((s) => s.setOrdenCategorias);
  const clearOrdenCategorias = useAnaliticaStore((s) => s.clearOrdenCategorias);

  const instrumentCodes = opciones.map((o) => o.code);
  const codesActuales = sembrarOrden(instrumentCodes, saved);

  const labelMap: Record<string, string> = {};
  const countMap: Record<string, number> = {};
  opciones.forEach((o) => {
    labelMap[o.code] = o.label;
    countMap[o.code] = o.count;
  });

  const hayOverride = !!saved && saved.length > 0;
  const especialesYaAlFinal = ordenesIguales(codesActuales, enviarEspecialesAlFinal(codesActuales));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = codesActuales.indexOf(String(active.id));
    const newIdx = codesActuales.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setOrdenCategorias(listName, arrayMove(codesActuales, oldIdx, newIdx));
  }

  // Controles precisos por fila (complementan el arrastre). Cada uno persiste
  // la secuencia resultante; los movers son no-op fuera de rango.
  function subir(idx: number) {
    setOrdenCategorias(listName, moverArriba(codesActuales, idx));
  }
  function bajar(idx: number) {
    setOrdenCategorias(listName, moverAbajo(codesActuales, idx));
  }
  function alInicio(idx: number) {
    setOrdenCategorias(listName, moverAlInicio(codesActuales, idx));
  }
  function alFinal(idx: number) {
    setOrdenCategorias(listName, moverAlFinal(codesActuales, idx));
  }

  function invertir() {
    setOrdenCategorias(listName, [...codesActuales].reverse());
  }

  function especialesAlFinal() {
    setOrdenCategorias(listName, enviarEspecialesAlFinal(codesActuales));
  }

  function restaurar() {
    clearOrdenCategorias(listName);
  }

  return (
    <div className="analitica-orden-editor">
      <div className="analitica-orden-toolbar">
        <span className="analitica-orden-toolbar-title">
          Orden de categorías
        </span>
        <span className="analitica-orden-list-badge" title="Lista de opciones (list_name)">
          {listName}
        </span>
        <button
          type="button"
          onClick={invertir}
          title="Invertir el orden completo de la lista"
          className="analitica-orden-btn"
        >
          <ArrowDown size={11} />
          <ArrowUp size={11} className="analitica-orden-btn-tuck" /> Invertir
        </button>
        <button
          type="button"
          onClick={especialesAlFinal}
          disabled={especialesYaAlFinal}
          title="Mover 90/94/95/96/97/98/99 al final, preservando el resto"
          className="analitica-orden-btn"
        >
          <ChevronsDown size={11} /> Enviar especiales al final
        </button>
        <button
          type="button"
          onClick={restaurar}
          disabled={!hayOverride}
          title="Borrar el override y volver al orden del instrumento"
          className="analitica-orden-btn"
        >
          <RotateCcw size={11} /> Restaurar orden del instrumento
        </button>
      </div>

      <div className="analitica-orden-scale">
        <span>↑ Primero</span>
        <span className="analitica-orden-scale-rule" />
        <span>↓ Último</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={codesActuales} strategy={verticalListSortingStrategy}>
          <div className="analitica-orden-rows">
            {codesActuales.map((code, idx) => (
              <SortableCodeRow
                key={code}
                code={code}
                posicion={idx + 1}
                total={codesActuales.length}
                label={labelMap[code] ?? ""}
                count={countMap[code]}
                especial={esValorEspecial(code)}
                onSubir={() => subir(idx)}
                onBajar={() => bajar(idx)}
                onAlInicio={() => alInicio(idx)}
                onAlFinal={() => alFinal(idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="analitica-orden-note">
        Arrastra para reordenar. El orden se guarda por <strong>lista de opciones</strong>, así que
        afecta a todas las variables que la comparten. Sin override manda el orden del instrumento;
        los valores especiales se muestran al final como sugerencia. Las tablas de frecuencia y los
        PPT usan este orden.
      </p>

      {varsCompartidas.length > 0 && (
        <div className="analitica-orden-shared">
          <div className="analitica-orden-shared-head">
            <HelpCircle size={11} />
            <span>Variables que comparten esta lista ({varsCompartidas.length})</span>
          </div>
          <ul className="analitica-orden-shared-list">
            {varsCompartidas.map((v) => (
              <li key={v.name}>
                <code>{v.name}</code>
                <span title={v.label || v.name}>
                  {v.label || <em>(sin etiqueta)</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SortableCodeRow({
  code,
  posicion,
  total,
  label,
  count,
  especial,
  onSubir,
  onBajar,
  onAlInicio,
  onAlFinal,
}: {
  code: string;
  posicion: number;
  total: number;
  label: string;
  count: number | undefined;
  especial: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onAlInicio: () => void;
  onAlFinal: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: code });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  const esPrimera = posicion <= 1;
  const esUltima = posicion >= total;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`analitica-orden-row${especial ? " is-especial" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar código ${code}`}
        className="analitica-orden-grip"
      >
        <GripVertical size={13} />
      </button>
      <span className="analitica-orden-pos" aria-hidden="true">{posicion}</span>
      <code className="analitica-orden-code">{code}</code>
      <span className="analitica-orden-label">
        {label || <em>(sin etiqueta)</em>}
      </span>
      {especial && <span className="analitica-orden-tag">especial</span>}
      {typeof count === "number" && (
        <span className="analitica-orden-count" title="Casos en la base">
          n={count}
        </span>
      )}
      <div className="analitica-orden-move" role="group" aria-label={`Mover código ${code}`}>
        <button
          type="button"
          onClick={onAlInicio}
          disabled={esPrimera}
          title="Llevar al inicio"
          aria-label={`Llevar código ${code} al inicio`}
          className="analitica-orden-move-btn"
        >
          <ChevronsUp size={12} />
        </button>
        <button
          type="button"
          onClick={onSubir}
          disabled={esPrimera}
          title="Subir una posición"
          aria-label={`Subir código ${code}`}
          className="analitica-orden-move-btn"
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          onClick={onBajar}
          disabled={esUltima}
          title="Bajar una posición"
          aria-label={`Bajar código ${code}`}
          className="analitica-orden-move-btn"
        >
          <ArrowDown size={12} />
        </button>
        <button
          type="button"
          onClick={onAlFinal}
          disabled={esUltima}
          title="Llevar al final"
          aria-label={`Llevar código ${code} al final`}
          className="analitica-orden-move-btn"
        >
          <ChevronsDown size={12} />
        </button>
      </div>
    </div>
  );
}
