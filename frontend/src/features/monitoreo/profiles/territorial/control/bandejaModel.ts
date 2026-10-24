import type { MonitoreoTerritorialDashboard, TerritorialInternalReviewCase } from "../../../../../api/client";
import { territorialDurationOperationalStatusFromValues } from "../../../territorialDuration";
import { diaYMes, fmt, nombreDeDistrito, numeroDeUmp, rotuloDeAplicador } from "../rotulos";

/**
 * Control › Bandeja (territorial.md §3.6): los casos por revisar
 * (`internal_queries$review_cases`, corte de Consultas) con filtros por motivo
 * y por distrito, y los casos ya anulados uno a uno.
 *
 * Regla de Gonzalo para el control de tiempo: se revisan las encuestas CORTAS
 * (menos de 5 min, y las de menos de 2 aparte). Una larga no es un problema:
 * si llegara un caso de duración que no es corto, no entra a la bandeja ni a
 * sus conteos.
 */

export type MotivoDeBandeja = "gps-lejos" | "gps-revision" | "sin-gps" | "muy-corta" | "corta" | "ump" | "registro";

export const ROTULO_DE_MOTIVO: Record<MotivoDeBandeja, string> = {
  "gps-lejos": "GPS a más de 300 m",
  "gps-revision": "GPS entre 150 y 300 m",
  "sin-gps": "Sin GPS",
  "muy-corta": "Duración menor a 2 min",
  corta: "Duración de 2 a 5 min",
  ump: "UMP iniciada incompleta",
  registro: "Registro por revisar",
};

const ORDEN: MotivoDeBandeja[] = ["gps-lejos", "gps-revision", "sin-gps", "muy-corta", "corta", "ump", "registro"];

export type CasoDeBandeja = {
  id: string;
  responseId: string;
  /** Lo que se lee en la columna Caso: el formulario, o la UMP si el caso es de una UMP entera. */
  etiqueta: string;
  motivo: MotivoDeBandeja;
  rotuloDeMotivo: string;
  detalle: string;
  dia: string;
  fechaIso: string;
  hora: string;
  distrito: string;
  ump: string;
  manzana: string;
  aplicador: string;
  distanciaM: number | null;
  distancia: string;
  duracion: string;
};

export type AnuladoDeBandeja = { id: string; responseId: string; rotulo: string; motivo: string; dia: string };

export type ModeloBandeja = {
  disponible: boolean;
  casos: CasoDeBandeja[];
  filtros: Array<{ clave: MotivoDeBandeja; rotulo: string; casos: number }>;
  distritos: Array<{ distrito: string; casos: number }>;
  anulados: AnuladoDeBandeja[];
};

export function motivoDe(caso: TerritorialInternalReviewCase): MotivoDeBandeja | null {
  if (caso.type === "gps") {
    if (caso.geo_estado === "geo_no_defendible") return "gps-lejos";
    if (caso.geo_estado === "geo_revision") return "gps-revision";
    return "sin-gps";
  }
  if (caso.type === "duration") {
    const segundos = Number(caso.duration_seconds);
    const estado = territorialDurationOperationalStatusFromValues({
      seconds: Number.isFinite(segundos) && segundos > 0 ? segundos : null,
      durationStatus: caso.duration_status,
      durationOperationalStatus: caso.duration_operational_status,
      durationOperationalLabel: caso.duration_operational_label,
    });
    if (estado === "muy_corto") return "muy-corta";
    return estado === "corto" ? "corta" : null;
  }
  if (caso.type === "ump") return "ump";
  return "registro";
}

