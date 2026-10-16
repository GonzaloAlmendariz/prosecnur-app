// Segmentos de cruce del estudio (ADR 0107): lógica pura del panel
// `?panel=segmentos`.
//
// - Direcciones del panel y readiness.
// - El estado de cada celda segmento × base, en llano.
// - El borrador de un segmento (clave, etiqueta, escala estándar y, por base,
//   la variable de origen y el mapa de sus códigos), su validación y el cuerpo
//   del POST.
// - La ayuda que arma el mapa: «Rangos» para una variable numérica.
// - La fusión de las filas de cruce en la matriz que se está editando.
//
// Los componentes sólo pintan; lo que decide vive aquí y tiene Vitest.

import type { BaseVariables, OpcionBase } from "../../../api/baseVariables";
import type { CodigosObservados } from "../../../api/codigosObservados";
import { codigosConObservados, ordenarCodigos, type CodigoDeOrigen } from "../codigosObservadosModel";
import type { EquivalenciaFila, VariableDeBase } from "../../../api/equivalencias";
import type {
  CategoriaSegmento,
  Segmento,
  SegmentoADeclarar,
  SegmentoEnBase,
  SegmentosEstado,
} from "../../../api/segmentos";
import { conNivel } from "../../../lib/navegacion/direccion";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import type { FilaEditor } from "../equivalenciasEditorModel";
import { aFilasEditor } from "../equivalenciasEditorModel";
import { etiquetaTolerante, etiquetasAmbiguas, indicePorEtiqueta } from "../etiquetaTolerante";
import { PANEL_SEGMENTOS } from "../panelesCarga";
import { nombreDesdeEtiqueta, type CategoriaBorrador } from "../variablesBase/variablesBaseModel";

// ---------------------------------------------------------------------------
// Direcciones y readiness
// ---------------------------------------------------------------------------

export const PREFIJO_SEGMENTO = "cruce_";
/** El nombre `cruce_<clave>` no pasa de 32 caracteres, como una calculada. */
export const MAX_CLAVE = 32 - PREFIJO_SEGMENTO.length;
const PREFIJO_FILA = "SEG-";

/** `?panel=segmentos`; con `clave`, ese segmento en su editor. */
export function searchConSegmentos(search: string, clave: string | null = null): string {
  return conNivel(conNivel(search, "panel", PANEL_SEGMENTOS.id), "foco", clave || null);
}

export type LecturaSegmentos =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: SegmentosEstado };

/** `false` sólo mientras lee (AD6); un terminal sin contenido publica `vacio:<motivo>`. */
export function readinessSegmentos(lectura: LecturaSegmentos): string {
  if (lectura.tipo === "cargando") return "false";
  if (lectura.tipo === "error") return "vacio:error";
  if (!lectura.datos.disponible) return "vacio:no-disponible";
  return lectura.datos.segmentos.length ? "true" : "vacio:sin-segmentos";
}

export function nombreDeSegmento(clave: string): string {
  return `${PREFIJO_SEGMENTO}${clave}`;
}

/** La clave del segmento de una fila de la matriz (`SEG-<clave>`), o `null`. */
export function claveDeFilaCruce(fila: Pick<FilaEditor, "cruce" | "id_declarado">): string | null {
  const id = fila.id_declarado ?? "";
  if (!id.startsWith(PREFIJO_FILA)) return fila.cruce ? "" : null;
  return id.slice(PREFIJO_FILA.length);
}

export function esFilaCruce(fila: Pick<FilaEditor, "cruce" | "id_declarado">): boolean {
  return Boolean(fila.cruce) || (fila.id_declarado ?? "").startsWith(PREFIJO_FILA);
}

/** Bases del estudio en el orden de la serie que ya se ve en Equivalencias. */
export function ordenarBases(bases: readonly string[], orden: readonly string[]): string[] {
  const enOrden = orden.filter((b) => bases.includes(b));
  return [...enOrden, ...bases.filter((b) => !enOrden.includes(b))];
}

// ---------------------------------------------------------------------------
// Estado de una celda segmento × base
// ---------------------------------------------------------------------------

export type TonoCelda = "ok" | "aviso" | "neutro";

export type EstadoCelda = { tono: TonoCelda; texto: string; detalle: string };

export function textoFaltanCasos(n: number): string {
  if (n <= 0) return "Faltan códigos por asignar";
  return n === 1 ? "Falta 1 caso por asignar" : `Faltan ${formatoConteo(n)} casos por asignar`;
}

export function estadoCelda(entrada: SegmentoEnBase | undefined): EstadoCelda {
  if (!entrada || (entrada.estado === "sin_origen" && !entrada.origen_ausente)) {
    return { tono: "neutro", texto: "Sin origen", detalle: "" };
  }
  if (entrada.estado === "sin_origen") {
    return { tono: "aviso", texto: "Falta el origen", detalle: `${entrada.origen} ya no está en la base` };
  }
  if (entrada.estado === "incompleto") {
    return { tono: "aviso", texto: textoFaltanCasos(entrada.n_sin_mapa), detalle: `desde ${entrada.origen}` };
  }
  return { tono: "ok", texto: "Definido", detalle: `desde ${entrada.origen}` };
}

