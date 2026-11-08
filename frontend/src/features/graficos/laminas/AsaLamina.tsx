// El asa para reordenar una lámina en la Estructura o en la tira (patrón de mazoResumen/AsaMazo.tsx): lo único que
// inicia el arrastre, con puntero o con teclado (espacio y flechas). Va al lado del botón de la fila, no dentro: un
// botón no puede contener otro, y Enter sobre la fila sigue abriendo la lámina.

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { GripVertical } from "../../../vendor/lucide-react";
import "./ordenLaminas.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "aria-label"> & {
  /** Nombre accesible completo: «Mover lámina 3: Satisfacción general». */
  etiqueta: string;
  donde: "estructura" | "tira";
};

export const AsaLamina = forwardRef<HTMLButtonElement, Props>(function AsaLamina({ etiqueta, donde, className, ...rest }, ref) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={`pulso-f6-asa-lamina is-${donde}${className ? ` ${className}` : ""}`}
      aria-label={etiqueta}
      title="Arrastra para cambiar el orden (o espacio y flechas)"
    >
      <GripVertical size={donde === "tira" ? 12 : 14} aria-hidden="true" />
    </button>
  );
});
