// El límite de filas de la lámina nativa (`tope_filas`). Se ve siempre que existe, con el mismo texto en los dos tonos:
// neutro mientras la selección cabe y de aviso cuando la pasa (calculado con la selección que se ve, optimista). Pasarlo
// cambia el color, no el alto: el marco no salta (C2).

import { formatoConteo } from "../../../../lib/formatoNumero";

type Props = { tope: number; excedido: boolean; aviso: string | null };

export function LimiteLamina({ tope, excedido, aviso }: Props) {
  return (
    <span className={`pulso-f6-regla-tope${excedido ? " is-excedido" : ""}`} role="note" title={aviso ?? undefined}
      data-excedido={excedido || undefined}>
      <span className="pulso-f6-regla-tope-marca" aria-hidden="true" />
      La lámina nativa admite {formatoConteo(tope)}
    </span>
  );
}