/** «2 segmentos · 1 base con algo por resolver». */
export function resumenSegmentos(datos: SegmentosEstado): string {
  const n = datos.segmentos.length;
  if (n === 0) return "Ninguno todavía.";
  const conPendiente = datos.bases.filter((b) =>
    datos.segmentos.some((s) => estadoCelda(s.por_base[b]).tono === "aviso"),
  ).length;
  const segs = formatoConteoDe(n, "segmento", "segmentos");
  return conPendiente
    ? `${segs} · ${formatoConteoDe(conPendiente, "base", "bases")} con algo por resolver`
    : `${segs} en ${datos.bases.length === 1 ? "la base" : `las ${formatoConteo(datos.bases.length)} bases`}`;
}

// ---------------------------------------------------------------------------
// Clave y nombre
// ---------------------------------------------------------------------------

/** Sin tildes; «ñ» pasa a «ni» para que «años» no quede «anos». */
function sinTildes(s: string): string {
  return s.replace(/ñ/gi, "ni").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lo que el backend acepta como clave: `[a-z0-9_]`, sin el prefijo `cruce_`. */
export function normalizarClave(texto: string): string {
  return sinTildes(texto)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^(cruce_+)+/, "")
    .slice(0, MAX_CLAVE);
}

/** «Año de ingreso» → «anio_ingreso»: la propuesta de `nombreDesdeEtiqueta` sin el prefijo. */
export function claveDesdeEtiqueta(etiqueta: string): string {
  return normalizarClave(nombreDesdeEtiqueta(etiqueta, MAX_CLAVE));
}

// ---------------------------------------------------------------------------
// Variables de origen y sus códigos
// ---------------------------------------------------------------------------

/**
 * Lo que una base ofrece como origen: las preguntas del catálogo, sus variables
 * calculadas (una fórmula como «2026 - P8» se agrupa aquí en rangos) y las
 * columnas que la data trae fuera del formulario. Fuera, los segmentos: uno no
 * sale de otro.
 */
export function opcionesDeOrigen(
  catalogo: readonly VariableDeBase[],
  propias: Pick<BaseVariables, "extras" | "calculadas"> | undefined,
  nombresSegmentos: readonly string[] = [],
): VariableDeBase[] {
  const fuera = new Set(nombresSegmentos);
  const delCatalogo = catalogo.filter((v) => !fuera.has(v.name));
  const nombres = new Set(delCatalogo.map((v) => v.name));
  const extras = (propias?.extras ?? [])
    .filter((c) => !nombres.has(c.name) && !fuera.has(c.name))
    .map((c): VariableDeBase => ({
      name: c.name,
      label: c.label,
      seccion: "Fuera del formulario",
      opciones: c.opciones.map((o) => ({ codigo: o.codigo, etiqueta: o.etiqueta })),
    }));
  return [...delCatalogo, ...extras];
}

const ENTERO = /^-?\d+$/;

export type { CodigoDeOrigen };

/**
 * Los códigos del origen en una base.
 *
 * Con los observados (`GET /api/carga/codigos-observados`), son los valores
 * que la data trae, con sus casos; las opciones del instrumento que nadie
 * eligió se suman con 0 casos, porque también hay que decidir a dónde van.
 * Mientras no llegan (o si no se pudieron leer), los que se conocen: la lista
 * de respuestas y, si lo guardado salió del mismo origen, lo mapeado y lo que
 * el backend vio sin mapa.
 */
export function codigosConocidos(
  opciones: readonly OpcionBase[],
  origen: string,
  guardado: SegmentoEnBase | undefined,
  mapa: Readonly<Record<string, string>>,
  observados: CodigosObservados | null = null,
): CodigoDeOrigen[] {
  const reales = codigosConObservados(opciones, observados);
  if (reales) return reales;
  const out = new Map<string, CodigoDeOrigen>();
  for (const o of opciones) out.set(o.codigo, { codigo: o.codigo, etiqueta: o.etiqueta, n: null });
  const mismo = guardado && guardado.origen === origen;
  const extra = [
    ...(mismo ? Object.keys(guardado.mapa) : []),
    ...(mismo ? guardado.codigos_sin_mapa : []),
    ...Object.keys(mapa),
  ];
  for (const c of extra) if (c && !out.has(c)) out.set(c, { codigo: c, etiqueta: "", n: null });
  return ordenarCodigos([...out.values()]);
}

/**
 * Los códigos de la entrada de una base: `codigosConocidos` con las opciones de
 * su variable de origen. Lo usan la sección de la base y, para «Emparejar
 * todas» y los atajos de «Partir de…», el editor: las dos leen lo mismo.
 */
