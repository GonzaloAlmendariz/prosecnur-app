// Ventana de filas del Editor XLSForm (E10, 2026-10-20): con 893 filas × 27 columnas montar todas las celdas cuesta
// cientos de ms por render. Sólo se montan las filas visibles más un margen; el resto se reemplaza por dos espaciadores
// con la altura que ocuparían. Las alturas medidas mandan; las no medidas usan la estimada.

export type Ventana = {
  /** Primera fila montada (incluida). */
  inicio: number;
  /** Última fila montada (excluida). */
  fin: number;
  /** Alto del espaciador previo a `inicio`. */
  arriba: number;
  /** Alto del espaciador posterior a `fin`. */
  abajo: number;
};

/** Offset (px, desde el inicio del cuerpo) de cada fila; el último elemento es el alto total. */
export function offsetsDeFilas(total: number, alturas: ReadonlyMap<number, number>, estimada: number): number[] {
  const offsets = new Array<number>(total + 1);
  offsets[0] = 0;
  for (let i = 0; i < total; i += 1) offsets[i + 1] = offsets[i]! + (alturas.get(i) ?? estimada);
  return offsets;
}

/** Primer índice cuyo final queda por debajo de `y` (búsqueda binaria sobre los offsets). */
function filaEn(offsets: readonly number[], y: number): number {
  let bajo = 0;
  let alto = offsets.length - 2;
  if (alto < 0) return 0;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (offsets[medio + 1]! <= y) bajo = medio + 1;
    else alto = medio;
  }
  return bajo;
}

export function calcularVentana(opciones: {
  offsets: readonly number[];
  /** scrollTop del contenedor menos lo que ocupa la cabecera. */
  desde: number;
  /** Alto visible del contenedor. */
  alto: number;
  /** Filas extra montadas a cada lado. */
  margen: number;
}): Ventana {
  const { offsets, desde, alto, margen } = opciones;
  const total = offsets.length - 1;
  if (total <= 0) return { inicio: 0, fin: 0, arriba: 0, abajo: 0 };
  const primera = filaEn(offsets, Math.max(0, desde));
  const ultima = filaEn(offsets, Math.max(0, desde + alto));
  const inicio = Math.max(0, primera - margen);
  const fin = Math.min(total, ultima + 1 + margen);
  return { inicio, fin, arriba: offsets[inicio]!, abajo: offsets[total]! - offsets[fin]! };
}

/** Distancia máxima (en filas) a la que se estira la ventana para no desmontar una fila fijada. */
const ESTIRAMIENTO_MAXIMO = 60;

/** Estira la ventana hasta incluir las filas fijadas cercanas (la que se edita, la que se va a enfocar). */
export function incluirFilas(ventana: Ventana, offsets: readonly number[], fijadas: readonly (number | null)[]): Ventana {
  const total = offsets.length - 1;
  let { inicio, fin } = ventana;
  for (const f of fijadas) {
    if (f === null || f < 0 || f >= total) continue;
    if (f < inicio && inicio - f <= ESTIRAMIENTO_MAXIMO) inicio = f;
    if (f >= fin && f - fin < ESTIRAMIENTO_MAXIMO) fin = f + 1;
  }
  if (inicio === ventana.inicio && fin === ventana.fin) return ventana;
  return { inicio, fin, arriba: offsets[inicio]!, abajo: offsets[total]! - offsets[fin]! };
}
