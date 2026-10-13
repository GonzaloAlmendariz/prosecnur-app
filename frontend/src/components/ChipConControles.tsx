// Chip con controles adentro (pedido del usuario: «Las geometrías de los bordes
// no son las mismas»).
//
// Un chip píldora que lleva botones dentro (↑ ↓ del orden de la serie, quitar
// una etiqueta…) dibujaba los botones con el radio de `button.pulso-icon`, 6 px:
// esquinas casi rectas dentro de una curva completa. La regla, una vez para
// todos:
//
// - **Radios concéntricos.** El contenedor es píldora (`--pulso-radius-chip`) y
//   cada control interno también: un círculo cuyo diámetro es el alto del chip
//   menos su borde y su holgura, así las dos curvas quedan paralelas.
// - **Un token por nivel.** Contenedor y control usan `--pulso-radius-chip`; el
//   alto sale de `--pulso-control-height-sm` y la holgura de `--pulso-space-1`.
// - **Mismo alto, centrados.** Todos los controles miden lo mismo y quedan
//   centrados en el eje del chip.
//
// Uso: el contenedor lleva `CLASE_CHIP_CON_CONTROLES` (un `li`, un `span`…) y
// sus botones son `ChipControl`.

import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./chipConControles.css";

export const CLASE_CHIP_CON_CONTROLES = "pulso-chip-controles";

export type ChipControlProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Un control de sólo ícono necesita nombre accesible. */
  "aria-label": string;
};

export const ChipControl = forwardRef<HTMLButtonElement, ChipControlProps>(function ChipControl(
  { type = "button", className, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={["pulso-chip-control", className].filter(Boolean).join(" ")}
    />
  );
});
