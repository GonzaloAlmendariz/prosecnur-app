// El pedido de conteo que una firma describe (graficador|scope|args en JSON estable, `firmaPedidoRegla`). Vive aparte
// para que la caché (cacheConteoRegla.ts) y el hook (useConteoRegla.ts) lo compartan sin importarse en círculo.

type Args = Readonly<Record<string, unknown>>;

/** El pedido que la firma describe; `null` si la firma está rota. */
export function pedidoDeFirma(firma: string): { graficador: string; scope: string; args: Args } | null {
  const a = firma.indexOf("|");
  const b = a < 0 ? -1 : firma.indexOf("|", a + 1);
  if (a < 0 || b < 0) return null;
  try {
    const args = JSON.parse(firma.slice(b + 1)) as unknown;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    return { graficador: firma.slice(0, a), scope: firma.slice(a + 1, b), args: args as Args };
  } catch {
    return null;
  }
}
