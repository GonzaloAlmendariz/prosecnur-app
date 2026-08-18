/**
 * Distribución del APORTE de los titulares (K3).
 *
 * Gonzalo: «mejorando los gráficos y visualizaciones y ampliándolas aún
 * más». La pregunta del analista que este modelo responde: ¿la muestra se
 * sostiene pareja entre titulares, o unas pocas aulas grandes cargan con
 * todo? El dato es `aporte_neto` (alumnos elegibles NUEVOS que cada titular
 * suma, ya descontados los repetidos — lo publica el motor por fila).
 *
 * Medido antes de dibujar (la vara de la casa): en HSVG2026 el aporte va de
 * 8 a 84 con 56 valores distintos — hay señal. Los `representativity_*` por
 * fila son CONSTANTES (score global replicado) y no se grafican: un
 * histograma de una constante sería decoración.
 */
export type BinAporte = { desde: number; hasta: number; n: number };

export type AporteTitulares = {
  bins: BinAporte[];
  maxN: number;
  titulares: number;
  total: number;
  mediana: number;
  /** Qué % del aporte total ponen el 20% de titulares que más aportan. */
  concentracionTop20: number;
  /** Titulares con selector_score negativo: duplican más de lo que aportan. */
  scoreNegativo: number;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function construirAporteTitulares(
  filas: ReadonlyArray<Record<string, unknown>> | null | undefined,
  nBins = 9,
): AporteTitulares | null {
  const aportes = (filas ?? [])
    .map((r) => num(r.aporte_neto))
    .filter((v): v is number => v != null);
  if (aportes.length < 4) return null;
  const orden = [...aportes].sort((a, b) => a - b);
  const min = orden[0]!;
  const max = orden[orden.length - 1]!;
  if (max <= min) return null;
  const ancho = (max - min) / nBins;
  const bins: BinAporte[] = Array.from({ length: nBins }, (_, i) => ({
    desde: min + i * ancho,
    hasta: min + (i + 1) * ancho,
    n: 0,
  }));
  for (const v of aportes) {
    const i = Math.min(nBins - 1, Math.floor((v - min) / ancho));
    bins[i]!.n += 1;
  }
  const total = aportes.reduce((s, v) => s + v, 0);
  const top = Math.max(1, Math.round(aportes.length * 0.2));
  const aporteTop = orden.slice(-top).reduce((s, v) => s + v, 0);
  const mitad = orden.length % 2
    ? orden[(orden.length - 1) / 2]!
    : (orden[orden.length / 2 - 1]! + orden[orden.length / 2]!) / 2;
  const scoreNegativo = (filas ?? []).filter((r) => {
    const sc = num(r.selector_score);
    return sc != null && sc < 0;
  }).length;
  return {
    bins,
    maxN: Math.max(...bins.map((b) => b.n)),
    titulares: aportes.length,
    total,
    mediana: mitad,
    concentracionTop20: total > 0 ? aporteTop / total : 0,
    scoreNegativo,
  };
}
