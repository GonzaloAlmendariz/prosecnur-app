// Las cifras del redondeo de un gráfico (oleada I2, ítem 6), sin React: lo que suma la lámina con cada método
// («Estándar: suma 99%», «Reparto: 100%») y la cifra mayor ya redondeada, del detalle del motor (`sumas` de cada fila).
// Con varias barras, el rango de las sumas. Sin `·`: el redondeo dice cada método en su línea.

import type { CifraDetalle, DetalleCifras } from "../../../../api/graficosCifras";
import { filaPrincipal, mayorDe, textoPct } from "./modeloCifras";

export type CifrasRedondeo = { estandar: string | null; reparto: string | null; mayor: string | null };

function rango(cifras: readonly CifraDetalle[], dec: number): string | null {
  const vs = cifras.map((c) => c.valor).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vs.length) return null;
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  return min === max ? textoPct(min, dec) : `de ${textoPct(min, dec)} a ${textoPct(max, dec)}`;
}

export function cifrasRedondeo(det: DetalleCifras | null): CifrasRedondeo | null {
  if (!det) return null;
  const dec = det.redondeo.decimales;
  const principal = filaPrincipal(det);
  const filas = (principal ? [principal] : det.filas).filter((f) => f.sumas);
  const est = rango(filas.map((f) => f.sumas!.estandar), dec);
  const conReparto = filas.filter((f) => f.sumas!.reparto.aplica);
  const rep = conReparto.length ? rango(conReparto.map((f) => f.sumas!.reparto), dec) : null;
  const m = mayorDe(det);
  return {
    estandar: est ? `Estándar: suma ${est}` : null,
    reparto: rep ? `Reparto: ${rep}` : null,
    mayor: m ? `La mayor: ${textoPct(m.valor, dec)}` : null,
  };
}
