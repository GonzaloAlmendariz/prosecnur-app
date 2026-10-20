// Aviso breve tras quitar algo, con su «Deshacer» a mano (criterio 6 del
// editor intuitivo): «Bloque quitado · Deshacer». Se va solo a los 6 s; ⌘Z
// sigue deshaciendo después. Anunciado a lectores de pantalla (role=status).

import { useEffect } from "react";

import { Undo2, X } from "../../../vendor/lucide-react";

export type Deshacible = { texto: string; deshacer: () => void; clave: number };

const DURACION_MS = 6000;

export function AvisoDeshacer({ aviso, onCerrar }: { aviso: Deshacible | null; onCerrar: () => void }) {
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(onCerrar, DURACION_MS);
    return () => window.clearTimeout(t);
  }, [aviso, onCerrar]);
  if (!aviso) return null;
  return (
    <div className="rec-guia-toast" role="status" aria-live="polite">
      <span>{aviso.texto}</span>
      <button
        type="button"
        className="rec-guia-toast-accion"
        onClick={() => { aviso.deshacer(); onCerrar(); }}
      >
        <Undo2 size={14} aria-hidden /> Deshacer
      </button>
      <button type="button" className="rec-guia-toast-cerrar" aria-label="Cerrar el aviso" onClick={onCerrar}>
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
