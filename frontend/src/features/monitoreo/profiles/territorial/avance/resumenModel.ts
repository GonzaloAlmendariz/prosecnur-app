import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { diaYMes, nombreDeDistrito, pctEntero } from "../rotulos";

/**
 * Avance › Resumen (territorial.md §3.14). Una sola cifra con su base: lo que
 * cuenta para la meta es `advance$validas` frente a `advance$meta` (§2), y el
 * embudo, el ritmo y los distritos leen esa misma base.
 */

export type PasoDelEmbudo = {
  clave: "recibidas" | "anuladas" | "corte" | "no-cuentan" | "cuentan" | "observacion" | "sin-observacion";
  rotulo: string;
  valor: number;
  /** Paso que se resta del anterior (anuladas, no cuentan). */
  resta?: boolean;
  /** Desglose de «cuentan» (en observación, sin observación). */
  nivel?: 1;
};

export type MotivoDeObservacion = { clave: string; rotulo: string; casos: number };

export type DiaDelRitmo = { fecha: string; rotulo: string; cuentan: number; observacion: number; acumulado: number };

export type TirasDeUmp = { completas: number; subsanadas: number; pendientes: number };

export type FilaDeDistritoResumen = {
  distrito: string;
  cuentan: number;
  meta: number;
  avance: string;
  observacion: number;
  noCuentan: number;
  umps: TirasDeUmp;
};

export type ModeloResumen = {
  configurado: boolean;
  cuentan: number;
  meta: number;
  avance: string;
  /** Proporción para el anillo, acotada a 1. */
  proporcion: number;
  metaAlcanzada: { fecha: string; acumulado: number; excedente: number } | null;
  embudo: PasoDelEmbudo[];
  /** Diferencia entre recibidas − anuladas y lo que queda en el corte. */
  descuadre: number;
  /**
   * `null` cuando el corte no trae las respuestas una a una (`advance_summary`
   * las omite): el desglose no se inventa con los conteos globales de GPS.
   */
  motivos: MotivoDeObservacion[] | null;
  primerRegistro: string;
  ultimoRegistro: string;
  diasConCampo: number;
  ritmo: DiaDelRitmo[];
  distritos: FilaDeDistritoResumen[];
  total: {
    cuentan: number;
    meta: number;
    avance: string;
    observacion: number;
    noCuentan: number;
    sinDistrito: number;
    umpsCompletas: number;
    umps: number;
  };
};