export function codigosDeEntrada(
  opciones: readonly VariableDeBase[] | null,
  entrada: Pick<EntradaBorrador, "origen" | "mapa">,
  guardado: SegmentoEnBase | undefined,
  observados: CodigosObservados | null,
): CodigoDeOrigen[] {
  if (!entrada.origen) return [];
  const delOrigen = (opciones ?? []).find((o) => o.name === entrada.origen);
  return codigosConocidos(delOrigen?.opciones ?? [], entrada.origen, guardado, entrada.mapa, observados);
}

/** Códigos especiales: «Otro» 88, «No sabe» 98, «No responde» 99… */
const ESPECIAL = /^(8[0-9]|9[0-9])$/;
const NUMERO = /^-?\d+(\.\d+)?$/;

/**
 * Si los valores son números sin lista de respuestas propia: todos numéricos y
 * sin etiqueta (o con la etiqueta igual al código), salvo los especiales 80–99,
 * que pueden traer la suya («Otro»). Un año, una edad, un conteo o el resultado
 * de una fórmula. Quedan fuera de los rangos que no los cubran y se asignan a mano.
 */
export function sonNumericos(codigos: readonly OpcionBase[]): boolean {
  const normales = codigos.filter((c) => !ESPECIAL.test(c.codigo));
  return normales.length > 0
    && codigos.every((c) => NUMERO.test(c.codigo))
    && normales.every((c) => !c.etiqueta.trim() || c.etiqueta.trim() === c.codigo);
}

function sinEtiquetas(codigos: readonly OpcionBase[]): boolean {
  return codigos.every((c) => !c.etiqueta.trim() || c.etiqueta.trim() === c.codigo);
}

export type AyudaMapa = "rangos";

/**
 * Qué ayudas se ofrecen sobre los códigos del origen: con números, los rangos.
 * Una ayuda por caso (años transcurridos, tramos de edad…) no: eso se construye
 * con una variable calculada por fórmula y luego se agrupa en rangos.
 */
export function ayudasDisponibles(codigos: readonly OpcionBase[]): AyudaMapa[] {
  return sonNumericos(codigos) ? ["rangos"] : [];
}

// ---------------------------------------------------------------------------
// Filas de la tabla de códigos
// ---------------------------------------------------------------------------

/** Destino de un código: un código de la escala, `""` sin dato explícito, `null` sin mapa. */
export type DestinoCodigo = string | null;

export type FilaCodigo = {
  /** Uno, o el tramo de enteros consecutivos con el mismo destino. */
  codigos: string[];
  rotulo: string;
  etiqueta: string;
  destino: DestinoCodigo;
  /** Sin destino y con casos (o sin conteo): lo que falta decidir. */
  sinMapa: boolean;
  /**
   * Sin destino y con 0 casos en la data: no queda nadie sin segmento, así que
   * no es pendiente —el backend tampoco lo cuenta—. Se pinta tenue.
   */
  sinCasos: boolean;
  /** Casos de la fila (suma del tramo); `null` si no se leyeron de la data. */
  n: number | null;
};

/** A partir de cuántos enteros sin etiqueta la tabla los agrupa en tramos. */
export const UMBRAL_AGRUPAR = 10;

function conPendiente(f: Omit<FilaCodigo, "sinMapa" | "sinCasos">): FilaCodigo {
  const sinCasos = f.destino === null && f.n === 0;
  return { ...f, sinMapa: f.destino === null && !sinCasos, sinCasos };
}

function destinoDe(mapa: Readonly<Record<string, string>>, codigo: string, escala: ReadonlySet<string>): DestinoCodigo {
  if (!(codigo in mapa)) return null;
  const d = mapa[codigo];
  return d === "" || escala.has(d) ? d : null;
}

/**
 * Cada código del origen y su destino. Con diez o más números sin etiqueta (una
 * edad, un año, una fórmula), los valores seguidos —en el orden en que la data
 * los trae, aunque falte alguno entre ellos— con el mismo destino se leen como
 * un tramo («21 a 67»); asignar el tramo asigna todos sus códigos.
 */
