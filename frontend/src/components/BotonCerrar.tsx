import { forwardRef, type ButtonHTMLAttributes } from "react";
import { X } from "../vendor/lucide-react";
import { PulsoButton } from "./PulsoButton";
import "./kit-cerrar.css";

export type BotonCerrarProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "type"
> & {
  /**
   * Nombre accesible obligatorio y con objeto: «Cerrar propuesta», «Cerrar
   * selector de gráficos». El tipo exige el prefijo «Cerrar » seguido del
   * objeto; «Cerrar» solo no compila.
   */
  "aria-label": `Cerrar ${string}`;
  /**
   * `md` (por defecto): caja de 28 px (`--pulso-close-size`) e ícono de 16, para
   * cabeceras de panel y diálogo. `sm`: caja de 20 e ícono de 14, para filas y
   * chips densos. En los dos el área de impacto es de 32 px (`--pulso-close-hit`).
   */
  size?: "sm" | "md";
};

/**
 * **La X del kit.** Una sola gramática de cierre (contrato B del acabado de
 * Láminas): PulsoButton `icon` + `tone="quiet"`, X del shim de lucide, caja de
 * 28 con 32 de impacto, `--pulso-surface-3` al hover, radio
 * `--pulso-control-radius`, foco `--mov-foco` y sin sombra.
 *
 * **Escape NO es asunto de este botón.** Cerrar con Escape y devolver el foco
 * al disparador lo resuelve la superficie que se cierra (Dialog, Sideover,
 * Popover o el hook del panel); el botón solo dispara `onClick`. Duplicar el
 * manejador aquí haría que un Escape cerrara dos capas a la vez.
 *
 * En una cabecera va dentro de `CabeceraPanel`, que lo alinea a la primera
 * línea del título. Para quitar un elemento de una fila (no cerrar una
 * superficie) usa PulsoButton `icon` `tone="quiet"` `intent="remove"` con su
 * propio nombre («Quitar …»).
 */
export const BotonCerrar = forwardRef<HTMLButtonElement, BotonCerrarProps>(function BotonCerrar(
  { size = "md", className, ...props },
  ref,
) {
  return (
    <PulsoButton
      {...props}
      ref={ref}
      variant="icon"
      tone="quiet"
      size={size}
      className={["pulso-cerrar", `pulso-cerrar--${size}`, className].filter(Boolean).join(" ")}
    >
      <X aria-hidden="true" focusable="false" />
    </PulsoButton>
  );
});
