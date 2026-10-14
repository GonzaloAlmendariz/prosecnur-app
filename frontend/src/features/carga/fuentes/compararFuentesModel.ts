// Carga › Fuentes: «Ver armonización» de una base nacida de un formulario
// publicado y «Comparar fuentes» entre dos bases de la misma revisión (ADR 0102).
// Lógica pura: los paneles direccionables, cuándo se ofrece comparar, el orden
// de las variables y los rótulos. Los componentes sólo pintan.
//
// Direcciones:
// - `?panel=armonizacion-base&foco=<base>`
// - `?panel=comparar-fuentes&foco=<baseA>~<baseB>`
// El id `armonizacion` ya lo usa Equivalencias (armonizar una fila); este es otro panel.

import { ApiError } from "../../../api/core";
import {
  E_COMPARAR_OTRA_REVISION,
  type ArmonizacionBase,
  type CategoriaComparada,
  type CasosComparados,
  type ComparacionFuentes,
  type DatosFuente,
  type FuenteComparada,
  type PerdidaEnCarga,
  type VariableComparada,
} from "../../../api/cargaArmonizacion";
import { conNivel } from "../../../lib/navegacion/direccion";
import type { PanelDeclarado } from "../../../lib/navegacion/paneles";
import { formatoConteo, formatoConteoDe, formatoDecimal } from "../../../lib/formatoNumero";
import { rotuloRevision } from "./formularioPublicadoModel";

// ---------------------------------------------------------------------------
// Paneles
// ---------------------------------------------------------------------------

export const PANEL_ARMONIZACION_BASE: PanelDeclarado = {
  id: "armonizacion-base",
  label: "Armonización de la base con su formulario",
  clase: "sideover",
};

export const PANEL_COMPARAR_FUENTES: PanelDeclarado = {
  id: "comparar-fuentes",
  label: "Comparar dos fuentes del mismo formulario",
  clase: "sideover",
};

export function searchConArmonizacionBase(search: string, base: string): string {
  return conNivel(conNivel(search, "panel", PANEL_ARMONIZACION_BASE.id), "foco", base || null);
}

export function searchConComparacion(search: string, par: ParBases | null): string {
  return conNivel(conNivel(search, "panel", PANEL_COMPARAR_FUENTES.id), "foco", par ? focoComparacion(par) : null);
}

/** Cierra el panel y limpia su foco, para que el siguiente panel no herede uno ajeno. */
export function searchSinPanelYFoco(search: string): string {
  return conNivel(conNivel(search, "panel", null), "foco", null);
}

// ---------------------------------------------------------------------------
// Foco de la comparación: «<baseA>~<baseB>»
// ---------------------------------------------------------------------------

export type ParBases = { a: string; b: string };

const SEPARADOR = "~";

// El nombre de una base admite «~» (la regla sólo veta espacios y «$»): se escapa.
function escapar(nombre: string): string {
  return nombre.replace(/%/g, "%25").replace(/~/g, "%7E");
}

function desescapar(parte: string): string {
  return parte.replace(/%7E/gi, "~").replace(/%25/g, "%");
}

export function focoComparacion(par: ParBases): string {
  return `${escapar(par.a)}${SEPARADOR}${escapar(par.b)}`;
}

/** `null` si el foco no nombra dos bases distintas. */
export function leerFocoComparacion(foco: string | null | undefined): ParBases | null {
  const partes = (foco ?? "").split(SEPARADOR);
  if (partes.length !== 2) return null;
  const [a, b] = partes.map((p) => desescapar(p.trim()));
  if (!a || !b || a === b) return null;
  return { a, b };
}

// ---------------------------------------------------------------------------
// Cuándo se ofrece comparar: dos bases ligadas a la MISMA revisión
// ---------------------------------------------------------------------------

export type BaseLigada = {
  nombre: string;
  instrument_revision_id?: string | null;
  parent_base?: string | null;
};

function revisionDe(b: BaseLigada): string {
  return String(b.instrument_revision_id ?? "").trim();
}

/** Bases por revisión, sólo las revisiones con dos o más bases y sin hijas de grupos repetidos. */
export function gruposComparables(bases: readonly BaseLigada[]): Map<string, string[]> {
  const grupos = new Map<string, string[]>();
  for (const b of bases) {
    const rev = revisionDe(b);
    if (!rev || b.parent_base) continue;
    grupos.set(rev, [...(grupos.get(rev) ?? []), b.nombre]);
  }
  for (const [rev, nombres] of grupos) if (nombres.length < 2) grupos.delete(rev);
  return grupos;
}

export function hayFuentesComparables(bases: readonly BaseLigada[]): boolean {
  return gruposComparables(bases).size > 0;
}

/** Las otras bases ligadas a la misma revisión que `base`, en el orden recibido. */
export function comparablesCon(base: string, bases: readonly BaseLigada[]): string[] {
  for (const nombres of gruposComparables(bases).values()) {
    if (nombres.includes(base)) return nombres.filter((n) => n !== base);
  }
  return [];
}

