// Movimiento al reordenar (F6.3; contrato de movimiento F6): cada tarjeta que cambió de lugar parte de donde estaba y
// llega a su sitio nuevo (FLIP, sólo `transform`). Pura: la parte medible; `useFlipTarjetas` mide y anima.

export type Punto = { x: number; y: number };

export type DesplazamientoFlip = { id: string; dx: number; dy: number };

/** Menos de medio píxel no se anima (redondeo de layout); más allá de `maximo` tampoco: se ve como un salto de lejos. */
export function desplazamientosFlip(
  antes: ReadonlyMap<string, Punto>,
  despues: ReadonlyMap<string, Punto>,
  opciones: { minimo?: number; maximo?: number } = {},
): DesplazamientoFlip[] {
  const minimo = opciones.minimo ?? 0.5;
  const maximo = opciones.maximo ?? 1600;
  const out: DesplazamientoFlip[] = [];
  for (const [id, fin] of despues) {
    const inicio = antes.get(id);
    if (!inicio) continue;
    const dx = inicio.x - fin.x;
    const dy = inicio.y - fin.y;
    const d = Math.hypot(dx, dy);
    if (d < minimo || d > maximo) continue;
    out.push({ id, dx, dy });
  }
  return out;
}

/** I8 (2026-10-14): las tarjetas que no existían antes del cambio (agregadas o duplicadas): ésas «aparecen». */
/** Si el «antes» estaba vacío (primera carga) o casi todo es nuevo (otra base, otro plan), no se anima nada: aparecer es
 *  para una o unas pocas tarjetas que el usuario acaba de crear, no para un informe entero que llega. */
export function tarjetasNuevas(antes: ReadonlyMap<string, Punto>, despues: ReadonlyMap<string, Punto>, maximo = 12): string[] {
  if (antes.size === 0) return [];
  const nuevas = [...despues.keys()].filter((id) => !antes.has(id));
  return nuevas.length > maximo || nuevas.length > despues.size / 2 ? [] : nuevas;
}
