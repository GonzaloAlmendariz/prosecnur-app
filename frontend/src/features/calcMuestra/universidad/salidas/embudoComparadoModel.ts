/**
 * Modelo puro del embudo comparado 2025↔hoy, facultad por facultad.
 *
 * Gonzalo, sobre Coincidencia: «en Datos la pestaña histórica tiene un montón
 * de gráficos interesantes que en Entrega y Coincidencia no existen cuando
 * deberían hacerlo». El gráfico que faltaba es éste: para cada paso del
 * embudo, las quince facultades con su barra de HOY contra la de 2025, a la
 * misma escala, para ver de un vistazo DÓNDE los dos estudios no coinciden.
 *
 * Sólo proyecta las cifras que `fichaFacultadModel` ya enfrentó (hoy/antes por
 * paso); no recalcula nada. Un dato ausente viaja `null` y se dice — nunca se
 * coacciona a 0, porque un 0 se leería como medido (`Number(null)` es 0, no
 * NaN: trampa conocida del repo).
 */
import type { FichaFacultad } from "../criterios/fichaFacultadModel";

export type FilaEmbudoComparado = {
  facultad: string;
  hoy: number | null;
  antes: number | null;
  /** hoy − antes; null si falta cualquiera de los dos. */
  delta: number | null;
};

export type PasoComparado = {
  n: number;
  titulo: string;
  filas: FilaEmbudoComparado[];
  /** Máximo de todas las barras del paso; las barras se escalan contra esto. */
  escala: number;
  /** Cuántas facultades tienen ambas cifras (las comparables de verdad). */
  comparables: number;
};

/** Pasos que vale la pena comparar: los que tienen columna de 2025 en al
 *  menos una facultad. El paso 6 («Aulas que sobran») no tiene histórico por
 *  diseño y se excluye siempre. */
export function pasosComparables(fichas: FichaFacultad[]): Array<{ n: number; titulo: string }> {
  const vistos = new Map<number, { titulo: string; conAntes: boolean }>();
  for (const ficha of fichas) {
    for (const paso of ficha.pasos) {
      const previo = vistos.get(paso.n);
      vistos.set(paso.n, {
        titulo: paso.titulo,
        conAntes: (previo?.conAntes ?? false) || paso.antes != null,
      });
    }
  }
  return [...vistos.entries()]
    .filter(([, v]) => v.conAntes)
    .sort(([a], [b]) => a - b)
    .map(([n, v]) => ({ n, titulo: v.titulo }));
}

export function pasoComparado(fichas: FichaFacultad[], n: number): PasoComparado {
  const filas: FilaEmbudoComparado[] = [];
  let titulo = "";
  for (const ficha of fichas) {
    const paso = ficha.pasos.find((p) => p.n === n);
    if (!paso) continue;
    if (!titulo) titulo = paso.titulo;
    filas.push({
      facultad: ficha.facultad,
      hoy: paso.hoy,
      antes: paso.antes,
      delta: paso.hoy != null && paso.antes != null ? paso.hoy - paso.antes : null,
    });
  }
  // Orden por la cifra de HOY, y las facultades sin cifra al final: el lector
  // ve primero lo que existe y al fondo lo que falta por medir.
  filas.sort((a, b) => (b.hoy ?? -1) - (a.hoy ?? -1));
  const escala = filas.reduce(
    (max, f) => Math.max(max, f.hoy ?? 0, f.antes ?? 0),
    0,
  );
  return {
    n,
    titulo,
    filas,
    escala,
    comparables: filas.filter((f) => f.delta != null).length,
  };
}
