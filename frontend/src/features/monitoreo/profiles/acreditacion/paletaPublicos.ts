/**
 * Paleta de públicos de Acreditación — hermana de `tonoDePabellon` (Sistema
 * Pabellón, perfil de aulas).
 *
 * Un público se pinta del mismo color en todas las piezas de Avance (Correo:
 * embudo, matriz, cronología e inválidos; Cuotas: tarjetas). La letra inicial
 * no sirve aquí como en los pabellones: «Docentes Campus» y «Docentes
 * contratados» comparten letra. El tono sale de un hash del nombre normalizado
 * y, si dos públicos del MISMO estudio chocan, el segundo en orden alfabético
 * toma el siguiente tono libre. Determinista: sin reloj, sin azar y sin
 * depender del orden en que llegan del backend.
 *
 * Los tonos son índices; el color vive en `paletaPublicos.css` (clases
 * `es-publico-N` sobre tokens `--pulso-*`).
 */

/** Cuántos tonos declara la hoja. Subirlo exige declarar la clase nueva. */
export const TONOS_DE_PUBLICO = 10;

/** Públicos que no son un público del universo: van en neutro. */
const SIN_TONO = new Set(["", "fuera del universo", "sin público", "sin publico"]);

function normalizar(nombre: string): string {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** FNV-1a de 32 bits: barato, estable y bien repartido para nombres cortos. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Tono preferido de un nombre, sin mirar a sus vecinos; `null` si es neutro. */
export function tonoPreferido(nombre: string): number | null {
  const n = normalizar(nombre);
  if (SIN_TONO.has(n)) return null;
  return hash(n) % TONOS_DE_PUBLICO;
}

export type PaletaDePublicos = ReadonlyMap<string, number | null>;

/**
 * Asigna un tono a cada público del estudio. Con hasta `TONOS_DE_PUBLICO`
 * públicos con tono, ninguno se repite.
 */
export function paletaDePublicos(nombres: Iterable<string>): PaletaDePublicos {
  const unicos = [...new Set([...nombres].map((n) => String(n ?? "").trim()))]
    .sort((a, b) => a.localeCompare(b, "es"));
  const usados = new Set<number>();
  const out = new Map<string, number | null>();
  for (const nombre of unicos) {
    const preferido = tonoPreferido(nombre);
    if (preferido == null) {
      out.set(nombre, null);
      continue;
    }
    let tono = preferido;
    if (usados.size < TONOS_DE_PUBLICO) {
      while (usados.has(tono)) tono = (tono + 1) % TONOS_DE_PUBLICO;
    }
    usados.add(tono);
    out.set(nombre, tono);
  }
  return out;
}

/** Clase CSS del público: `es-publico-N` o `es-publico-neutro`. */
export function clasePublico(paleta: PaletaDePublicos, nombre: string): string {
  const clave = String(nombre ?? "").trim();
  const tono = paleta.has(clave) ? paleta.get(clave) ?? null : tonoPreferido(clave);
  return tono == null ? "es-publico-neutro" : `es-publico-${tono}`;
}
