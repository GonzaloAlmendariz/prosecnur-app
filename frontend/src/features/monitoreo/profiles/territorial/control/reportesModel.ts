import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmtConSigno, nombreDeDistrito, numeroDeUmp } from "../rotulos";

/**
 * Control › Reportes UMP (territorial.md §3.10): una baldosa por UMP de la ruta,
 * agrupadas por distrito, con cuántos partes tiene y si las efectivas que
 * declara el parte cuadran con lo recibido en Kobo para esa UMP.
 *
 * «No cuadra» compara contra lo RECIBIDO, como en la maqueta; si debe ser
 * contra lo que cuenta es la pregunta 7 de `territorial.md`.
 */

export type BaldosaDeUmp = {
  ump: string;
  partes: number;
  efectivasDeclaradas: number;
  intentos: number;
  /** Recibidas en Kobo para la UMP; `null` sin el corte de Validación. */
  recibidas: number | null;
  /** Declaradas menos recibidas; `null` si no se puede comparar. */
  diferencia: number | null;
};

export type BloqueDeDistrito = { distrito: string; baldosas: BaldosaDeUmp[] };

export type ModeloReportes = {
  disponible: boolean;
  distritos: BloqueDeDistrito[];
  conUnParte: number;
  conDosOMas: number;
  sinParte: string[];
  noCuadran: { total: number; conMenos: number; conMas: number } | null;
  fueraDeRuta: string[];
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function textoDeDiferencia(diferencia: number | null): string {
  if (diferencia == null) return "Sin recibidas para comparar";
  return diferencia === 0 ? "Cuadra" : `No cuadra · ${fmtConSigno(diferencia)}`;
}

export function construirReportes(
  ocurrencias: MonitoreoTerritorialDashboard | null | undefined,
  validacion: MonitoreoTerritorialDashboard | null | undefined,
): ModeloReportes {
  const porUmp = new Map((ocurrencias?.field_occurrences?.by_ump ?? []).map((item) => [numeroDeUmp(item.ump), item]));
  const auditoria = Array.isArray(validacion?.response_audit) ? validacion.response_audit : null;
  const recibidasPorUmp = new Map<string, number>();
  for (const fila of auditoria ?? []) {
    const ump = numeroDeUmp(fila.advance_block_ump);
    if (ump) recibidasPorUmp.set(ump, (recibidasPorUmp.get(ump) ?? 0) + 1);
  }

  // El corte de consultas trae `route_quota_progress` VACÍO, no ausente: con
  // `??` se quedaba con él y la pestaña decía «sin partes» con 84 en la base.
  const cuota = [ocurrencias?.route_quota_progress, validacion?.route_quota_progress]
    .find((item) => (item?.ump_groups?.length ?? 0) > 0) ?? ocurrencias?.route_quota_progress ?? validacion?.route_quota_progress;
  const distritoPorManzana = new Map((cuota?.blocks ?? []).map((bloque) => [bloque.id_manzana, nombreDeDistrito(bloque.distrito)]));
  const grupos = cuota?.ump_groups ?? [];
  const enRuta = new Set(grupos.map((grupo) => numeroDeUmp(grupo.ump)));

  const porDistrito = new Map<string, BaldosaDeUmp[]>();
  for (const grupo of grupos) {
    const ump = numeroDeUmp(grupo.ump);
    const parte = porUmp.get(ump);
    const partes = Math.round(n(parte?.reportes));
    const declaradas = Math.round(n(parte?.efectivas));
    const recibidas = auditoria ? recibidasPorUmp.get(ump) ?? 0 : null;
    const distrito = distritoPorManzana.get(String(grupo.selected_id_manzana ?? "")) ?? "Sin distrito";
    porDistrito.set(distrito, [...(porDistrito.get(distrito) ?? []), {
      ump,
      partes,
      efectivasDeclaradas: declaradas,
      intentos: Math.round(n(parte?.intentos)),
      recibidas,
      diferencia: partes > 0 && recibidas != null ? declaradas - recibidas : null,
    }]);
  }
  const distritos = [...porDistrito.entries()]
    .map(([distrito, baldosas]) => ({ distrito, baldosas: baldosas.sort((a, b) => Number(a.ump) - Number(b.ump)) }))
    .sort((a, b) => a.distrito.localeCompare(b.distrito, "es"));
  const todas = distritos.flatMap((bloque) => bloque.baldosas);
  const comparables = todas.filter((baldosa) => baldosa.diferencia != null);
  const descuadradas = comparables.filter((baldosa) => baldosa.diferencia !== 0);

  return {
    disponible: grupos.length > 0 && Boolean(ocurrencias?.field_occurrences),
    distritos,
    conUnParte: todas.filter((baldosa) => baldosa.partes === 1).length,
    conDosOMas: todas.filter((baldosa) => baldosa.partes >= 2).length,
    sinParte: todas.filter((baldosa) => baldosa.partes === 0).map((baldosa) => baldosa.ump),
    noCuadran: auditoria ? {
      total: descuadradas.length,
      conMenos: descuadradas.filter((baldosa) => (baldosa.diferencia ?? 0) < 0).length,
      conMas: descuadradas.filter((baldosa) => (baldosa.diferencia ?? 0) > 0).length,
    } : null,
    fueraDeRuta: [...porUmp.keys()].filter((ump) => ump && !enRuta.has(ump)).sort((a, b) => Number(a) - Number(b)),
  };
}
