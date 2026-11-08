// Las tarjetas de la maqueta del cierre (MaquetaCierre.tsx), en el lugar que ocupan en la lámina (lamina_cierre_hallazgos.R):
// una por fila del editor y nunca menos de tres. La fila vacía tiene su tarjeta con «Hallazgo N» atenuado, aunque el motor
// no la dibuje: así el marco no cambia mientras se llena (antes pasaba de tres tarjetas a una al elegir la primera cifra,
// y sin filas medía 0 px; C4 de la ronda 4). La cifra es la viva de su lámina; mientras no llega, la que se leyó al
// elegirla. Pura: sin React.

import type { CifraClave } from "../../../../api/graficosCifras";
import { MIN_HALLAZGOS, type HallazgoCierre } from "./modeloCierre";
import type { CifrasLeidas } from "./modeloElegirCifra";

export type TarjetaCierre = {
  /** Clave de la fila del editor; `null` en el marcador que completa las tres sin fila detrás. */
  fila: string | null;
  /** El número de la fila en el editor («Hallazgo 2»). */
  numero: number;
  cifra: Pick<CifraClave, "texto" | "unidad"> | null;
  texto: string;
};

/** La cifra de una fila para su tarjeta: la viva; si su lámina todavía no respondió, la que se leyó al elegirla. */
function cifraDeTarjeta(h: HallazgoCierre, leidas: CifrasLeidas | undefined): TarjetaCierre["cifra"] {
  if (!h.lamina || !h.cifra) return null;
  const viva = leidas?.cifras?.find((c) => c.clave === h.cifra);
  if (viva) return viva;
  if (!leidas?.cifras && h.cifraAlEscribir) return { texto: h.cifraAlEscribir, unidad: "" };
  return null;
}

export function tarjetasDelCierre(filas: readonly HallazgoCierre[], cifrasPorOrigen: Readonly<Record<string, CifrasLeidas>>): TarjetaCierre[] {
  const tarjetas: TarjetaCierre[] = filas.map((h, i) => ({ fila: h.clave, numero: i + 1, cifra: cifraDeTarjeta(h, cifrasPorOrigen[h.lamina]), texto: h.texto }));
  for (let n = tarjetas.length + 1; n <= MIN_HALLAZGOS; n += 1) tarjetas.push({ fila: null, numero: n, cifra: null, texto: "" });
  return tarjetas;
}

/** «Hallazgo N» en la tarjeta sin cifra: marca el lugar en el editor y no sale en la lámina. `null` si tiene cifra. */
export function marcadorDeLugar(t: Pick<TarjetaCierre, "cifra" | "numero">): string | null {
  return t.cifra ? null : `Hallazgo ${t.numero}`;
}
