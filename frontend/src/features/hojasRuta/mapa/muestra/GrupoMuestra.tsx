import { useState, type ReactNode } from "react";

import { ChevronRight } from "../../../../vendor/lucide-react";

/**
 * Un grupo plegable del inspector de Muestra. El resumen dice el valor vigente en una línea, así que
 * plegado el grupo sigue declarando qué decidió (C1) y abrirlo es sólo para cambiarlo (C4). Existe porque
 * cada capacidad del ADR 0131 (base 2025, estrato, forzosas) agregó su bloque debajo del anterior y el
 * inspector llegó a doce secciones seguidas sin jerarquía.
 */
export function GrupoMuestra({ titulo, resumen, abierto = false, children }: { titulo: string; resumen: ReactNode; abierto?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(abierto);
  return (
    <details className="hr-muestra-plegable" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <ChevronRight size={14} aria-hidden className="hr-muestra-plegable-flecha" />
        <span className="hr-muestra-plegable-titulo">{titulo}</span>
        <span className="hr-muestra-plegable-resumen">{resumen}</span>
      </summary>
      <div className="hr-muestra-plegable-cuerpo">{children}</div>
    </details>
  );
}
