// Modelo del editor del índice (A5 rebanada 2b, W2; contrato docs/qa/contrato-vista-general-2b-f6-2026-10-11.md,
// «Datos» bloque Índice y E2). Puro: lee y escribe el payload de `p_slide_indice` sin cambiar su forma persistida.
//
// - Capítulos y subcapítulos siguen en `secciones` (uno por línea), `subindices` («Capítulo: sub») y `subtemas`.
// - Íconos por capítulo en `meta.iconos: string[]` ("" automático, "none" sin ícono; todo automático → sin clave). Se
//   lee `meta.iconos[k]` y, si falta, `iconos_focos[k]`, como `.lam_indice_iconos` (api/R/lamina_indice_focos.R). El
//   editor nunca escribe `iconos_focos`: la primera edición lo migra a `meta.iconos` y, como sin `iconos_focos` el motor
//   dejaría de elegir «círculos», declara `meta.composicion = "circulos"` si no estaba declarada (la salida no cambia).
// - `composicionIndiceEfectiva` replica `.lam_indice_composicion` y la normalización de `.lam_laminas_indice`: el
//   selector de composición nunca muestra otra que la que se exporta («el recetario siempre manda»).
// - El motor corta cada subíndice en el primer «:» o «|» (`reporte_plan_ppt.R`, `.indice_subindices_df`): un título con
//   esos signos y subcapítulos los perdería, así que esa edición no se escribe hasta corregirlo.

import type { Slide } from "../../../api/graficos";
import type { EstructuraInforme, LaminaEnEstructura } from "../laminas/modeloEstructura";
import { conSlideMeta, leerSlideMeta } from "../slideMeta";

export const ICONO_AUTOMATICO = "";
export const SIN_ICONO = "none";

/** `.lam_indice_cabe`: el recetario dibuja de 1 a 13 capítulos; más, y la lámina sale por la ruta anterior. */
export const MAX_CAPITULOS_RECETARIO = 13;

/** `.LAM_INDICE_COMPOSICIONES` (api/R/lamina_identidad.R). */
export const COMPOSICIONES_INDICE = ["arcos", "facetas", "circulos", "bloques"] as const;
export type ComposicionIndice = (typeof COMPOSICIONES_INDICE)[number];
/** «focos» es la elección explícita del estilo de bombillas de la ruta anterior (`.lam_indice_ruta_focos`). */
export type ComposicionIndiceEfectiva = ComposicionIndice | "focos";

export type CapituloIndice = {
  titulo: string;
  /** Uno por subcapítulo, en orden. El borrador guarda las líneas tal como se escriben; al guardar se limpian. */
  subcapitulos: string[];
  /** Nombre de la biblioteca del recetario, `ICONO_AUTOMATICO` o `SIN_ICONO`. */
  icono: string;
};

export type IndiceEditable = {
  capitulos: CapituloIndice[];
  /** Líneas de subíndice cuyo capítulo no existe: el motor no las dibuja, pero el editor no las borra en silencio. */
  huerfanos: string[];
};

/** Equivalentes del catálogo anterior en la biblioteca del recetario (`.LAM_INDICE_ICONOS_EQUIVALENTES`). */
const EQUIVALENTES_CATALOGO_ANTERIOR: Readonly<Record<string, string>> = {
  "target-arrow": "diana-flecha",
  bullseye: "target",
  "bar-chart-line-fill": "chart-column",
  "circle-user-round": "user-round",
};

/** El nombre que la biblioteca del recetario muestra para un ícono guardado (los del catálogo anterior, por su par). */
export function iconoEnBiblioteca(nombre: string): string {
  const base = nombre.replace(/\.(svg|png)$/i, "");
  return EQUIVALENTES_CATALOGO_ANTERIOR[base] ?? base;
}

// ---------------------------------------------------------------------------
// Lectura del payload (como el motor)
// ---------------------------------------------------------------------------

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `.indice_clean_vec`: texto por líneas o vector, sin vacíos. */
function lineas(value: unknown): string[] {
  if (value == null) return [];
  const crudo = Array.isArray(value) ? value.flatMap((v) => (v == null ? [] : String(v).split(/\r?\n/))) : String(value).split(/\r?\n/);
  return crudo.map((l) => l.trim()).filter((l) => l.length > 0);
}

