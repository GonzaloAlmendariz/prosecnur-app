// La miniatura real del selector de láminas (`panel=tipo-lamina`): cómo queda la tarjeta enfocada, o las dos de
// «Comparar», con los datos del estudio. Sólo esas: la galería conserva su glifo, porque pedir una lámina por tarjeta
// saturaría el motor. Se dibuja la lámina que la tarjeta insertaría (payload por defecto del tipo con el gráfico de la
// tarjeta, su regla, los `vars` y las bases del estudio y su indicador por defecto). Una tarjeta sin regla ni preguntas de
// partida (las divergentes del recetario) se dibuja con una muestra de las preguntas que la ficha «Datos» cuenta (R5-1):
// sin ellas la imagen salía en blanco. No se pide si el estudio no alcanza para el gráfico (las faltas de la ficha) ni si
// a la lámina le falta un dato obligatorio (faltaLamina.ts): una lámina vacía no es la propuesta, y el hueco lo dice en
// una línea visible. Una imagen que llega sin gráfico cuenta como error. Mismo patrón que el mazo
// (mazoResumen/modeloMiniaturasMazo.ts): ids estables, un lote del selector a la vez y siempre `reemplazar = false`.
// Pura: el hook la orquesta y los tests la prueban sola.

import type { GraficadorRef, Slide, VarInfo } from "../../../../api/graficos";
import type { PreguntaQueUsa, UsaGrafico } from "../../iconos/catalogoTipos.generated";
import { clavePreview } from "../../previewLaminaCoordinador";
import { payloadPorDefecto } from "../../store";
import { faltaEnLamina } from "../faltaLamina";
import { esPreguntaDeEscala } from "../mazoResumen/modeloMazo";
import type { EntradaMiniatura, LaminaClave } from "../miniaturas/loteMiniaturas";
import { cruzarConEstudio, usaDeTarjeta, type CruceConEstudio, type EstadoInventario } from "./fichaDatos";
import { conOpcion, presetDe, ranuraDePreset, tipoDeOpcion, type EstudioDelSelector, type OpcionLamina } from "./opcionesLamina";

export type LaminaDelSelector = LaminaClave & { opcion: OpcionLamina; slide: Slide };

/**
 * Lo que pinta el hueco: la imagen si llegó; si no, el glifo y, con un error o una lámina incompleta, una línea visible
 * con el motivo (nunca sólo el `title`).
 */
export type MiniaturaSelector = { src: string | null; error: string | null };

/** Las preguntas del estudio de una base (useVariables), con las que se arma la muestra. */
export type FuenteSelector = { name: string; variables: readonly Pick<VarInfo, "name" | "tipo" | "choices" | "graphable">[] };

/** Cuántas preguntas lleva la muestra de una tarjeta sin preguntas de partida. */
export const PREGUNTAS_MUESTRA = 6;

/** Gráficos cuyas preguntas no son una lista (temas de la matriz, dimensiones): sin elegirlas no hay muestra. */
const SIN_MUESTRA: ReadonlySet<string> = new Set(["p_significancia_publicos", "p_dim_heatmap_criterios"]);

export const NOTA_SIN_PREGUNTAS = "Sin vista previa: falta elegir preguntas.";

/** «Sin vista previa: elige la pregunta que define los grupos.» desde lo que falta en la lámina. */
export const notaDeFalta = (falta: string): string => `Sin vista previa: ${falta.charAt(0).toLowerCase()}${falta.slice(1)}`;

