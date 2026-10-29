// modeloUnidades.ts — la lista de UMP de la campaña territorial sin React
// (ADR 0118 §1): titulares con sus reemplazos debajo, agrupadas por distrito,
// filtradas por una búsqueda sin acentos.

import type { UnidadTerritorial } from "../../../api/materialTerritorial";

export type TitularConReemplazos = {
  titular: UnidadTerritorial;
  reemplazos: UnidadTerritorial[];
};

export type GrupoDeDistrito = {
  /** `ubigeo` o, sin él, el nombre del distrito: la clave del grupo. */
  clave: string;
  distrito: string;
  ubigeo: string;
  titulares: TitularConReemplazos[];
  /** Reemplazos cuya titular no está en la foto: se listan aparte, no se pierden. */
  sueltos: UnidadTerritorial[];
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function textoDe(u: UnidadTerritorial): string {
  return normalizar([u.label, u.unit_id, u.distrito, u.zona ? `zona ${u.zona}` : "", u.manzana ? `manzana ${u.manzana}` : ""].join(" "));
}

/** ¿Cada palabra de la búsqueda aparece en la unidad (en cualquier orden)? */
export function coincide(u: UnidadTerritorial, busqueda: string): boolean {
  const q = normalizar(busqueda.trim());
  if (!q) return true;
  const t = textoDe(u);
  return q.split(/\s+/).every((p) => t.includes(p));
}

/**
 * Agrupa por distrito, en el orden en que llegan. Una titular entra si ella o
 * alguno de sus reemplazos coincide con la búsqueda; si entra por su
 * reemplazo, sólo se muestran los reemplazos que coinciden.
 */
export function agruparUnidades(units: readonly UnidadTerritorial[], busqueda = ""): GrupoDeDistrito[] {
  const titularesPorId = new Map<string, TitularConReemplazos>();
  const grupos = new Map<string, GrupoDeDistrito>();
  const grupoDe = (u: UnidadTerritorial) => {
    const clave = u.ubigeo || u.distrito || "—";
    let g = grupos.get(clave);
    if (!g) {
      g = { clave, distrito: u.distrito, ubigeo: u.ubigeo, titulares: [], sueltos: [] };
      grupos.set(clave, g);
    }
    return g;
  };
  for (const u of units) {
    if (u.role !== "titular") continue;
    const fila = { titular: u, reemplazos: [] };
    titularesPorId.set(u.unit_id, fila);
    grupoDe(u).titulares.push(fila);
  }
  for (const u of units) {
    if (u.role !== "reemplazo") continue;
    const duena = u.titular_id ? titularesPorId.get(u.titular_id) : undefined;
    if (duena) duena.reemplazos.push(u);
    else grupoDe(u).sueltos.push(u);
  }
  const q = busqueda.trim();
  const salida: GrupoDeDistrito[] = [];
  for (const g of grupos.values()) {
    const titulares = g.titulares.flatMap((f) => {
      if (!q || coincide(f.titular, q)) return [f];
      const reemplazos = f.reemplazos.filter((r) => coincide(r, q));
      return reemplazos.length ? [{ titular: f.titular, reemplazos }] : [];
    });
    const sueltos = g.sueltos.filter((r) => coincide(r, q));
    if (titulares.length || sueltos.length) salida.push({ ...g, titulares, sueltos });
  }
  return salida;
}

/** La unidad de un `foco` (`id_manzana`), o `null`. */
export function unidadDelFoco(units: readonly UnidadTerritorial[], foco: string | null | undefined): UnidadTerritorial | null {
  if (!foco) return null;
  return units.find((u) => u.unit_id === foco) ?? null;
}

/** «29/10/2026»: día, mes y año con dos y cuatro cifras, sin depender del ICU del entorno. */
export function fechaDelEnvio(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * «encuestas 1–12 · 120 viv.». El rango son los números de ENCUESTA de la ruta
 * (rango_inicio/rango_fin), no viviendas; las viviendas son las de la manzana en el censo.
 */
export function rangoDeLaUmp(u: Pick<UnidadTerritorial, "rango_inicio" | "rango_fin" | "viviendas">): string {
  const partes: string[] = [];
  if (u.rango_inicio !== null && u.rango_fin !== null) partes.push(`encuestas ${u.rango_inicio}–${u.rango_fin}`);
  if (u.viviendas !== null) partes.push(`${u.viviendas.toLocaleString("es-PE")} viv.`);
  return partes.join(" · ");
}
