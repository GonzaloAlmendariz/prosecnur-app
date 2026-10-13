import type { ReactNode } from "react";

import "./cifrasPestana.css";

// Cifras de una pestaña de Analítica (P-M1 de la ronda de pulido).
//
// Las pestañas hermanas resumían sus cifras de cuatro maneras: tarjetas KPI
// grandes (Comparativos), chips planos sin etiqueta (Datos), chips con
// etiqueta en versalitas (Frecuencias, Cruces, Ponderación, Libro de códigos)
// y una tira segmentada (Codificación). La regla es una sola primitiva por
// pestaña: la de chips con etiqueta, que es la más compacta. Las tarjetas KPI
// quedan para los homepages.
//
// Cada cifra es «ETIQUETA valor». El valor puede ser un enlace (p. ej. las
// excluidas abren su panel) y puede llevar tono semántico cuando la cifra es
// un estado, no un conteo: `peligro` para lo que bloquea, `alerta` para lo
// pendiente, `acento` para lo activo.

export type TonoCifra = "neutral" | "acento" | "alerta" | "peligro";

export interface CifraPestana {
  /** Clave estable para React. Si falta se usa la etiqueta. */
  clave?: string;
  etiqueta: string;
  valor: ReactNode;
  tono?: TonoCifra;
  /** Texto de ayuda al pasar el puntero. */
  titulo?: string;
}

export function CifrasPestana({
  cifras,
  ariaLabel,
  className,
}: {
  cifras: readonly CifraPestana[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={["analitica-cifras", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
      // C1: cada chip mide lo que su cifra necesita; no son marcos pares.
      data-qa-geometry-group="analitica/cifras"
      data-qa-geometry-contract="intrinsic"
    >
      {cifras.map((cifra) => (
        <span
          key={cifra.clave ?? cifra.etiqueta}
          className="analitica-cifra"
          data-tono={cifra.tono ?? "neutral"}
          title={cifra.titulo}
        >
          <span className="analitica-cifra-etiqueta">{cifra.etiqueta}</span>
          <strong className="analitica-cifra-valor">{cifra.valor}</strong>
        </span>
      ))}
    </div>
  );
}
