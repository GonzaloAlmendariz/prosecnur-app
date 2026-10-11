/**
 * **Sideover**: la misma primitiva que `Dialog`, anclada a la derecha (520 px).
 *
 * Para conexiones, inspectores y avisos que acompañan a la vista en vez de
 * interrumpirla. Comparte con `Dialog` la cabecera, el pie, el focus trap, el
 * Escape, el foco de vuelta, la apertura por `?panel=` y la re-inyección de
 * `moduleChromeVars` en el portal.
 */
import {
  OverlayBase,
  OverlayDePanel,
  type OverlayApertura,
  type OverlayChromeProps,
  type OverlayVariante,
} from "./Dialog";

export type SideoverProps = OverlayChromeProps & OverlayApertura;

const VARIANTE: OverlayVariante = { tipo: "sideover" };

export function Sideover(props: SideoverProps) {
  const { panel, open, onOpenChange, ...chrome } = props;
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
