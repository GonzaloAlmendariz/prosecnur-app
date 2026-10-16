import type { ReactNode } from "react";
import "./kit.css";

// Fila de propiedad al estilo Linear: rótulo gris a la izquierda, valor en tinta.
// Si recibe `onClick` es un botón (toda la fila es el blanco), si no es una fila estática.

export type PropRowProps = {
  label: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  mono?: boolean;
};

export function PropRow({ label, children, onClick, mono }: PropRowProps) {
  const value = <span className={mono ? "xfk-prow__value xfk-mono" : "xfk-prow__value"}>{children}</span>;
  if (onClick) {
    return (
      <button type="button" className="xfk-prow xfk-prow--action" onClick={onClick}>
        <span className="xfk-prow__label">{label}</span>
        {value}
      </button>
    );
  }
  return (
    <div className="xfk-prow">
      <span className="xfk-prow__label">{label}</span>
      {value}
    </div>
  );
}
