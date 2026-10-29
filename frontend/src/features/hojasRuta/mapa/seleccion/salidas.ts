import type { HojasRutaWorkspaceOutputs, SelectedBlock } from "../../../../api/hojasRuta";
import { codigoDeUmp } from "../../seleccion/revisionMarco";

/**
 * Salidas de Selección en la página del lienzo (U10): qué falta para entregar,
 * qué titulares se ofrecen para reemplazos puntuales y cómo se rotula un archivo.
 */

export type PasoListo = { id: "territorio" | "poblacion" | "cuotas" | "manzanas"; label: string; ok: boolean; detalle: string };

export function pasosDeEntrega(distritos: number, salidas: HojasRutaWorkspaceOutputs | null | undefined): PasoListo[] {
  return [
    { id: "territorio", label: "Territorio", ok: distritos > 0, detalle: distritos ? `${distritos} distrito${distritos === 1 ? "" : "s"}` : "Sin distritos" },
    { id: "poblacion", label: "Población", ok: Boolean(salidas?.population?.ok), detalle: salidas?.population?.ok ? "Calculada" : "Pendiente" },
    { id: "cuotas", label: "Cuotas", ok: Boolean((salidas?.quota ?? salidas?.sample?.quota)?.ok), detalle: (salidas?.quota ?? salidas?.sample?.quota)?.ok ? "Listas" : "Pendientes" },
    { id: "manzanas", label: "Manzanas", ok: Boolean(salidas?.sample?.ok), detalle: salidas?.sample?.ok ? `${salidas.sample.n_blocks} titulares` : "Sin sorteo" },
  ];
}

export const listoParaEntregar = (pasos: readonly PasoListo[]) => pasos.every((p) => p.ok);

export type Candidata = { id: string; codigo: string; distrito: string; zona: string; elegida: boolean };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-PE");
/** Cada palabra de la búsqueda (ya normalizada) tiene que aparecer, en cualquier orden. */
const coincideTodo = (texto: string, q: string) => {
  const t = normalizar(texto);
  return q.split(/\s+/).every((p) => t.includes(p));
};

/** Titulares para reemplazos puntuales: las elegidas primero, luego las que coinciden, con tope. */
export function candidatasDeReemplazo(titulares: readonly SelectedBlock[], busqueda: string, elegidas: readonly string[], tope = 12): { filas: Candidata[]; coincidencias: number } {
  const q = normalizar(busqueda.trim());
  const set = new Set(elegidas);
  const fila = (b: SelectedBlock): Candidata => ({ id: b.id_manzana, codigo: codigoDeUmp(b), distrito: b.distrito, zona: b.zona, elegida: set.has(b.id_manzana) });
  const primero = titulares.filter((b) => set.has(b.id_manzana)).map(fila);
  if (!q) return { filas: primero, coincidencias: 0 };
  const resto = titulares.filter((b) => !set.has(b.id_manzana) && coincideTodo(`${codigoDeUmp(b)} ${b.distrito} ${b.zona} ${b.id_manzana}`, q));
  return { filas: [...primero, ...resto.slice(0, tope).map(fila)], coincidencias: resto.length };
}

export const alternarId = (lista: readonly string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

export function pesoLegible(bytes: number): string {
  if (!(bytes > 0)) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-PE", { maximumFractionDigits: 1 })} MB`;
}

/** Lo que trae el paquete antes de generarlo (brecha B22), contado sobre la muestra. */
export function conteosDelPaquete(titulares: readonly SelectedBlock[], reemplazos: readonly SelectedBlock[]): { titulares: number; distritos: number; reemplazos: number; zonas: number } {
  return {
    titulares: titulares.length,
    distritos: new Set(titulares.map((b) => b.ubigeo)).size,
    reemplazos: reemplazos.length,
    // El ZIP trae una hoja por zona con alguna ruta: titular o reemplazo.
    zonas: new Set([...titulares, ...reemplazos].map((b) => `${b.ubigeo}|${b.zona}`)).size,
  };
}

/**
 * Titulares que conviene revisar para un reemplazo puntual (B22): las que el marco
 * registra sin viviendas. Es una sugerencia; quien decide es el equipo de campo.
 */
export const sugeridasParaReemplazo = (titulares: readonly SelectedBlock[]) => titulares.filter((b) => Number(b.viviendas || 0) === 0).map((b) => b.id_manzana);
