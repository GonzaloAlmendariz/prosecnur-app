// Encuadre del nodo elegido en el Mapa de lógica (ítem 50): el panel del nodo se superpone arriba a la derecha del
// lienzo, así que el nodo tiene que quedar completo A LA IZQUIERDA del panel, con aire. Si ya lo está, no se mueve.

export type Caja = { x: number; y: number; ancho: number; alto: number };

/**
 * Desplazamiento mínimo (en px de pantalla) que deja `nodo` dentro de `area` con `margen` de aire.
 * `area` es el lienzo visible menos la franja que tapa el panel. Devuelve null si no hace falta moverse.
 */
export function desplazamientoParaMostrar(nodo: Caja, area: Caja, margen: number): { dx: number; dy: number } | null {
  const ajuste = (inicio: number, largo: number, areaInicio: number, areaLargo: number) => {
    const min = areaInicio + margen;
    const max = areaInicio + areaLargo - margen;
    if (largo > max - min) return min - inicio; // no cabe: se alinea su comienzo
    if (inicio < min) return min - inicio;
    if (inicio + largo > max) return max - (inicio + largo);
    return 0;
  };
  const dx = ajuste(nodo.x, nodo.ancho, area.x, area.ancho);
  const dy = ajuste(nodo.y, nodo.alto, area.y, area.alto);
  return dx === 0 && dy === 0 ? null : { dx, dy };
}