/** El par con que se abre «Comparar fuentes» sin foco: las dos primeras bases del primer grupo. */
export function primerParComparable(bases: readonly BaseLigada[]): ParBases | null {
  const primero = gruposComparables(bases).values().next();
  if (primero.done) return null;
  const [a, b] = primero.value;
  return a && b ? { a, b } : null;
}

/**
 * El par que el panel compara: el del foco si ambas bases son comparables
 * entre sí; si no, el primero disponible. Un foco con una base que ya no está
 * o de otra revisión no se compara a ciegas.
 */
export function parEfectivo(foco: string | null | undefined, bases: readonly BaseLigada[]): ParBases | null {
  const pedido = leerFocoComparacion(foco);
  if (pedido && comparablesCon(pedido.a, bases).includes(pedido.b)) return pedido;
  return primerParComparable(bases);
}

/** Al elegir A, B se queda si sigue siendo comparable; si no, la primera que lo sea. */
export function cambiarLado(par: ParBases, lado: "a" | "b", nombre: string, bases: readonly BaseLigada[]): ParBases | null {
  if (lado === "a") {
    const pares = comparablesCon(nombre, bases);
    if (!pares.length) return null;
    return { a: nombre, b: pares.includes(par.b) ? par.b : pares[0] };
  }
  return nombre !== par.a && comparablesCon(par.a, bases).includes(nombre) ? { a: par.a, b: nombre } : par;
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

/** «surveymonkey» → «SurveyMonkey», «sav» → «Archivo .sav». */
export function rotuloTipoFuente(fuente: string): string {
  const k = fuente.trim().toLowerCase().replace(/^formulario_publicado_/, "");
  if (k === "surveymonkey") return "SurveyMonkey";
  if (k === "sav" || k === "spss") return "Archivo .sav";
  if (k === "excel" || k === "xlsx" || k === "csv") return "Excel";
  if (k.startsWith("kobo")) return "KoboToolbox";
  return k ? "Archivos" : "Fuente sin declarar";
}

/** El «.sav» o «SurveyMonkey» con que se nombra la fuente en una frase. */
function nombreCorto(fuente: string): string {
  const r = rotuloTipoFuente(fuente);
  return r === "Archivo .sav" ? "el .sav" : r === "Excel" ? "el Excel" : r === "Archivos" ? "el archivo" : r;
}

export function rotuloDatos(datos: DatosFuente): string {
  return datos === "cruda" ? "Base cruda" : datos === "depurada" ? "Base depurada" : "";
}

/**
 * Cómo se nombra cada lado: por su tipo de fuente si difieren («SurveyMonkey»
 * frente a «Archivo .sav»); por el nombre de la base si ambas son del mismo tipo.
 */
export function nombresDeLados(a: FuenteComparada, b: FuenteComparada): { a: string; b: string } {
  const ta = rotuloTipoFuente(a.fuente);
  const tb = rotuloTipoFuente(b.fuente);
  if (ta !== tb && a.fuente && b.fuente) return { a: ta, b: tb };
  return { a: a.nombre, b: b.nombre };
}

/** «279 en ambas · 10 solo en SurveyMonkey»; `null` sin clave común. */
export function rotuloCasos(casos: CasosComparados | null, lados: { a: string; b: string }): string | null {
  if (!casos) return null;
  const partes: string[] = [];
  if (casos.en_ambas != null) partes.push(`${formatoConteo(casos.en_ambas)} en ambas`);
  if (casos.solo_a) partes.push(`${formatoConteo(casos.solo_a)} solo en ${lados.a}`);
  if (casos.solo_b) partes.push(`${formatoConteo(casos.solo_b)} solo en ${lados.b}`);
  return partes.length ? partes.join(" · ") : null;
}

/** «SurveyMonkey trae 10 respuestas más», «Mismo número de respuestas». */
export function rotuloDiferenciaFilas(diferencia: number | null, lados: { a: string; b: string }): string | null {
  if (diferencia == null) return null;
  if (diferencia === 0) return "Mismo número de respuestas";
  const lado = diferencia > 0 ? lados.a : lados.b;
  return `${lado} trae ${formatoConteoDe(Math.abs(diferencia), "respuesta")} más`;
}

/** Porcentaje es-PE con un decimal: «45.2 %». */
export function formatoPct(pct: number | null): string {
  return pct == null ? "—" : `${formatoDecimal(pct, 1)} %`;
}

/** Porcentaje con su frecuencia (regla de la casa): «45.2 % (120)». */
export function pctConFrecuencia(pct: number | null, n: number | null): string {
  if (pct == null && n == null) return "—";
  return `${formatoPct(pct)} (${formatoConteo(n)})`;
}

/** Ancho de la barra en %, acotado. */
export function anchoBarra(pct: number | null): number {
  return pct == null ? 0 : Math.max(0, Math.min(100, pct));
}

export function rotuloDiferenciaPp(dif: number | null): string | null {
  return dif == null || dif === 0 ? null : `Difiere hasta ${formatoDecimal(dif, 1)} pp`;
}

export const ROTULO_ESTADO: Record<VariableComparada["estado"], string> = {
  igual: "Igual",
  distinta: "Distinta",
  solo_a: "Solo en una",
  solo_b: "Solo en una",
};

/** Fecha y hora de importación en es-PE; el texto crudo si no es una fecha. */
export function fechaImportacion(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(t));
}

