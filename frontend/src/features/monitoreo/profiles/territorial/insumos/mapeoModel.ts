import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialMapeo } from "../../../../../api/client";
import { fmt, nombreDeDistrito, pctEntero } from "../rotulos";

/**
 * Insumos › Mapeo y filtro (territorial.md §3.2): las reglas de lectura del
 * formulario. Cada rol con la columna a la que apunta y si existe en la base;
 * el filtro de efectivas con cuántas pasan sobre su base; los umbrales que
 * alimentan la Bandeja; y el cruce de distritos de Kobo a ubigeo.
 */

export type EstadoDeRol = "encontrada" | "sin-mapear" | "ausente";

export type FilaDeRol = { campo: string; rol: string; columna: string; estado: EstadoDeRol; rotuloDeEstado: string };

export type ModeloMapeo = {
  roles: FilaDeRol[] | null;
  pendientes: number;
  filtro: { pregunta: string; valores: string[]; pasan: number | null; noPasan: number | null; base: number | null; proporcion: string } | null;
  umbrales: Array<{ rotulo: string; valor: string }>;
  distritos: Array<{ codigo: string; etiqueta: string; ubigeo: string; distrito: string; ok: boolean }>;
};

const ROTULO_DE_ESTADO: Record<EstadoDeRol, string> = {
  encontrada: "En la base",
  "sin-mapear": "Sin columna",
  ausente: "Columna ausente",
};

function n(valor: unknown): number | null {
  const numero = Number(valor);
  return valor != null && valor !== "" && Number.isFinite(numero) ? numero : null;
}

function segundosEnTexto(valor: number | null): string {
  if (valor == null) return "—";
  return valor >= 120 && valor % 60 === 0 ? `${fmt(valor / 60)} min` : `${fmt(valor)} s`;
}

export function construirMapeo(
  mapeo: MonitoreoTerritorialMapeo | null | undefined,
  state: MonitoreoState | null | undefined,
  reports: MonitoreoTerritorialDashboard | null | undefined,
): ModeloMapeo {
  const roles = mapeo
    ? mapeo.variables.map((variable) => {
      const estado: EstadoDeRol = variable.resuelta ? "encontrada" : variable.motivo === "columna_ausente" ? "ausente" : "sin-mapear";
      return { campo: variable.campo, rol: variable.etiqueta, columna: variable.apunta_a, estado, rotuloDeEstado: ROTULO_DE_ESTADO[estado] };
    })
    : null;

  const validez = reports?.source_validity;
  const pasan = n(validez?.effective_count);
  const noPasan = n(validez?.non_effective_count);
  const base = n(validez?.total_responses);
  const etiquetas = new Map((validez?.options ?? []).map((opcion) => [String(opcion.value), String(opcion.label || opcion.value)]));

  const territorial = state?.config?.territorial;
  const umbrales = territorial ? [
    { rotulo: "GPS cerca de su manzana hasta", valor: `${fmt(territorial.geo_thresholds_m?.cerca)} m` },
    { rotulo: "GPS en revisión hasta", valor: `${fmt(territorial.geo_thresholds_m?.revision)} m` },
    { rotulo: "Duración mínima", valor: segundosEnTexto(n(territorial.min_duration_seconds)) },
    // Regla de Gonzalo: el control de tiempo revisa las cortas; el umbral de las
    // largas es un dato, no una alerta.
    { rotulo: "Duración larga desde, sin alerta", valor: segundosEnTexto(n(territorial.max_duration_seconds)) },
    { rotulo: "Edad a revisar desde", valor: `${fmt(territorial.high_age_review)} años` },
  ] : [];

  return {
    roles,
    pendientes: roles ? roles.filter((rol) => rol.estado !== "encontrada").length : 0,
    filtro: validez ? {
      pregunta: String(validez.field_label || validez.field_resolved || validez.field || ""),
      valores: (validez.values ?? []).map((valor) => etiquetas.get(String(valor)) ?? String(valor)),
      pasan,
      noPasan,
      base,
      proporcion: pasan != null && base ? pctEntero(pasan, base) : "—",
    } : null,
    umbrales,
    distritos: (territorial?.district_crosswalk ?? []).map((fila) => ({
      codigo: String(fila.kobo_code ?? ""),
      etiqueta: String(fila.kobo_label ?? ""),
      ubigeo: String(fila.ubigeo ?? ""),
      distrito: fila.distrito ? nombreDeDistrito(fila.distrito) : "Sin distrito",
      ok: Boolean(String(fila.ubigeo ?? "").trim()),
    })),
  };
}
