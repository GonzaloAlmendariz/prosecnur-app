import type {
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialOperationalAdjustment,
  MonitoreoTerritorialOperationalAdjustmentSuggestion,
} from "../../../../../api/client";
import { claveDePaquete, type RechazoDeSubsanacion } from "../../../../../api/monitoreoRechazos";
import { celdaEnFrase, diaYMes, fmt, nombreDeDistrito, numeroDeUmp, rotuloDeAplicador } from "../rotulos";

/**
 * Control › Subsanaciones (territorial.md §3.11). El motor publica las celdas
 * con déficit, el paquete que sugiere para cubrirlas y las subsanaciones ya
 * aplicadas o revertidas (`operational_adjustments`); la decisión es del
 * coordinador, que aplica el paquete con una nota que queda en el historial.
 */

export type CeldaConDeficit = { texto: string; falta: number };

export type UmpConDeficit = {
  ump: string;
  distrito: string;
  manzana: string;
  elegible: boolean;
  celdas: CeldaConDeficit[];
  falta: number;
};

export type Movimiento = { celda: string; casos: number };

export type PaqueteSugerido = {
  id: string;
  origen: { ump: string; manzana: string; aplicador: string };
  destino: { ump: string; manzana: string; aplicador: string };
  movimientos: Movimiento[];
  casos: number;
  distancia: string;
  motivo: string;
  /** El coordinador ya rechazó este mismo paquete (el motor lo volvió a sugerir). */
  rechazo: RechazoDeSubsanacion | null;
  /** Lo que se manda al motor al aplicar. */
  ajuste: MonitoreoTerritorialOperationalAdjustmentSuggestion;
};

export type EntradaDeHistorial = { id: string; cuando: string; orden: string; texto: string; nota: string; estado: "activa" | "revertida" | "rechazada" };

