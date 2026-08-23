// textoVisible.ts — qué texto pinta de verdad una pantalla.
//
// Infraestructura de los guardianes de vocabulario. Vive en un solo sitio porque
// el defecto que más se repite en este dominio es tener la misma regla escrita
// en dos lados: dos extractores acabarían divergiendo, y el que se quedara atrás
// daría verde sin mirar lo mismo.
//
// Dos precisiones que hacen que sirva:
//
// - **Los comentarios quedan fuera.** Ahí SÍ deben usarse los nombres reales del
//   motor: son el rastro hasta el código que manda.
// - **El JSX parte expresiones en varias líneas**, así que el extractor pesca
//   trozos de código —«{adapterId ===», «renderAulasView( seccionActiva,»—. Un
//   falso positivo gasta el crédito del guardián, así que se filtran.

/** Señales de que una línea es código y no copy. */
const PARECE_CODIGO = [
  /[{}]/, /===/, /=>/, /\?\?/, /\|\|/,
  // Llamada a función o continuación de argumentos.
  /[A-Za-z_$][\w$]*\s*\(/, /,\s*$/, /^\s*[A-Za-z_$][\w$]*\s*,/,
];

/**
 * El texto que la pantalla pinta: literales JSX y atributos de copy.
 *
 * @param fuente contenido del `.tsx`.
 */
export function textoVisibleDe(fuente: string): string[] {
  const limpio = fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const jsx = [...limpio.matchAll(/>\s*([^<>{}\n][^<>{}]{6,160})\s*</g)].map((m) => m[1]);
  const attrs = [...limpio.matchAll(
    /(?:title|label|eyebrow|empty|lead|placeholder|aria-label)=["']([^"']{6,160})["']/g,
  )].map((m) => m[1]);
  return [...jsx, ...attrs]
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((t) => !PARECE_CODIGO.some((re) => re.test(t)));
}

/**
 * Términos de arquitectura: significan algo dentro del código y nada fuera.
 *
 * La lista no es una opinión de estilo. Cada uno salió de una pantalla real que
 * lo enseñaba: «ejecuta el preflight», «QR autoritativo del backend», «recibo de
 * artefacto renderizado», «Deployment → Monitoreo».
 */
export const JERGA_DE_ARQUITECTURA = [
  "preflight", "deployment", "idempotente", "payload", "binding",
  "adapter", "backend", "artefacto renderizado", "fingerprint",
  "plantilla semántica", "recipient link", "autoritativo",
  "snapshot", "endpoint",
];

/** Los términos de jerga que aparecen en el texto visible de un fuente. */
export function jergaVisibleEn(fuente: string, jerga = JERGA_DE_ARQUITECTURA): string[] {
  return textoVisibleDe(fuente).flatMap((linea) =>
    jerga
      .filter((termino) => linea.toLowerCase().includes(termino))
      .map((termino) => `«${termino}» en: ${linea.slice(0, 80)}`));
}
