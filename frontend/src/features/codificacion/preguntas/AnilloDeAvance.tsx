import type { CSSProperties } from "react";

/**
 * El avance de una pregunta en un anillo con su porcentaje dentro (`pp-anillo` del prototipo). El
 * porcentaje se escribe; el anillo lo dibuja. El detalle (cuántos de cuántos) va en el nombre accesible.
 */
export function AnilloDeAvance({ porcentaje, detalle }: { porcentaje: number; detalle: string }) {
  const valor = Math.max(0, Math.min(100, Math.round(porcentaje)));
  return (
    <span
      className="pulso-preg-anillo"
      role="img"
      aria-label={`${valor} %: ${detalle}`}
      title={detalle}
      data-completo={valor === 100 ? "" : undefined}
      data-cero={valor === 0 ? "" : undefined}
      style={{ "--preg-avance": String(valor) } as CSSProperties}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="pulso-preg-anillo-fondo" cx="18" cy="18" r="15.5" pathLength={100} />
        <circle className="pulso-preg-anillo-valor" cx="18" cy="18" r="15.5" pathLength={100} />
      </svg>
      <b aria-hidden="true">{valor}</b>
    </span>
  );
}
