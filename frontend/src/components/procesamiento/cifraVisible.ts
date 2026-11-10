// Una cifra de las piezas de Procesamiento llega como número o como texto ya escrito
// ("8 nov"). El número pasa por lib/formatoNumero; el texto se pinta tal cual.

import { formatoConteo } from "../../lib/formatoNumero";

export function cifraVisible(cifra: number | string): string {
  return typeof cifra === "number" ? formatoConteo(cifra) : cifra;
}
