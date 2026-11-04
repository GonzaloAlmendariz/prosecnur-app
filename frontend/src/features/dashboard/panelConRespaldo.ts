import { useState } from "react";

/**
 * Un overlay del tablero que se abre por dirección (`?panel=…`) en la app admin y con un estado propio en la
 * publicación. `DashboardRuta`, que vive dentro del Router, lee la dirección y pasa el control como prop; la
 * publicación monta `DashboardPage` FUERA del Router y no lo pasa, así que aquí no se toca el router: sin prop, el
 * panel vive en un `useState` local (7453e06dc; contrato `app/publicModeSinRouter.contract.test.tsx`).
 */
export type ControlDePanel = { abierto: boolean; abrir: () => void; cerrar: () => void };

export function usePanelConRespaldo(dePropia?: ControlDePanel): ControlDePanel {
  const [abierto, setAbierto] = useState(false);
  return dePropia ?? { abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false) };
}