export function filasDeCodigos(
  codigos: readonly CodigoDeOrigen[],
  mapa: Readonly<Record<string, string>>,
  escala: readonly CategoriaSegmento[],
): FilaCodigo[] {
  const validos = new Set(escala.map((c) => c.codigo).filter(Boolean));
  const sueltas = codigos.map((c): FilaCodigo => {
    const destino = destinoDe(mapa, c.codigo, validos);
    return conPendiente({ codigos: [c.codigo], rotulo: c.codigo, etiqueta: c.etiqueta, destino, n: c.n });
  });
  if (codigos.length < UMBRAL_AGRUPAR || !sonNumericos(codigos) || !sinEtiquetas(codigos)) return sueltas;
  const out: FilaCodigo[] = [];
  const orden = [...sueltas].sort((a, b) => Number(a.codigos[0]) - Number(b.codigos[0]));
  for (const f of orden) {
    const previa = out[out.length - 1];
    const ultimo = previa ? Number(previa.codigos[previa.codigos.length - 1]) : NaN;
    // Asignados: basta el mismo destino. Sin mapa: sólo enteros seguidos, para
    // no esconder en un tramo un valor que nadie decidió.
    const seguido = f.destino !== null || Number(f.codigos[0]) === ultimo + 1;
    if (previa && previa.destino === f.destino && seguido) {
      previa.codigos.push(f.codigos[0]);
      previa.rotulo = `${previa.codigos[0]} a ${f.codigos[0]}`;
      previa.n = previa.n === null || f.n === null ? null : previa.n + f.n;
    } else {
      out.push({ ...f, codigos: [...f.codigos], etiqueta: "" });
    }
  }
  // Un tramo con casos deja de ser «sin casos» aunque alguno de sus códigos lo sea.
  return out.map(conPendiente);
}

export type ResumenMapa = { total: number; asignados: number; sinDato: number; sinCasos: number; sinMapa: number };

export function resumenMapa(filas: readonly FilaCodigo[]): ResumenMapa {
  let total = 0;
  let asignados = 0;
  let sinDato = 0;
  let sinCasos = 0;
  for (const f of filas) {
    total += f.codigos.length;
    if (f.destino === "") sinDato += f.codigos.length;
    else if (f.destino !== null) asignados += f.codigos.length;
    else if (f.sinCasos) sinCasos += f.codigos.length;
  }
  return { total, asignados, sinDato, sinCasos, sinMapa: total - asignados - sinDato - sinCasos };
}

export function textoResumenMapa(r: ResumenMapa): string {
  if (r.total === 0) return "";
  const partes = [`${formatoConteo(r.asignados)} de ${formatoConteoDe(r.total, "código", "códigos")} asignados`];
  if (r.sinDato) partes.push(`${formatoConteo(r.sinDato)} sin dato`);
  if (r.sinMapa) partes.push(`${formatoConteo(r.sinMapa)} sin mapa`);
  if (r.sinCasos) partes.push(`${formatoConteo(r.sinCasos)} sin casos`);
  return partes.join(" · ");
}

/** «Sin dato: 5 casos», lo que la data trae vacío en el origen. */
export function textoSinDatoObservado(n: number): string {
  return `Sin dato: ${formatoConteoDe(n, "caso", "casos")}`;
}

/** Casos que todavía no tienen destino, si se leyeron de la data. */
export function casosSinMapa(filas: readonly FilaCodigo[]): number | null {
  let total = 0;
  for (const f of filas) {
    if (!f.sinMapa) continue;
    if (f.n === null) return null;
    total += f.n;
  }
  return total;
}

export type EstadoBorradorBase = "sin_origen" | "incompleto" | "definido";

/** El estado que tendrá la base al guardar, según lo que se conoce de su origen. */
export function estadoDeEntrada(origen: string, filas: readonly FilaCodigo[]): EstadoBorradorBase {
  if (!origen) return "sin_origen";
  const r = resumenMapa(filas);
  return r.total === 0 || r.sinMapa > 0 || r.asignados === 0 ? "incompleto" : "definido";
}

export const TEXTO_ESTADO_BORRADOR: Record<EstadoBorradorBase, string> = {
  sin_origen: "Sin origen",
  incompleto: "Por completar",
  definido: "Definido",
};

// ---------------------------------------------------------------------------
// Borrador del segmento
// ---------------------------------------------------------------------------

export type EntradaBorrador = {
  origen: string;
  /** `código de origen -> código de la escala`; `""` es sin dato explícito; ausente, sin mapa. */
  mapa: Record<string, string>;
  marcados: string[];
};

export type BorradorSegmento = {
  /** Editando uno guardado: la clave es su identidad y no cambia. */
  editando: boolean;
  clave: string;
  etiqueta: string;
  /** Nota al pie de toda tabla cruzada por el segmento. */
  nota: string;
  escala: CategoriaBorrador[];
  porBase: Record<string, EntradaBorrador>;
};

const ENTRADA_VACIA: EntradaBorrador = { origen: "", mapa: {}, marcados: [] };

function entradaDe(b: BorradorSegmento, base: string): EntradaBorrador {
  return b.porBase[base] ?? ENTRADA_VACIA;
}

function conEntrada(b: BorradorSegmento, base: string, cambio: (e: EntradaBorrador) => EntradaBorrador): BorradorSegmento {
  return { ...b, porBase: { ...b.porBase, [base]: cambio(entradaDe(b, base)) } };
}

function escalaBorrador(opciones: readonly OpcionBase[]): CategoriaBorrador[] {
  return opciones.map((o, i) => ({ clave: `c${i + 1}`, codigo: o.codigo, etiqueta: o.etiqueta }));
}

