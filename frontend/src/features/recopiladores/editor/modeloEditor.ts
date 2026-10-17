/**
 * Modelo puro del editor sobre la página real (E1b, Material de campo).
 *
 * Todo lo que el editor decide sin React vive aquí: cómo se escribe y se lee
 * el foco, qué cara y qué bloque señala, dónde va una zona sobre la imagen,
 * de dónde sale el dato de cada bloque y cómo se edita UNA cara sin tocar las
 * demás. Las pantallas sólo lo pintan.
 */

import type { CSSProperties } from "react";

import type {
  CollectionBlockType,
  CollectionMaterialBlock,
  CollectionMaterialField,
  CollectionMaterialTemplate,
} from "../../../api/recopiladores";
import type {
  MaterialPreview,
  MaterialPreviewBbox,
  MaterialPreviewProblem,
  MaterialPreviewUndrawn,
  MaterialPreviewWarning,
  MaterialPreviewZone,
} from "../../../api/materialPreview";
import {
  bindingLabel,
  materialFieldBinding,
  rotuloDeBloque,
  TIPOS_QUE_SE_AGREGAN,
} from "../bloquesDeMaterial";

export type CaraDeReceta = CollectionMaterialTemplate["pages"][number];

// ---------------------------------------------------------------------------
// Foco: `<page_id>~<block_id>` o `<page_id>`
// ---------------------------------------------------------------------------

export const SEPARADOR_FOCO = "~";

export type FocoDelEditor = { pageId: string; blockId: string | null };

export function serializarFoco(foco: FocoDelEditor): string {
  return foco.blockId ? `${foco.pageId}${SEPARADOR_FOCO}${foco.blockId}` : foco.pageId;
}

export type FocoResuelto = {
  /** Índice de la cara señalada (0 si el foco no dice nada válido). */
  cara: number;
  /** Bloque señalado dentro de esa cara, si existe en ella. */
  blockId: string | null;
  /** La forma canónica del foco resuelto, o `null` si no queda nada que escribir. */
  canonico: string | null;
  /** La URL dice otra cosa que la forma canónica: hay que reescribirla (replace). */
  reescribir: boolean;
};

const SIN_FOCO: FocoResuelto = { cara: 0, blockId: null, canonico: null, reescribir: false };

function indiceDeCara(pages: readonly CaraDeReceta[], pageId: string): number {
  return pages.findIndex((page) => page.page_id === pageId);
}

/**
 * Lee el foco contra las caras de la receta.
 *
 * - `ficha~qr`: la cara `ficha` y su bloque `qr`.
 * - `ficha`: la cara, sin bloque.
 * - `qr` (alias de enlaces guardados): la primera cara que tenga ese bloque, y
 *   se pide reescribirlo a `ficha~qr`. Un page_id gana a un block_id del mismo
 *   nombre: el croquis se llama `croquis` como cara y como bloque.
 * - Lo que no resuelve se descarta: se reescribe sin foco.
 */
export function parseFoco(raw: string | null | undefined, pages: readonly CaraDeReceta[]): FocoResuelto {
  const texto = (raw ?? "").trim();
  if (!texto || !pages.length) return SIN_FOCO;
  const corte = texto.indexOf(SEPARADOR_FOCO);
  if (corte >= 0) {
    const pageId = texto.slice(0, corte);
    const blockId = texto.slice(corte + SEPARADOR_FOCO.length);
    const cara = indiceDeCara(pages, pageId);
    if (cara < 0) return { ...SIN_FOCO, reescribir: true };
    const existe = pages[cara].blocks.some((block) => block.block_id === blockId);
    if (!existe) return { cara, blockId: null, canonico: pageId, reescribir: true };
    return { cara, blockId, canonico: texto, reescribir: false };
  }
  const cara = indiceDeCara(pages, texto);
  if (cara >= 0) return { cara, blockId: null, canonico: texto, reescribir: false };
  const conBloque = pages.findIndex((page) => page.blocks.some((block) => block.block_id === texto));
  if (conBloque >= 0) {
    const canonico = serializarFoco({ pageId: pages[conBloque].page_id, blockId: texto });
    return { cara: conBloque, blockId: texto, canonico, reescribir: true };
  }
  return { ...SIN_FOCO, reescribir: true };
}

