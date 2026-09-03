import type { ReactNode } from "react";

import { tonoDePabellon } from "./chipDePabellon";

/**
 * El sistema de chips de Carga de campo (dictado 2026-09-02: «una lista más
 * jerarquizada y ordenada, los pabellones con números en recuadros elegantes
 * de colores en función de la letra, el horario como otro cuadrito elegante»).
 *
 * Tres piezas y nada más:
 * - `ChipLugar`: el pabellón/salón, con color DERIVADO de su letra
 *   (`tonoDePabellon`, determinista) — el mismo A703 se pinta igual en el
 *   detalle de la malla, en la tabla de Asignación y en el pie por pabellón.
 * - `ChipHora`: la hora o ventana, sobria y con números tabulares.
 * - `ChipDato`: el neutro para lo demás (fecha, momento, nombres).
 *
 * El color vive en la hoja (`aulasCargaDeCampo.css`, clases `es-tono-*` sobre
 * tokens `--pulso-*`); aquí solo se elige el índice.
 */

export function ChipLugar({ lugar }: { lugar: string }) {
  const tono = tonoDePabellon(lugar);
  return (
    <span className={`aulas-chip aulas-chip-lugar${tono === null ? "" : ` es-tono-${tono}`}`}>
      {lugar}
    </span>
  );
}

export function ChipHora({ children }: { children: ReactNode }) {
  return <span className="aulas-chip aulas-chip-hora">{children}</span>;
}

export function ChipDato({ children }: { children: ReactNode }) {
  return <span className="aulas-chip">{children}</span>;
}