/** `.lam_indice_ranuras`: ranuras por posición; los huecos quedan como "". */
function ranuras(value: unknown): string[] {
  if (value == null) return [];
  let lista: string[];
  if (Array.isArray(value)) {
    lista = value.map((e) => {
      if (esObjeto(e)) return String(e.icono ?? e.name ?? e.ruta ?? e.path ?? "");
      return e == null ? "" : String(e);
    });
  } else {
    lista = [String(value)];
  }
  if (lista.length === 1) lista = lista[0].split(/\r?\n/);
  return lista.map((x) => x.trim());
}

/** El `lleno` de `.lam_indice_focos`: un lógico vale si es TRUE; lo demás, si trae algún texto no vacío. */
function lleno(value: unknown): boolean {
  if (value == null) return false;
  const planos = Array.isArray(value) ? value.flat(Infinity) : esObjeto(value) ? Object.values(value) : [value];
  if (planos.length && planos.every((x) => typeof x === "boolean")) return planos.some((x) => x === true);
  return planos.some((x) => x != null && String(x).trim().length > 0);
}

const CLAVES_FOCOS = [
  "iconos_focos", "iconos_focos_fill", "iconos_focos_objeto_unico", "iconos_focos_diametro_cm", "iconos_focos_icon_scale",
  "iconos_focos_left_cm", "iconos_focos_top_cm",
] as const;

/** ¿El payload pide el índice de focos por sus ajustes? (`.lam_indice_focos` sin la parte de `meta`). */
export function pideFocos(payload: Readonly<Record<string, unknown>>): boolean {
  const estilo = esObjeto(payload.estilo) ? payload.estilo : {};
  return CLAVES_FOCOS.some((k) => lleno(payload[k])) || payload.redibujar_focos === true
    || estilo.redibujar_focos === true || lleno(estilo.iconos_focos);
}

/** Lo que el motor usa sin composición declarada: «círculos» si el plan pide focos y «arcos» (la 31) si no. */
export function composicionIndicePorDefecto(payload: Readonly<Record<string, unknown>>): ComposicionIndice {
  return pideFocos(payload) ? "circulos" : "arcos";
}

function composicionDeclarada(slide: Pick<Slide, "payload">): string | null {
  const v = (leerSlideMeta(slide) as Record<string, unknown>).composicion;
  const primero = Array.isArray(v) ? v[0] : v;
  if (primero == null) return null;
  const s = String(primero);
  return s.length ? s : null;
}

/** La composición con la que el motor exporta este índice (`.lam_indice_composicion` + `.lam_laminas_indice`). */
export function composicionIndiceEfectiva(slide: Pick<Slide, "payload">): ComposicionIndiceEfectiva {
  const declarada = composicionDeclarada(slide);
  if (declarada === null) return composicionIndicePorDefecto(slide.payload ?? {});
  const baja = declarada.toLowerCase();
  if (baja === "focos") return "focos";
  return (COMPOSICIONES_INDICE as readonly string[]).includes(baja) ? (baja as ComposicionIndice) : "arcos";
}

/** `.lam_clave`: sin tildes y en minúsculas. */
const clave = (s: string): string => s.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El primer «:» o «|» con su espacio alrededor (`regexpr("\\s*[:|]\\s*", line)` del motor). */
const SEPARADOR_SUBINDICE = /\s*[:|]\s*/;
const TIENE_SEPARADOR = /[:|]/;

/** El índice editable que hoy guarda el payload. */
export function leerIndice(payload: Readonly<Record<string, unknown>> | null | undefined): IndiceEditable {
  const p = payload ?? {};
  const titulos = lineas(p.secciones);
  const meta = esObjeto(p.meta) ? p.meta : {};
  const editor = ranuras(meta.iconos);
  const estilo = esObjeto(p.estilo) ? p.estilo : {};
  const focos = ranuras(p.iconos_focos ?? estilo.iconos_focos);
  const capitulos: CapituloIndice[] = titulos.map((titulo, k) => ({
    titulo,
    subcapitulos: [],
    icono: editor[k] ? editor[k] : focos[k] ?? "",
  }));

  const porClave = new Map<string, CapituloIndice[]>();
  for (const c of capitulos) porClave.set(clave(c.titulo), [...(porClave.get(clave(c.titulo)) ?? []), c]);
  const ultimo = capitulos[capitulos.length - 1];
  const huerfanos: string[] = [];
  const subindices = lineas(p.subindices);
  for (const linea of subindices) {
    const m = SEPARADOR_SUBINDICE.exec(linea);
    const destino = m && m.index > 0 ? porClave.get(clave(linea.slice(0, m.index))) : ultimo ? [ultimo] : undefined;
    const item = (m && m.index > 0 ? linea.slice(m.index + m[0].length) : linea).trim();
    if (!item) continue;
    if (!destino) { huerfanos.push(linea); continue; }
    for (const c of destino) c.subcapitulos.push(item);
  }
  // Sin subíndices, los subtemas cuelgan del último capítulo; con ellos el motor los ignora.
  if (!subindices.length && ultimo) ultimo.subcapitulos.push(...lineas(p.subtemas));
  return { capitulos, huerfanos };
}

