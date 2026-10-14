// De qué paleta toma sus colores cada lista del instrumento (ADR 0097, P1a). Espejo del resolvedor del backend, que es
// el que dibuja: (a) nombre exacto de la lista, ± s/es (`.paleta_auto`, reporte_plan_ppt.R); (b) vínculo explícito
// `config.paletas_vinculos[list_name] = clave`; (c) firma de opciones: una paleta cuyas etiquetas, normalizadas sin caja,
// tildes ni espacios repetidos, coinciden COMO CONJUNTO con las opciones de la lista.
//
// Sin React ni store: los colores por respuesta de la pestaña Estilo y el conteo de la sección (`listasConColor`) leen de
// aquí, así que lo que la pantalla dice y lo que el motor pinta no pueden divergir sin que un test lo note.

import { normalizePaletasVinculos } from "../../api/graficosConfigNormalizer";

export type PaletaColores = Record<string, string>;
export type MapaPaletas = Record<string, PaletaColores>;
export type VinculosPaletas = Record<string, string>;

/** Lo mínimo de una lista del instrumento que el resolvedor necesita (encaja con `PaletaSugeridaEntry`). */
export type ListaConOpciones = { list_name: string; choices: ReadonlyArray<{ label: string }> };

export type OrigenPaleta = "propia" | "vinculo" | "firma";

export type ResolucionPaleta = {
  origen: OrigenPaleta;
  /** Clave de `paletas` de la que salen los colores. */
  clave: string;
};

