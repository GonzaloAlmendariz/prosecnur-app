// =============================================================================
// modeloCambiarPor.ts — «Cambiar por» sin perder el contenido (GOAL editor de
// correos profesional, L8; benchmark §5), sin React
// =============================================================================
// Las secciones comparten ranuras (`title`, `text`, `entries`, `image_ref`…):
// cambiar una por otra pasa cada ranura que el destino tiene. Lo que el
// destino no tiene NO se borra: queda en `guardado` (el render lo ignora) y
// vuelve al regresar. La forma (`layout`) y el encuadre (`crop`) son de cada
// tipo: se guardan por tipo y cada uno recupera los suyos. Los íconos de los
// beneficios, igual: una entrada de un paso no lleva ícono, pero el beneficio
// lo recupera al volver. Lo obligatorio que el destino exige y no venía se
// completa con su ejemplo y se anota (`guardado._relleno`): si nadie lo tocó,
// no viaja de vuelta como si fuera contenido. Las entradas respetan el rango
// de cada sección (`RANGO_DE_ENTRADAS`): las que no caben quedan guardadas
// (`entries_extra`) y vuelven donde caben; si faltan, se completan con las del
// ejemplo (`_relleno.entries_pad`) y, sin tocar, no viajan de vuelta.

import type { MailBlock, MailBlockType } from "../../../api/materialMail";
import { CLAVES_OBLIGATORIAS, esTipoDeSeccion, RANGO_DE_ENTRADAS, tieneEntradas } from "../../../api/materialMail";
import { bloqueNuevo, ROTULO_DE_BLOQUE } from "./modeloCorreo";

/** Las secciones que se cambian entre sí, en el orden de la biblioteca. */
export const TIPOS_INTERCAMBIABLES = ["feature", "steps", "deadline", "benefits", "quote", "faq", "contact"] as const;
export type TipoIntercambiable = (typeof TIPOS_INTERCAMBIABLES)[number];

/** Las ranuras de cada sección (espejo de `.CMAIL_BLOCK_KEYS`), sin `layout`/`crop`/`box`, que van aparte. */
export const RANURAS: Record<TipoIntercambiable, readonly string[]> = {
  feature: ["eyebrow", "title", "text", "image_ref", "alt", "button_text", "url"],
  steps: ["title", "entries", "image_ref", "alt"],
  deadline: ["eyebrow", "title", "text", "button_text", "url"],
  benefits: ["title", "entries"],
  quote: ["text", "name", "role", "image_ref", "alt"],
  faq: ["title", "entries"],
  contact: ["eyebrow", "name", "role", "text", "email", "phone", "image_ref", "alt"],
};

/** Sólo Destacado y Pasos tienen forma; las que llevan foto tienen encuadre. */
const CON_FORMA: ReadonlySet<string> = new Set(["feature", "steps"]);
const CON_ENCUADRE: ReadonlySet<string> = new Set(["feature", "steps", "quote", "contact"]);

export function esIntercambiable(type: MailBlockType | string): type is TipoIntercambiable {
  return (TIPOS_INTERCAMBIABLES as readonly string[]).includes(type);
}

type Contenido = Record<string, unknown>;
type Entrada = { title?: unknown; text?: unknown; icon?: unknown };

