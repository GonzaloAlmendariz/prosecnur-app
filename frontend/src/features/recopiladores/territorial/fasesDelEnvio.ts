// fasesDelEnvio.ts — de qué fase de Hojas de ruta se lee la foto de una campaña
// territorial nueva (ADR 0118 §3). Puro: lo que «Nueva campaña» pregunta o da
// por decidido según qué fases tienen una muestra enviada.

import type { EnviosPorFase, FaseTerritorial } from "../../../api/materialTerritorial";

export type EleccionDeFase =
  /** Ninguna fase tiene envío: no hay de dónde leer. */
  | { tipo: "ninguna" }
  /** Una sola tiene envío: se usa esa, sin preguntar. */
  | { tipo: "unica"; fase: FaseTerritorial }
  /** Las dos: quien crea la campaña elige. */
  | { tipo: "elegir" };

export function eleccionDeFase(envios: EnviosPorFase | null): EleccionDeFase {
  if (!envios) return { tipo: "ninguna" };
  const con = (["pilot", "field"] as const).filter((f) => envios[f] !== null);
  if (con.length === 2) return { tipo: "elegir" };
  if (con.length === 1) return { tipo: "unica", fase: con[0] };
  return { tipo: "ninguna" };
}

/** La fase que viaja al crear: la elegida, la única, o `null` (el backend usa la activa). */
export function faseParaCrear(eleccion: EleccionDeFase, elegida: FaseTerritorial | null): FaseTerritorial | null {
  if (eleccion.tipo === "unica") return eleccion.fase;
  if (eleccion.tipo === "elegir") return elegida;
  return null;
}
