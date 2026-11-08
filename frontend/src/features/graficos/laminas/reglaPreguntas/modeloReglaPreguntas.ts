// La regla de preguntas de una lámina de resumen en la tarjeta del gráfico (ADR 0135 §2 y §4; maqueta graficos-sintesis,
// Configurar › Preguntas). Pura: qué tipos ofrece cada graficador, cómo se lee la regla guardada, el ajuste a mano por
// fila (`agregar` / `quitar`) y la firma del pedido de conteo. El componente (ReglaPreguntas.tsx) sólo pinta.
//
// El universo de cada graficador sale de graficos_regla_indicadores.R: el panorama y la escala miden por público (un
// grupo por base), la brecha compara dos públicos o los grupos de un cruce. Las reglas que comparan grupos (`comunes`,
// `mayor_diferencia`, `diferencia_minima`) necesitan dos o más: con uno, el backend responde E_REGLA_PREGUNTAS_INVALIDA.

import { esTipoRegla, type ConteoRegla, type ReglaPreguntas, type TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";

type Args = Readonly<Record<string, unknown>>;

export const GRAFICADORES_CON_REGLA: ReadonlySet<string> = new Set(["p_panorama", "p_dumbbell", "p_barras_divergentes", "p_fortalezas"]);

export const ENTRE_GRUPOS: ReadonlySet<TipoReglaPreguntas> = new Set(["comunes", "mayor_diferencia", "diferencia_minima"]);
export const CON_N: ReadonlySet<TipoReglaPreguntas> = new Set(["mayor_diferencia", "mayor_sin_info", "extremos"]);
export const CON_UMBRAL: ReadonlySet<TipoReglaPreguntas> = new Set(["diferencia_minima", "bajo_umbral"]);

export const ROTULO_TIPO: Readonly<Record<TipoReglaPreguntas, string>> = {
  todas: "Todas",
  comunes: "Todas las comunes",
  mayor_diferencia: "Las de mayor diferencia",
  diferencia_minima: "Con diferencia de al menos",
  mayor_sin_info: "Las de más Sin información",
  bajo_umbral: "Bajo un umbral en algún público",
  extremos: "Las más altas y las más bajas",
  a_mano: "Elegidas a mano",
};

/** Lo que se escribe al elegir un tipo que pide cifra y no la tiene guardada. */
export const N_POR_DEFECTO = 10;
export const UMBRAL_POR_DEFECTO: Readonly<Record<"diferencia_minima" | "bajo_umbral", number>> = { diferencia_minima: 15, bajo_umbral: 60 };

const ORDEN_POR_GRAFICADOR: Readonly<Record<string, readonly TipoReglaPreguntas[]>> = {
  p_panorama: ["todas", "comunes", "mayor_diferencia", "diferencia_minima", "bajo_umbral", "a_mano"],
  p_dumbbell: ["mayor_diferencia", "diferencia_minima", "comunes", "a_mano"],
  p_barras_divergentes: ["mayor_sin_info", "bajo_umbral", "extremos", "todas", "a_mano"],
  p_fortalezas: ["extremos", "bajo_umbral", "mayor_sin_info", "todas", "a_mano"],
};

const baseDe = (r: unknown): string | null => (typeof r === "string" && r.includes("$") ? r.slice(0, r.indexOf("$")) : null);

/**
 * Cuántos grupos compara la lámina, para ofrecer sólo las reglas que tienen sentido. El panorama y la escala: las bases
 * distintas de `vars`. La brecha siempre compara (dos públicos o los grupos del cruce).
 */
export function gruposDeLaLamina(graficador: string, args: Args): number {
  if (graficador === "p_dumbbell") return 2;
  const vars = Array.isArray(args.vars) ? args.vars : [];
  return new Set(vars.map(baseDe).filter((b): b is string => !!b)).size;
}

/** Los tipos que la tarjeta ofrece; el guardado siempre está, aunque ya no aplique, para que se vea y se pueda cambiar. */
export function tiposOfrecidos(graficador: string, grupos: number, guardado: TipoReglaPreguntas | null): TipoReglaPreguntas[] {
  const base = (ORDEN_POR_GRAFICADOR[graficador] ?? []).filter((t) => grupos >= 2 || !ENTRE_GRUPOS.has(t));
  return guardado && !base.includes(guardado) ? [...base, guardado] : base;
}

/** El rótulo del tipo en este graficador: el panorama elige entre preguntas de escala. */
export function rotuloTipo(tipo: TipoReglaPreguntas, graficador: string): string {
  if (tipo === "todas" && graficador !== "p_dumbbell") return "Todas las de escala";
  return ROTULO_TIPO[tipo];
}

const textos = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()))];

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** La regla guardada, o `null` (sin regla: las preguntas declaradas en `vars`, el contrato de siempre). */
export function leerRegla(valor: unknown): ReglaPreguntas | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const o = valor as Record<string, unknown>;
  if (!esTipoRegla(o.tipo)) return null;
  const r: ReglaPreguntas = { tipo: o.tipo };
  const n = numero(o.n);
  const umbral = numero(o.umbral);
  if (CON_N.has(o.tipo) && n !== null) r.n = n;
  if (CON_UMBRAL.has(o.tipo) && umbral !== null) r.umbral = umbral;
  const agregar = textos(o.agregar);
  const quitar = textos(o.quitar);
  if (agregar.length) r.agregar = agregar;
  if (quitar.length) r.quitar = quitar;
  return r;
}

