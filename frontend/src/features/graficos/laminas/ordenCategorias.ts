// Orden de categorías por gráfico (D8; contrato docs/qa/contrato-orden-categorias-f6-2026-10-10.md). Modelo puro de
// la fila «Orden» de la tarjeta del inspector: qué graficadores la llevan, cómo se lee y escribe
// `args.orden_categorias` y qué lista muestra el modo personalizado.

import type { AvisoCategorias, GraficosCategorias } from "../../../api/graficos";

export type ModoOrden = "recetario" | "frecuencia" | "instrumento" | "personalizado";
export type OrdenCategorias = { modo: ModoOrden; lista: string[]; invertir: boolean };

export const MODOS_ORDEN: readonly ModoOrden[] = ["recetario", "frecuencia", "instrumento", "personalizado"];

/** Graficadores a los que aplica (contrato §1). En escalas no se muestra: el orden es el de la escala. */
const CON_ORDEN = new Set(["p_barras_categoricas", "p_dicotomica", "p_barras_agrupadas", "p_pie", "p_donut"]);

export function aplicaOrden(graficador: string): boolean {
  return CON_ORDEN.has(graficador);
}

export const ORDEN_POR_DEFECTO: OrdenCategorias = { modo: "recetario", lista: [], invertir: false };

/** Ausente, `null`, `{}` o un modo desconocido equivalen a recetario (contrato §1). */
export function leerOrden(args: Readonly<Record<string, unknown>>): OrdenCategorias {
  const raw = args.orden_categorias;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ORDEN_POR_DEFECTO;
  const r = raw as Record<string, unknown>;
  const modo = MODOS_ORDEN.includes(r.modo as ModoOrden) ? (r.modo as ModoOrden) : "recetario";
  const lista = Array.isArray(r.lista) ? r.lista.filter((x) => typeof x === "string" || typeof x === "number").map(String) : [];
  return { modo, lista, invertir: r.invertir === true };
}

/** Lo que se escribe en `args.orden_categorias`; `null` (borra la clave) cuando es el de fábrica. */
export function ordenAGuardar(o: OrdenCategorias): OrdenCategorias | null {
  if (o.modo === "recetario" && !o.invertir) return null;
  return { modo: o.modo, lista: o.modo === "personalizado" ? [...o.lista] : [], invertir: o.invertir };
}

const LEGADO = ["orden_barras", "ordenar_categorias", "orden_categorias_manual"] as const;

/** ¿El gráfico trae un orden elegido con los controles anteriores? Con «Recetario» manda ese (contrato §3, paso 2). */
export function tieneOrdenHeredado(args: Readonly<Record<string, unknown>>): boolean {
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  return LEGADO.some((k) => {
    const v = ov[k] ?? args[k];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "";
  });
}

const NOMBRE_MODO: Record<Exclude<ModoOrden, "recetario">, string> = {
  frecuencia: "por frecuencia",
  instrumento: "como el instrumento",
  personalizado: "personalizado",
};

/** Rótulo de la opción «Recetario», que dice qué aplica: «Recetario · por frecuencia». */
export function rotuloRecetario(datos: GraficosCategorias | null, heredado: boolean): string {
  if (heredado) return "Por defecto, orden elegido antes";
  const m = datos?.modo_recetario;
  return m ? `Por defecto, ${NOMBRE_MODO[m]}` : "Por defecto";
}

/**
 * La lista del modo personalizado tal como se dibujará: los códigos listados que existen, luego los no listados en
 * orden del instrumento y, al final, los residuales no listados (contrato §4). Sin lista guardada parte del orden que
 * el recetario dibuja hoy.
 */
export function listaPersonalizada(lista: readonly string[], datos: GraficosCategorias): string[] {
  const codigos = datos.categorias.map((c) => c.codigo);
  const existe = new Set(codigos);
  const base = lista.length ? lista.filter((k) => existe.has(k)) : [...(datos.orden.recetario.length ? datos.orden.recetario : codigos)];
  const listados = new Set(base);
  const residual = new Map(datos.categorias.map((c) => [c.codigo, c.residual]));
  const resto = codigos.filter((k) => !listados.has(k));
  return [...base, ...resto.filter((k) => !residual.get(k)), ...resto.filter((k) => residual.get(k))];
}

/**
 * WYSIWYG (F-a): la lista personalizada se MUESTRA en el orden en que se dibuja. Con `invertir`, el motor invierte la
 * parte listada y deja detrás las no listadas (contrato §4), así que eso es lo que se ve. Sin ningún código listado que
 * exista (lista guardada vacía o sólo con códigos que ya no están), el motor no tiene parte listada: dibuja todo en orden
 * del instrumento con los residuales al final, invierta o no (`.goc_orden_codigos`, api/R/graficos_orden_categorias.R).
 */
export function ordenMostrado(lista: readonly string[], datos: GraficosCategorias, invertir: boolean): string[] {
  const existe = new Set(datos.categorias.map((c) => c.codigo));
  const listados = lista.filter((k) => existe.has(k)).length;
  if (listados === 0) {
    return [...datos.categorias.filter((c) => !c.residual), ...datos.categorias.filter((c) => c.residual)].map((c) => c.codigo);
  }
  const completa = listaPersonalizada(lista, datos);
  if (!invertir) return completa;
  return [...completa.slice(0, listados).reverse(), ...completa.slice(listados)];
}

/**
 * Avisos de la pregunta (decisión 4; contrato §7). Se decide SÓLO por `codigo`; `texto` se muestra tal cual llega (ya
 * pasó el detector de jerga), salvo el prefijo «“<pregunta>”: », que dentro de la tarjeta de esa misma pregunta se
 * repite y se quita únicamente si coincide exacto.
 */