export type DatoCabecera = { clave: string; rotulo: string; valor: string };

/** Formulario, revisión, fuente y fecha: la cabecera del panel de armonización. */
export function cabeceraArmonizacion(arm: ArmonizacionBase): DatoCabecera[] {
  const datos: DatoCabecera[] = [];
  if (arm.formulario) {
    datos.push({ clave: "formulario", rotulo: "Formulario", valor: arm.formulario.form_name });
    datos.push({ clave: "revision", rotulo: "Revisión", valor: rotuloRevision(arm.formulario.revision_no) });
  }
  if (arm.fuente) datos.push({ clave: "fuente", rotulo: "Fuente", valor: rotuloTipoFuente(arm.fuente) });
  const fecha = fechaImportacion(arm.importado_at);
  if (fecha) datos.push({ clave: "importado", rotulo: "Importada", valor: fecha });
  return datos;
}

// ---------------------------------------------------------------------------
// Orden de las variables y de sus categorías
// ---------------------------------------------------------------------------

export type VariablesOrdenadas = {
  /** Distintas (mayor diferencia primero) y luego las que están en una sola fuente. */
  destacadas: VariableComparada[];
  /** Iguales, en el orden del formulario: van plegadas. */
  iguales: VariableComparada[];
};

export function ordenarVariables(variables: readonly VariableComparada[]): VariablesOrdenadas {
  const indice = new Map(variables.map((v, i) => [v, i] as const));
  const peso = (v: VariableComparada) => (v.estado === "distinta" ? 0 : 1);
  const destacadas = variables
    .filter((v) => v.estado !== "igual")
    .sort((x, y) => {
      if (peso(x) !== peso(y)) return peso(x) - peso(y);
      const dx = x.diferencia_max_pp ?? -1;
      const dy = y.diferencia_max_pp ?? -1;
      if (dx !== dy) return dy - dx;
      return (indice.get(x) ?? 0) - (indice.get(y) ?? 0);
    });
  return { destacadas, iguales: variables.filter((v) => v.estado === "igual") };
}

/** Las sustantivas primero; los códigos especiales (SIN INF, No aplica…) aparte, sin quitarlos. */
export function partirCategorias(categorias: readonly CategoriaComparada[]): {
  sustantivas: CategoriaComparada[];
  especiales: CategoriaComparada[];
} {
  return {
    sustantivas: categorias.filter((c) => !c.especial),
    especiales: categorias.filter((c) => c.especial),
  };
}

/** «No binario (3)»: una categoría exclusiva como chip. */
export function rotuloExclusiva(c: { codigo: string; etiqueta: string }): string {
  if (c.etiqueta && c.codigo) return `${c.etiqueta} · ${c.codigo}`;
  return c.etiqueta || c.codigo;
}

export function rotuloCategoria(c: Pick<CategoriaComparada, "codigo" | "etiqueta">): string {
  return c.etiqueta || (c.codigo ? `Código ${c.codigo}` : "Sin etiqueta");
}

// ---------------------------------------------------------------------------
// Categorías que se perdieron al cargar
// ---------------------------------------------------------------------------

export type AvisoPerdidas = {
  lado: "a" | "b";
  titulo: string;
  items: { clave: string; variable: string; etiqueta: string; n: number }[];
  total: number;
};

function avisoDe(lado: "a" | "b", fuente: FuenteComparada, perdidas: readonly PerdidaEnCarga[]): AvisoPerdidas | null {
  if (!perdidas.length) return null;
  const quien = nombreCorto(fuente.fuente);
  const sujeto = quien.charAt(0).toUpperCase() + quien.slice(1);
  return {
    lado,
    titulo: `${sujeto} traía categorías que el formulario no tiene`,
    items: perdidas.map((p, i) => ({ clave: `${p.variable}:${p.etiqueta}:${i}`, ...p })),
    total: perdidas.reduce((s, p) => s + p.n, 0),
  };
}

export function avisosPerdidas(comp: ComparacionFuentes): AvisoPerdidas[] {
  return [
    avisoDe("a", comp.base_a, comp.perdidas_en_carga_a),
    avisoDe("b", comp.base_b, comp.perdidas_en_carga_b),
  ].filter((x): x is AvisoPerdidas => x !== null);
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export const MENSAJE_OTRA_REVISION =
  "Estas dos bases están ligadas a revisiones distintas del formulario. Sólo se comparan fuentes de la misma revisión.";

export function mensajeErrorComparar(error: unknown): string {
  if (error instanceof ApiError && error.code === E_COMPARAR_OTRA_REVISION) return MENSAJE_OTRA_REVISION;
  if (error instanceof Error && error.message.includes(E_COMPARAR_OTRA_REVISION)) return MENSAJE_OTRA_REVISION;
  return error instanceof Error ? error.message : "No se pudo comparar las fuentes.";
}