/** «12:05» de segundos, o «—». */
export function minutosYSegundos(segundos: unknown): string {
  const valor = Number(segundos);
  if (segundos == null || !Number.isFinite(valor) || valor <= 0) return "—";
  const total = Math.round(valor);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function textoDeMetros(metros: number | null): string {
  if (metros == null) return "Sin GPS";
  return metros >= 1000 ? `${(metros / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} km` : `${fmt(Math.round(metros))} m`;
}

export function construirBandeja(consultas: MonitoreoTerritorialDashboard | null | undefined): ModeloBandeja {
  const crudos = consultas?.internal_queries?.review_cases;
  const casos: CasoDeBandeja[] = (crudos ?? []).flatMap((caso) => {
    const motivo = motivoDe(caso);
    if (!motivo) return [];
    const distancia = caso.distance_m != null && Number.isFinite(Number(caso.distance_m)) ? Number(caso.distance_m) : null;
    const responseId = String(caso.response_id ?? "");
    const ump = numeroDeUmp(caso.ump);
    return [{
      id: String(caso.id),
      responseId,
      // Un caso de UMP («UMP iniciada incompleta») no trae formulario: su id es
      // la clave del motor («ump:ump_iniciada_incompleta:1501…») y no se pinta.
      etiqueta: responseId ? responseId.slice(0, 8) : ump ? `UMP ${ump}` : "Sin formulario",
      motivo,
      rotuloDeMotivo: ROTULO_DE_MOTIVO[motivo],
      detalle: String(caso.reason ?? ""),
      dia: diaYMes(caso.submission_date_iso || caso.submission_date),
      fechaIso: String(caso.submission_date_iso ?? ""),
      hora: String(caso.submission_hour ?? "").slice(0, 5),
      distrito: nombreDeDistrito(caso.district),
      ump,
      manzana: String(caso.manzana ?? ""),
      aplicador: rotuloDeAplicador(caso.responsible || caso.pulso_code),
      distanciaM: motivo === "sin-gps" ? null : distancia,
      distancia: motivo === "sin-gps" ? "Sin GPS" : textoDeMetros(distancia),
      duracion: minutosYSegundos(caso.duration_seconds),
    }];
  });
  casos.sort((a, b) => ORDEN.indexOf(a.motivo) - ORDEN.indexOf(b.motivo) || a.fechaIso.localeCompare(b.fechaIso) || a.hora.localeCompare(b.hora));

  const porDistrito = new Map<string, number>();
  for (const caso of casos) porDistrito.set(caso.distrito, (porDistrito.get(caso.distrito) ?? 0) + 1);

  const anulados = (consultas?.production_annulments?.entries ?? [])
    .filter((entrada) => entrada.status === "active" && entrada.scope === "response")
    .map((entrada) => ({
      id: entrada.id,
      responseId: String(entrada.response_id ?? ""),
      rotulo: String(entrada.response_label || entrada.response_id || ""),
      motivo: String(entrada.reason ?? ""),
      dia: diaYMes(entrada.created_at),
    }));

  return {
    disponible: Array.isArray(crudos),
    casos,
    filtros: ORDEN.map((clave) => ({ clave, rotulo: ROTULO_DE_MOTIVO[clave], casos: casos.filter((caso) => caso.motivo === clave).length }))
      .filter((filtro) => filtro.casos > 0),
    distritos: [...porDistrito.entries()].map(([distrito, cantidad]) => ({ distrito, casos: cantidad }))
      .sort((a, b) => a.distrito.localeCompare(b.distrito, "es")),
    anulados,
  };
}

export function esMotivoDeBandeja(valor: unknown): valor is MotivoDeBandeja {
  return typeof valor === "string" && (ORDEN as string[]).includes(valor);
}

export function filtrarBandeja(casos: readonly CasoDeBandeja[], motivo: MotivoDeBandeja | null, distrito: string | null): CasoDeBandeja[] {
  return casos.filter((caso) => (!motivo || caso.motivo === motivo) && (!distrito || caso.distrito === distrito));
}

/** Escala del esquema de distancia: anillos de 150 y 300 m y el caso. */
export function escalaDelEsquema(metros: number | null): { radioMaximo: number; anillos: number[] } {
  const radioMaximo = Math.max(400, Math.ceil(((metros ?? 0) * 1.15) / 100) * 100);
  return { radioMaximo, anillos: [150, 300] };
}
