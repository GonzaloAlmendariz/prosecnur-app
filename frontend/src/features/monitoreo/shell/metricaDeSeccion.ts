/**
 * La insignia de una píldora de sección (L20, Meta B). Una cifra de avance no
 * se publica sin su base: «106 %» va con «423/400» a la vista cuando la barra
 * tiene sitio, y siempre en el `title` y en el nombre accesible. Las insignias
 * que son conteos (Control «23») siguen siendo un texto suelto.
 */

export type MetricaConBase = {
  /** Lo que se lee en la cápsula: «106 %». */
  valor: string;
  /** La base compacta, numerador sobre denominador: «423/400». */
  base?: string;
  /** La base dicha entera, para `title` y lector de pantalla: «423 efectivas de una meta de 400». */
  lectura?: string;
};

export type MetricaDeSeccion = string | MetricaConBase;

export function normalizarMetrica(metrica: MetricaDeSeccion | null | undefined): MetricaConBase | null {
  if (metrica == null) return null;
  if (typeof metrica === "string") return metrica ? { valor: metrica } : null;
  return metrica.valor ? metrica : null;
}

/** «Avance, 106 %, 423 efectivas de una meta de 400: Efectivas y ritmo». */
export function nombreDeLaPildora(etiqueta: string, metrica: MetricaConBase | null, descripcion: string): string {
  if (!metrica) return `${etiqueta}: ${descripcion}`;
  const lectura = metrica.lectura ?? metrica.base;
  return lectura
    ? `${etiqueta}, ${metrica.valor}, ${lectura}: ${descripcion}`
    : `${etiqueta}, ${metrica.valor}: ${descripcion}`;
}

/** El tooltip: la cifra con su base en la primera línea y qué hay en la sección en la segunda. */
export function tituloDeLaPildora(etiqueta: string, metrica: MetricaConBase | null, descripcion: string): string {
  if (!metrica) return `${etiqueta}: ${descripcion}`;
  const lectura = metrica.lectura ?? metrica.base;
  return `${etiqueta}: ${metrica.valor}${lectura ? `, ${lectura}` : ""}\n${descripcion}`;
}
