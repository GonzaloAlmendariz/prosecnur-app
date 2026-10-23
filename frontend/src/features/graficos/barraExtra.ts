// Barra extra: la columna que se dibuja a la derecha de cada barra o fila. Una sola decisión con tres opciones
// (Top Two Box, Bottom Two Box, Conteos) en lugar de interruptores sueltos que se pisaban entre sí.
//
// Contrato con el motor (R): la clave `barra_extra` vale `false` o un arreglo de `"top2box" | "bottom2box" | "conteos"`
// y el orden es el de las columnas. Se declara por bloque (`bloques[j].barra_extra`), por tarjeta/lámina
// (`overrides.barra_extra` o `args.barra_extra`) o en el preset base; manda el más cercano: bloque > lámina > preset.
// Con `barra_extra` presente el motor ignora las claves viejas, y el frontend ya no las escribe.
//
// Reglas de la fase actual: «Conteos» va solo; Top y Bottom Two Box se combinan (máximo dos boxes, que son los dos
// únicos). Las categorías de cada box viajan en `top2box_labels` y `bottom2box_labels`. Módulo puro, sin React.

export type OpcionBarraExtra = "top2box" | "bottom2box" | "conteos";
export type BarraExtra = false | readonly OpcionBarraExtra[];
export type OrigenBarraExtra = "bloque" | "lamina" | "preset" | "ninguno";

/** Orden de las columnas. */
export const OPCIONES_BARRA_EXTRA: readonly OpcionBarraExtra[] = ["top2box", "bottom2box", "conteos"];
export const ROTULO_OPCION: Readonly<Record<OpcionBarraExtra, string>> = {
  top2box: "Top Two Box",
  bottom2box: "Bottom Two Box",
  conteos: "Conteos",
};
export const AYUDA_OPCION: Readonly<Record<OpcionBarraExtra, string>> = {
  top2box: "Suma de las dos categorías más altas de la escala.",
  bottom2box: "Suma de las dos categorías más bajas de la escala.",
  conteos: "El n de casos de cada barra o fila.",
};
export const NOTA_CONTEOS_SOLO = "Conteos va solo: quita el Top o el Bottom Two Box para usarlo, o quita Conteos para usar los boxes.";

type Registro = Readonly<Record<string, unknown>>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});
const esBox = (o: OpcionBarraExtra) => o === "top2box" || o === "bottom2box";

/** Lee un valor guardado. `undefined`: no declara nada (hereda). Un arreglo sin opciones válidas equivale a `false`. */
export function normalizarBarraExtra(v: unknown): BarraExtra | undefined {
  if (v === false) return false;
  if (!Array.isArray(v)) return undefined;
  const pedidas = OPCIONES_BARRA_EXTRA.filter((o) => v.includes(o));
  const boxes = pedidas.filter(esBox);
  const validas = boxes.length > 0 ? boxes : pedidas;
  return validas.length > 0 ? validas : false;
}

export function mismaBarraExtra(a: BarraExtra, b: BarraExtra): boolean {
  if (a === false || b === false) return a === b;
  return a.length === b.length && a.every((o, i) => o === b[i]);
}

export function opcionesActivas(v: BarraExtra): readonly OpcionBarraExtra[] {
  return v === false ? [] : v;
}

export type EstadoOpcion = { activa: boolean; deshabilitada: boolean; motivo?: string };

/** Si una opción está elegida y, cuando no, si la combinación con lo elegido no se permite (y por qué). */
export function estadoOpcion(actual: BarraExtra, opcion: OpcionBarraExtra): EstadoOpcion {
  const activas = opcionesActivas(actual);
  if (activas.includes(opcion)) return { activa: true, deshabilitada: false };
  const conflicto = opcion === "conteos" ? activas.some(esBox) : activas.includes("conteos");
  return conflicto ? { activa: false, deshabilitada: true, motivo: NOTA_CONTEOS_SOLO } : { activa: false, deshabilitada: false };
}

/** Elige o quita una opción. Una combinación no permitida no cambia nada; quitar la última apaga la barra. */
export function alternarOpcion(actual: BarraExtra, opcion: OpcionBarraExtra): BarraExtra {
  const estado = estadoOpcion(actual, opcion);
  if (estado.deshabilitada) return actual;
  const activas = opcionesActivas(actual);
  const siguientes = estado.activa ? activas.filter((o) => o !== opcion) : [...activas, opcion];
  return normalizarBarraExtra(siguientes) ?? false;
}

