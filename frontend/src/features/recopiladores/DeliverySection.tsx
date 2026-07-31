import { useMemo, useState } from "react";

import {
  apiRecopiladoresHandoff,
  type CollectionArtifactReceipt,
  type CollectionStatePayload,
} from "../../api/recopiladores";
import { downloadUrl } from "../../api/core";
import { PulsoButton } from "../../components/PulsoButton";
import { CheckCircle2, Download, FileCheck2, Loader2, Send, ShieldCheck } from "../../vendor/lucide-react";
import { handoffReadiness } from "./handoffModel";
import "./styles/delivery.css";

type Props = {
  payload: CollectionStatePayload | null;
  latestArtifact: CollectionArtifactReceipt | null;
  onState: (payload: CollectionStatePayload) => void;
};

function shortFingerprint(value: string | null | undefined) {
  if (!value) return "—";
  return value.length > 24 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value;
}

export function DeliverySection({ payload, latestArtifact, onState }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deployment = payload?.state.deployment ?? null;
  const readiness = handoffReadiness(deployment);
  const receipt = payload?.handoff ?? readiness.receipt;
  const artifacts = useMemo(() => {
    const stored = payload?.state.artifact_receipts ?? [];
    if (!latestArtifact) return stored;
    return [latestArtifact, ...stored.filter((item) => item.receipt_id !== latestArtifact.receipt_id)];
  }, [latestArtifact, payload?.state.artifact_receipts]);

  const handoff = async () => {
    if (!payload || !readiness.ready || !readiness.fingerprint) return;
    setBusy(true);
    setError("");
    try {
      onState(await apiRecopiladoresHandoff(payload.state_revision, readiness.fingerprint));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar el handoff.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rec-delivery-layout">
      <section className="rec-handoff-card">
        <header><Send size={20} /><div><span>Handoff local</span><h2>Deployment → Monitoreo</h2></div></header>
        <div className={`rec-handoff-status${readiness.delivered ? " is-delivered" : readiness.ready ? " is-ready" : " is-blocked"}`}>
          {readiness.delivered ? <CheckCircle2 size={22} /> : <ShieldCheck size={22} />}
          <div><strong>{readiness.delivered ? "Entrega registrada" : readiness.ready ? "Listo para entregar" : "Entrega bloqueada"}</strong><p>{readiness.reason}</p></div>
        </div>
        <dl>
          <div><dt>Deployment</dt><dd>{deployment?.deployment_id ?? "—"}</dd></div>
          <div><dt>Cobertura</dt><dd>{deployment ? `${deployment.coverage.units_with_access}/${deployment.coverage.units_total}` : "—"}</dd></div>
          <div><dt>Target</dt><dd>{deployment?.target.provider ?? "—"}</dd></div>
          <div><dt>Fingerprint</dt><dd title={readiness.fingerprint}>{shortFingerprint(readiness.fingerprint)}</dd></div>
        </dl>
        <PulsoButton variant="primary" onClick={() => { void handoff(); }} disabled={!readiness.ready || readiness.delivered || busy}>
          {busy ? <Loader2 size={15} className="pulso-spin" /> : <Send size={15} />}
          {readiness.delivered ? "Entregado" : "Entregar a Monitoreo"}
        </PulsoButton>
        <p className="rec-policy-note">La operación es idempotente: el mismo fingerprint conserva un único recibo y no repite el traspaso.</p>
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </section>

      <section className="rec-receipt-card" data-qa-geometry-capacity="owned">
        <header><FileCheck2 size={20} /><div><span>Recibo estable</span><h2>Manifest de entrega y artefactos</h2></div></header>
        {receipt ? (
          <article className="rec-receipt">
            <strong>{receipt.schema}</strong>
            <dl>
              <div><dt>Fecha</dt><dd>{receipt.handed_off_at}</dd></div>
              <div><dt>Revisión</dt><dd>{receipt.state_revision}</dd></div>
              <div><dt>Plan</dt><dd title={receipt.plan_fingerprint}>{shortFingerprint(receipt.plan_fingerprint)}</dd></div>
              <div><dt>Deployment</dt><dd title={receipt.deployment_fingerprint}>{shortFingerprint(receipt.deployment_fingerprint)}</dd></div>
            </dl>
          </article>
        ) : <div className="rec-contained-empty">El recibo aparece aquí después de entregar un deployment preparado.</div>}

        <div className="rec-artifact-list" data-qa-geometry-group="recopiladores/artefactos" data-qa-geometry-contract="intrinsic">
          {artifacts.map((artifact) => (
            <article key={artifact.receipt_id}>
              <FileCheck2 size={17} />
              <div><strong>{artifact.filename}</strong><span>{artifact.media_type} · {artifact.page_count} páginas · {artifact.size_bytes} bytes</span><code>{shortFingerprint(artifact.sha256)}</code></div>
              <a href={downloadUrl(artifact.file_id)} aria-label={`Descargar ${artifact.filename}`}><Download size={15} /></a>
            </article>
          ))}
          {!artifacts.length ? (
            <div className="rec-contained-empty" data-qa-geometry-capacity="owned">
              Aún no hay un recibo de artefacto renderizado en esta sesión.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