// ---------------------------------------------------------------------------
// Avisos y escritura
// ---------------------------------------------------------------------------

export type CodigoAvisoIndice = "separador_en_titulo" | "titulo_vacio" | "demasiados_capitulos" | "huerfanos";

export type AvisoIndice = {
  codigo: CodigoAvisoIndice;
  texto: string;
  /** Capítulo (1-based) al que se refiere, si es de uno. */
  capitulo?: number;
  /** `true`: mientras siga, la edición no se guarda. */
  bloquea: boolean;
};

const limpias = (xs: readonly string[]): string[] => xs.map((x) => x.trim()).filter((x) => x.length > 0);

export function avisosIndice(indice: IndiceEditable): AvisoIndice[] {
  const avisos: AvisoIndice[] = [];
  indice.capitulos.forEach((c, i) => {
    const titulo = c.titulo.trim();
    if (!titulo) {
      avisos.push({ codigo: "titulo_vacio", capitulo: i + 1, bloquea: false,
        texto: `El capítulo ${i + 1} no tiene título: no sale en el índice hasta que lo tenga.` });
    } else if (TIENE_SEPARADOR.test(titulo) && limpias(c.subcapitulos).length > 0) {
      avisos.push({ codigo: "separador_en_titulo", capitulo: i + 1, bloquea: true,
        texto: `«${titulo}» lleva «:» o «|» y tiene subcapítulos: el motor los perdería. Quita el signo para guardar el índice.` });
    }
  });
  const n = indice.capitulos.filter((c) => c.titulo.trim()).length;
  if (n > MAX_CAPITULOS_RECETARIO) {
    avisos.push({ codigo: "demasiados_capitulos", bloquea: false,
      texto: `El recetario dibuja hasta ${MAX_CAPITULOS_RECETARIO} capítulos; con ${n}, el índice sale por la ruta anterior.` });
  }
  if (indice.huerfanos.length) {
    const h = indice.huerfanos.length;
    avisos.push({ codigo: "huerfanos", bloquea: false,
      texto: `${h} ${h === 1 ? "subcapítulo no corresponde" : "subcapítulos no corresponden"} a ningún capítulo: el motor no ${h === 1 ? "lo" : "los"} dibuja.` });
  }
  return avisos;
}

export type PatchIndice = {
  secciones: string;
  subtemas: string;
  subindices: string;
  meta: Record<string, unknown> | undefined;
  iconos_focos?: undefined;
  estilo?: Record<string, unknown>;
};

export type ResultadoSerializar = { ok: true; patch: PatchIndice } | { ok: false; avisos: AvisoIndice[] };

/**
 * El parche de `updateSlidePayload` que guarda este índice, o los avisos que lo bloquean. Los capítulos sin título no se
 * escriben; los íconos quedan alineados a los que sí.
 */
export function serializarIndice(slide: Pick<Slide, "payload">, indice: IndiceEditable): ResultadoSerializar {
  const bloqueos = avisosIndice(indice).filter((a) => a.bloquea);
  if (bloqueos.length) return { ok: false, avisos: bloqueos };
  const payload = slide.payload ?? {};
  const capitulos = indice.capitulos
    .map((c) => ({ titulo: c.titulo.trim(), subcapitulos: limpias(c.subcapitulos), icono: c.icono.trim() }))
    .filter((c) => c.titulo.length > 0);
  const subLineas = capitulos.flatMap((c) => c.subcapitulos.map((s) => `${c.titulo}: ${s}`));
  const iconos = capitulos.map((c) => c.icono);
  const declarada = composicionDeclarada(slide);
  const meta = conSlideMeta(slide, {
    iconos: iconos.some((x) => x !== ICONO_AUTOMATICO) ? iconos : undefined,
    // Migración: sin `iconos_focos` el motor volvería a «arcos»; se declara la que ya salía.
    ...(declarada === null && pideFocos(payload) ? { composicion: "circulos" } : {}),
  }).payload.meta as Record<string, unknown> | undefined;
  const patch: PatchIndice = {
    secciones: capitulos.map((c) => c.titulo).join("\n"),
    subtemas: capitulos.flatMap((c) => c.subcapitulos).join("\n"),
    subindices: [...subLineas, ...indice.huerfanos].join("\n"),
    meta,
  };
  if ("iconos_focos" in payload) patch.iconos_focos = undefined;
  if (esObjeto(payload.estilo) && "iconos_focos" in payload.estilo) {
    const { iconos_focos: _migrado, ...resto } = payload.estilo;
    patch.estilo = resto;
  }
  return { ok: true, patch };
}

