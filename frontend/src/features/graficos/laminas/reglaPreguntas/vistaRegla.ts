// Lo que la tarjeta muestra de la selección mientras el motor no confirma (conteo optimista, ADR 0135 §4). Puro.
//
// - Con la cifra en movimiento o el pedido sin responder, y un tipo que el cliente sabe recalcular, la base es el
//   cálculo local con las métricas ya recibidas; si no, la selección del backend.
// - Un interruptor recién tocado se aplica encima al instante (sirve también en Todas, Comunes y A mano, que el
//   cliente no recalcula).
// - Con la respuesta al día y sin nada pendiente, manda el backend.

import type { ConteoRegla } from "../../../../api/graficosRegla";
import type { Reparto } from "./repartoRegla";

export type SeleccionVista = {
  /** Temas que se ven encendidos. */
  temas: Set<string>;
  /** `true` si lo que se ve es una proyección del cliente, todavía sin confirmar. */
  proyectada: boolean;
};

export function seleccionVista(
  conteo: Pick<ConteoRegla, "seleccionadas">,
  calculado: Pick<Reparto, "seleccionadas"> | null,
  pendiente: boolean,
  filas: Readonly<Record<string, boolean>>,
): SeleccionVista {
  const usarLocal = pendiente && !!calculado;
  const temas = new Set(usarLocal && calculado ? calculado.seleccionadas : conteo.seleccionadas);
  const tocadas = pendiente ? Object.entries(filas) : [];
  for (const [tema, encendida] of tocadas) {
    if (encendida) temas.add(tema);
    else temas.delete(tema);
  }
  return { temas, proyectada: usarLocal || tocadas.length > 0 };
}

/** Los temas en el orden en que se ven (para `conTipo` y el conteo). */
export function enOrden(temas: Set<string>, orden: readonly { tema: string }[]): string[] {
  const conocidos = orden.filter((c) => temas.has(c.tema)).map((c) => c.tema);
  return [...conocidos, ...[...temas].filter((t) => !conocidos.includes(t))];
}
