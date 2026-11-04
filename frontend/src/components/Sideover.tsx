/**
 * **Sideover**: la misma primitiva que `Dialog`, anclada a la derecha (520 px).
 *
 * Para conexiones, inspectores y avisos que acompañan a la vista en vez de
 * interrumpirla. Comparte con `Dialog` la cabecera, el pie, el focus trap, el
 * Escape, el foco de vuelta, la apertura por `?panel=` y la re-inyección de
 * `moduleChromeVars` en el portal.
 *
 * Alto (C3): por defecto ocupa la ventana, para inspectores cuyo contenido
 * cambia con cada clic (el marco no salta). Con `alto="contenido"` mide lo que
 * trae, hasta la ventana: un cuerpo corto no deja al pie un vacío que no es suyo.
 */
import {
  OverlayBase,
  OverlayDePanel,
  type OverlayApertura,
  type OverlayChromeProps,
  type OverlayVariante,
} from "./Dialog";

export type SideoverAlto = "ventana" | "contenido";

export type SideoverProps = OverlayChromeProps &
  OverlayApertura & {
    /** Política de alto (C3). Por defecto `ventana`. */
    alto?: SideoverAlto;
  };

const VARIANTE: OverlayVariante = { tipo: "sideover" };

export function Sideover(props: SideoverProps) {
  const { panel, open, onOpenChange, alto = "ventana", className, ...resto } = props;
  const chrome = {
    ...resto,
    className: [className, alto === "contenido" && "pulso-sideover--contenido"].filter(Boolean).join(" ") || undefined,
  };
  if (panel) return <OverlayDePanel {...chrome} variante={VARIANTE} panel={panel} />;
  return (
    <OverlayBase
      {...chrome}
      variante={VARIANTE}
      open={open ?? false}
      onOpenChange={onOpenChange ?? (() => undefined)}
    />
  );
}
