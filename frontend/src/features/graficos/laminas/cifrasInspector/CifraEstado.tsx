// Una cifra del inspector como estado de una línea (ADR 0135 §8): lo que el control produce («Base 412 → 380»,
// «Top Two Box 62%»). Mientras llega lo nuevo, el valor anterior se ve atenuado; sin valor anterior, una silueta del
// kit. Sin texto y sin espera no pinta nada: el control queda como sin cifra.

import { Skeleton } from "../../../../components/Skeleton";
import "./cifrasInspector.css";

type Props = {
  texto: string | null;
  /** El texto corresponde a lo que el control tiene ahora; false: es el anterior o aún no llega. */
  vigente: boolean;
  /** Se está esperando una respuesta (sin ella, un texto null no pinta nada). */
  esperando?: boolean;
  qa?: string;
  className?: string;
};

export function CifraEstado({ texto, vigente, esperando = !vigente, qa, className }: Props) {
  if (!texto && !esperando) return null;
  return (
    <span className={["pulso-f6-cifra-estado", !vigente ? "is-anterior" : "", className].filter(Boolean).join(" ")}
      role="status" aria-busy={esperando || undefined} data-qa={qa}>
      {texto ?? <Skeleton forma="texto" ancho="8ch" className="pulso-f6-cifra-silueta" />}
    </span>
  );
}
