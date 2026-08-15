// =============================================================================
// marcasPrevias — qué marcó esa persona antes de que la clasifiques
// =============================================================================
// Al clasificar una respuesta abierta de una `select_multiple`, mandarla a un
// código que la persona YA marcó es una operación nula: la mención existe y el
// matiz que escribió se pierde. Mandarla a uno que no marcó le suma una
// mención y mueve el porcentaje de esa categoría. Son dos resultados distintos
// y hasta ahora se elegían a ciegas.
//
// La lista de respuestas agrupa por texto único, no por fila. Cuando el mismo
// texto viene de varias personas con marcas distintas, el aviso tiene que ir en
// proporción o miente: en ACNUR V3 todas tenían frecuencia 1, pero el motor
// soporta ambos casos.
// =============================================================================

import type { MarcaPrevia } from "../../api/codificacion";

export type AvisoMarcaPrevia = {
  /** Todas las filas que aportan la respuesta ya tenían el código marcado. */
  todas: boolean;
  /** Texto corto para el chip del dropdown. */
  etiqueta: string;
  /** Frase completa para el `title` y el lector de pantalla. */
  detalle: string;
};

/**
 * El aviso para un código destino, o `null` si nadie lo tenía marcado —que es
 * el caso normal y no debe pintar nada.
 */
export function avisoMarcaPrevia(
  codigoDestino: string,
  marcas: readonly MarcaPrevia[] | undefined,
  frecuencia: number,
): AvisoMarcaPrevia | null {
  const codigo = (codigoDestino ?? "").trim();
  if (!codigo || !marcas?.length) return null;
  const marca = marcas.find((m) => (m.codigo ?? "").trim() === codigo);
  if (!marca) return null;
  const n = Number.isFinite(marca.n) ? Math.max(0, Math.trunc(marca.n)) : 0;
  if (n <= 0) return null;

  const total = Number.isFinite(frecuencia) ? Math.max(n, Math.trunc(frecuencia)) : n;
  const todas = n >= total;
  return {
    todas,
    etiqueta: todas ? "ya marcada" : `ya marcada · ${n} de ${total}`,
    detalle: todas
      ? total === 1
        ? "Esta persona ya marcó esta opción: mandarla acá no suma una mención."
        : `Las ${total} ya marcaron esta opción: mandarlas acá no suma menciones.`
      : `${n} de ${total} ya marcaron esta opción: para esas, mandarlas acá no suma una mención.`,
  };
}