/** Lo que se ofrece al encender: Top Two Box si la pregunta tiene escala con categorías, y Conteos si no. */
export function encenderBarraExtra(hayEscala: boolean): BarraExtra {
  return hayEscala ? ["top2box"] : ["conteos"];
}

export function resumenBarraExtra(v: BarraExtra): string {
  return v === false ? "Sin barra extra" : v.map((o) => ROTULO_OPCION[o]).join(" + ");
}

/** `barra_extra` de una tarjeta: sus `overrides` mandan sobre `args.barra_extra`. */
export function barraExtraDeTarjeta(args: Registro): BarraExtra | undefined {
  return normalizarBarraExtra(registro(args.overrides).barra_extra) ?? normalizarBarraExtra(args.barra_extra);
}

export function barraExtraDeBloque(bloque: unknown): BarraExtra | undefined {
  return normalizarBarraExtra(registro(bloque).barra_extra);
}

/**
 * `barra_extra` de un preset (estilo del informe). Un estilo guardado antes de esta clave sólo trae las viejas
 * (`mostrar_barra_extra`, `barra_extra_preset`, `columna_bottom2box`): se LEEN para mostrar lo que el motor va a heredar,
 * nunca se escriben.
 */
export function barraExtraDePreset(preset: Registro): BarraExtra | undefined {
  const propia = normalizarBarraExtra(preset.barra_extra);
  if (propia !== undefined) return propia;
  const mostrar = preset.mostrar_barra_extra;
  if (typeof mostrar !== "boolean") return undefined;
  if (!mostrar) return false;
  const tipo = typeof preset.barra_extra_preset === "string" ? preset.barra_extra_preset : "top2box";
  if (tipo === "ninguno") return false;
  if (tipo === "n" || tipo === "conteos") return ["conteos"];
  return preset.columna_bottom2box === true ? ["top2box", "bottom2box"] : ["top2box"];
}

export type BarraExtraResuelta = { valor: BarraExtra; origen: OrigenBarraExtra };

/** Lo que dibuja el motor y de dónde viene: bloque > lámina > preset. */
export function resolverBarraExtra(
  fuentes: { bloque?: BarraExtra; lamina?: BarraExtra; preset?: BarraExtra },
  porDefecto: BarraExtra = false,
): BarraExtraResuelta {
  if (fuentes.bloque !== undefined) return { valor: fuentes.bloque, origen: "bloque" };
  if (fuentes.lamina !== undefined) return { valor: fuentes.lamina, origen: "lamina" };
  if (fuentes.preset !== undefined) return { valor: fuentes.preset, origen: "preset" };
  return { valor: porDefecto, origen: "ninguno" };
}

const etiquetasDe = (v: unknown): number => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).length : 0);

export type ResumenBloques = {
  total: number;
  /** Bloques que dibujan alguna barra extra (propia o heredada de la lámina). */
  conBarra: number;
  /** Bloques que declaran su propia `barra_extra` (aunque sea apagada). */
  propios: number;
  /** Bloques con Top Two Box encendido y sin categorías: el motor omite esa columna. */
  sinCategorias: number;
  /** Ídem para el Bottom Two Box. */
  conBottomSinCategorias: number;
};

export function resumenDeBloques(bloques: unknown, lamina: BarraExtra | undefined): ResumenBloques {
  const lista = Array.isArray(bloques) ? bloques : [];
  const out: ResumenBloques = { total: lista.length, conBarra: 0, propios: 0, sinCategorias: 0, conBottomSinCategorias: 0 };
  for (const b of lista) {
    const propia = barraExtraDeBloque(b);
    if (propia !== undefined) out.propios += 1;
    const { valor } = resolverBarraExtra({ bloque: propia, lamina });
    const activas = opcionesActivas(valor);
    if (activas.length === 0) continue;
    out.conBarra += 1;
    const r = registro(b);
    if (activas.includes("top2box") && etiquetasDe(r.top2box_labels) === 0) out.sinCategorias += 1;
    if (activas.includes("bottom2box") && etiquetasDe(r.bottom2box_labels) === 0) out.conBottomSinCategorias += 1;
  }
  return out;
}
