// La cifra del Top y del Bottom Two Box junto a su chip (oleada I2, ítem 2), sin React. La caja es la SUMA DE LAS
// CIFRAS ROTULADAS de sus categorías, como en la lámina (graficos_cifras_detalle.R): se pide al motor con `caja` y se lee
// de cada fila. Con una barra, «Top Two Box 62%»; con varias, el rango («Top Two Box de 38% a 62%»).

import type { DetalleCifras } from "../../../../api/graficosCifras";
import { filaPrincipal, textoPct } from "../cifrasInspector/modeloCifras";
import type { VarianteDetalle } from "../cifrasInspector/useDetalleCifras";

type Args = Readonly<Record<string, unknown>>;
export type CajaTwoBox = "top" | "bottom";

export const ROTULO_CAJA: Readonly<Record<CajaTwoBox, string>> = { top: "Top Two Box", bottom: "Bottom Two Box" };

/** Una variante por caja encendida y con categorías elegidas. */
export function variantesTwoBox(args: Args, cajas: Readonly<Partial<Record<CajaTwoBox, readonly string[]>>>): VarianteDetalle[] {
  return (Object.entries(cajas) as [CajaTwoBox, readonly string[] | undefined][])
    .filter(([, e]) => e && e.length > 0)
    .map(([clave, e]) => ({ clave, args, caja: e }));
}

/** La cifra de la caja: la de la fila principal o el rango entre las barras; null si el detalle no la trae. */
export function cifraCaja(det: DetalleCifras | null): string | null {
  if (!det) return null;
  const dec = det.redondeo.decimales;
  const principal = filaPrincipal(det);
  if (principal) return textoPct(principal.caja?.valor, dec);
  const valores = det.filas.map((f) => f.caja?.valor).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!valores.length) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return min === max ? textoPct(min, dec) : `de ${textoPct(min, dec)} a ${textoPct(max, dec)}`;
}

/** «Top Two Box 62%, Bottom Two Box 18%» con las que tienen cifra; null si ninguna. */
export function textoTwoBox(partes: readonly { caja: CajaTwoBox; cifra: string | null }[]): string | null {
  const con = partes.filter((p) => p.cifra);
  return con.length ? con.map((p) => `${ROTULO_CAJA[p.caja]} ${p.cifra}`).join(", ") : null;
}
