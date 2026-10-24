// monitoreoTelefonico.ts — decisiones propias de Monitoreo › Telefónico (T9).
//
// Control › Discrepancias: el supervisor decide si una efectiva de Kobo que la
// hoja no marca «Efectivo» cuenta o no cuenta (P1–P2). La decisión se guarda en
// `monitoreo_profile.reconciliation_decisions` con nota obligatoria; mientras
// no se decide, la efectiva cuenta. Backend:
// `api/R/monitoreo_telefonico_discrepancias.R`.

import type { MonitoreoManualCaseReconciliation, MonitoreoState } from "./monitoreo";
import { apiFetch, handle, headers } from "./core";

export type DecisionDeDiscrepancia = "cuenta" | "no_cuenta";

export async function apiMonitoreoTelefonicoDecidirDiscrepancia(payload: {
  response_id: string;
  codpulso: string;
  decision: DecisionDeDiscrepancia;
  note: string;
}) {
  return handle<{ ok: true; decision: MonitoreoManualCaseReconciliation; state: MonitoreoState; saved_project: boolean }>(
    await apiFetch("/api/monitoreo/telefonico/discrepancia/decision", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ decision: payload }),
    }),
  );
}

// ---------- Rondas de supervisión (motor: api/R/monitoreo_supervision_rondas.R) ----------

/** Una ronda guardada, tal como la devuelve el motor (`.monitoreo_supervision_ronda_payload`). */
export type RondaDeSupervisionApi = {
  numero: number;
  generada_el: string;
  semilla: number | null;
  porcentaje: number | null;
  universo: number;
  corte_anterior: string;
  corte: string;
  casos: Array<Record<string, unknown>>;
  reparto: Array<Record<string, unknown>>;
  publicada: { en: string; pestana: string; spreadsheet_id: string; filas: number } | null;
  /** Última lectura de su pestaña «Ronda N»: `leida`, `pestana_borrada` o `sin_pestana`. */
  resultados: { estado: string; leido_el: string; pestana: string } | null;
};

function numeroONulo(valor: unknown): number | null {
  if (valor == null || valor === "" || valor === "NA") return null;
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isFinite(n) ? n : null;
}

function textoDe(valor: unknown): string {
  if (valor == null || valor === "NA") return "";
  return String(Array.isArray(valor) ? (valor[0] ?? "") : valor);
}

function filas(valor: unknown): Array<Record<string, unknown>> {
  return Array.isArray(valor) ? valor.filter((fila): fila is Record<string, unknown> => Boolean(fila) && typeof fila === "object") : [];
}

/** Normalizador defensivo: Plumber manda escalares como vectores de largo uno y `{}` por `NULL`. */
export function normalizarRondasDeSupervision(raw: unknown): RondaDeSupervisionApi[] {
  const lista = Array.isArray(raw) ? raw : [];
  return lista.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const numero = numeroONulo(r.numero);
    if (numero == null) return [];
    const pub = r.publicada && typeof r.publicada === "object" && !Array.isArray(r.publicada) ? r.publicada as Record<string, unknown> : null;
    const leida = r.resultados && typeof r.resultados === "object" && !Array.isArray(r.resultados) ? r.resultados as Record<string, unknown> : null;
    return [{
      numero,
      generada_el: textoDe(r.generada_el),
      semilla: numeroONulo(r.semilla),
      porcentaje: numeroONulo(r.porcentaje),
      universo: numeroONulo(r.universo) ?? 0,
      corte_anterior: textoDe(r.corte_anterior),
      corte: textoDe(r.corte),
      casos: filas(r.casos),
      reparto: filas(r.reparto),
      publicada: pub && textoDe(pub.pestana) ? {
        en: textoDe(pub.en), pestana: textoDe(pub.pestana), spreadsheet_id: textoDe(pub.spreadsheet_id), filas: numeroONulo(pub.filas) ?? 0,
      } : null,
      resultados: leida && textoDe(leida.estado) ? {
        estado: textoDe(leida.estado), leido_el: textoDe(leida.leido_el), pestana: textoDe(leida.pestana),
      } : null,
    }];
  }).sort((a, b) => a.numero - b.numero);
}

export async function apiSupervisionRondas() {
  const raw = await handle<{ ok: true; schema: string; rondas: unknown }>(
    await apiFetch("/api/monitoreo/telefonico/supervision/rondas", { headers: headers() }),
  );
  return { ok: true as const, rondas: normalizarRondasDeSupervision(raw.rondas) };
}

export async function apiSupervisionNuevaRonda(payload: { porcentaje?: number | null; agregados?: string[]; semilla?: number }) {
  const raw = await handle<{ ok: true; ronda: unknown; rondas: unknown; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/telefonico/supervision/ronda", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(payload.porcentaje != null ? { porcentaje: payload.porcentaje } : {}),
        agregados: payload.agregados ?? [],
        ...(payload.semilla != null ? { semilla: payload.semilla } : {}),
      }),
    }),
  );
  return { ok: true as const, rondas: normalizarRondasDeSupervision(raw.rondas), state: raw.state };
}

export async function apiSupervisionPublicarRonda(payload: { numero: number; preguntas: string[] }) {
  const raw = await handle<{ ok: true; ronda: unknown; rondas: unknown; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/telefonico/supervision/ronda/publicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return { ok: true as const, rondas: normalizarRondasDeSupervision(raw.rondas), state: raw.state };
}

/**
 * Lee (sólo lectura) las pestañas «Ronda N» de la hoja de supervisión y guarda
 * en cada ronda sus resultados; avisa de las rondas cuya pestaña se borró.
 */
export async function apiSupervisionLeerResultados() {
  const raw = await handle<{ ok: true; leidas: unknown; avisos: unknown; rondas: unknown; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/telefonico/supervision/resultados/leer", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: "{}",
    }),
  );
  const avisos = (Array.isArray(raw.avisos) ? raw.avisos : []).map((aviso) => textoDe(aviso)).filter(Boolean);
  return {
    ok: true as const,
    leidas: numeroONulo(raw.leidas) ?? 0,
    avisos,
    rondas: normalizarRondasDeSupervision(raw.rondas),
    state: raw.state,
  };
}
