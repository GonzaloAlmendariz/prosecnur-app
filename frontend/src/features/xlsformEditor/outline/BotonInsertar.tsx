import { Plus } from "../../../vendor/lucide-react";
import type { DestinoInsercion } from "../state/accionesConstructor";

// «+» entre líneas de la Estructura (C18, 2026-10-17): aparece al pasar el puntero por la línea o al enfocarla y
// abre el menú de tipos para insertar EN ese lugar. Fuera del recorrido con Tab: con la línea enfocada, la tecla +
// hace lo mismo.

export type AbrirInsertar = (destino: DestinoInsercion, ancla: HTMLElement) => void;

export function BotonInsertar({
  destino,
  etiqueta,
  onAbrir,
  className,
}: {
  destino: DestinoInsercion;
  etiqueta: string;
  onAbrir: AbrirInsertar;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className ? `xfe-mas ${className}` : "xfe-mas"}
      tabIndex={-1}
      aria-label={etiqueta}
      title={`${etiqueta} · tecla Insert o +`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(destino, e.currentTarget);
      }}
    >
      <Plus size={11} strokeWidth={2.6} aria-hidden="true" />
    </button>
  );
}
