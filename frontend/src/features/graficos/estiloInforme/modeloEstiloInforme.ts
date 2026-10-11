// Modelo puro de la pestaña «Estilo del informe» de Procesamiento › Gráficos (A10 W-E; decisiones 28–29; ADR 0094 y
// 0074). Sin React ni store: el componente lee `presets`, `wPresets`, `paletas` y `scopeRules` del store del plan,
// deriva aquí la procedencia y escribe con las funciones `con*`/`sin*`, que devuelven un objeto nuevo (nunca mutan el de
// entrada). Así cada cambio es un solo paso deshacible y lo guarda el autosave de siempre, en la base activa o en el
// borrador del informe compartido según el alcance (ADR 0040 §6.1: nada se copia entre bases).
//
// Procedencia derivada, no guardada (ADR 0094 §4): un ajuste es «Propio» cuando el plan guarda una clave cuyo valor
// difiere del default; si no, «Del recetario». Elegir el valor del default o «Volver al recetario» borra la clave.

import type { ArgMetadata, PresetMetadata } from "../../../api/graficos";
import type { WordFijado } from "../../../api/graficosWordFijado";
import { wordChartPresetsDecisiones } from "../../../api/graficosConfigDefaults";
import type { Procedencia } from "../estilo/modeloEstilo";

export type { Procedencia };

export type MapaPresets = Record<string, Record<string, unknown>>;

/** Preset que heredan todos los gráficos: ahí viven el texto de la base y la nota del redondeo. */
export const PRESET_BASE = "base";
export const ARG_FORMATO = "formato";
export const ARG_SUFIJO = "sufijo_auto";
export const ARG_NOTA = "nota_redondeo";
export const ARG_METODO = "metodo_redondeo";
export const METODO_ESTANDAR = "estandar";
export const METODO_REPARTO = "reparto";
export const DECIMALES_MAX = 2;
/** Conteo con el que se ilustra el texto de la base. */
export const N_EJEMPLO = 120;

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Igualdad de valores de args (JSON). Un texto vacío contra un default ausente es «sin cambio»: no hay nada que decidir
 * si el recetario no pone nada.
 */