function claveNueva(escala: readonly CategoriaBorrador[]): string {
  const max = escala.reduce((m, c) => Math.max(m, Number(c.clave.slice(1)) || 0), 0);
  return `c${max + 1}`;
}

export function borradorDesde(s: Segmento | null, bases: readonly string[]): BorradorSegmento {
  const porBase: Record<string, EntradaBorrador> = {};
  for (const base of bases) {
    const e = s?.por_base[base];
    // Un origen que ya no está en la data se conserva: la persona lo ve y lo cambia.
    porBase[base] = e?.origen ? { origen: e.origen, mapa: { ...e.mapa }, marcados: [] } : { ...ENTRADA_VACIA };
  }
  return {
    editando: Boolean(s),
    clave: s?.clave ?? "",
    etiqueta: s?.etiqueta ?? "",
    nota: s?.nota ?? "",
    escala: s ? escalaBorrador(s.escala) : [],
    porBase,
  };
}

export type AccionSegmento =
  | { tipo: "etiqueta"; valor: string }
  | { tipo: "clave"; valor: string }
  | { tipo: "nota"; valor: string }
  | { tipo: "categoria-agregar" }
  | { tipo: "categoria-codigo"; clave: string; valor: string }
  | { tipo: "categoria-etiqueta"; clave: string; valor: string }
  | { tipo: "categoria-quitar"; clave: string }
  /** Escala desde las opciones de una variable; si su base no tiene origen, lo toma con mapa identidad. */
  | { tipo: "partir-de"; opciones: readonly OpcionBase[]; base?: string; variable?: string }
  | { tipo: "origen"; base: string; variable: string }
  /** `null` quita el destino (sin mapa); `""` es sin dato explícito. */
  | { tipo: "destino"; base: string; codigos: readonly string[]; destino: DestinoCodigo }
  | { tipo: "aplicar-mapa"; base: string; mapa: Readonly<Record<string, string>> }
  /** Varios mapas a la vez, uno por base (`mapasPorEtiqueta`). No pisa: sólo suma. */
  | { tipo: "aplicar-mapas"; mapas: Readonly<Record<string, Readonly<Record<string, string>>>> }
  | { tipo: "marcar"; base: string; codigos: readonly string[]; marcado: boolean }
  | { tipo: "limpiar-marcas"; base: string };

function mapaSin(mapa: Readonly<Record<string, string>>, quitar: (destino: string) => boolean): Record<string, string> {
  return Object.fromEntries(Object.entries(mapa).filter(([, d]) => !quitar(d)));
}

