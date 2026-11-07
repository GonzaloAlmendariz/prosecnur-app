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

/** Clave estable del público para su clase propia (`es-publico-x-<clave>`). */
export function claveDePublico(nombre: string): string {
  return normalizar(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-nombre";
}

/**
 * Clase CSS del público: `es-publico-N` (o `es-publico-neutro`) más su clase
 * propia `es-publico-x-<clave>`, que es donde se engancha el color que el
 * equipo elija en Modelo › Cuotas (`reglasDeColores`). Así cambiar un color no
 * obliga a re-pintar a los consumidores: sólo cambia la hoja.
 */
export function clasePublico(paleta: PaletaDePublicos, nombre: string): string {
  const clave = String(nombre ?? "").trim();
  const tono = paleta.has(clave) ? paleta.get(clave) ?? null : tonoPreferido(clave);
  return tono == null ? "es-publico-neutro" : `es-publico-${tono} es-publico-x-${claveDePublico(clave)}`;
}

const HEX = /^#[0-9a-f]{6}$/;

/** Normaliza lo que el usuario escribe: «0f0», «#0F0», «#00ff00» -> «#00ff00»; `null` si no es un color. */
export function hexValido(texto: string): string | null {
  let hex = String(texto ?? "").trim().toLowerCase();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) hex = `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  return HEX.test(hex) ? hex : null;
}

/** Las reglas que pintan a cada público con el color elegido; doble clase para ganar a `es-publico-N`. */
export function reglasDeColores(colores: Readonly<Record<string, string>> | null | undefined): string {
  return Object.entries(colores ?? {})
    .map(([publico, valor]) => [claveDePublico(publico), hexValido(valor)] as const)
    .filter((par): par is readonly [string, string] => par[1] != null)
    .map(([clave, hex]) => `.es-publico-x-${clave}.es-publico-x-${clave} { --publico: ${hex}; }`)
    .join("\n");
}