/** Id estable por tarjeta («p_slide_un_grafico:brecha» → «selector-p_slide_un_grafico-brecha»). */
export function idMiniaturaSelector(op: OpcionLamina): string {
  return `selector-${op.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

/** Las tarjetas a la vista que piden: las dos de «Comparar» o, fuera de ella, sólo la enfocada. Nunca la galería. */
export function opcionesQuePiden(
  candidato: OpcionLamina | null, comparar: readonly OpcionLamina[], viendoComparacion: boolean,
): OpcionLamina[] {
  if (viendoComparacion) return [...comparar];
  return candidato ? [candidato] : [];
}

/**
 * ¿Se dibuja esta tarjeta? Sólo con gráfico de partida (sin él, la lámina saldría vacía) y con el estudio leído y
 * suficiente para ese gráfico. Mientras se lee el estudio, o si no se pudo leer, no: queda el glifo.
 */
export function puedePedir(op: OpcionLamina, inventario: EstadoInventario): boolean {
  if (!presetDe(op)?.grafico) return false;
  const usa = usaDeTarjeta(presetDe(op));
  if (!usa || inventario.estado !== "listo") return false;
  return cruzarConEstudio(usa, inventario.publicos).alcanza;
}

/** El tipo de pregunta de una variable con el criterio del inventario (ADR 0135: la escala primero); null si no cuenta. */
export function tipoDePregunta(v: FuenteSelector["variables"][number]): Exclude<PreguntaQueUsa, "cualquiera"> | null {
  if (v.graphable === false) return null;
  const t = v.tipo.trim().toLowerCase();
  if (t.startsWith("select_one")) return esPreguntaDeEscala(v) ? "escala" : "opcion_unica";
  if (t.startsWith("select_multiple")) return "multiple";
  if (/^(integer|decimal|range)\b/.test(t)) return "numerica";
  if (t.startsWith("text")) return "abierta";
  return null;
}

/**
 * La muestra con que se dibuja una tarjeta sin preguntas de partida: las primeras preguntas de los tipos que usa el
 * gráfico, de los públicos que la ficha cuenta con preguntas (de uno solo si el gráfico usa uno: la base activa si
 * entra). `base$variable`, como las refs del editor. Vacía si el estudio no tiene ninguna.
 */
export function muestraDePreguntas(
  usa: UsaGrafico, cruce: CruceConEstudio, fuentes: readonly FuenteSelector[], baseActiva: string | null, n = PREGUNTAS_MUESTRA,
): string[] {
  const conPreguntas = cruce.publicos.filter((p) => p.preguntas > 0).map((p) => p.base);
  const principal = baseActiva && conPreguntas.includes(baseActiva) ? baseActiva : conPreguntas[0];
  const bases = usa.publicos === "uno" ? (principal ? [principal] : []) : conPreguntas;
  if (!bases.length) return [];
  const porBase = Math.max(1, Math.ceil(n / bases.length));
  const tipos = usa.pregunta;
  const cuenta = (v: FuenteSelector["variables"][number]) => {
    const t = tipoDePregunta(v);
    return !!t && (tipos.includes("cualquiera") || tipos.includes(t));
  };
  return bases.flatMap((b) => (fuentes.find((f) => f.name === b)?.variables ?? [])
    .filter(cuenta).slice(0, porBase).map((v) => `${b}$${v.name}`)).slice(0, n);
}

const comoRef = (v: unknown): GraficadorRef | null =>
  v && typeof v === "object" && !Array.isArray(v) && typeof (v as GraficadorRef).graficador === "string" ? (v as GraficadorRef) : null;

const vacio = (v: unknown): boolean =>
  v === undefined || v === null || v === "" || (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v as object).length === 0);

/** ¿El gráfico no trae de dónde sacar sus preguntas (ni `vars`, ni regla, ni bases)? */
const sinPreguntas = (args: Readonly<Record<string, unknown>>): boolean => vacio(args.vars) && vacio(args.regla) && vacio(args.bases);

/** Contexto con que la tarjeta completa su muestra: el inventario leído y las preguntas de cada base. */
export type ContextoMuestra = { inventario: EstadoInventario; fuentes: readonly FuenteSelector[] };

/**
 * La lámina que la tarjeta insertaría, con un id estable y, si su gráfico no trae preguntas ni regla, con la muestra de
 * las preguntas del estudio (sólo en la miniatura: al insertarla, las preguntas las elige el analista).
 */
export function laminaDeOpcion(op: OpcionLamina, estudio: EstudioDelSelector, contexto?: ContextoMuestra): Slide {
  const tipo = tipoDeOpcion(op);
  const payload = conOpcion(op, payloadPorDefecto(tipo), estudio);
  const preset = presetDe(op);
  const slot = preset?.grafico ? ranuraDePreset(preset) : null;
  const g = slot ? comoRef(payload[slot]) : null;
  const usa = usaDeTarjeta(preset);
  if (slot && g && usa && contexto?.inventario.estado === "listo" && !SIN_MUESTRA.has(g.graficador) && sinPreguntas(g.args ?? {})) {
    const muestra = muestraDePreguntas(usa, cruzarConEstudio(usa, contexto.inventario.publicos), contexto.fuentes, estudio.baseActiva);
    if (muestra.length) payload[slot] = { ...g, args: { ...(g.args ?? {}), vars: muestra } };
  }
  return { id: idMiniaturaSelector(op), tipo, payload };
}

/**
 * Por qué una tarjeta que el estudio alcanza no pide su miniatura: le faltan preguntas o un dato obligatorio. `null` si
 * pide, o si no pide por otra razón (sin gráfico de partida, estudio sin leer o que no alcanza: eso lo dice la ficha).
 */
export function notaSinVista(slide: Slide): string | null {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  const g = Object.values(payload).map(comoRef).find((x): x is GraficadorRef => !!x);
  if (g && sinPreguntas(g.args ?? {})) return NOTA_SIN_PREGUNTAS;
  const falta = faltaEnLamina(slide);
  return falta ? notaDeFalta(falta) : null;
}

/** Las láminas a pedir, con su clave (lámina + estilo global + alcance, como la tira y el mazo). */
export function laminasDelSelector(
  opciones: readonly OpcionLamina[], inventario: EstadoInventario, estudio: EstudioDelSelector, global: string,
  fuentes: readonly FuenteSelector[] = [],
): LaminaDelSelector[] {
  return [...new Set(opciones)].filter((op) => puedePedir(op, inventario)).flatMap((op) => {
    const slide = laminaDeOpcion(op, estudio, { inventario, fuentes });
    if (notaSinVista(slide)) return [];
    return [{ id: slide.id, opcion: op, slide, clave: `${global}|${clavePreview(slide)}` }];
  });
}

/** Las tarjetas que el estudio alcanza y no piden: su línea «Sin vista previa: …». */
export function notasDelSelector(
  opciones: readonly OpcionLamina[], inventario: EstadoInventario, estudio: EstudioDelSelector, fuentes: readonly FuenteSelector[] = [],
): Partial<Record<OpcionLamina, string>> {
  const out: Partial<Record<OpcionLamina, string>> = {};
  for (const op of new Set(opciones)) {
    if (!puedePedir(op, inventario)) continue;
    const nota = notaSinVista(laminaDeOpcion(op, estudio, { inventario, fuentes }));
    if (nota) out[op] = nota;
  }
  return out;
}

export const ERROR_SIN_GRAFICO = "Sin vista previa: el gráfico salió sin datos.";
export const ERROR_SIN_IMAGEN = "Sin vista previa: no se pudo dibujar la imagen.";

/**
 * El hueco de una tarjeta: imagen de su clave vigente (o la anterior mientras se rehace) o, con error, la nota. Una
 * imagen sin gráfico (`sin_datos`, sin imagen, o todos sus gráficos vacíos) es un error: la lámina en blanco no es la
 * propuesta.
 */
export function miniaturaDeEntrada(e: EntradaMiniatura | undefined): MiniaturaSelector {
  if (!e) return { src: null, error: null };
  if (e.estado === "error") return { src: null, error: e.error ?? "No se pudo dibujar la vista previa." };
  if (e.estado === "sin_imagen") return { src: null, error: ERROR_SIN_IMAGEN };
  const todosVacios = !!e.vacios && e.vacios.pedidos > 0 && e.vacios.vacios >= e.vacios.pedidos;
  if (e.estado === "sin_datos" || todosVacios) {
    const motivo = e.vacios?.motivo?.trim() || e.error?.trim();
    return { src: null, error: motivo ? notaDeFalta(motivo.endsWith(".") ? motivo : `${motivo}.`) : ERROR_SIN_GRAFICO };
  }
  return { src: e.src ?? e.anterior ?? null, error: null };
}

/**
 * Qué pedir. Con un lote del selector corriendo, nada: la tarjeta a la que se pasó espera a que termine (un solo lote
 * en vuelo). Sin lote: las que no tienen entrada, las que cambiaron de clave y las pendientes huérfanas. null = nada.
 * Las que ya fallaron con su clave no se repiten solas.
 */
export function planSelector(laminas: readonly LaminaClave[], entradas: Readonly<Record<string, EntradaMiniatura>>, lotesCorriendo: number): LaminaClave[] | null {
  if (lotesCorriendo > 0) return null;
  const pedir = laminas.filter((l) => {
    const e = entradas[l.id];
    return !e || e.clave !== l.clave || e.estado === "pendiente";
  });
  return pedir.length ? pedir : null;
}
