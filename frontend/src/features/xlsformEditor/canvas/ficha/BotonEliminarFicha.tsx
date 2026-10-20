// Eliminar en dos pasos en la ficha del Constructor (E11b), como en Hojas: el primer clic pregunta «¿Eliminar?» en el
// propio botón y salir de él lo devuelve a su estado. Reemplaza al window.confirm. Si la pieza está citada en otras
// filas, el botón armado lo dice, porque esas referencias quedan rotas.

import { useState } from "react";
import { Trash2 } from "../../../../vendor/lucide-react";

export function BotonEliminarFicha({ onEliminar, referencias = 0, texto, className = "xfh-icono is-peligro" }: {
  onEliminar: () => void;
  /** Otras filas que citan la pieza con `${x}`. */
  referencias?: number;
  /** Texto del botón en reposo. Sin él, sólo el ícono. */
  texto?: string;
  className?: string;
}) {
  const [armado, setArmado] = useState(false);
  const desarmar = () => setArmado(false);
  const aviso = referencias > 0 ? `Rompe ${referencias} ${referencias === 1 ? "referencia" : "referencias"}. ¿Eliminar?` : "¿Eliminar?";
  return (
    <button
      type="button"
      className={`${className}${armado ? " is-armado" : ""}`}
      onClick={() => {
        if (!armado) { setArmado(true); return; }
        setArmado(false);
        onEliminar();
      }}
      onBlur={desarmar}
      onMouseLeave={desarmar}
      onKeyDown={(e) => { if (e.key === "Escape" && armado) { e.stopPropagation(); desarmar(); } }}
      aria-label={armado ? `Confirmar: ${aviso}` : texto ?? "Eliminar"}
      title={armado ? "Vuelve a pulsar para eliminar" : texto ?? "Eliminar"}
    >
      <Trash2 size={14} aria-hidden="true" />
      {armado ? <span>{aviso}</span> : texto ? <span>{texto}</span> : null}
    </button>
  );
}