/**
 * La regla que rige: la guardada o, en Fortalezas y alertas, la que el constructor pone sin regla (`extremos` con su
 * `n`, graficos_fortalezas_plan.R). En los demás, sin regla no hay regla: salen las `vars` declaradas.
 */
export function reglaEfectiva(graficador: string, args: Args, valor: unknown): ReglaPreguntas | null {
  const guardada = leerRegla(valor);
  if (guardada || graficador !== "p_fortalezas") return guardada;
  return { tipo: "extremos", n: numero(args.n) ?? 5 };
}

/** La regla sin claves vacías: lo que se guarda en el plan. */
export function limpiarRegla(r: ReglaPreguntas): ReglaPreguntas {
  const out: ReglaPreguntas = { tipo: r.tipo };
  if (CON_N.has(r.tipo)) out.n = r.n ?? N_POR_DEFECTO;
  if (CON_UMBRAL.has(r.tipo)) out.umbral = r.umbral ?? UMBRAL_POR_DEFECTO[r.tipo as "diferencia_minima" | "bajo_umbral"];
  if (r.agregar?.length) out.agregar = [...r.agregar];
  if (r.quitar?.length) out.quitar = [...r.quitar];
  return out;
}

/**
 * Cambiar de tipo deja la regla limpia (el ajuste a mano era relativo a la anterior). «Elegidas a mano» arranca con lo
 * que la lámina muestra ahora: el backend pide al menos una en `agregar`, y nadie tiene que marcarlas de nuevo.
 */
export function conTipo(actual: ReglaPreguntas | null, tipo: TipoReglaPreguntas, seleccionadas: readonly string[]): ReglaPreguntas {
  if (tipo === "a_mano") return limpiarRegla({ tipo, agregar: [...seleccionadas] });
  const previo = actual && actual.tipo === tipo ? actual : null;
  return limpiarRegla({ tipo, n: previo?.n ?? actual?.n, umbral: previo?.umbral });
}

export function conCifra(r: ReglaPreguntas, cifra: number | null): ReglaPreguntas {
  if (CON_N.has(r.tipo)) return limpiarRegla({ ...r, n: cifra ?? undefined });
  if (CON_UMBRAL.has(r.tipo)) return limpiarRegla({ ...r, umbral: cifra ?? undefined });
  return r;
}

/** ¿La lista se ajustó a mano sobre la regla? (en «Elegidas a mano» la lista ES la regla). */
export function ajustadaAMano(r: ReglaPreguntas | null): boolean {
  return !!r && r.tipo !== "a_mano" && (!!r.agregar?.length || !!r.quitar?.length);
}

export function volverALaRegla(r: ReglaPreguntas): ReglaPreguntas {
  return limpiarRegla({ ...r, agregar: [], quitar: [] });
}

/**
 * Encender o apagar una fila. Sobre una regla: apagar una elegida la quita (o deshace su agregado) y encender una que no
 * estaba la agrega (o deshace su quitado). En «Elegidas a mano» la lista es `agregar`.
 */
export function alternarFila(r: ReglaPreguntas, tema: string, encendida: boolean): ReglaPreguntas {
  const agregar = new Set(r.agregar ?? []);
  const quitar = new Set(r.quitar ?? []);
  if (r.tipo === "a_mano") {
    if (encendida) agregar.delete(tema);
    else agregar.add(tema);
    quitar.delete(tema);
  } else if (encendida) {
    if (agregar.has(tema)) agregar.delete(tema);
    else quitar.add(tema);
  } else if (quitar.has(tema)) quitar.delete(tema);
  else agregar.add(tema);
  return limpiarRegla({ ...r, agregar: [...agregar], quitar: [...quitar] });
}

/** En «Elegidas a mano» la última no se apaga: el backend no acepta una lista vacía. */
export function filaBloqueada(r: ReglaPreguntas, tema: string, encendida: boolean): boolean {
  return r.tipo === "a_mano" && encendida && (r.agregar ?? []).filter((t) => t !== tema).length === 0;
}

