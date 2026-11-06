// Asignación UMP → encuestador por columna del calendario (decisión I3, «la de Monitoreo»).
// Lógica pura: el borrador es un mapa id_manzana → código, sólo con lo explícito (los
// reemplazos heredan del titular en el backend, no aquí).

import type { AsignacionTerritorial } from "../../../api/materialTerritorial";

export type Borrador = Record<string, string>;

/** Lo explícito de lo guardado: el punto de partida del borrador. */
export function borradorDe(a: AsignacionTerritorial | null): Borrador {
  const b: Borrador = {};
  for (const u of a?.asignacion ?? []) if (u.origen === "explicita") b[u.id_manzana] = u.codigo;
  return b;
}

/** El código de la columna: el común a todas sus UMP, "" si ninguna tiene, `null` si están mezcladas. */
export function codigoDeColumna(umps: readonly string[], b: Borrador): string | null {
  const codigos = new Set(umps.map((id) => b[id] ?? ""));
  if (codigos.size === 0) return "";
  return codigos.size === 1 ? [...codigos][0] : null;
}

/** Asigna (o quita, con "") el código a todas las UMP de la columna. */
export function asignarColumna(b: Borrador, umps: readonly string[], codigo: string): Borrador {
  const n: Borrador = { ...b };
  for (const id of umps) {
    if (codigo) n[id] = codigo;
    else delete n[id];
  }
  return n;
}

export function cuerpoDelBorrador(b: Borrador): { id_manzana: string; codigo: string }[] {
  return Object.entries(b)
    .filter(([, codigo]) => Boolean(codigo))
    .map(([id_manzana, codigo]) => ({ id_manzana, codigo }))
    .sort((x, y) => x.id_manzana.localeCompare(y.id_manzana));
}

export function hayCambios(b: Borrador, a: AsignacionTerritorial | null): boolean {
  return JSON.stringify(cuerpoDelBorrador(b)) !== JSON.stringify(cuerpoDelBorrador(borradorDe(a)));
}

/** Por qué no se puede asignar ahora; `null` si se puede. */
export function motivoDeBloqueo(a: AsignacionTerritorial | null): string | null {
  if (!a) return null;
  if (a.sin_fuente) return "La muestra enviada desde Hojas de ruta ya no está: vuelve a enviarla para asignar encuestadores.";
  if (a.stale) return "La muestra cambió en Hojas de ruta desde el envío: reenvíala antes de asignar encuestadores.";
  if (a.code_format === "DNI") return "La lista de encuestadores de Monitoreo identifica por DNI. Para asignar aquí, cárgala en Monitoreo con códigos (P001, P002…).";
  if (!a.equipo.length) return "Aún no hay encuestadores. La lista se carga en Monitoreo › Territorial, y de ahí se asignan aquí.";
  return null;
}
