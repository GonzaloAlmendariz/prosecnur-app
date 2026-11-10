/** UMP titulares de cada distrito por nivel NSE de su manzana: índice 0 sin dato, 1 Alto … 5 Bajo. */
export function nsePorDistrito(manzanas: readonly { ubigeo: string; nse: number }[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const m of manzanas) {
    const fila = out.get(m.ubigeo) ?? [0, 0, 0, 0, 0, 0];
    fila[m.nse >= 1 && m.nse <= 5 ? m.nse : 0] += 1;
    out.set(m.ubigeo, fila);
  }
  return out;
}

/** El orden de los tramos de la barra: de Alto a Bajo y el «sin dato» al final. */
export const ORDEN_NSE = [1, 2, 3, 4, 5, 0] as const;
