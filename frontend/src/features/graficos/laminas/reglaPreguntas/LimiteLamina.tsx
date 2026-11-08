// El chip del límite de la lámina nativa (estado en limiteRegla.ts). Neutro mientras la selección cabe; de aviso cuando
// pasa el tope (optimista, con la selección que se ve) o cuando el motor dice que la escala sale como imagen por otra
// causa (dos opciones «Sin información»). Cambiar de tono o de texto cambia el color, no el alto: el chip reserva dos
// líneas y el marco no salta (C2).

import type { EstadoLimite } from "./limiteRegla";

type Props = { limite: EstadoLimite };

export function LimiteLamina({ limite }: Props) {
  return (
    <span className={`pulso-f6-regla-tope${limite.aviso ? " is-excedido" : ""}`} role="note" title={limite.titulo ?? undefined}
      data-excedido={limite.aviso || undefined} data-causa={limite.otraCausa ? "sin-informacion" : limite.excedido ? "filas" : undefined}>
      <span className="pulso-f6-regla-tope-marca" aria-hidden="true" />
      <span>{limite.texto}</span>
    </span>
  );
}
