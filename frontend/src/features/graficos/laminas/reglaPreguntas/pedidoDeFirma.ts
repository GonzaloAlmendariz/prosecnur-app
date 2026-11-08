// El pedido de conteo que una firma describe (graficador|scope|args en JSON estable, `firmaPedidoRegla`). Vive aparte
// para que la caché (cacheConteoRegla.ts) y el hook (useConteoRegla.ts) lo compartan sin importarse en círculo.

type Args = Readonly<Record<string, unknown>>;

/**
 * El pedido que la firma describe; `null` si la firma está rota. La firma lleva, entre el scope y los args, el hash del
 * preset del tipo (`p<hash>`, R5-12); la de antes, sin él, también se lee. El hash no viaja: el pedido manda `config`.
 */
export function pedidoDeFirma(firma: string): { graficador: string; scope: string; args: Args } | null {
  const a = firma.indexOf("|");
  const b = a < 0 ? -1 : firma.indexOf("|", a + 1);
  if (a < 0 || b < 0) return null;
  const c = firma.charAt(b + 1) === "p" ? firma.indexOf("|", b + 1) : b;
  if (c < 0) return null;
  try {
    const args = JSON.parse(firma.slice(c + 1)) as unknown;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    return { graficador: firma.slice(0, a), scope: firma.slice(a + 1, b), args: args as Args };
  } catch {
    return null;
  }
}
