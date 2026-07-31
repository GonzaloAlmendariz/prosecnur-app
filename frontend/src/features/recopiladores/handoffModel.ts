import type { CollectionDeployment, CollectionHandoffReceipt } from "../../api/recopiladores";

export type HandoffReadiness = {
  ready: boolean;
  delivered: boolean;
  fingerprint: string;
  receipt: CollectionHandoffReceipt | null;
  reason: string;
};

export function handoffReadiness(deployment: CollectionDeployment | null): HandoffReadiness {
  if (!deployment) return { ready: false, delivered: false, fingerprint: "", receipt: null, reason: "Falta preparar un deployment." };
  const receipt = deployment.handoff?.schema === "collection_handoff/v1" ? deployment.handoff : null;
  const fingerprint = deployment.deployment_fingerprint ?? receipt?.deployment_fingerprint ?? "";
  if (deployment.status === "handed_off" && receipt) {
    return { ready: true, delivered: true, fingerprint, receipt, reason: "El handoff ya tiene un recibo estable." };
  }
  if (deployment.status !== "prepared") {
    return { ready: false, delivered: false, fingerprint, receipt, reason: deployment.status === "stale" ? "El deployment cambió y debe reconciliarse." : "El deployment aún no está preparado." };
  }
  if (!fingerprint) return { ready: false, delivered: false, fingerprint: "", receipt, reason: "Falta el fingerprint del deployment." };
  return { ready: true, delivered: false, fingerprint, receipt, reason: "Listo para entregar a Monitoreo." };
}
