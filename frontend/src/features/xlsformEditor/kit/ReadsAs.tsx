import type { ReactNode } from "react";
import "./kit.css";

// Fila de definición «Se lee / En el papel / XLSForm»: rótulo en versalita a la izquierda y valor.
// `code` muestra el valor como expresión (monoespaciada, en caja).

export function ReadsAs({ label, children, code }: { label: string; children: ReactNode; code?: boolean }) {
  return (
    <div className="xfk-def">
      <span className="xfk-over">{label}</span>
      {code ? <code className="xfk-def__code">{children}</code> : <span className="xfk-def__value">{children}</span>}
    </div>
  );
}