export type ModeloSubsanaciones = {
  disponible: boolean;
  umps: UmpConDeficit[];
  celdas: number;
  sugerencias: PaqueteSugerido[];
  activas: number;
  activasPorDistrito: Array<{ distrito: string; casos: number }>;
  revertidas: number;
  rechazadas: number;
  historial: EntradaDeHistorial[];
  /** Ajustes activos, para revertir uno desde el historial. */
  idsActivos: Set<string>;
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function celdaDelAjuste(item: Pick<MonitoreoTerritorialOperationalAdjustment, "sex" | "age_group">): string {
  const sexo = String(item.sex ?? "").trim();
  const edad = String(item.age_group ?? "").trim();
  if (sexo && edad) return `${celdaEnFrase(sexo)} de ${celdaEnFrase(edad)}`;
  return celdaEnFrase(sexo || edad);
}

function movimientosDe(item: MonitoreoTerritorialOperationalAdjustment): Movimiento[] {
  const partes = item.adjustments?.length ? item.adjustments : [item];
  return partes.map((parte) => ({ celda: celdaDelAjuste(parte), casos: Math.max(1, Math.round(n(parte.count) || 1)) }));
}

function distanciaDe(km: unknown): string {
  const valor = Number(km);
  return km != null && Number.isFinite(valor) ? `${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : "Sin distancia";
}

function textoDelAjuste(item: MonitoreoTerritorialOperationalAdjustment): string {
  const movimientos = movimientosDe(item);
  const casos = movimientos.reduce((suma, movimiento) => suma + movimiento.casos, 0);
  return `UMP ${numeroDeUmp(item.source_ump)} → UMP ${numeroDeUmp(item.target_ump)}: ${fmt(casos)} ${casos === 1 ? "caso" : "casos"} (${movimientos.map((m) => m.celda).join(", ")})`;
}

function cuandoDe(fecha: unknown): { cuando: string; orden: string } {
  const texto = String(fecha ?? "").trim();
  if (!texto) return { cuando: "Sin fecha", orden: "" };
  const hora = texto.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
  return { cuando: `${diaYMes(texto)}${hora ? ` ${hora}` : ""}`, orden: texto };
}

export function construirSubsanaciones(
  reports: MonitoreoTerritorialDashboard | null | undefined,
  rechazos: readonly RechazoDeSubsanacion[] = [],
): ModeloSubsanaciones {
  const rechazoPorClave = new Map(rechazos.map((rechazo) => [rechazo.clavePaquete, rechazo]));
  const ajustes = reports?.operational_adjustments;
  const disponible = Boolean(ajustes) && !/scope/i.test(String(ajustes?.reason ?? ""));
  const deficits = ajustes?.deficits ?? [];

  const porUmp = new Map<string, UmpConDeficit>();
  for (const deficit of deficits) {
    if (!(n(deficit.missing) > 0)) continue;
    const ump = numeroDeUmp(deficit.target_ump);
    const clave = `${ump}|${deficit.target_block_id}`;
    const item = porUmp.get(clave) ?? {
      ump,
      distrito: nombreDeDistrito(deficit.district),
      manzana: String(deficit.target_manzana ?? ""),
      elegible: false,
      celdas: [],
      falta: 0,
    };
    item.elegible = item.elegible || deficit.match_status === "eligible";
    item.celdas.push({ texto: celdaDelAjuste(deficit), falta: Math.round(n(deficit.missing)) });
    item.falta += Math.round(n(deficit.missing));
    porUmp.set(clave, item);
  }
  const umps = [...porUmp.values()].sort((a, b) => Number(b.elegible) - Number(a.elegible) || b.falta - a.falta || Number(a.ump) - Number(b.ump));

  const sugerencias: PaqueteSugerido[] = (ajustes?.suggestions ?? []).map((sugerencia) => {
    const movimientos = movimientosDe(sugerencia);
    return {
      id: sugerencia.id,
      origen: { ump: numeroDeUmp(sugerencia.source_ump), manzana: String(sugerencia.source_manzana ?? ""), aplicador: rotuloDeAplicador(sugerencia.source_responsible) },
      destino: { ump: numeroDeUmp(sugerencia.target_ump), manzana: String(sugerencia.target_manzana ?? ""), aplicador: rotuloDeAplicador(sugerencia.target_responsible) },
      movimientos,
      casos: movimientos.reduce((suma, movimiento) => suma + movimiento.casos, 0),
      distancia: distanciaDe(sugerencia.distance_km ?? sugerencia.max_distance_km),
      motivo: String(sugerencia.reason ?? ""),
      rechazo: rechazoPorClave.get(claveDePaquete(sugerencia)) ?? null,
      ajuste: sugerencia,
    };
  });

  const aplicados = ajustes?.applied ?? [];
  const activos = aplicados.filter((item) => String(item.status ?? "active") === "active");
  const revertidos = aplicados.filter((item) => item.status === "reverted");
  const porDistrito = new Map<string, number>();
  for (const item of activos) {
    const distrito = nombreDeDistrito(item.district);
    porDistrito.set(distrito, (porDistrito.get(distrito) ?? 0) + movimientosDe(item).reduce((suma, m) => suma + m.casos, 0));
  }

  const historial = aplicados.map((item, indice): EntradaDeHistorial => {
    const revertida = item.status === "reverted";
    const { cuando, orden } = cuandoDe(revertida ? item.reverted_at || item.created_at : item.created_at);
    return {
      id: String(item.id ?? `ajuste-${indice}`),
      cuando,
      orden,
      texto: `${revertida ? "Revertida" : "Aplicada"} · ${textoDelAjuste(item)}${item.created_by ? ` · ${item.created_by}` : ""}`,
      nota: String(item.note ?? ""),
      estado: revertida ? "revertida" : "activa",
    };
  });
  for (const rechazo of rechazos) {
    const { cuando, orden } = cuandoDe(rechazo.fecha);
    historial.push({
      id: rechazo.id,
      cuando,
      orden,
      texto: `Rechazada · UMP ${numeroDeUmp(rechazo.sourceUmp)} → UMP ${numeroDeUmp(rechazo.targetUmp)}: ${celdaDelAjuste({ sex: rechazo.sex, age_group: rechazo.ageGroup })} · ${rechazo.autor}`,
      nota: rechazo.nota,
      estado: "rechazada",
    });
  }
  historial.sort((a, b) => b.orden.localeCompare(a.orden));

  return {
    disponible,
    umps,
    celdas: umps.reduce((suma, item) => suma + item.celdas.length, 0),
    sugerencias,
    activas: activos.length,
    activasPorDistrito: [...porDistrito.entries()].map(([distrito, casos]) => ({ distrito, casos })).sort((a, b) => b.casos - a.casos),
    revertidas: revertidos.length,
    rechazadas: rechazos.length,
    historial,
    idsActivos: new Set(activos.map((item) => String(item.id ?? ""))),
  };
}

/** Lo que se manda al motor: el paquete con la nota del coordinador. */
export function ajusteParaAplicar(paquete: PaqueteSugerido, nota: string): MonitoreoTerritorialOperationalAdjustment {
  const texto = nota.trim();
  return {
    ...paquete.ajuste,
    note: texto || `Aplicado desde Control › Subsanaciones: ${textoDelAjuste(paquete.ajuste)}.`,
    reason: paquete.ajuste.reason || "Excedente compatible usado como subsanación operativa",
  };
}