export function mismoValor(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) {
    const otro = a === undefined ? b : a;
    return otro === undefined || otro === "";
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Default de un arg: el de `/presets-defaults` si llegó; si no, el que declara el catálogo. */
export function defaultDeArg(
  defaults: MapaPresets,
  meta: PresetMetadata | undefined,
  preset: string,
  arg: string,
): unknown {
  const delGet = defaults[preset];
  if (esRegistro(delGet) && Object.prototype.hasOwnProperty.call(delGet, arg)) return delGet[arg];
  return meta?.args.find((a) => a.name === arg)?.default;
}

function tieneClave(presets: MapaPresets, preset: string, arg: string): boolean {
  const bloque = presets[preset];
  return esRegistro(bloque) && Object.prototype.hasOwnProperty.call(bloque, arg);
}

/** Lo que sale: el valor guardado o, si no hay clave, el default. */
export function valorEfectivo(presets: MapaPresets, preset: string, arg: string, porDefecto: unknown): unknown {
  return tieneClave(presets, preset, arg) ? presets[preset][arg] : porDefecto;
}

/** Es decisión del proyecto: hay clave y su valor difiere del default. */
export function esDecision(presets: MapaPresets, preset: string, arg: string, porDefecto: unknown): boolean {
  return tieneClave(presets, preset, arg) && !mismoValor(presets[preset][arg], porDefecto);
}

export function procedenciaArg(presets: MapaPresets, preset: string, arg: string, porDefecto: unknown): Procedencia {
  return esDecision(presets, preset, arg, porDefecto) ? "propio" : "recetario";
}

function conBloque(presets: MapaPresets, preset: string, bloque: Record<string, unknown>): MapaPresets {
  const out: MapaPresets = { ...presets };
  if (Object.keys(bloque).length === 0) delete out[preset];
  else out[preset] = bloque;
  return out;
}

/** Fija un arg. Igual al default (o `undefined`) = se borra la clave: sólo se guardan decisiones. */
export function conArg(
  presets: MapaPresets,
  preset: string,
  arg: string,
  valor: unknown,
  porDefecto: unknown,
): MapaPresets {
  const bloque: Record<string, unknown> = { ...(esRegistro(presets[preset]) ? presets[preset] : {}) };
  if (valor === undefined || valor === null || mismoValor(valor, porDefecto)) delete bloque[arg];
  else bloque[arg] = valor;
  return conBloque(presets, preset, bloque);
}

/** «Volver al recetario»: borra las claves; un preset que queda vacío desaparece. */
export function sinArgs(presets: MapaPresets, preset: string, args: readonly string[]): MapaPresets {
  if (!esRegistro(presets[preset])) return presets;
  const bloque: Record<string, unknown> = { ...presets[preset] };
  for (const arg of args) delete bloque[arg];
  return conBloque(presets, preset, bloque);
}

// --- Texto de la base (C48) ----------------------------------------------------------------------------------------

/**
 * El motor arma el texto con `sprintf(formato, "<n> <sufijo>")`: el formato necesita un único `%s` y ningún otro `%`
 * suelto (un `%d` aborta el render). `%%` es un porcentaje literal y vale.
 */
export function errorFormato(formato: string): string | null {
  const marcadores = formato.match(/%s/g)?.length ?? 0;
  if (marcadores === 0) return "Falta %s: es donde va el conteo.";
  if (marcadores > 1) return "Usa %s una sola vez.";
  if (formato.replace(/%%/g, "").replace("%s", "").includes("%")) return "Un % suelto rompe el texto; escribe %% para un porcentaje.";
  return null;
}

/** Cómo se lee el texto de la base con un conteo de ejemplo, igual que lo compone el motor. */
export function ejemploTextoBase(formato: string, sufijo: string, n: number = N_EJEMPLO): string {
  const sufijoLimpio = sufijo.trim();
  const conteo = sufijoLimpio ? `${n} ${sufijoLimpio}` : String(n);
  return formato.replace(/%%/g, "\u0000").replace("%s", conteo).replace(/\u0000/g, "%");
}

function texto(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type CampoBase = {
  arg: string;
  valor: string;
  porDefecto: string;
  procedencia: Procedencia;
};

export type TextoBase = {
  formato: CampoBase;
  sufijo: CampoBase;
  ejemplo: string;
  modificado: boolean;
};

export function textoBase(presets: MapaPresets, defaults: MapaPresets, meta: PresetMetadata | undefined): TextoBase {
  const campo = (arg: string): CampoBase => {
    const porDefecto = defaultDeArg(defaults, meta, PRESET_BASE, arg);
    return {
      arg,
      valor: texto(valorEfectivo(presets, PRESET_BASE, arg, porDefecto)),
      porDefecto: texto(porDefecto),
      procedencia: procedenciaArg(presets, PRESET_BASE, arg, porDefecto),
    };
  };
  const formato = campo(ARG_FORMATO);
  const sufijo = campo(ARG_SUFIJO);
  return {
    formato,
    sufijo,
    ejemplo: ejemploTextoBase(errorFormato(formato.valor) ? formato.porDefecto || "Base: %s" : formato.valor, sufijo.valor),
    modificado: formato.procedencia === "propio" || sufijo.procedencia === "propio",
  };
}

// --- Cálculos (C50) ------------------------------------------------------------------------------------------------

export type FilaCalculo = {
  preset: string;
  titulo: string;
  icono: string;
  admiteMetodo: boolean;
  campoDecimales: string;
  metodo: string;
  metodoDefault: string;
  choicesMetodo: NonNullable<ArgMetadata["choices"]>;
  decimales: number;
  decimalesDefault: number;
  procedencia: Procedencia;
};

function numero(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function acotarDecimales(value: unknown): number {
  return Math.max(0, Math.min(DECIMALES_MAX, Math.round(numero(value, 0))));
}

/** Familias que rotulan porcentajes, en el orden del catálogo (la clasificación la sirve el motor en `calculos`). */
export function filasCalculos(catalogo: readonly PresetMetadata[], presets: MapaPresets, defaults: MapaPresets): FilaCalculo[] {
  return catalogo
    .filter((p) => p.calculos?.familia_porcentaje)
    .map((p) => {
      const admiteMetodo = p.calculos?.admite_metodo === true;
      const campoDecimales = p.calculos?.campo_decimales ?? "";
      const metodoDef = texto(defaultDeArg(defaults, p, p.name, ARG_METODO)) || METODO_ESTANDAR;
      const decDef = acotarDecimales(campoDecimales ? defaultDeArg(defaults, p, p.name, campoDecimales) : 0);
      const metodoDecidido = admiteMetodo && esDecision(presets, p.name, ARG_METODO, metodoDef);
      const decDecidido = !!campoDecimales && esDecision(presets, p.name, campoDecimales, decDef);
      return {
        preset: p.name,
        titulo: p.titulo_humano,
        icono: p.icono_ui,
        admiteMetodo,
        campoDecimales,
        metodo: admiteMetodo ? texto(valorEfectivo(presets, p.name, ARG_METODO, metodoDef)) || metodoDef : METODO_ESTANDAR,
        metodoDefault: metodoDef,
        choicesMetodo: p.args.find((a) => a.name === ARG_METODO)?.choices ?? [],
        decimales: campoDecimales ? acotarDecimales(valorEfectivo(presets, p.name, campoDecimales, decDef)) : 0,
        decimalesDefault: decDef,
        procedencia: metodoDecidido || decDecidido ? "propio" : "recetario",
      };
    });
}

export function conMetodo(presets: MapaPresets, fila: FilaCalculo, metodo: string): MapaPresets {
  if (!fila.admiteMetodo) return presets;
  return conArg(presets, fila.preset, ARG_METODO, metodo, fila.metodoDefault);
}

export function conDecimales(presets: MapaPresets, fila: FilaCalculo, decimales: number): MapaPresets {
  if (!fila.campoDecimales) return presets;
  return conArg(presets, fila.preset, fila.campoDecimales, acotarDecimales(decimales), fila.decimalesDefault);
}

/** «Aplicar a todos» en un solo paso deshacible. Las familias sin resto que repartir no cambian de método. */
export function conMetodoEnTodas(presets: MapaPresets, filas: readonly FilaCalculo[], metodo: string): MapaPresets {
  return filas.reduce((acc, fila) => conMetodo(acc, fila, metodo), presets);
}

export function conDecimalesEnTodas(presets: MapaPresets, filas: readonly FilaCalculo[], decimales: number): MapaPresets {
  return filas.reduce((acc, fila) => conDecimales(acc, fila, decimales), presets);
}

export function sinCalculos(presets: MapaPresets, fila: FilaCalculo): MapaPresets {
  const args = [ARG_METODO, ...(fila.campoDecimales ? [fila.campoDecimales] : [])];
  return sinArgs(presets, fila.preset, args);
}

export type NotaRedondeo = { activa: boolean; porDefecto: boolean; procedencia: Procedencia };

export function notaRedondeo(presets: MapaPresets, defaults: MapaPresets, meta: PresetMetadata | undefined): NotaRedondeo {
  const porDefecto = defaultDeArg(defaults, meta, PRESET_BASE, ARG_NOTA) === true;
  return {
    activa: valorEfectivo(presets, PRESET_BASE, ARG_NOTA, porDefecto) === true,
    porDefecto,
    procedencia: procedenciaArg(presets, PRESET_BASE, ARG_NOTA, porDefecto),
  };
}

// --- Paletas (C51) y línea visual (C52) ----------------------------------------------------------------------------

/** Listas con al menos un color propio. Sin colores, el motor usa la paleta del recetario. */
export function listasConColor(paletas: Record<string, Record<string, string>>): number {
  return Object.values(paletas).filter((p) => esRegistro(p) && Object.values(p).some((c) => typeof c === "string" && c.trim() !== "")).length;
}

/** `profile_id` de la línea visual aplicada al plan (lo escribe `applyPptStyleProfile` en `scope_rules.global`). */
export function lineaVisualAplicada(scopeRules: Record<string, unknown>): string | null {
  const global = scopeRules.global;
  if (!esRegistro(global)) return null;
  const id = global.profile_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

// --- Word: lo que decide el recetario (C49, decisión 29) -----------------------------------------------------------

export const ARG_OCULTAR_ETIQUETA = "ocultar_etiqueta_si_titulo";

function opcionesWord(wPresets: MapaPresets): Record<string, unknown> {
  return esRegistro(wPresets.chart_options) ? wPresets.chart_options : {};
}

export type OpcionWord = { activa: boolean; porDefecto: boolean; procedencia: Procedencia };

/** «No repetir el título como etiqueta del eje»: activa salvo `false` explícito, igual que el motor. */
export function ocultarEtiquetaSiTitulo(wPresets: MapaPresets, referencia: MapaPresets): OpcionWord {
  const porDefecto = opcionesWord(referencia)[ARG_OCULTAR_ETIQUETA] !== false;
  const activa = opcionesWord(wPresets)[ARG_OCULTAR_ETIQUETA] !== false;
  return { activa, porDefecto, procedencia: activa === porDefecto ? "recetario" : "propio" };
}

/**
 * Fija la opción. El estado del Word trae el default completo y el backend guarda sólo el diff (ADR 0094 §1): volver al
 * valor del recetario es reponer el de la referencia, que al guardar desaparece del `.pulso`.
 */
export function conOcultarEtiqueta(wPresets: MapaPresets, referencia: MapaPresets, activa: boolean): MapaPresets {
  const ref = opcionesWord(referencia);
  const opciones: Record<string, unknown> = { ...opcionesWord(wPresets) };
  const porDefecto = ref[ARG_OCULTAR_ETIQUETA] !== false;
  if (activa === porDefecto) {
    if (Object.prototype.hasOwnProperty.call(ref, ARG_OCULTAR_ETIQUETA)) opciones[ARG_OCULTAR_ETIQUETA] = ref[ARG_OCULTAR_ETIQUETA];
    else delete opciones[ARG_OCULTAR_ETIQUETA];
  } else {
    opciones[ARG_OCULTAR_ETIQUETA] = activa;
  }
  return { ...wPresets, chart_options: opciones };
}

export type LineaFijada = { fijado: WordFijado; meta?: ArgMetadata; guardado?: unknown };
export type BloqueFijado = { preset: string; titulo: string; lineas: LineaFijada[] };

/**
 * Por tipo de gráfico, los ajustes del Word que fija el recetario (`word_fijado` del catálogo), con el valor que el
 * proyecto guarda como decisión si guarda alguno (para que el candado diga que no se usa, sin borrarlo).
 */
export function bloquesFijados(catalogo: readonly PresetMetadata[], wPresets: MapaPresets, referencia: MapaPresets): BloqueFijado[] {
  const decisiones = wordChartPresetsDecisiones(wPresets, referencia);
  return catalogo
    .filter((p) => (p.word_fijado?.length ?? 0) > 0)
    .map((p) => ({
      preset: p.name,
      titulo: p.titulo_humano,
      lineas: (p.word_fijado ?? []).map((fijado) => {
        const meta = p.args.find((a) => a.name === fijado.arg);
        const guardado = decisiones[p.name]?.[fijado.arg];
        return { fijado, ...(meta ? { meta } : {}), ...(guardado !== undefined ? { guardado } : {}) };
      }),
    }));
}
