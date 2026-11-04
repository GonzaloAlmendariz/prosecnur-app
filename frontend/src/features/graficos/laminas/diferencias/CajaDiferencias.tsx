// Un bloque con marco de «Diferencias entre grupos» es un Panel del kit (P2 de la pasada de formato): el tono pinta el
// aviso (abstención, frágil con título que afirma), el peligro (error) o la sugerencia (sin marco).

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Panel } from "../../../../components/Panel";

export type TonoCaja = "neutro" | "aviso" | "peligro" | "sugerencia";

type Props = {
  tono?: TonoCaja;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "title" | "className" | "children">;

export function CajaDiferencias({ tono = "neutro", children, ...rest }: Props) {
  return (
    <Panel variant={tono === "sugerencia" ? "subtle" : "content"} className={`pulso-sig-caja is-${tono}`} {...rest}>
      {children}
    </Panel>
  );
}
