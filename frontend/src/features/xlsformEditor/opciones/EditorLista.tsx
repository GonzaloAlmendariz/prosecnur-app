// Editor de una lista en la pestaña «Listas de opciones» (F1b, 2026-10-16). Reemplaza al del panel lateral
// (catalogs/CatalogWorkspace.tsx), que repetía la cabecera, pedía «Aplicar» en cada fila y apretaba los campos:
// aquí una tabla a todo el ancho, el código de la lista en la cabecera y «Agregar opción» al pie.

import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Search, Trash2 } from "../../../vendor/lucide-react";
import type { CatalogSummary } from "../types";
import { OpcionFila } from "./OpcionFila";
import { origenDeLista, textoOrigen, type OrigenLista } from "./opcionesModel";

export type EditorListaProps = {
  lista: CatalogSummary;
  usos: number;
  onRename: (actual: string, nuevo: string) => void;
  onAgregar: (listName: string) => void;
  onCambio: (rowIndex: number, next: { label: string; name: string }) => void;
  onQuitar: (rowIndex: number) => void;
  onMover: (listName: string, desde: number, hacia: number) => void;
  onBorrarLista: (listName: string) => void;
  /** De dónde salen las opciones si la lista no vive en choices (con la estructura, cita etiquetas). */
  origen?: OrigenLista | null;
};

export function EditorLista({ lista, usos, onRename, onAgregar, onCambio, onQuitar, onMover, onBorrarLista, origen: origenProp }: EditorListaProps) {
  // Sin la estructura, el código de la lista basta para saber que sale de una respuesta (`${x}`), aunque se cite por código.
  const origen = lista.items.length === 0 ? origenProp ?? origenDeLista(lista.listName, null) : null;
  const [codigo, setCodigo] = useState(lista.listName);
  const [busca, setBusca] = useState("");
  useEffect(() => { setCodigo(lista.listName); setBusca(""); }, [lista.listName]);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? lista.items.filter((i) => i.label.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) : lista.items;
  }, [lista.items, busca]);

  const renombrar = () => {
    const nuevo = codigo.trim();
    if (!nuevo || nuevo === lista.listName) { setCodigo(lista.listName); return; }
    onRename(lista.listName, nuevo);
  };
  const soltar = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMover(lista.listName, Number(active.id), Number(over.id));
  };

  return (
    <div className="xfo-editor">
      <div className="xfo-editor__cab">
        {origen ? (
          // Una lista dinámica no se renombra aquí: su «código» es la referencia que escribe la pregunta (M1).
          <div className="xfo-editor__codigo">
            <span>Código de la lista</span>
            <code data-codigo-fijo="" title="Lo escribe la pregunta que la usa: no se renombra aquí">{lista.listName}</code>
          </div>
        ) : (
          <label className="xfo-editor__codigo">
            <span>Código de la lista</span>
            <input value={codigo} spellCheck={false} onChange={(e) => setCodigo(e.target.value)} onBlur={renombrar}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setCodigo(lista.listName); }} />
          </label>
        )}
        <span className="xfo-editor__dato">
          {origen ? "opciones dinámicas" : `${lista.items.length} ${lista.items.length === 1 ? "opción" : "opciones"}`}, {usos === 0 ? "sin uso" : usos === 1 ? "en 1 pregunta" : `en ${usos} preguntas`}
        </span>
        {usos === 0 ? (
          <button type="button" className="xfo-editor__borrar" onClick={() => onBorrarLista(lista.listName)}>
            <Trash2 size={13} aria-hidden="true" /> Borrar lista
          </button>
        ) : null}
      </div>

      {lista.items.length >= 12 ? (
        <label className="xfo-editor__busca">
          <Search size={13} aria-hidden="true" />
          <input value={busca} placeholder="Buscar opción" onChange={(e) => setBusca(e.target.value)} aria-label="Buscar opción" />
          {busca ? <span>{visibles.length} de {lista.items.length}</span> : null}
        </label>
      ) : null}

      {origen ? (
        <p className="xfo-nota" role="note">{textoOrigen(origen)}</p>
      ) : lista.items.length === 0 ? (
        <p className="xfo-nota">La lista no tiene opciones. Agrega la primera; salen en este orden en el formulario.</p>
      ) : (
        <div className="xfo-tabla" role="group" aria-label="Opciones de la lista">
          <div className="xfo-fila is-cab" aria-hidden="true">
            <span /><span>#</span><span>Texto</span><span>Código</span><span />
          </div>
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
            <SortableContext items={visibles.map((i) => i.rowIndex)} strategy={verticalListSortingStrategy}>
              <div className="xfo-tabla__cuerpo" data-qa-geometry-group="xlsform/opciones-filas" data-qa-geometry-contract="intrinsic">
                {visibles.map((op) => (
                  <OpcionFila key={op.rowIndex} opcion={op} posicion={lista.items.indexOf(op) + 1}
                    onCambio={(v) => onCambio(op.rowIndex, v)} onQuitar={() => onQuitar(op.rowIndex)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {busca && visibles.length === 0 ? <p className="xfo-nota">Ninguna opción coincide con la búsqueda.</p> : null}
        </div>
      )}

      {origen ? null : (
        <button type="button" className="xfo-editor__agregar" onClick={() => onAgregar(lista.listName)}>
          <Plus size={14} aria-hidden="true" /> Agregar opción
        </button>
      )}
    </div>
  );
}