/** Caja, tildes y espacios repetidos son accidentes de transcripción, no otra opción (ADR 0097; `escala_firma.R`). */
export function normalizarEtiquetaPaleta(etiqueta: string): string {
  return String(etiqueta ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Firma de un juego de opciones: el CONJUNTO de etiquetas normalizadas. El orden y los duplicados no cuentan. */
export function firmaOpciones(etiquetas: Iterable<string>): string {
  const set = new Set<string>();
  for (const etiqueta of etiquetas) {
    const n = normalizarEtiquetaPaleta(etiqueta);
    if (n) set.add(n);
  }
  return Array.from(set).sort().join("\u001f");
}

/** Etiquetas de una paleta con un color de verdad (un hex vacío no es una decisión). */
export function etiquetasConColor(paleta: PaletaColores | undefined | null): string[] {
  if (!paleta || typeof paleta !== "object") return [];
  return Object.entries(paleta)
    .filter(([, color]) => typeof color === "string" && color.trim() !== "")
    .map(([etiqueta]) => etiqueta);
}

export function paletaTieneColor(paleta: PaletaColores | undefined | null): boolean {
  return etiquetasConColor(paleta).length > 0;
}

/** Los nombres con los que el motor busca la paleta de una lista: el nombre, sin `s`/`es` final y con `s`/`es` (`.paleta_auto`). */
export function candidatosNombre(listName: string): string[] {
  const ln = String(listName ?? "").trim();
  if (!ln) return [];
  const out = [ln];
  if (/s$/.test(ln)) out.push(ln.replace(/s$/, ""));
  if (/es$/.test(ln)) out.push(ln.replace(/es$/, ""));
  out.push(`${ln}s`, `${ln}es`);
  return Array.from(new Set(out.map((x) => x.trim()).filter(Boolean)));
}

/** Clave de la paleta propia de una lista, si la hay (el primer candidato con color, en el orden del motor). */
export function clavePropia(listName: string, paletas: MapaPaletas): string | null {
  for (const candidato of candidatosNombre(listName)) {
    if (paletaTieneColor(paletas[candidato])) return candidato;
  }
  return null;
}

/**
 * Resuelve la paleta de una lista: nombre → vínculo → firma. `null` = la lista no tiene paleta y el motor usa el
 * recetario. Un vínculo a una clave sin colores (la paleta se vació o no viajó) no cuenta: se sigue a la firma.
 */
export function resolverPaleta(
  lista: ListaConOpciones,
  paletas: MapaPaletas,
  vinculos: VinculosPaletas = {},
): ResolucionPaleta | null {
  const propia = clavePropia(lista.list_name, paletas);
  if (propia) return { origen: "propia", clave: propia };

  const vinculada = vinculos[lista.list_name];
  if (typeof vinculada === "string" && paletaTieneColor(paletas[vinculada])) {
    return { origen: "vinculo", clave: vinculada };
  }

  const firma = firmaOpciones(lista.choices.map((c) => c.label));
  if (!firma) return null;
  for (const clave of Object.keys(paletas)) {
    const etiquetas = etiquetasConColor(paletas[clave]);
    if (etiquetas.length > 0 && firmaOpciones(etiquetas) === firma) return { origen: "firma", clave };
  }
  return null;
}

/**
 * Paletas guardadas que no corresponden por nombre a ninguna lista del instrumento («sin lista en este instrumento»):
 * vienen de un perfil (`acuerdo_4`, `likert`, `yesno`) o de otro proyecto. Sólo las que tienen algún color.
 */
export function clavesHuerfanas(paletas: MapaPaletas, listNames: Iterable<string>): string[] {
  const propias = new Set<string>();
  for (const ln of listNames) for (const c of candidatosNombre(ln)) propias.add(c);
  return Object.keys(paletas).filter((clave) => !propias.has(clave) && paletaTieneColor(paletas[clave]));
}

/** Listas que hoy toman sus colores de una clave dada, con el camino por el que llegan (vínculo o firma). */
export function listasQueUsan<L extends ListaConOpciones>(
  clave: string,
  listas: readonly L[],
  paletas: MapaPaletas,
  vinculos: VinculosPaletas = {},
): Array<{ lista: L; origen: OrigenPaleta }> {
  const out: Array<{ lista: L; origen: OrigenPaleta }> = [];
  for (const lista of listas) {
    const r = resolverPaleta(lista, paletas, vinculos);
    if (r && r.clave === clave) out.push({ lista, origen: r.origen });
  }
  return out;
}

/**
 * Sólo decisiones (ADR 0094/0097): claves y valores de texto no vacíos, y nunca una lista vinculada a su propio nombre
 * —eso ya lo resuelve el paso (a)—. Lo demás no se guarda. Una sola regla: la del normalizador de la config.
 */
export function vinculosDecisiones(raw: unknown): VinculosPaletas {
  return normalizePaletasVinculos(raw);
}

/** Vínculos con `listName → clave` puesto (o quitado con `null`). Devuelve el mismo objeto si no cambia nada. */
export function conVinculo(vinculos: VinculosPaletas, listName: string, clave: string | null): VinculosPaletas {
  const ln = listName.trim();
  const c = (clave ?? "").trim();
  if (!ln) return vinculos;
  if (!c || c === ln) {
    if (!(ln in vinculos)) return vinculos;
    const next = { ...vinculos };
    delete next[ln];
    return next;
  }
  if (vinculos[ln] === c) return vinculos;
  return { ...vinculos, [ln]: c };
}

/**
 * Listas del instrumento con colores por decisión del usuario: propia (por nombre) o vínculo. Una paleta huérfana no
 * es una lista con color —ninguna lista la usa por su nombre— y la firma es una inferencia, no una decisión.
 */
export function listasConColorDelInstrumento(
  listNames: Iterable<string>,
  paletas: MapaPaletas,
  vinculos: VinculosPaletas = {},
): number {
  let n = 0;
  for (const ln of new Set(listNames)) {
    if (clavePropia(ln, paletas)) n += 1;
    else if (typeof vinculos[ln] === "string" && paletaTieneColor(paletas[vinculos[ln]])) n += 1;
  }
  return n;
}

/**
 * Color de cada opción de `destino` según la paleta `origen`, cruzando por etiqueta normalizada. Sirve para agrupar
 * listas idénticas por firma: «Totalmente de Acuerdo» y «totalmente de acuerdo» reciben el mismo color aunque el orden
 * o la caja difieran entre listas.
 */
export function coloresPorEtiqueta(
  origen: PaletaColores,
  destino: ReadonlyArray<{ label: string }>,
): Array<{ label: string; color: string }> {
  const porNorm = new Map<string, string>();
  for (const [etiqueta, color] of Object.entries(origen)) {
    if (typeof color === "string" && color.trim() !== "") porNorm.set(normalizarEtiquetaPaleta(etiqueta), color);
  }
  const out: Array<{ label: string; color: string }> = [];
  for (const c of destino) {
    const color = porNorm.get(normalizarEtiquetaPaleta(c.label));
    if (color) out.push({ label: c.label, color });
  }
  return out;
}

/** La etiqueta de `lista` que corresponde a `etiqueta` por normalización, o `null` si no la tiene. */
export function etiquetaEquivalente(lista: ListaConOpciones, etiqueta: string): string | null {
  const n = normalizarEtiquetaPaleta(etiqueta);
  return lista.choices.find((c) => normalizarEtiquetaPaleta(c.label) === n)?.label ?? null;
}
