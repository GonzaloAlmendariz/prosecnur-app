// Modelo del emparejamiento por el texto de la pregunta (ítem 4 del checklist de
// validación del practicante). La propuesta la arma el backend
// (api/R/carga_emparejar_por_texto.R); aquí solo se decide qué viene elegido,
// qué se muestra y qué se manda al aceptar.

import type {
  CandidataEmparejamiento,
  ColumnaEmparejamiento,
  EstadoEmparejamiento,
  ParejaAceptada,
  PropuestaEmparejamiento,
  ResumenEmparejamiento,
} from "../../../../api/cargaEmparejamiento";

/** Valor del selector para "esta columna se queda con su encabezado". */
export const SIN_PAREJA = "__sin_pareja__";

/** Pregunta elegida por columna (posición en la base → `name`, o vacío). */
export type EleccionEmparejamiento = Record<number, string>;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Rótulo del botón que abre la propuesta. Base: columnas de la base. */
export function rotuloOfertaEmparejamiento(resumen: ResumenEmparejamiento): string {
  const n = resumen.n_propuestas;
  return `Emparejar por el texto de la pregunta: ${n} de ${plural(resumen.n_columnas, "columna", "columnas")} ${n === 1 ? "coincide" : "coinciden"}`;
}

/** Vienen elegidas las coincidencias exactas y las que contienen el texto; las dudosas se eligen al revisar. */
export function eleccionInicial(propuesta: PropuestaEmparejamiento): EleccionEmparejamiento {
  const out: EleccionEmparejamiento = {};
  for (const c of propuesta.columnas) {
    out[c.columna] = c.estado === "exacta" || c.estado === "contenida" ? c.name : "";
  }
  return out;
}

export function elegir(eleccion: EleccionEmparejamiento, columna: number, valor: string): EleccionEmparejamiento {
  return { ...eleccion, [columna]: valor === SIN_PAREJA ? "" : valor };
}

/** Columnas que eligieron una pregunta que otra columna también eligió. */
export function columnasEnConflicto(eleccion: EleccionEmparejamiento): Set<number> {
  const porNombre = new Map<string, number[]>();
  for (const [col, name] of Object.entries(eleccion)) {
    if (!name) continue;
    porNombre.set(name, [...(porNombre.get(name) ?? []), Number(col)]);
  }
  const out = new Set<number>();
  for (const cols of porNombre.values()) if (cols.length > 1) cols.forEach((c) => out.add(c));
  return out;
}

export function parejasAceptadas(propuesta: PropuestaEmparejamiento, eleccion: EleccionEmparejamiento): ParejaAceptada[] {
  return propuesta.columnas
    .filter((c) => c.estado !== "nombre" && eleccion[c.columna])
    .map((c) => ({ columna: c.columna, encabezado: c.encabezado, name: eleccion[c.columna]! }));
}

/** Preguntas que se pueden elegir para una columna: las candidatas del motor y la propuesta. */
export function opcionesDeColumna(c: ColumnaEmparejamiento): CandidataEmparejamiento[] {
  const out = [...c.candidatos];
  if (c.name && !out.some((x) => x.name === c.name)) out.unshift({ name: c.name, pregunta: c.pregunta });
  return out;
}

export const ROTULO_ESTADO: Record<EstadoEmparejamiento, string> = {
  exacta: "Mismo texto",
  contenida: "Contiene el texto",
  dudosa: "Para revisar",
  ambigua: "Ambigua",
  sin_pareja: "Sin pareja",
  nombre: "Ya trae el nombre",
};

export type GrupoEmparejamiento = { clave: string; titulo: string; columnas: ColumnaEmparejamiento[] };

const GRUPOS: { clave: string; titulo: string; estados: EstadoEmparejamiento[] }[] = [
  { clave: "revisar", titulo: "Para revisar", estados: ["dudosa", "ambigua"] },
  { clave: "coinciden", titulo: "Coinciden con el texto de una pregunta", estados: ["exacta", "contenida"] },
  { clave: "sin-pareja", titulo: "Sin pareja", estados: ["sin_pareja"] },
  { clave: "nombre", titulo: "Ya traen el nombre del formulario", estados: ["nombre"] },
];

/** Columnas agrupadas para la tabla: primero lo que pide decisión. Los grupos vacíos no se muestran. */
export function gruposDeColumnas(propuesta: PropuestaEmparejamiento): GrupoEmparejamiento[] {
  return GRUPOS.map((g) => ({
    clave: g.clave,
    titulo: `${g.titulo} (${propuesta.columnas.filter((c) => g.estados.includes(c.estado)).length})`,
    columnas: propuesta.columnas.filter((c) => g.estados.includes(c.estado)),
  })).filter((g) => g.columnas.length > 0);
}

/** Pie del diálogo: cuántas columnas se renombrarán al cargar. */
export function conteoEleccion(parejas: ParejaAceptada[], conflictos: Set<number>): string {
  if (conflictos.size) {
    return `${plural(conflictos.size, "columna eligió", "columnas eligieron")} una pregunta repetida; deja una sola columna por pregunta`;
  }
  if (!parejas.length) return "Ninguna columna se renombrará";
  return `${plural(parejas.length, "columna se renombrará", "columnas se renombrarán")} con el nombre de su pregunta`;
}
