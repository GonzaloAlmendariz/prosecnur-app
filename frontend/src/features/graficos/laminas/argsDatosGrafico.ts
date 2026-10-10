// Qué datos de un gráfico se editan en la tarjeta del inspector (F6.1, parte 2; dirección F6 §4.1 y §7).
//
// Lista BLANCA contra la Parte B del inventario: sólo argumentos que la salida nativa lee (qué pregunta, cómo se
// divide, qué entra y en qué orden, significancia). Todo lo de estilo ggplot queda fuera aunque el registro lo
// declare. Cada entrada trae un rótulo corto y, si hace falta, una ayuda de una línea; el texto largo del registro no
// se muestra (va en el título del «?»).

import type { ArgMetadata } from "../../../api/graficos";

export type ControlDato = "variable" | "variable_opcional" | "interruptor" | "numero" | "opciones" | "texto" | "codigos";

type Entrada = { rotulo: string; ayuda?: string; control?: ControlDato; /** Sólo con este arg activo. */ siActivo?: string };

/** Orden de aparición = orden de las claves. */
const LISTA_BLANCA: Record<string, Entrada> = {
  var: { rotulo: "Pregunta" },
  modo: { rotulo: "Modo" },
  cruces: { rotulo: "Dividir por", ayuda: "Vacío: una sola serie." },
  cruce: { rotulo: "Dividir por", ayuda: "Vacío: una sola serie." },
  corte: { rotulo: "Corte" },
  corte_etiqueta: { rotulo: "Rótulo del corte" },
  objetivo: { rotulo: "Objetivo" },
  metrica: { rotulo: "Métrica" },
  categoria: { rotulo: "Categoría" },
  direccion_escala: { rotulo: "Dirección de la escala" },
  n_negativas: { rotulo: "Categorías negativas" },
  incluir_neutro: { rotulo: "Incluir el punto medio" },
  orden_barras: { rotulo: "Orden" },
  max_categorias: { rotulo: "Máximo de categorías" },
  top_k: { rotulo: "Máximo de categorías" },
  agrupar_resto_en_otros: { rotulo: "Agrupar el resto en «Otros»", siActivo: undefined },
  excluir_opciones: { rotulo: "Excluir respuestas", ayuda: "Códigos separados por comas (p. ej. 88, 99)." },
  excluir_grupos: { rotulo: "Excluir grupos", ayuda: "Códigos separados por comas." },
  mostrar_significancia: { rotulo: "Marcar diferencias significativas" },
  significancia_alpha: { rotulo: "Nivel de significancia", siActivo: "mostrar_significancia" },
  valores_decimales: { rotulo: "Decimales" },
};

/** Tipos de control que la tarjeta sabe dibujar en una línea. */
const CONTROL_POR_TIPO: Partial<Record<ArgMetadata["tipo_input"], ControlDato>> = {
  variable: "variable",
  variable_opt: "variable_opcional",
  bool: "interruptor",
  number: "numero",
  choice: "opciones",
  string: "texto",
  codigos_list: "codigos",
};

export type CampoDato = {
  arg: ArgMetadata;
  rotulo: string;
  ayuda: string | null;
  /** Descripción larga del registro, para el título del «?». */
  detalle: string;
  control: ControlDato;
};

/** Los campos de datos de un graficador, en el orden de la lista blanca; respeta `siActivo` con los valores actuales. */
export function camposDeDatos(args: readonly ArgMetadata[], valores: Readonly<Record<string, unknown>>): CampoDato[] {
  const porNombre = new Map(args.map((a) => [a.name, a]));
  const salida: CampoDato[] = [];
  for (const [name, e] of Object.entries(LISTA_BLANCA)) {
    const arg = porNombre.get(name);
    if (!arg) continue;
    const control = e.control ?? CONTROL_POR_TIPO[arg.tipo_input];
    if (!control) continue;
    if (e.siActivo && valores[e.siActivo] !== true) continue;
    salida.push({ arg, rotulo: e.rotulo, ayuda: e.ayuda ?? null, detalle: arg.descripcion ?? "", control });
  }
  return salida;
}

/** «88, 99» ⇄ ["88","99"]. */
export function codigosATexto(v: unknown): string {
  return Array.isArray(v) ? v.map(String).join(", ") : typeof v === "string" ? v : "";
}
export function textoACodigos(t: string): string[] {
  return t.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
}

/** La etiqueta corta de una variable vive en `overrides.etiquetas_vars[variable]` (K12a, 07d43c5f7). */
export function leerEtiquetaCorta(args: Readonly<Record<string, unknown>>, variable: string): string {
  const o = args.overrides;
  const m = o && typeof o === "object" ? (o as Record<string, unknown>).etiquetas_vars : null;
  const v = m && typeof m === "object" ? (m as Record<string, unknown>)[variable] : null;
  return typeof v === "string" ? v : "";
}

export function conEtiquetaCorta(args: Readonly<Record<string, unknown>>, variable: string, etiqueta: string): Record<string, unknown> {
  const overrides = { ...((args.overrides && typeof args.overrides === "object" ? args.overrides : {}) as Record<string, unknown>) };
  const mapa = { ...((overrides.etiquetas_vars && typeof overrides.etiquetas_vars === "object" ? overrides.etiquetas_vars : {}) as Record<string, unknown>) };
  if (etiqueta.trim()) mapa[variable] = etiqueta.trim();
  else delete mapa[variable];
  if (Object.keys(mapa).length) overrides.etiquetas_vars = mapa;
  else delete overrides.etiquetas_vars;
  return overrides;
}
