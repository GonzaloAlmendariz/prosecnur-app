// Colores por serie en la tarjeta de un gráfico (C45, A10 W-D). Modelo puro: a qué gráfico aplica, qué se lee y qué se
// escribe en su arg de color, y qué color dibujará el motor en cada serie.
//
// Sólo donde la lámina NATIVA lee el color (verificado en api/R, sólo lectura, 2026-10-11):
// - `p_serie_temporal.colores_series`: `p_serie_temporal()` lo pasa por `overrides` (graficos_serie_temporal_plan.R:154);
//   el render lo mezcla con el preset con `modifyList` (:202) y `graficar_serie_temporal` lo resuelve con
//   `.graficos_mk_palette(niveles_serie, pal_user = colores_series)` (graficador_serie_temporal.R:30,214). Ese vector va a
//   la espec nativa de dos mediciones (`.espec_serie_dos`, graficos_espec_numericos.R:79) y al dibujo del recetario de
//   tres o más. Las claves son los nombres de los temas (`names(vars)`), en su orden.
// - `p_barras_categoricas.colores_categorias` NO entra: la lámina nativa pinta las barras con el azul del recetario y la
//   mayor destacada (`.lam_columnas`/`.lam_barras_h`, lamina_categorica.R:15,43; `preparar_categorica` no lleva color).
//   Sólo lo lee la ruta anterior, cuando los rótulos no caben. Ofrecerlo en la tarjeta prometería un color que la lámina
//   no dibuja (C5): queda a decisión (paridad C45).
//
// Forma que el motor lee: objeto nombrado `{ "Tema": "#RRGGBB" }` (jsonlite → lista nombrada). ADR 0094: se guarda la
// decisión, no el default; clave ausente = «Del recetario», presente = «Propio»; «Volver al recetario» borra la clave y
// un mapa vacío borra el arg.

type Registro = Record<string, unknown>;

/** Paleta base del motor (`base_pal` de `.graficos_mk_palette`, graficador_paleta.R), con un nombre legible por color. */
export const PALETA_RECETARIO: readonly { hex: string; nombre: string }[] = [
  { hex: "#0B4F8C", nombre: "Azul" },
  { hex: "#2A9D8F", nombre: "Verde azulado" },
  { hex: "#E9C46A", nombre: "Amarillo" },
  { hex: "#F4A261", nombre: "Naranja claro" },
  { hex: "#E76F51", nombre: "Coral" },
  { hex: "#7A9E9F", nombre: "Gris verdoso" },
  { hex: "#6D597A", nombre: "Morado" },
  { hex: "#5B8DEF", nombre: "Azul claro" },
];
const BASE_PAL = PALETA_RECETARIO.map((c) => c.hex);

export type ColoresDelGrafico = { arg: string; rotulo: string; nombres: (args: Readonly<Registro>) => string[] };

/** Los temas de una serie temporal (`vars` nombrado), en su orden y sin nombres vacíos ni repetidos. */
export function temasDeSerie(args: Readonly<Registro>): string[] {
  const v = args.vars;
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  return [...new Set(Object.keys(v).map((k) => k.trim()).filter(Boolean))];
}

const CON_COLORES: Readonly<Record<string, ColoresDelGrafico>> = {
  p_serie_temporal: { arg: "colores_series", rotulo: "Colores por serie", nombres: temasDeSerie },
};

/** El arg de color del gráfico, si la lámina nativa lo lee y el registro lo declara como `series_colors`. */
export function coloresDelGrafico(graficador: string, argsDelRegistro: readonly { name: string; tipo_input?: string }[]): ColoresDelGrafico | null {
  const c = CON_COLORES[graficador];
  if (!c) return null;
  return argsDelRegistro.some((a) => a.name === c.arg && a.tipo_input === "series_colors") ? c : null;
}

/** `#rgb`/`#rrggbb` → `#RRGGBB`; cualquier otra cosa, `null`. Es lo único que se escribe. */
export function normalizarHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  const corto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (corto) return `#${corto[1]}${corto[1]}${corto[2]}${corto[2]}${corto[3]}${corto[3]}`.toUpperCase();
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null;
}

