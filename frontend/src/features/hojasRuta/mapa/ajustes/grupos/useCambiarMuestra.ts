import type { HojasRutaSampleSizeConfig } from "../../../../../api/hojasRuta";
import type { BorradorMuestra } from "../../muestra/desdeConfig";
import { useLienzoHojasRuta } from "../../store";

/** Escribir en el borrador de la muestra, como lo hacía el inspector de Muestra (mismo merge de `sample_size`). */
export function useCambiarMuestra() {
  const { muestraBorrador, setMuestraBorrador } = useLienzoHojasRuta();
  const cambiar = (b: BorradorMuestra) => setMuestraBorrador({ ...muestraBorrador, ...b, sample_size: { ...muestraBorrador?.sample_size, ...b.sample_size } });
  const cambiarS = (x: Partial<HojasRutaSampleSizeConfig>) => cambiar({ sample_size: x });
  return { cambiar, cambiarS };
}