const vacio = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** Todo lo que el bloque sabe: lo guardado de antes y, encima, lo que hoy muestra. */
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function contenidoDe(block: MailBlock): Contenido {
  const raw = block as unknown as Contenido;
  const { _relleno, ...guardado } = (raw.guardado && typeof raw.guardado === "object" ? raw.guardado : {}) as Contenido;
  const relleno = (_relleno && typeof _relleno === "object" ? _relleno : {}) as Contenido;
  const out: Contenido = { ...guardado };
  for (const [k, v] of Object.entries(raw)) {
    if (k === "block_id" || k === "type" || k === "guardado" || vacio(v)) continue;
    // El ejemplo que puso el cambio anterior, sin tocar, no es contenido.
    if (k in relleno && igual(relleno[k], v)) continue;
    if (k === "layout" || k === "crop") out[`${raw.type}_${k}`] = v;
    else out[k] = v;
  }
  // Entradas: sin las de relleno que nadie tocó, y con las que no cabían antes, al final.
  delete out.entries_extra;
  if (Array.isArray(out.entries)) {
    let entries = out.entries as Entrada[];
    const pad = Array.isArray(relleno.entries_pad) ? (relleno.entries_pad as Entrada[]) : [];
    if (pad.length && igual(entries.slice(-pad.length), pad)) entries = entries.slice(0, -pad.length);
    // Los íconos de los beneficios se guardan aparte: una entrada sin ícono no los borra.
    if (raw.type === "benefits") out.icons = entries.map((e) => e.icon ?? null);
    out.entries = entries;
  }
  if (Array.isArray(guardado.entries_extra)) {
    out.entries = [...(Array.isArray(out.entries) ? (out.entries as Entrada[]) : []), ...(guardado.entries_extra as Entrada[])];
  }
  if (Array.isArray(out.entries) && !(out.entries as unknown[]).length) delete out.entries;
  return out;
}

/** El bloque cambiado de tipo, con todo lo que tenía: lo que el destino no muestra queda guardado. */
export function cambiarPor(block: MailBlock, tipo: TipoIntercambiable): MailBlock {
  if (!esIntercambiable(block.type) || block.type === tipo) return block;
  const todo = contenidoDe(block);
  const nuevo = bloqueNuevo(tipo, block.block_id) as unknown as Contenido;
  const out: Contenido = { block_id: block.block_id, type: tipo };
  const usadas = new Set<string>();
  for (const k of RANURAS[tipo]) {
    if (!vacio(todo[k])) { out[k] = todo[k]; usadas.add(k); }
  }
  // Lo obligatorio que no venía se completa con el ejemplo del tipo (la revisión lo marca si queda así).
  const obligatorias = [...(esTipoDeSeccion(tipo) ? CLAVES_OBLIGATORIAS[tipo] : ["title"]), ...(RANURAS[tipo].includes("entries") ? ["entries"] : [])];
  const relleno: Contenido = {};
  for (const k of obligatorias) {
    if (vacio(out[k]) && !vacio(nuevo[k])) { out[k] = nuevo[k]; relleno[k] = nuevo[k]; }
  }
  // Un botón sin enlace no vale: sin `url`, el texto del botón queda guardado.
  if (out.button_text !== undefined && vacio(out.url)) { delete out.button_text; usadas.delete("button_text"); }
  // La descripción viaja con su foto.
  if (out.image_ref === undefined) { delete out.alt; usadas.delete("alt"); }
  // Entradas en el rango del destino: lo que sobra queda guardado; lo que falta, del ejemplo.
  let extra: Entrada[] = [];
  if (tieneEntradas(tipo) && Array.isArray(out.entries) && !("entries" in relleno)) {
    const [minimo, maximo] = RANGO_DE_ENTRADAS[tipo];
    let entries = out.entries as Entrada[];
    if (entries.length > maximo) { extra = entries.slice(maximo); entries = entries.slice(0, maximo); }
    if (entries.length < minimo) {
      const pad = ((nuevo.entries as Entrada[]) ?? []).slice(entries.length, minimo);
      entries = [...entries, ...pad];
      relleno.entries_pad = pad;
    }
    out.entries = entries;
  }
  // Entradas: el ícono sólo en un beneficio; al volver a serlo, recupera los suyos.
  if (Array.isArray(out.entries)) {
    const icons = Array.isArray(todo.icons) ? (todo.icons as unknown[]) : [];
    out.entries = (out.entries as Entrada[]).map((e, i) => {
      const { icon: _icon, ...sinIcono } = e;
      if (tipo !== "benefits") return sinIcono;
      const icon = e.icon ?? icons[i];
      return icon ? { ...sinIcono, icon } : sinIcono;
    });
    if (Array.isArray(relleno.entries_pad)) relleno.entries_pad = (out.entries as Entrada[]).slice(-(relleno.entries_pad as unknown[]).length);
  }
  if (CON_FORMA.has(tipo) && todo[`${tipo}_layout`] !== undefined) out.layout = todo[`${tipo}_layout`];
  if (CON_ENCUADRE.has(tipo) && todo[`${tipo}_crop`] !== undefined && out.image_ref !== undefined) out.crop = todo[`${tipo}_crop`];
  if (todo.box !== undefined) out.box = todo.box;
  // Lo que no se muestra, guardado; los íconos sólo si hay alguno.
  const guardado: Contenido = {};
  for (const [k, v] of Object.entries(todo)) {
    if (k === "box" || usadas.has(k) || out[k] !== undefined) continue;
    if (k === "icons" && !(v as unknown[]).some(Boolean)) continue;
    if (k === `${tipo}_layout` || k === `${tipo}_crop`) continue;
    guardado[k] = v;
  }
  if (extra.length) guardado.entries_extra = extra;
  if (Object.keys(relleno).length) guardado._relleno = relleno;
  if (Object.keys(guardado).length) out.guardado = guardado;
  return out as unknown as MailBlock;
}

