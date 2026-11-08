// Las tarjetas de la maqueta del cierre (MaquetaCierre.tsx), como las dibuja el motor (lamina_cierre_hallazgos.R): una por
// hallazgo que viaja al plan (una fila vacía por completo no viaja y no tiene tarjeta) y, sin ninguno, tres tarjetas
// vacías. La cifra es la viva de su lámina; mientras no llega, la que se leyó al elegirla. Pura: sin React.

import type { CifraClave } from "../../../../api/graficosCifras";
import { MIN_HALLAZGOS, type HallazgoCierre } from "./modeloCierre";
import type { CifrasLeidas } from "./modeloElegirCifra";

export type TarjetaCierre = {
  /** Clave de la fila del editor. */
  fila: string;
  /** El número de la fila en el editor («Hallazgo 2»). */
  numero: number;
  cifra: Pick<CifraClave, "texto" | "unidad"> | null;
  texto: string;
};

const viaja = (h: HallazgoCierre): boolean => !!(h.lamina || h.cifra || h.texto);

/** La cifra de una fila para su tarjeta: la viva; si su lámina todavía no respondió, la que se leyó al elegirla. */
function cifraDeTarjeta(h: HallazgoCierre, leidas: CifrasLeidas | undefined): TarjetaCierre["cifra"] {
  if (!h.lamina || !h.cifra) return null;
  const viva = leidas?.cifras?.find((c) => c.clave === h.cifra);
  if (viva) return viva;
  if (!leidas?.cifras && h.cifraAlEscribir) return { texto: h.cifraAlEscribir, unidad: "" };
  return null;
}

export function tarjetasDelCierre(filas: readonly HallazgoCierre[], cifrasPorOrigen: Readonly<Record<string, CifrasLeidas>>): TarjetaCierre[] {
  const numeradas = filas.map((h, i) => ({ h, numero: i + 1 }));
  const conTarjeta = numeradas.some(({ h }) => viaja(h)) ? numeradas.filter(({ h }) => viaja(h)) : numeradas.slice(0, MIN_HALLAZGOS);
  return conTarjeta.map(({ h, numero }) => ({ fila: h.clave, numero, cifra: cifraDeTarjeta(h, cifrasPorOrigen[h.lamina]), texto: h.texto }));
}

/** «Hallazgo N» en la tarjeta sin cifra: marca el lugar en el editor y no sale en la lámina. `null` si tiene cifra. */
export function marcadorDeLugar(t: Pick<TarjetaCierre, "cifra" | "numero">): string | null {
  return t.cifra ? null : `Hallazgo ${t.numero}`;
}
