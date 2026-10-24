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
