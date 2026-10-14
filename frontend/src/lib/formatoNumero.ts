// Formateador compartido de cifras para la interfaz.
//
// Prosecnur escribe todas sus cifras con la convención `es-PE` de CLDR:
// **coma de millares y punto decimal** («17,124», «1,234.5»). No es la
// convención de `es-ES` («1.234,5»); quien construya un guard o un test
// sobre esa premisa le pone un motivo falso.
//
// Existe porque la misma pantalla mostraba «3,318» en un panel y «3318» en
// el de al lado (P-M5 de la ronda de pulido): cada vista formateaba a su
// manera o no formateaba. Un conteo que llega a la UI pasa por aquí.
//
// Los `Intl.NumberFormat` se construyen una sola vez: crearlos por llamada
// es caro y en tablas de cientos de filas se nota.

const LOCALE = "es-PE";

const enteros = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalesCache = new Map<number, Intl.NumberFormat>();

function decimales(digitos: number): Intl.NumberFormat {
  const clave = Math.max(0, Math.min(6, Math.trunc(digitos)));
  let fmt = decimalesCache.get(clave);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: clave,
    });
    decimalesCache.set(clave, fmt);
  }
  return fmt;
}

/** Texto que se muestra cuando no hay cifra (no es un cero). */
export const SIN_CIFRA = "—";

/**
 * Convierte la entrada en número finito o `null`.
 *
 * `null`, `undefined` y `""` son «sin dato», no cero: `Number(null)` vale 0 y
 * sin este guard un conteo ausente se pintaría como «0».
 */
export function numeroFinito(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Conteo entero con separador de millares: `17124` → «17,124». */
export function formatoConteo(valor: unknown, sinDato: string = SIN_CIFRA): string {
  const n = numeroFinito(valor);
  if (n == null) return sinDato;
  return enteros.format(Math.round(n));
}

/**
 * Cifra con hasta `digitos` decimales (sin ceros de relleno):
 * `1234.5` → «1,234.5», `50` → «50».
 */
export function formatoDecimal(
  valor: unknown,
  digitos = 1,
  sinDato: string = SIN_CIFRA,
): string {
  const n = numeroFinito(valor);
  if (n == null) return sinDato;
  return decimales(digitos).format(n);
}

/**
 * Conteo con su sustantivo concordado: `formatoConteoDe(1, "etiqueta")` →
 * «1 etiqueta»; `formatoConteoDe(1234, "variable")` → «1,234 variables».
 * El plural por defecto añade «s»; pásalo si es irregular.
 */
export function formatoConteoDe(
  valor: unknown,
  singular: string,
  plural: string = `${singular}s`,
  sinDato: string = SIN_CIFRA,
): string {
  const n = numeroFinito(valor);
  if (n == null) return sinDato;
  const redondeado = Math.round(n);
  return `${enteros.format(redondeado)} ${Math.abs(redondeado) === 1 ? singular : plural}`;
}
