import type { ReactNode } from "react";

import { Switch } from "../../components/Switch";

// Opción de Analítica que QUEDA PUESTA: un interruptor, no una casilla.
//
// Regla de la casa (dictado del usuario, comentario de components/Switch.tsx):
// un ajuste encendido o apagado es un interruptor; la casilla queda para
// marcar elementos de una lista sobre los que se va a actuar. Las tarjetas de
// opción de Analítica llevaban casilla y, además, un tile con ✓ que repetía
// el estado (P-B5): el interruptor reemplaza a los dos.
//
// - `tarjeta`: la tarjeta de opción (`.analitica-control-card`), con título
//   y una línea de explicación.
// - `linea`: una opción suelta dentro de un bloque (respaldo SPSS, contexto).
//
// El rótulo es un `<label>` que envuelve al interruptor: el clic en el texto
// también lo acciona, y el nombre accesible sale del título.

export function InterruptorOpcion({
  checked,
  onToggle,
  titulo,
  descripcion,
  disabled = false,
  variante = "tarjeta",
  title,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  titulo: string;
  descripcion?: ReactNode;
  disabled?: boolean;
  variante?: "tarjeta" | "linea";
  title?: string;
  className?: string;
}) {
  const clase = variante === "tarjeta"
    ? `analitica-control-card analitica-interruptor-opcion${checked ? " is-active" : ""}`
    : "analitica-interruptor-linea";
  return (
    <label
      className={[clase, disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")}
      title={title}
    >
      <Switch
        checked={checked}
        onToggle={onToggle}
        ariaLabel={titulo}
        disabled={disabled}
        className="analitica-interruptor"
      />
      <span className="analitica-interruptor-texto">
        <span className="analitica-control-title">{titulo}</span>
        {descripcion ? <span className="analitica-control-copy">{descripcion}</span> : null}
      </span>
    </label>
  );
}