export function reducirSegmento(b: BorradorSegmento, a: AccionSegmento): BorradorSegmento {
  switch (a.tipo) {
    case "etiqueta": {
      // Mientras la clave siga siendo la propuesta (o esté vacía), acompaña a la
      // etiqueta, igual que el nombre de una variable calculada.
      const auto = !b.editando && (b.clave === "" || b.clave === claveDesdeEtiqueta(b.etiqueta));
      return { ...b, etiqueta: a.valor, clave: auto ? claveDesdeEtiqueta(a.valor) : b.clave };
    }
    case "clave":
      return b.editando ? b : { ...b, clave: normalizarClave(a.valor) };
    case "nota":
      return { ...b, nota: a.valor };
    case "categoria-agregar":
      return { ...b, escala: [...b.escala, { clave: claveNueva(b.escala), codigo: String(b.escala.length + 1), etiqueta: "" }] };
    case "categoria-codigo": {
      const previa = b.escala.find((c) => c.clave === a.clave);
      if (!previa) return b;
      const nuevo = a.valor.trim();
      // Lo que caía en el código viejo sigue cayendo en la misma categoría, en todas las bases.
      const porBase: Record<string, EntradaBorrador> = {};
      for (const [base, e] of Object.entries(b.porBase)) {
        const mapa: Record<string, string> = {};
        for (const [origen, destino] of Object.entries(e.mapa)) {
          if (destino !== previa.codigo || destino === "") mapa[origen] = destino;
          else if (nuevo) mapa[origen] = nuevo;
        }
        porBase[base] = { ...e, mapa };
      }
      return { ...b, porBase, escala: b.escala.map((c) => (c.clave === a.clave ? { ...c, codigo: nuevo } : c)) };
    }
    case "categoria-etiqueta":
      return { ...b, escala: b.escala.map((c) => (c.clave === a.clave ? { ...c, etiqueta: a.valor } : c)) };
    case "categoria-quitar": {
      const quitada = b.escala.find((c) => c.clave === a.clave);
      if (!quitada) return b;
      const porBase = Object.fromEntries(
        Object.entries(b.porBase).map(([base, e]) => [
          base,
          { ...e, mapa: mapaSin(e.mapa, (d) => d !== "" && d === quitada.codigo) },
        ]),
      );
      return { ...b, porBase, escala: b.escala.filter((c) => c.clave !== a.clave) };
    }
    case "partir-de": {
      const escala = escalaBorrador(a.opciones);
      const codigos = new Set(escala.map((c) => c.codigo));
      // Las demás bases conservan lo asignado que sigue existiendo en la escala nueva.
      const porBase = Object.fromEntries(
        Object.entries(b.porBase).map(([base, e]) => [base, { ...e, mapa: mapaSin(e.mapa, (d) => d !== "" && !codigos.has(d)) }]),
      );
      const siguiente = { ...b, escala, porBase };
      const variable = a.variable ?? "";
      if (!a.base || !variable) return siguiente;
      const previo = entradaDe(siguiente, a.base);
      // Una base con OTRO origen no se toca: copiar opciones no cambia de dónde sale.
      if (previo.origen && previo.origen !== variable) return siguiente;
      // La base de la que salió la escala queda en identidad: cada código a sí mismo.
      // Lo demás que ya tenía (un «sin dato», un código fuera de la lista) se conserva.
      const identidad = Object.fromEntries(escala.map((c) => [c.codigo, c.codigo]));
      return conEntrada(siguiente, a.base, (e) => ({
        origen: variable,
        mapa: previo.origen ? { ...e.mapa, ...identidad } : identidad,
        marcados: [],
      }));
    }
    case "origen":
      return entradaDe(b, a.base).origen === a.variable
        ? b
        : conEntrada(b, a.base, () => ({ origen: a.variable, mapa: {}, marcados: [] }));
    case "destino":
      return conEntrada(b, a.base, (e) => {
        const mapa = { ...e.mapa };
        for (const c of a.codigos) {
          if (a.destino === null) delete mapa[c];
          else mapa[c] = a.destino;
        }
        return { ...e, mapa, marcados: e.marcados.filter((c) => !a.codigos.includes(c)) };
      });
    case "aplicar-mapa":
      return conEntrada(b, a.base, (e) => ({ ...e, mapa: { ...e.mapa, ...a.mapa }, marcados: [] }));
    case "aplicar-mapas":
      return Object.entries(a.mapas).reduce(
        (acc, [base, mapa]) => (entradaDe(acc, base).origen ? reducirSegmento(acc, { tipo: "aplicar-mapa", base, mapa }) : acc),
        b,
      );
    case "marcar":
      return conEntrada(b, a.base, (e) => {
        const sin = e.marcados.filter((c) => !a.codigos.includes(c));
        return { ...e, marcados: a.marcado ? [...sin, ...a.codigos] : sin };
      });
    case "limpiar-marcas":
      return conEntrada(b, a.base, (e) => ({ ...e, marcados: [] }));
  }
}

/** Escala del borrador tal como se envía (y como la leen la tabla y los selectores). */
export function escalaDeBorrador(b: Pick<BorradorSegmento, "escala">): CategoriaSegmento[] {
  return b.escala
    .map((c) => ({ codigo: c.codigo.trim(), etiqueta: c.etiqueta.trim() }))
    .filter((c) => c.codigo);
}

/**
 * «Emparejar por etiqueta»: cada código sin mapa va a la categoría de la
 * escala con su misma etiqueta tolerante (`etiquetaTolerante`, la misma de la
 * armonización de una fila: sin mayúsculas, tildes, puntuación ni marcado, así
 * que «18–20 años» casa con «18-20 años», pero «<18» no casa con «18»). No toca
 * lo asignado ni empareja dos códigos de la base que dicen lo mismo.
 */
export function mapaPorEtiqueta(
  codigos: readonly OpcionBase[],
  mapa: Readonly<Record<string, string>>,
  escala: readonly CategoriaSegmento[],
): Record<string, string> {
  const porEtiqueta = indicePorEtiqueta(escala);
  const ambiguas = etiquetasAmbiguas(codigos);
  const out: Record<string, string> = {};
  for (const c of codigos) {
    if (c.codigo in mapa) continue;
    const clave = etiquetaTolerante(c.etiqueta);
    if (ambiguas.has(clave)) continue;
    const destino = porEtiqueta.get(clave);
    if (destino) out[c.codigo] = destino;
  }
  return out;
}

export type EmparejarTodas = {
  /** `base -> mapa` sólo de las bases con algo que emparejar. */
  mapas: Record<string, Record<string, string>>;
  codigos: number;
  bases: number;
};

/**
 * «Emparejar todas por etiqueta»: `mapaPorEtiqueta` en cada base con origen, a
 * la vez. Sólo códigos sin mapa; lo asignado no se pisa.
 */