/** Lo que el editor escribe, para saber si un borrador sigue correspondiendo al payload (deshacer lo descarta). */
export function firmaIndice(payload: Readonly<Record<string, unknown>> | null | undefined): string {
  const p = payload ?? {};
  const meta = esObjeto(p.meta) ? p.meta : {};
  const estilo = esObjeto(p.estilo) ? p.estilo : {};
  return JSON.stringify([p.secciones ?? null, p.subtemas ?? null, p.subindices ?? null, p.iconos_focos ?? null,
    estilo.iconos_focos ?? null, meta.iconos ?? null, meta.composicion ?? null]);
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

export function moverCapitulo(indice: IndiceEditable, desde: number, hasta: number): IndiceEditable {
  const n = indice.capitulos.length;
  if (desde < 0 || desde >= n || hasta < 0 || hasta >= n || desde === hasta) return indice;
  const capitulos = [...indice.capitulos];
  const [c] = capitulos.splice(desde, 1);
  capitulos.splice(hasta, 0, c);
  return { ...indice, capitulos };
}

export function conCapitulo(indice: IndiceEditable, i: number, cambio: Partial<CapituloIndice>): IndiceEditable {
  return { ...indice, capitulos: indice.capitulos.map((c, k) => (k === i ? { ...c, ...cambio } : c)) };
}

export function sinCapitulo(indice: IndiceEditable, i: number): IndiceEditable {
  return { ...indice, capitulos: indice.capitulos.filter((_, k) => k !== i) };
}

export function conCapituloNuevo(indice: IndiceEditable): IndiceEditable {
  return { ...indice, capitulos: [...indice.capitulos, { titulo: "", subcapitulos: [], icono: ICONO_AUTOMATICO }] };
}

// ---------------------------------------------------------------------------
// Desde la estructura del informe (decisión 22: botón explícito, aviso de desfase, el analista edita lo que resulta)
// ---------------------------------------------------------------------------

/** El título que el analista escribió en el separador; sin él, `construirEstructura` pone el nombre del tipo. */
const tituloSeparador = (l: LaminaEnEstructura): string => (l.titulo === l.tipoLabel ? "" : l.titulo.trim());

/**
 * El índice que dicta la estructura: un capítulo por separador de capítulo y, dentro, sus subcapítulos. Conserva el
 * ícono de los capítulos que siguen llamándose igual; las líneas huérfanas se descartan (el reemplazo es explícito).
 */
export function indiceDesdeEstructura(estructura: EstructuraInforme, anterior?: IndiceEditable): IndiceEditable {
  const iconos = new Map((anterior?.capitulos ?? []).map((c) => [clave(c.titulo), c.icono]));
  const capitulos: CapituloIndice[] = [];
  for (const nodo of estructura.nodos) {
    if (nodo.clase !== "capitulo") continue;
    const titulo = tituloSeparador(nodo.separador);
    capitulos.push({
      titulo,
      subcapitulos: nodo.subcapitulos.map((s) => tituloSeparador(s.separador)).filter((s) => s.length > 0),
      icono: iconos.get(clave(titulo)) ?? ICONO_AUTOMATICO,
    });
  }
  return { capitulos, huerfanos: [] };
}

const huella = (indice: IndiceEditable): string => JSON.stringify(
  indice.capitulos.filter((c) => c.titulo.trim()).map((c) => [clave(c.titulo), limpias(c.subcapitulos).map(clave)]),
);

/** ¿El índice dejó de reflejar los capítulos del informe? Sin capítulos en el informe no hay con qué comparar. */
export function indiceDesfasado(indice: IndiceEditable, estructura: EstructuraInforme): boolean {
  const informe = indiceDesdeEstructura(estructura);
  // Un índice vacío sigue al informe (el motor toma sus capítulos): no hay desfase que avisar.
  if (!informe.capitulos.length || !indice.capitulos.length) return false;
  return huella(indice) !== huella(informe);
}