/** Rótulos de `.monitoreo_territorial_observation_reasons` (motor). */
const MOTIVOS: Record<string, string> = {
  gps_lejos: "GPS a más de 300 m",
  gps_revision: "GPS entre 150 y 300 m",
  gps_sin_gps: "Sin GPS",
  gps_sin_cruce: "GPS sin cruce con la ruta",
  duracion_corta: "Duración menor a 5 min",
  duracion_muy_corta: "Duración menor a 2 min",
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function rotuloDeMotivo(clave: string): string {
  return MOTIVOS[clave] ?? "Otro motivo";
}

function estadoDeUmp(status: unknown, falta: number): keyof TirasDeUmp {
  if (falta > 0) return "pendientes";
  const valor = String(status ?? "").toLowerCase();
  if (valor.startsWith("subsan")) return "subsanadas";
  if (valor === "complete" || valor === "exceeded") return "completas";
  return "pendientes";
}

export function construirResumen(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloResumen {
  const advance = reports?.advance;
  const cuentan = Math.round(n(advance?.validas));
  const meta = Math.round(n(advance?.meta));
  const observacion = Math.round(n(advance?.observacion));
  const noCuentan = Math.round(n(advance?.no_validas));
  const enCorte = Math.round(n(advance?.total_respuestas));
  const recibidas = Math.round(n(reports?.source_validity?.total_responses));
  const anuladas = Math.round(n(reports?.production_annulments?.summary?.annulled_responses));

  const embudo: PasoDelEmbudo[] = [
    { clave: "recibidas", rotulo: "Recibidas de Kobo", valor: recibidas },
    { clave: "anuladas", rotulo: "Anuladas", valor: anuladas, resta: true },
    { clave: "corte", rotulo: "En el corte", valor: enCorte },
    { clave: "no-cuentan", rotulo: "No cuentan", valor: noCuentan, resta: true },
    { clave: "cuentan", rotulo: "Cuentan para la meta", valor: cuentan },
    { clave: "observacion", rotulo: "En observación", valor: observacion, nivel: 1 },
    { clave: "sin-observacion", rotulo: "Sin observación", valor: Math.max(0, cuentan - observacion), nivel: 1 },
  ];

  const filasDeAuditoria = Array.isArray(reports?.response_audit) ? reports.response_audit : [];
  let motivos: MotivoDeObservacion[] | null = null;
  if (filasDeAuditoria.length) {
    const conteo = new Map<string, number>();
    for (const fila of filasDeAuditoria) {
      if (fila.observation_status !== "en_observacion") continue;
      for (const clave of String(fila.observation_reasons ?? "").split(";").map((item) => item.trim()).filter(Boolean)) {
        conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
      }
    }
    motivos = [...conteo.entries()]
      .map(([clave, casos]) => ({ clave, rotulo: rotuloDeMotivo(clave), casos }))
      .sort((a, b) => b.casos - a.casos);
  }

  const dias = [...(advance?.daily ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let acumulado = 0;
  const ritmo: DiaDelRitmo[] = dias.map((dia) => {
    acumulado += Math.round(n(dia.validas));
    return {
      fecha: String(dia.date),
      rotulo: diaYMes(dia.date) || String(dia.date_label ?? dia.date),
      cuentan: Math.round(n(dia.validas)),
      observacion: Math.round(n(dia.revision)),
      acumulado,
    };
  });
  const cruce = meta > 0 ? ritmo.find((dia) => dia.acumulado >= meta) : undefined;
  const conCampo = dias.filter((dia) => n(dia.total) > 0);

  const bloques = reports?.route_quota_progress?.blocks ?? [];
  const distritoDeManzana = new Map(bloques.map((bloque) => [bloque.id_manzana, nombreDeDistrito(bloque.distrito)]));
  const grupos = reports?.route_quota_progress?.ump_groups ?? [];
  const tirasPorDistrito = new Map<string, TirasDeUmp>();
  for (const grupo of grupos) {
    const distrito = distritoDeManzana.get(String(grupo.selected_id_manzana ?? ""));
    if (!distrito) continue;
    const tiras = tirasPorDistrito.get(distrito) ?? { completas: 0, subsanadas: 0, pendientes: 0 };
    tiras[estadoDeUmp(grupo.status, n(grupo.missing_total))] += 1;
    tirasPorDistrito.set(distrito, tiras);
  }

  const distritos: FilaDeDistritoResumen[] = (advance?.district_progress ?? []).map((fila) => {
    const nombre = nombreDeDistrito(fila.distrito);
    const metaDistrito = Math.round(n(fila.meta));
    return {
      distrito: nombre,
      cuentan: Math.round(n(fila.validas)),
      meta: metaDistrito,
      avance: pctEntero(n(fila.validas), metaDistrito),
      observacion: Math.round(n(fila.revision)),
      noCuentan: Math.round(n(fila.no_defendibles)),
      umps: tirasPorDistrito.get(nombre) ?? { completas: 0, subsanadas: 0, pendientes: 0 },
    };
  });
  const suma = (clave: "cuentan" | "meta" | "observacion" | "noCuentan") => distritos.reduce((total, fila) => total + fila[clave], 0);
  const noCuentanEnDistritos = suma("noCuentan");
  const umpsCompletas = grupos.filter((grupo) => estadoDeUmp(grupo.status, n(grupo.missing_total)) !== "pendientes").length;

  return {
    configurado: Boolean(advance) && (meta > 0 || enCorte > 0),
    cuentan,
    meta,
    avance: pctEntero(cuentan, meta),
    proporcion: meta > 0 ? Math.min(1, cuentan / meta) : 0,
    metaAlcanzada: cruce ? { fecha: cruce.rotulo, acumulado: cruce.acumulado, excedente: cuentan - meta } : null,
    embudo,
    descuadre: recibidas > 0 ? recibidas - anuladas - enCorte : 0,
    motivos,
    primerRegistro: ritmo[0]?.rotulo ?? "",
    ultimoRegistro: ritmo.at(-1)?.rotulo ?? "",
    diasConCampo: conCampo.length,
    ritmo,
    distritos,
    total: {
      cuentan,
      meta,
      avance: pctEntero(cuentan, meta),
      observacion,
      noCuentan,
      sinDistrito: Math.max(0, noCuentan - noCuentanEnDistritos),
      umpsCompletas,
      umps: grupos.length,
    },
  };
}