/** En el orden en que se lee una sección. */
const NOMBRE_DE_RANURA: Record<string, { nombre: string; plural?: boolean; femenino?: boolean }> = {
  eyebrow: { nombre: "el antetítulo" },
  title: { nombre: "el título" },
  text: { nombre: "el texto" },
  name: { nombre: "el nombre" },
  role: { nombre: "el cargo" },
  email: { nombre: "el correo" },
  phone: { nombre: "el teléfono" },
  entries: { nombre: "los elementos", plural: true },
  entries_extra: { nombre: "los elementos que no caben", plural: true },
  image_ref: { nombre: "la imagen", femenino: true },
  button_text: { nombre: "el botón" },
};

/** Lo que se dejaría de ver al cambiar a `tipo`, en el orden en que se lee. */
export function loQueQuedaGuardado(block: MailBlock, tipo: TipoIntercambiable): string[] {
  const cambiado = cambiarPor(block, tipo) as unknown as Contenido;
  const raw = block as unknown as Contenido;
  const guardado = (cambiado.guardado ?? {}) as Contenido;
  return Object.keys(NOMBRE_DE_RANURA).filter((k) => k === "entries_extra"
    ? Array.isArray(guardado.entries_extra) && guardado.entries_extra.length > 0
    : !vacio(raw[k]) && vacio(cambiado[k]));
}

/** La frase de la maqueta: «Pasa todo» o «La imagen y el botón quedan guardados, sin mostrarse». */
export function fraseDeCambio(block: MailBlock, tipo: TipoIntercambiable): string {
  const perdidas = loQueQuedaGuardado(block, tipo);
  if (!perdidas.length) return "Pasa todo";
  const nombres = perdidas.map((k) => NOMBRE_DE_RANURA[k].nombre);
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  const plural = perdidas.length > 1 || NOMBRE_DE_RANURA[perdidas[0]].plural;
  // Concuerda con lo que nombra: «la imagen queda guardada»; en plural mixto, masculino.
  const femenino = perdidas.every((k) => NOMBRE_DE_RANURA[k].femenino);
  const verbo = `${plural ? "quedan" : "queda"} guardad${femenino ? "a" : "o"}${plural ? "s" : ""}`;
  return `${lista[0].toUpperCase()}${lista.slice(1)} ${verbo}, sin mostrarse`;
}

export function rotuloDeDestino(tipo: TipoIntercambiable): string {
  return ROTULO_DE_BLOQUE[tipo];
}
