// Una categoría de la lista elegida: el asa para arrastrar (que también la mueve
// con Alt y las flechas), su código, su etiqueta y cuántos casos la eligieron,
// con una barra relativa a la más elegida.

import type { KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { formatoConteo } from "../../../lib/formatoNumero";
import { GripVertical } from "../../../vendor/lucide-react";

export function FilaDeCategoria({ code, etiqueta, casos, maximo, posicion, total, especial, onTeclado }: {
  code: string;
  etiqueta: string;
  casos: number | undefined;
  maximo: number;
  posicion: number;
  total: number;
  especial: boolean;
  onTeclado: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: code });
  const ancho = typeof casos === "number" && maximo > 0 ? Math.round((casos / maximo) * 100) : 0;
  return (
    <li
      ref={setNodeRef}
      className="categorias-categoria"
      data-especial={especial ? "" : undefined}
      data-arrastrando={isDragging ? "" : undefined}
      data-codigo={code}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        // dnd-kit le pone role="button" y su descripción; el nombre dice qué se mueve y dónde está.
        aria-roledescription="categoría ordenable"
        aria-label={`${code} ${etiqueta || "sin etiqueta"}, posición ${posicion} de ${total}. Alt con las flechas la mueve`}
        className="categorias-asa"
        onKeyDown={onTeclado}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <code className="categorias-codigo">{code}</code>
      <b className="categorias-etiqueta">{etiqueta || <span className="categorias-sin-etiqueta">Sin etiqueta</span>}</b>
      <span className="categorias-barra" aria-hidden="true"><i style={{ width: `${ancho}%` }} /></span>
      <em className="categorias-casos">{typeof casos === "number" ? formatoConteo(casos) : ""}</em>
    </li>
  );
}