/**
 * El mapa guardado, tal como el motor lo empareja: objeto nombrado, o lista posicional sobre `nombres` (formato que el
 * Editor anterior aceptaba). Lo que no es color se descarta, como hace el saneo de `.graficos_mk_palette`. El hex se
 * conserva como está escrito: el motor compara colores como texto.
 */
export function leerColores(valor: unknown, nombres: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(valor)) {
    valor.forEach((c, i) => {
      const n = nombres[i];
      if (n && typeof c === "string" && normalizarHex(c)) out[n] = c.trim();
    });
    return out;
  }
  if (!valor || typeof valor !== "object") return out;
  for (const [k, c] of Object.entries(valor as Registro)) {
    const n = k.trim();
    if (n && typeof c === "string" && normalizarHex(c)) out[n] = c.trim();
  }
  return out;
}

export type OrigenColor = "propio" | "informe" | "recetario";
export type ColorDeSerie = {
  nombre: string;
  /** El color que dibujará el motor; `null` cuando lo decide su rampa automática (más series que la paleta). */
  hex: string | null;
  origen: OrigenColor;
};

/**
 * Lo que dibuja el motor, serie por serie (espejo de `.graficos_mk_palette`): sin ningún color nombrado, la paleta base por
 * posición; con alguno, cada serie nombrada lleva el suyo y las demás toman, en orden, los colores de la paleta que
 * nadie usa. `propios` manda sobre `heredados` (el preset del informe), como el `modifyList` del render.
 *
 * Límite conocido: sin colores nombrados, una lista de temas con forma de escala Likert toma la paleta Likert; los temas
 * de una serie no la tienen, así que no se replica.
 */
export function coloresEfectivos(
  nombres: readonly string[],
  propios: Readonly<Record<string, string>>,
  heredados: Readonly<Record<string, string>> = {},
): ColorDeSerie[] {
  const usados = nombres.map((n) => propios[n] ?? heredados[n] ?? null);
  const hayNombrados = Object.keys(propios).length > 0 || Object.keys(heredados).length > 0;
  if (!hayNombrados) {
    const caben = nombres.length <= BASE_PAL.length;
    return nombres.map((nombre, i) => ({ nombre, hex: caben ? BASE_PAL[i] : null, origen: "recetario" }));
  }
  const ocupados = new Set(usados.filter((c): c is string => c !== null));
  const libres = BASE_PAL.filter((c) => !ocupados.has(c));
  let k = 0;
  return nombres.map((nombre, i) => {
    const c = usados[i];
    if (c !== null) return { nombre, hex: c, origen: nombre in propios ? "propio" : "informe" };
    const libre = libres[k] ?? null;
    k += 1;
    return { nombre, hex: libre, origen: "recetario" };
  });
}

/** Nombre legible de un color: el de la paleta del recetario o, si no es de ella, su código. */
export function nombreDeColor(hex: string | null): string {
  if (!hex) return "Automático";
  const n = normalizarHex(hex);
  return PALETA_RECETARIO.find((c) => c.hex === n)?.nombre ?? n ?? hex;
}

/**
 * Patch de args al elegir `hex` para `nombre` (`null` = «Volver al recetario»). Elegir el color que el motor ya le daría
 * sin decisión también borra la clave (ADR 0094). Las demás claves guardadas se conservan tal cual, aunque nombren un
 * tema que hoy no está; un mapa que queda vacío borra el arg.
 */
export function patchColor(
  arg: string,
  valorActual: unknown,
  nombres: readonly string[],
  heredados: Readonly<Record<string, string>>,
  nombre: string,
  hex: string | null,
): Registro {
  const mapa = Array.isArray(valorActual) ? leerColores(valorActual, nombres) : registroDeColores(valorActual);
  delete mapa[nombre];
  const elegido = normalizarHex(hex);
  if (elegido) {
    const sinDecision = coloresEfectivos(nombres, leerColores(mapa, nombres), heredados).find((c) => c.nombre === nombre)?.hex ?? null;
    if (normalizarHex(sinDecision) !== elegido) mapa[nombre] = elegido;
  }
  return { [arg]: Object.keys(mapa).length ? mapa : null };
}

/** Copia del objeto guardado, sin tocar sus claves (sólo descarta lo que no es texto). */
function registroDeColores(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, c] of Object.entries(v as Registro)) if (typeof c === "string") out[k] = c;
  return out;
}