export function caraDelFoco(raw: string | null | undefined, pages: readonly CaraDeReceta[]): number {
  return parseFoco(raw, pages).cara;
}

/** El bloque que el editor muestra elegido: el del foco o, sin él, el primero de la cara. */
export function bloqueElegido(cara: CaraDeReceta | undefined, blockId: string | null): CollectionMaterialBlock | null {
  if (!cara) return null;
  return cara.blocks.find((block) => block.block_id === blockId) ?? cara.blocks[0] ?? null;
}

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

const ROTULO_DE_LAYOUT: Record<string, string> = {
  single_sheet: "Ficha de aula",
  field_form: "Ficha de campo",
  croquis_campus: "Croquis",
  poster_qr: "Afiche",
};

/** Cómo se llama una cara según lo que dibuja. */
export function rotuloDeCara(layoutPreset: string): string {
  return ROTULO_DE_LAYOUT[layoutPreset] ?? "Cara";
}

/** «Frente» y «Dorso» cuando la hoja va a doble cara; si no, nada. */
export function ladoDeCara(indice: number, total: number): string | null {
  if (total !== 2) return null;
  return indice === 0 ? "Frente" : "Dorso";
}

/**
 * Títulos del catálogo (`.cmc_presets()`, api/R/collection_material_catalog.R).
 * Un test los compara con la fuente para que no se separen.
 */
export const NOMBRE_DE_TIPO: Readonly<Record<string, string>> = {
  ficha_aplicacion_a4_v1: "Ficha de aula con QR",
  ficha_campo_qr_a4_v1: "Ficha de campo con croquis",
  afiche_qr_a4_v1: "Afiche QR",
};

export function nombreDeReceta(template: Pick<CollectionMaterialTemplate, "preset_id" | "pages">): string {
  return NOMBRE_DE_TIPO[template.preset_id] ?? rotuloDeCara(template.pages[0]?.layout_preset ?? "");
}

// ---------------------------------------------------------------------------
// Zonas sobre la imagen
// ---------------------------------------------------------------------------

function pct(valor: number): string {
  return `${Number((valor * 100).toFixed(4))}%`;
}

/** La caja de la zona como posición absoluta en % de la página. */
export function zonaAEstilo(bbox: MaterialPreviewBbox): CSSProperties {
  return { left: pct(bbox.x), top: pct(bbox.y), width: pct(bbox.w), height: pct(bbox.h) };
}

/** Nombre accesible de una zona: qué bloque es y en qué alto de la página está. */
export function nombreDeZona(rotulo: string, bbox: MaterialPreviewBbox): string {
  const desde = Math.round(bbox.y * 100);
  const hasta = Math.round((bbox.y + bbox.h) * 100);
  return `${rotulo}, del ${desde} al ${hasta} % del alto de la página`;
}

