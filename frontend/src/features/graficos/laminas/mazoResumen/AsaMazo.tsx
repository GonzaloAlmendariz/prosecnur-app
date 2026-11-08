// El asa de arrastre del mazo (patrón de xlsformEditor/outline/AsaArrastre.tsx): lo único que inicia el arrastre, con
// puntero o con teclado (espacio y flechas). Va por encima del `::after` que hace clicable la tarjeta entera.

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { GripVertical } from "../../../../vendor/lucide-react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "aria-label"> & { etiqueta: string };

export const AsaMazo = forwardRef<HTMLButtonElement, Props>(function AsaMazo({ etiqueta, className, ...rest }, ref) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={`pulso-f6-mazo-asa${className ? ` ${className}` : ""}`}
      aria-label={etiqueta}
      title="Arrastra para cambiar el orden (o espacio y flechas)"
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  );
});