export function mapasPorEtiqueta(
  b: Pick<BorradorSegmento, "porBase">,
  codigosPorBase: Readonly<Record<string, readonly OpcionBase[]>>,
  escala: readonly CategoriaSegmento[],
): EmparejarTodas {
  const mapas: Record<string, Record<string, string>> = {};
  let codigos = 0;
  for (const [base, lista] of Object.entries(codigosPorBase)) {
    const e = b.porBase[base];
    if (!e?.origen) continue;
    const mapa = mapaPorEtiqueta(lista, e.mapa, escala);
    const n = Object.keys(mapa).length;
    if (!n) continue;
    mapas[base] = mapa;
    codigos += n;
  }
  return { mapas, codigos, bases: Object.keys(mapas).length };
}

/** El `title` del botón: qué hará, en llano. */
export function textoEmparejarTodas(e: EmparejarTodas): string {
  const en = e.bases === 1 ? `en ${Object.keys(e.mapas)[0]}` : `en ${formatoConteo(e.bases)} bases`;
  return `Lleva ${formatoConteoDe(e.codigos, "código sin mapa", "códigos sin mapa")} ${en} a la categoría con su misma etiqueta. No toca lo ya asignado.`;
}

// ---------------------------------------------------------------------------
// «Partir de las opciones de…»: los orígenes ya elegidos, como atajo
// ---------------------------------------------------------------------------

export type AtajoPartirDe = { base: string; variable: string; rotulo: string; opciones: OpcionBase[] };

/**
 * Los orígenes ya elegidos en las bases («cruce_1 · 2024»), con las opciones
 * que copiarían: las de la lista de respuestas o, si la variable no trae lista,
 * los códigos que se conocen de ella. Sin opciones, el atajo no se ofrece.
 */
