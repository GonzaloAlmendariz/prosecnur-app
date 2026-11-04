// Territorial › Entrega, vista faro de la pasada de diseño (2 nov 2026): el reparto
// de la muestra entre el equipo, leído de un vistazo. Puro, para probarlo sin red.
//
// Gonzalo: «se ven con fondos grandes, ausencia de contenedores, ausencia de
// elementos UI sofisticados». La entrega era un formulario suelto; aquí se arma lo
// que la pantalla tiene que mostrar: cuántas UMP hay, cuántas tienen encuestador,
// cómo se reparten por distrito y cuánto carga cada persona del equipo.
//
// Identidad con color determinista (patrón del Sistema Pabellón, copiado y no
// importado: el módulo canónico es de Monitoreo): el mismo encuestador lleva el
// mismo tono en su avatar y en cada UMP que tiene asignada.

import type { AsignacionTerritorial, UnidadesTerritoriales } from "../../../api/materialTerritorial";

export const TONOS_DE_EQUIPO = 8;

export type PersonaDelEquipo = {
  codigo: string;
  nombre: string;
  iniciales: string;
  tono: number;
  asignadas: number;
};

export type UmpDelTablero = {
  unitId: string;
  label: string;
  /** Tono del encuestador asignado; `null` si la UMP no tiene encuestador. */
  tono: number | null;
  encuestador: string | null;
};

export type DistritoDelTablero = {
  distrito: string;
  total: number;
  asignadas: number;
  umps: UmpDelTablero[];
};

export type TableroDeEntrega = {
  total: number;
  asignadas: number;
  distritos: DistritoDelTablero[];
  equipo: PersonaDelEquipo[];
};

/** Tono estable por código: el mismo encuestador, el mismo color en toda la vista. */
export function tonoDeCodigo(codigo: string): number {
  let h = 5381;
  for (let i = 0; i < codigo.length; i += 1) h = ((h << 5) + h + codigo.charCodeAt(i)) >>> 0;
  return h % TONOS_DE_EQUIPO;
}

export function inicialesDe(nombre: string, codigo: string): string {
  const palabras = nombre.trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (palabras.length >= 2) return (palabras[0][0] + palabras[palabras.length - 1][0]).toLocaleUpperCase("es-PE");
  if (palabras.length === 1) return palabras[0].slice(0, 2).toLocaleUpperCase("es-PE");
  return codigo.slice(-2).toLocaleUpperCase("es-PE");
}

const porNumero = new Intl.Collator("es-PE", { numeric: true, sensitivity: "base" });

export function armarTablero(
  unidades: UnidadesTerritoriales | null,
  asignacion: AsignacionTerritorial | null,
): TableroDeEntrega {
  const titulares = (unidades?.units ?? []).filter((u) => u.role === "titular");
  const nombres = new Map((asignacion?.equipo ?? []).map((e) => [e.codigo, e.nombre]));
  const codigoDe = new Map(
    (asignacion?.asignacion ?? []).filter((a) => a.codigo && a.role === "titular").map((a) => [a.id_manzana, a.codigo]),
  );

  const cuenta = new Map<string, number>();
  const porDistrito = new Map<string, UmpDelTablero[]>();
  for (const u of titulares) {
    const codigo = codigoDe.get(u.unit_id) ?? null;
    if (codigo) cuenta.set(codigo, (cuenta.get(codigo) ?? 0) + 1);
    const ump: UmpDelTablero = {
      unitId: u.unit_id,
      label: u.label,
      tono: codigo ? tonoDeCodigo(codigo) : null,
      encuestador: codigo ? (nombres.get(codigo) || codigo) : null,
    };
    const clave = u.distrito || "Sin distrito";
    porDistrito.set(clave, [...(porDistrito.get(clave) ?? []), ump]);
  }

  const distritos = [...porDistrito.entries()]
    .map(([distrito, umps]) => ({
      distrito,
      total: umps.length,
      asignadas: umps.filter((u) => u.encuestador).length,
      umps: [...umps].sort((a, b) => porNumero.compare(a.label, b.label)),
    }))
    .sort((a, b) => porNumero.compare(a.distrito, b.distrito));

  // Todo el equipo, sin techo: también quien todavía no tiene UMP.
  const equipo = (asignacion?.equipo ?? [])
    .map((e) => ({
      codigo: e.codigo,
      nombre: e.nombre || e.codigo,
      iniciales: inicialesDe(e.nombre, e.codigo),
      tono: tonoDeCodigo(e.codigo),
      asignadas: cuenta.get(e.codigo) ?? 0,
    }))
    .sort((a, b) => b.asignadas - a.asignadas || porNumero.compare(a.nombre, b.nombre));

  const asignadas = distritos.reduce((n, d) => n + d.asignadas, 0);
  return { total: titulares.length, asignadas, distritos, equipo };
}
