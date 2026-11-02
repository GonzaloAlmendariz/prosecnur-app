import type { MonitoreoActorUnit } from "../../../../../api/monitoreo";

/**
 * Canales de un público de acreditación (ADR 0125 §5): una lista que CRECE con
 * lo que se va abriendo —ronda 1, 2, 3…—, no un plan cerrado. Gonzalo
 * (2026-11-02): «hacemos llamada y no llegamos a la meta y se decide después
 * iniciar una campaña de correo». Material abre una campaña por canal declarado.
 * Mismo contrato que `.monitoreo_normalize_canales` (api/R/monitoreo_actor_contract.R).
 */
export type TipoDeCanal = "correo" | "telefonico" | "presencial";
export type Canal = { ronda: number; canal: TipoDeCanal };

export const TIPOS_DE_CANAL: TipoDeCanal[] = ["correo", "telefonico", "presencial"];

export const ROTULO_DEL_CANAL: Record<TipoDeCanal, string> = {
  correo: "Correo",
  telefonico: "Telefónico",
  presencial: "Presencial en aula",
};

function esTipo(x: unknown): x is TipoDeCanal {
  return typeof x === "string" && (TIPOS_DE_CANAL as string[]).includes(x);
}

/** Lo guardado, en orden; un público sin canales con el switch telefónico migra a [correo, telefónico]. */
export function canalesDesde(unit: Pick<MonitoreoActorUnit, "canales" | "phone">): Canal[] {
  const vistos = new Set<number>();
  const out: Canal[] = [];
  for (const c of unit.canales ?? []) {
    if (!esTipo(c?.canal) || !Number.isFinite(c.ronda) || c.ronda < 1 || vistos.has(c.ronda)) continue;
    vistos.add(c.ronda);
    out.push({ ronda: Math.round(c.ronda), canal: c.canal });
  }
  if (!out.length && unit.phone?.enabled) return [{ ronda: 1, canal: "correo" }, { ronda: 2, canal: "telefonico" }];
  return out.sort((a, b) => a.ronda - b.ronda);
}

export function tieneTelefonico(canales: Canal[]): boolean {
  return canales.some((c) => c.canal === "telefonico");
}

/** Suma una ronda al final, con el número siguiente, sin tocar las anteriores. */
export function sumarRonda(canales: Canal[], canal: TipoDeCanal): Canal[] {
  const siguiente = canales.reduce((max, c) => Math.max(max, c.ronda), 0) + 1;
  return [...canales, { ronda: siguiente, canal }];
}

/** Quita una ronda; las demás conservan su número (es el historial de lo abierto). */
export function quitarRonda(canales: Canal[], ronda: number): Canal[] {
  return canales.filter((c) => c.ronda !== ronda);
}

/**
 * El switch telefónico crece desde aquí: encenderlo suma una ronda telefónica
 * (y el correo de base si el público no tenía ninguno); apagarlo quita las
 * rondas telefónicas.
 */
export function alternarTelefonico(canales: Canal[]): Canal[] {
  if (tieneTelefonico(canales)) return canales.filter((c) => c.canal !== "telefonico");
  const base = canales.length ? canales : [{ ronda: 1, canal: "correo" as const }];
  return sumarRonda(base, "telefonico");
}

export function firmaDeCanales(canales: Canal[]): string {
  return canales.map((c) => `${c.ronda}${c.canal[0]}`).join(",");
}