export const AVISO_BASE_POR_DEFECTO = "base_por_defecto";
export const AVISO_ESCALA_ORDEN_IGNORADO = "escala_orden_ignorado";

export type NotaOrden = { codigo: string; texto: string; destacada: boolean };
export type AvisosOrden = {
  /** Notas sobre la lista, en el orden en que llegan; sin la de escala, que va junto a los controles. */
  notas: NotaOrden[];
  /** El orden no aplica a este gráfico: el modo e «Invertir» quedan deshabilitados con esta nota a la vista. */
  escala: NotaOrden | null;
};

/** Quita «“<pregunta>”: » del inicio sólo si coincide exacto; el resto empieza en mayúscula. */
export function sinPrefijoPregunta(texto: string, pregunta: string): string {
  const p = pregunta.trim();
  if (!p) return texto;
  const prefijo = `“${p}”: `;
  if (!texto.startsWith(prefijo) || texto.length === prefijo.length) return texto;
  const resto = texto.slice(prefijo.length);
  return resto.charAt(0).toLocaleUpperCase("es") + resto.slice(1);
}

export function leerAvisosOrden(datos: Pick<GraficosCategorias, "avisos" | "pregunta"> | null): AvisosOrden {
  const notas: NotaOrden[] = [];
  let escala: NotaOrden | null = null;
  const avisos: readonly AvisoCategorias[] = datos?.avisos ?? [];
  for (const a of avisos) {
    const nota: NotaOrden = { codigo: a.codigo, texto: sinPrefijoPregunta(a.texto, datos?.pregunta ?? ""), destacada: a.codigo === AVISO_BASE_POR_DEFECTO };
    if (a.codigo === AVISO_ESCALA_ORDEN_IGNORADO) escala ??= nota;
    else notas.push(nota);
  }
  return { notas, escala };
}

/** Lo que la lista dice de una categoría sin respuestas. */
export const NO_SE_DIBUJA = "no se dibuja: 0 respuestas";

/**
 * Códigos sin respuestas, para marcar cada fila (misma regla `n === 0` que el aviso `categorias_sin_respuestas` del
 * backend, que es el que da el mensaje general): el gráfico no los dibuja, aunque la lista los ordene.
 */
export function categoriasSinRespuestas(datos: GraficosCategorias): Set<string> {
  return new Set(datos.categorias.filter((c) => c.n === 0).map((c) => c.codigo));
}

/** Atributo que nombra el botón Subir/Bajar de cada fila; el markup lo pone y el foco lo busca con el mismo nombre. */
export const ATRIBUTO_ACCION_ORDEN = "data-orden-accion";

export const selectorAccionOrden = (accion: "subir" | "bajar"): string => `button[${ATRIBUTO_ACCION_ORDEN}="${accion}"]`;

type Enfocable = { focus: (opciones?: FocusOptions) => void };
type FilaEnfocable = Enfocable & { querySelector: (selector: string) => Enfocable | null };

/**
 * Tras Subir/Bajar el foco queda en el botón que corresponde de la fila movida (`botonTrasMover`); si no hay botón
 * habilitado, en la fila. Devuelve lo que enfocó.
 */
export function enfocarTrasMover(fila: FilaEnfocable, accion: "subir" | "bajar", posicion: number, total: number): Enfocable {
  const destino = botonTrasMover(accion, posicion, total);
  const boton = destino ? fila.querySelector(selectorAccionOrden(destino)) : null;
  const objetivo = boton ?? fila;
  objetivo.focus();
  return objetivo;
}

/**
 * De la lista mostrada (ya reordenada por el analista) a la `lista` que se guarda: tras mover, todas quedan listadas, y
 * con `invertir` el motor la leerá al revés, así que se guarda invertida para que se dibuje tal como se ve.
 */
export function listaDesdeMostrado(mostrado: readonly string[], invertir: boolean): string[] {
  return invertir ? [...mostrado].reverse() : [...mostrado];
}

/**
 * Botón de la fila movida que recibe el foco tras Subir/Bajar: el mismo, salvo que la fila quedara en el borde y ese botón
 * esté disabled —un disabled tira el foco a BODY—; entonces el opuesto. Con una sola categoría ninguno sirve: `null`.
 */
export function botonTrasMover(accion: "subir" | "bajar", posicion: number, total: number): "subir" | "bajar" | null {
  const habilitado = (a: "subir" | "bajar") => (a === "subir" ? posicion > 0 : posicion < total - 1);
  if (habilitado(accion)) return accion;
  const opuesto = accion === "subir" ? "bajar" : "subir";
  return habilitado(opuesto) ? opuesto : null;
}

/** Mueve el elemento `desde` a la posición `hasta` (índices de la lista mostrada). */
export function mover(lista: readonly string[], desde: number, hasta: number): string[] {
  if (desde === hasta || desde < 0 || desde >= lista.length) return [...lista];
  const out = [...lista];
  const [x] = out.splice(desde, 1);
  out.splice(Math.max(0, Math.min(hasta, out.length)), 0, x);
  return out;
}

/**
 * La pregunta siempre calificada con su base (`base$var`): sin calificar, el backend resolvería la primera base. En un
 * plan multibase el gráfico ya la declara; si no, es la base activa. En el informe compartido (`consolidated`) NO: la
 * base activa no es la de ese informe y el preflight bloquea la ref sin base (`unqualified_multisource_reference`), así
 * que queda sin calificar y la tarjeta pide elegirla (datosBase/baseEnCompartido.ts).
 */
export function varCalificada(variable: string, baseActiva: string | null | undefined, scope: "active" | "consolidated" = "active"): string {
  const v = variable.trim();
  const b = (baseActiva ?? "").trim();
  if (!v || v.includes("$") || !b || scope === "consolidated") return v;
  return `${b}$${v}`;
}