export function atajosPartirDe(
  bases: readonly string[],
  porBase: Readonly<Record<string, EntradaBorrador>>,
  opcionesPorBase: Readonly<Record<string, readonly VariableDeBase[] | null>>,
  codigosPorBase: Readonly<Record<string, readonly OpcionBase[]>>,
  legible: (etiqueta: string) => string = (s) => s,
): AtajoPartirDe[] {
  const out: AtajoPartirDe[] = [];
  for (const base of bases) {
    const variable = porBase[base]?.origen ?? "";
    if (!variable) continue;
    const lista = (opcionesPorBase[base] ?? []).find((v) => v.name === variable)?.opciones ?? [];
    const fuente = lista.length ? lista : codigosPorBase[base] ?? [];
    const opciones = fuente
      .filter((o) => o.codigo.trim())
      .map((o) => ({ codigo: o.codigo, etiqueta: legible(o.etiqueta) || o.codigo }));
    if (opciones.length) out.push({ base, variable, rotulo: `${variable} · ${base}`, opciones });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ayuda: rangos
// ---------------------------------------------------------------------------

export type Tramo = { clave: string; desde: string; hasta: string; destino: string };

/** Un rango por categoría de la escala, por llenar. */
export function rangosPorDefecto(escala: readonly CategoriaSegmento[]): Tramo[] {
  const base = escala.length ? escala : [{ codigo: "", etiqueta: "" }];
  return base.map((c, i) => ({ clave: `t${i + 1}`, desde: "", hasta: "", destino: c.codigo }));
}

export function tramoNuevo(tramos: readonly Tramo[]): Tramo {
  const max = tramos.reduce((m, t) => Math.max(m, Number(t.clave.slice(1)) || 0), 0);
  return { clave: `t${max + 1}`, desde: "", hasta: "", destino: "" };
}

function numero(s: string): number | null {
  const t = s.trim();
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Lo que impide aplicar los tramos o rangos; vacío si se pueden aplicar. */
export function validarTramos(tramos: readonly Tramo[], escala: readonly CategoriaSegmento[]): string[] {
  const errores: string[] = [];
  if (tramos.length === 0) errores.push("Agrega al menos un tramo.");
  const codigos = new Set(escala.map((c) => c.codigo));
  const intervalos: [number, number][] = [];
  for (const [i, t] of tramos.entries()) {
    const desde = numero(t.desde);
    const hasta = t.hasta.trim() ? numero(t.hasta) : Number.POSITIVE_INFINITY;
    if (desde === null || hasta === null) {
      errores.push(`El tramo ${i + 1} necesita «desde» y, si tiene tope, «hasta» en números.`);
      continue;
    }
    if (hasta < desde) errores.push(`En el tramo ${i + 1}, «hasta» es menor que «desde».`);
    if (!t.destino || !codigos.has(t.destino)) errores.push(`Elige la categoría del tramo ${i + 1}.`);
    intervalos.push([desde, hasta]);
  }
  const ordenados = [...intervalos].sort((x, y) => x[0] - y[0]);
  if (ordenados.some((x, i) => i > 0 && x[0] <= ordenados[i - 1][1])) errores.push("Los tramos se superponen.");
  return errores;
}

function tramoDe(valor: number, tramos: readonly Tramo[]): Tramo | undefined {
  return tramos.find((t) => {
    const desde = numero(t.desde);
    const hasta = t.hasta.trim() ? numero(t.hasta) : Number.POSITIVE_INFINITY;
    return desde !== null && hasta !== null && valor >= desde && valor <= hasta;
  });
}

/** Los valores del origen sobre los que se aplican los rangos: los observados numéricos. */
export function valoresParaRangos(codigos: readonly OpcionBase[]): string[] {
  return codigos.map((c) => c.codigo).filter((c) => numero(c) !== null);
}

export function mapaPorRangos(valores: readonly string[], rangos: readonly Tramo[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of valores) {
    const v = numero(c);
    if (v === null) continue;
    const t = tramoDe(v, rangos);
    if (t?.destino) out[c] = t.destino;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validación y cuerpo del POST
// ---------------------------------------------------------------------------

/**
 * Lo que impide guardar, en el orden en que se lee el editor. `claves` son las
 * de los otros segmentos del estudio; el backend vuelve a comprobarlo todo.
 */
export function validarSegmento(b: BorradorSegmento, bases: readonly string[], claves: readonly string[]): string[] {
  const errores: string[] = [];
  if (!b.etiqueta.trim()) errores.push("Falta la etiqueta.");
  if (!b.clave) errores.push("Falta el nombre del segmento.");
  else if (!b.editando && claves.includes(b.clave)) errores.push(`Ya hay un segmento «${nombreDeSegmento(b.clave)}».`);
  if (b.escala.length === 0) errores.push("Define al menos una categoría de la escala estándar.");
  const codigos = b.escala.map((c) => c.codigo.trim());
  if (codigos.some((c) => !c)) errores.push("Cada categoría necesita su código.");
  else if (new Set(codigos).size !== codigos.length) errores.push("Hay códigos repetidos en la escala estándar.");
  if (b.escala.some((c) => !c.etiqueta.trim())) errores.push("Cada categoría necesita su etiqueta.");
  const conOrigen = bases.filter((base) => entradaDe(b, base).origen);
  if (conOrigen.length === 0) errores.push("Elige la variable de origen en al menos una base.");
  const validos = new Set(codigos.filter(Boolean));
  for (const base of conOrigen) {
    const e = entradaDe(b, base);
    if (!Object.values(e.mapa).some((d) => validos.has(d))) {
      errores.push(`En ${base}, asigna al menos un código de ${e.origen} a la escala.`);
    }
  }
  return errores;
}

/** El cuerpo del POST: sólo las bases con origen, y en su mapa sólo destinos de la escala o «sin dato». */
export function segmentoParaGuardar(b: BorradorSegmento, bases: readonly string[]): SegmentoADeclarar {
  const escala = b.escala.map((c) => ({ codigo: c.codigo.trim(), etiqueta: c.etiqueta.trim() }));
  const validos = new Set(escala.map((c) => c.codigo));
  const por_base: SegmentoADeclarar["por_base"] = {};
  for (const base of bases) {
    const e = entradaDe(b, base);
    if (!e.origen) continue;
    por_base[base] = {
      origen: e.origen,
      mapa: Object.fromEntries(Object.entries(e.mapa).filter(([, d]) => d === "" || validos.has(d))),
    };
  }
  return { clave: b.clave, etiqueta: b.etiqueta.trim(), nota: b.nota.trim(), escala, por_base };
}

// ---------------------------------------------------------------------------
// La matriz tras guardar o quitar un segmento
// ---------------------------------------------------------------------------

/**
 * La matriz en edición con las filas de cruce que el servidor tiene ahora.
 * Guardar o quitar un segmento sólo toca su fila `SEG-*`: las demás conservan
 * sus cambios sin guardar y su posición declarada se corrige al orden nuevo
 * (la armonización y el indicador compuesto se refieren a ella).
 */
export function fusionarFilasCruce(
  enEdicion: readonly FilaEditor[],
  antes: readonly EquivalenciaFila[],
  ahora: readonly EquivalenciaFila[],
): FilaEditor[] {
  const indiceComun = (filas: readonly EquivalenciaFila[]) => {
    const out: number[] = [];
    filas.forEach((f, i) => { if (!f.cruce && !(f.id ?? "").startsWith(PREFIJO_FILA)) out.push(i); });
    return out;
  };
  const viejos = indiceComun(antes);
  const nuevos = indiceComun(ahora);
  const conservadas = enEdicion
    .filter((f) => !esFilaCruce(f))
    .map((f) => {
      if (typeof f.indice_declarado !== "number") return f;
      const k = viejos.indexOf(f.indice_declarado);
      const nuevo = k >= 0 ? nuevos[k] : undefined;
      if (nuevo !== undefined) return { ...f, indice_declarado: nuevo };
      const { indice_declarado: _fuera, ...resto } = f;
      return resto;
    });
  const cruces = aFilasEditor(ahora).filter(esFilaCruce);
  return [...conservadas, ...cruces];
}