/** Rótulo de la cifra n o umbral del tipo; `null` si el tipo no pide cifra. */
export function campoCifra(tipo: TipoReglaPreguntas): { rotulo: string; min: number; max: number; paso: number } | null {
  if (tipo === "extremos") return { rotulo: "Cuántas de cada lado", min: 1, max: 50, paso: 1 };
  if (CON_N.has(tipo)) return { rotulo: "Cuántas", min: 1, max: 200, paso: 1 };
  if (tipo === "diferencia_minima") return { rotulo: "Diferencia mínima (puntos)", min: 0, max: 100, paso: 1 };
  if (tipo === "bajo_umbral") return { rotulo: "Umbral (%)", min: 0, max: 100, paso: 5 };
  return null;
}

export function valorCifra(r: ReglaPreguntas): number | null {
  if (CON_N.has(r.tipo)) return r.n ?? N_POR_DEFECTO;
  if (CON_UMBRAL.has(r.tipo)) return r.umbral ?? UMBRAL_POR_DEFECTO[r.tipo as "diferencia_minima" | "bajo_umbral"];
  return null;
}

/**
 * El encabezado de la cifra de cada fila: la métrica con que el backend ordena para ese tipo (`.regla_preguntas_conteo`,
 * graficos_regla_preguntas.R). Con dos públicos la distancia es su diferencia; con tres o más, la distancia entre el más
 * alto y el más bajo; con uno, el valor del indicador (Q2-12: «Todas las de escala» del panorama de tres públicos se
 * rotulaba «Diferencia»). `indicador` es el nombre que la lámina le da (`corte_etiqueta`).
 */
export function rotuloMetrica(tipo: TipoReglaPreguntas, grupos: number, indicador = ""): string {
  const delIndicador = indicador.trim() || "Indicador";
  const distancia = grupos >= 3 ? "Distancia" : "Diferencia";
  if (tipo === "mayor_sin_info") return "Sin información";
  if (tipo === "mayor_diferencia" || tipo === "diferencia_minima") return distancia;
  if (tipo === "bajo_umbral") return grupos >= 2 ? "Mínimo entre públicos" : delIndicador;
  if (tipo === "extremos") return grupos >= 2 ? "Promedio" : delIndicador;
  return grupos >= 2 ? distancia : delIndicador;
}

/** El nombre del indicador de la lámina, para rotular su cifra. */
export function indicadorDe(args: Args): string {
  return typeof args.corte_etiqueta === "string" ? args.corte_etiqueta : "";
}

export function textoMetrica(m: number | null): string {
  return m === null ? "" : formatoDecimal(m, 1);
}

/** «13 de 47»: las que salen en la lámina de las candidatas del universo. */
export function textoConteo(c: Pick<ConteoRegla, "seleccionadas" | "total">): string {
  return `${formatoConteo(c.seleccionadas.length)} de ${formatoConteo(c.total)}`;
}

/** JSON con las claves ordenadas: dos objetos con lo mismo dan el mismo texto. */
export function jsonEstable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${jsonEstable(o[k])}`).join(",")}}`;
  }
  return v === undefined ? "null" : JSON.stringify(v);
}

/**
 * La firma del pedido de conteo. Es un texto: el efecto que pide el conteo depende de ella y no de `args`, que la tarjeta
 * re-arma en cada render (el bucle efecto → estado → render que congeló la maqueta, useConteosMaqueta.ts).
 */
export function firmaPedidoRegla(graficador: string, args: Args, scope: string): string {
  return `${graficador}|${scope}|${jsonEstable(args)}`;
}

/**
 * La identidad del universo de candidatas: el pedido sin la regla. Cambia con la lámina (otro graficador u otras
 * `vars`, bases o filtros) y no con la cifra ni el ajuste a mano. Un conteo de otro universo no se muestra mientras
 * llega el nuevo (B8: al pasar de una lámina a otra se veían el conteo, la nota y la cabecera de la anterior).
 */
export function firmaUniversoRegla(graficador: string, args: Args, scope: string): string {
  const { regla: _regla, ...resto } = args;
  return firmaPedidoRegla(graficador, resto, scope);
}

/** ¿Dos conteos dicen lo mismo? Sin cambios no se vuelve a guardar el estado. */
export function mismoConteo(a: ConteoRegla | null, b: ConteoRegla | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.total === b.total && a.texto_regla === b.texto_regla && jsonEstable(a.seleccionadas) === jsonEstable(b.seleccionadas)
    && jsonEstable(a.avisos) === jsonEstable(b.avisos) && jsonEstable(a.candidatas) === jsonEstable(b.candidatas);
}