/** Las zonas de bloque de la vista, por block_id. Una zona derivada no se elige. */
export function zonasPorBloque(vista: MaterialPreview | null, pageId: string): Map<string, MaterialPreviewZone> {
  const mapa = new Map<string, MaterialPreviewZone>();
  if (!vista || vista.page_id !== pageId) return mapa;
  for (const zona of vista.zones) {
    if (zona.kind !== "block" || !zona.block_id) continue;
    if (zona.bbox.w <= 0 || zona.bbox.h <= 0) continue;
    if (!mapa.has(zona.block_id)) mapa.set(zona.block_id, zona);
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// De dónde sale el dato
// ---------------------------------------------------------------------------

/** Los bindings que llenan el bloque, en el orden en que aparecen. */
export function bindingsDelBloque(block: CollectionMaterialBlock): string[] {
  const salida: string[] = [];
  const sumar = (binding: unknown) => {
    if (typeof binding === "string" && binding && !salida.includes(binding)) salida.push(binding);
  };
  sumar(block.binding);
  for (const field of block.fields ?? []) sumar(materialFieldBinding(field as CollectionMaterialField));
  if (block.type === "form_lines" && Array.isArray(block.rows)) {
    for (const row of block.rows) {
      const cells = isRecord(row) && Array.isArray(row.fields) ? row.fields : [];
      for (const cell of cells) if (isRecord(cell)) sumar(cell.binding);
    }
  }
  return salida;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const DUENO_POR_FAMILIA: Record<string, string> = {
  unit: "Unidades (Cálculo de muestra)",
  access: "Accesos",
  deployment: "Accesos",
  project: "Proyecto",
};

export const TEXTO_DE_LA_RECETA = "Texto de la receta";

export type Procedencia = {
  /** Quién es dueño del dato que llena el bloque. */
  dueno: string;
  /** Lo llena cada unidad: se tiñe con el acento del módulo (ADR 0108 §7). */
  llenaLaUnidad: boolean;
};

/**
 * Quién llena el bloque. Si la vista ya lo dijo (`fills_from`), manda eso; si
 * no, se deduce de los bindings de la receta.
 */
export function procedencia(block: CollectionMaterialBlock, fillsFrom?: readonly string[]): Procedencia {
  const bindings = fillsFrom && fillsFrom.length ? [...fillsFrom] : bindingsDelBloque(block);
  const duenos: string[] = [];
  for (const binding of bindings) {
    const dueno = DUENO_POR_FAMILIA[binding.split(".")[0] ?? ""];
    if (dueno && !duenos.includes(dueno)) duenos.push(dueno);
  }
  return {
    dueno: duenos.length ? duenos.join(" y ") : TEXTO_DE_LA_RECETA,
    llenaLaUnidad: bindings.some((binding) => binding.startsWith("unit.")),
  };
}

/** Qué datos pinta el bloque, nombrados como en la pantalla. */
export function loLlena(block: CollectionMaterialBlock, fillsFrom?: readonly string[]): string {
  if (block.type === "brand_strip") return "Logos del estudio";
  if (block.type === "divider") return "Una línea";
  const bindings = fillsFrom && fillsFrom.length ? [...fillsFrom] : bindingsDelBloque(block);
  if (!bindings.length) return "Texto fijo";
  const nombres = bindings.map(bindingLabel);
  if (nombres.length <= 3) return nombres.join(" · ");
  return `${nombres.slice(0, 3).join(" · ")} y ${nombres.length - 3} más`;
}

/** Qué pasa en el papel cuando el dato no llega. */
export function siFalta(block: CollectionMaterialBlock): string {
  if (block.type === "access_qr") return "Sin accesos, la ficha no se genera";
  if (block.type === "campus_map") return "El campus sale sin resaltar, con aviso";
  const bindings = bindingsDelBloque(block);
  if (!bindings.length) return "No depende de datos";
  if (block.type === "form_lines" || block.type === "field_grid") return "Queda la raya para llenar a mano";
  return "Queda en blanco";
}

// ---------------------------------------------------------------------------
// Avisos por bloque
// ---------------------------------------------------------------------------

/** La nota de un bloque que la cara no dibuja. */
export function notaNoDibujado(item: Pick<MaterialPreviewUndrawn, "reason" | "type">): string {
  if (item.reason === "slot_taken") return `No se dibuja: ya hay un bloque «${rotuloDeBloque(item.type)}» en esta cara`;
  return "No se dibuja en esta cara";
}

export function textoDeAviso(code: string): string {
  if (code === "text_truncated") return "El texto no cabe entero y se corta";
  if (code.endsWith("_overflow")) return "No cabe en su espacio";
  if (code.startsWith("croquis_")) return "El croquis no encuentra el pabellón del aula";
  return "Hay un aviso al dibujarlo";
}

export type NotasDeBloque = {
  noDibujado: string | null;
  avisos: string[];
  problemas: string[];
};

const SIN_NOTAS: NotasDeBloque = { noDibujado: null, avisos: [], problemas: [] };

/**
 * Lo que hay que decir de cada bloque de la cara: si no se dibuja, sus avisos
 * de la vista y los problemas del borrador.
 */
export function notasDeLaCara(opts: {
  cara: CaraDeReceta;
  indice: number;
  vista: MaterialPreview | null;
  problemas: readonly MaterialPreviewProblem[];
}): { porBloque: Map<string, NotasDeBloque>; generales: string[] } {
  const { cara, indice, vista, problemas } = opts;
  const ids = new Set(cara.blocks.map((block) => block.block_id));
  const porBloque = new Map<string, NotasDeBloque>();
  const notas = (id: string) => {
    const actual = porBloque.get(id) ?? { noDibujado: null, avisos: [], problemas: [] };
    porBloque.set(id, actual);
    return actual;
  };
  if (vista && vista.page_id === cara.page_id) {
    for (const item of vista.undrawn) if (ids.has(item.block_id)) notas(item.block_id).noDibujado = notaNoDibujado(item);
    for (const aviso of vista.warnings) {
      if (!aviso.block_id || !ids.has(aviso.block_id) || !avisoDeEstaCara(aviso, indice)) continue;
      const texto = textoDeAviso(aviso.code);
      const lista = notas(aviso.block_id).avisos;
      if (!lista.includes(texto)) lista.push(texto);
    }
  }
  const generales: string[] = [];
  for (const problema of problemas) {
    const deEstaCara = problema.page_id ? problema.page_id === cara.page_id : problema.page === null || problema.page === indice + 1;
    const texto = problema.detail || problema.path;
    if (deEstaCara && problema.block_id && ids.has(problema.block_id)) {
      const lista = notas(problema.block_id).problemas;
      if (!lista.includes(texto)) lista.push(texto);
    } else if (!problema.block_id && (deEstaCara || (!problema.page_id && problema.page === null))) {
      if (!generales.includes(texto)) generales.push(texto);
    }
  }
  return { porBloque, generales };
}

function avisoDeEstaCara(aviso: MaterialPreviewWarning, indice: number): boolean {
  return aviso.page === null || aviso.page === indice + 1;
}

export function notasDe(mapa: Map<string, NotasDeBloque>, blockId: string): NotasDeBloque {
  return mapa.get(blockId) ?? SIN_NOTAS;
}

/** Problemas por cara, para marcar la cara que los tiene en el selector. */
export function carasConProblemas(pages: readonly CaraDeReceta[], problemas: readonly MaterialPreviewProblem[]): Set<number> {
  const salida = new Set<number>();
  for (const problema of problemas) {
    const indice = problema.page_id
      ? indiceDeCara(pages, problema.page_id)
      : problema.page !== null ? problema.page - 1 : -1;
    if (indice >= 0 && indice < pages.length) salida.add(indice);
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Edición de UNA cara
// ---------------------------------------------------------------------------

/** La receta con una sola cara cambiada; las demás quedan idénticas. */
export function conCara(
  template: CollectionMaterialTemplate,
  indice: number,
  cambiar: (blocks: CollectionMaterialBlock[]) => CollectionMaterialBlock[],
): CollectionMaterialTemplate {
  return {
    ...template,
    pages: template.pages.map((page, i) => (i === indice ? { ...page, blocks: cambiar(page.blocks) } : page)),
    template_sha256: null,
  };
}

export function actualizarBloque(
  template: CollectionMaterialTemplate,
  indice: number,
  blockId: string,
  patch: Partial<CollectionMaterialBlock>,
): CollectionMaterialTemplate {
  return conCara(template, indice, (blocks) => blocks.map((block) => (
    block.block_id === blockId ? { ...block, ...patch } : block
  )));
}

/**
 * El vecino con el que se intercambia al mover: el siguiente bloque que el
 * layout también apila. Cambiarlo por la cabecera, que el layout pinta siempre
 * arriba, movería el arreglo y no la tinta.
 */
function vecinoMovible(
  blocks: readonly CollectionMaterialBlock[],
  indice: number,
  direccion: -1 | 1,
  movibles: ReadonlySet<string>,
): number {
  for (let i = indice + direccion; i >= 0 && i < blocks.length; i += direccion) {
    if (movibles.has(blocks[i].block_id)) return i;
  }
  return -1;
}

export function puedeMover(
  blocks: readonly CollectionMaterialBlock[],
  blockId: string,
  direccion: -1 | 1,
  movibles: ReadonlySet<string>,
): boolean {
  const indice = blocks.findIndex((block) => block.block_id === blockId);
  if (indice < 0 || !movibles.has(blockId)) return false;
  return vecinoMovible(blocks, indice, direccion, movibles) >= 0;
}

export function moverBloque(
  blocks: readonly CollectionMaterialBlock[],
  blockId: string,
  direccion: -1 | 1,
  movibles: ReadonlySet<string>,
): CollectionMaterialBlock[] {
  const indice = blocks.findIndex((block) => block.block_id === blockId);
  if (indice < 0 || !movibles.has(blockId)) return [...blocks];
  const destino = vecinoMovible(blocks, indice, direccion, movibles);
  if (destino < 0) return [...blocks];
  const siguiente = [...blocks];
  [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
  return siguiente;
}

/** El QR y lo obligatorio no se quitan: sin ellos la ficha no sirve. */
export function puedeQuitar(block: CollectionMaterialBlock): boolean {
  return block.required !== true && block.type !== "access_qr";
}

export function quitarBloque(blocks: readonly CollectionMaterialBlock[], blockId: string): {
  blocks: CollectionMaterialBlock[];
  siguiente: string | null;
} {
  const indice = blocks.findIndex((block) => block.block_id === blockId);
  if (indice < 0 || !puedeQuitar(blocks[indice])) return { blocks: [...blocks], siguiente: blockId };
  const resto = blocks.filter((block) => block.block_id !== blockId);
  // Queda elegido el que ocupó su lugar, no el primero de la cara.
  return { blocks: resto, siguiente: resto[Math.min(indice, resto.length - 1)]?.block_id ?? null };
}

/** Los tipos que «Añadir bloque» ofrece en esta cara: un slot por tipo. */
export function tiposQueSePuedenAgregar(blocks: readonly CollectionMaterialBlock[]): CollectionBlockType[] {
  const presentes = new Set(blocks.map((block) => block.type));
  return TIPOS_QUE_SE_AGREGAN.filter((type) => !presentes.has(type));
}

/** Semilla que el backend acepta, con un block_id único dentro de su cara. */
export function semillaDeBloque(type: CollectionBlockType, blocks: readonly CollectionMaterialBlock[]): CollectionMaterialBlock {
  const usados = new Set(blocks.map((block) => block.block_id));
  let n = blocks.length + 1;
  while (usados.has(`${type}-${n}`)) n += 1;
  const shared = { block_id: `${type}-${n}`, type };
  if (type === "access_qr") return { ...shared, binding: "access.qr_payload", required: true };
  if (type === "field_grid") return { ...shared, fields: ["unit.label", "unit.schedule", "unit.venue"] };
  if (type === "heading" || type === "body" || type === "instructions") return { ...shared, text: rotuloDeBloque(type) };
  if (type === "footer") return { ...shared, binding: "deployment.deployment_id" };
  if (type === "status_tag") return { ...shared, text: "Titular" };
  return shared;
}

// ---------------------------------------------------------------------------
// Huella del borrador
// ---------------------------------------------------------------------------

function ordenado(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenado);
  if (isRecord(valor)) {
    return Object.fromEntries(Object.keys(valor).sort().map((clave) => [clave, ordenado(valor[clave])]));
  }
  return valor;
}

/** El contenido de la receta, sin su sello: dos recetas iguales dan lo mismo. */
export function contenidoDeReceta(template: CollectionMaterialTemplate | null): string {
  if (!template) return "";
  const { template_sha256: _sello, ...resto } = template;
  return JSON.stringify(ordenado(resto));
}

/** Huella corta (FNV-1a de 32 bits) para claves de caché. */
export function huellaDeReceta(template: CollectionMaterialTemplate | null): string {
  const texto = contenidoDeReceta(template);
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16).padStart(8, "0")}-${texto.length}`;
}

export function hayCambiosSinGuardar(
  borrador: CollectionMaterialTemplate | null,
  guardada: CollectionMaterialTemplate | null,
): boolean {
  if (!borrador || !guardada) return false;
  return contenidoDeReceta(borrador) !== contenidoDeReceta(guardada);
}

/** El aviso antes de guardar: guardar deja viejas las fichas ya creadas. */
export function avisoAntesDeGuardar(fichasCreadas: number): string | null {
  if (fichasCreadas <= 0) return null;
  const n = fichasCreadas.toLocaleString("es-PE");
  return fichasCreadas === 1
    ? "La ficha creada habrá que generarla de nuevo."
    : `Las ${n} fichas creadas habrá que generarlas de nuevo.`;
}
