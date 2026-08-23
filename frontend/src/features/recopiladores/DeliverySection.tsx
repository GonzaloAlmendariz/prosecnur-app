import { useMemo, useState } from "react";

import {
  apiRecopiladoresHandoff,
  type CollectionArtifactReceipt,
  type CollectionStatePayload,
} from "../../api/recopiladores";
import { downloadUrl } from "../../api/core";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { CheckCircle2, Download, FileCheck2, Loader2, Send, ShieldCheck } from "../../vendor/lucide-react";
import { handoffReadiness } from "./handoffModel";
import { juzgarMaterialesDelPlan } from "./materialesDelPlanVigente";
import { providerLabel } from "./providerRules";
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

  // Cada recibo guarda de qué plan salió; el plan vigente tiene su huella. Sin
  // compararlos, un material impreso con los cursos-horario del sorteo anterior
  // se ve igual que uno bueno.
  const juzgados = useMemo(
    () => juzgarMaterialesDelPlan(artifacts, payload?.state.plan?.input_fingerprint),
    [artifacts, payload?.state.plan?.input_fingerprint],
  );
  const desfasados = juzgados.filter((x) => x.desfasado).length;

  const handoff = async () => {
    if (!payload || !readiness.ready || !readiness.fingerprint) return;
    setBusy(true);
    setError("");
    try {
      onState(await apiRecopiladoresHandoff(payload.state_revision, readiness.fingerprint));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la entrega.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rec-delivery-layout">
      <Panel
        className="rec-handoff-card"
        eyebrow="Entrega"
        title={<><Send size={18} aria-hidden /> Lo que se entrega a Monitoreo</>}
      >
        <div className={`rec-handoff-status${readiness.delivered ? " is-delivered" : readiness.ready ? " is-ready" : " is-blocked"}`}>
          {readiness.delivered ? <CheckCircle2 size={22} /> : <ShieldCheck size={22} />}
          <div><strong>{readiness.delivered ? "Entrega registrada" : readiness.ready ? "Listo para entregar" : "Entrega bloqueada"}</strong><p>{readiness.reason}</p></div>
        </div>
        <dl>
          <div><dt>Accesos</dt><dd title={deployment?.deployment_id ?? undefined}>{shortFingerprint(deployment?.deployment_id)}</dd></div>
          <div><dt>Cobertura</dt><dd>{deployment ? `${deployment.coverage.units_with_access}/${deployment.coverage.units_total}` : "—"}</dd></div>
          <div><dt>Plataforma</dt><dd>{deployment ? providerLabel(deployment.target.provider) : "—"}</dd></div>
          <div><dt>Huella</dt><dd title={readiness.fingerprint}>{shortFingerprint(readiness.fingerprint)}</dd></div>
        </dl>
        <PulsoButton variant="primary" onClick={() => { void handoff(); }} disabled={!readiness.ready || readiness.delivered || busy}>
          {busy ? <Loader2 size={15} className="pulso-spin" /> : <Send size={15} />}
          {readiness.delivered ? "Entregado" : "Entregar a Monitoreo"}
        </PulsoButton>
        <p className="rec-policy-note">Entregar dos veces no duplica nada: con la misma huella se conserva un solo recibo y el traspaso no se repite.</p>
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </Panel>

      <Panel
        className="rec-receipt-card"
        data-qa-geometry-capacity="owned"
        eyebrow="Recibo estable"
        title={<><FileCheck2 size={18} aria-hidden /> Recibo de lo entregado</>}
      >
        {receipt ? (
          <article className="rec-receipt">
            <strong>Recibo firmado</strong>
            <dl>
              <div><dt>Fecha</dt><dd>{receipt.handed_off_at}</dd></div>
              <div><dt>Revisión</dt><dd>{receipt.state_revision}</dd></div>
              <div><dt>Plan</dt><dd title={receipt.plan_fingerprint}>{shortFingerprint(receipt.plan_fingerprint)}</dd></div>
              <div><dt>Accesos</dt><dd title={receipt.deployment_fingerprint}>{shortFingerprint(receipt.deployment_fingerprint)}</dd></div>
            </dl>
          </article>
        ) : <div className="rec-contained-empty">El recibo aparece aquí cuando se entregan unos accesos ya preparados.</div>}

        <div className="rec-artifact-list" data-qa-geometry-group="recopiladores/artefactos" data-qa-geometry-contract="intrinsic">
          {/* El aviso va ARRIBA de la lista: se descarga desde cada fila, así que
              enterarse después de haber bajado el archivo no sirve de nada. */}
          {desfasados ? (
            <p className="rec-artifact-stale-aviso" role="status">
              <strong>{desfasados}</strong>{" "}
              {desfasados === 1
                ? "material salió de un plan anterior"
                : "materiales salieron de un plan anterior"}
              : sus cursos-horario ya no son los del sorteo vigente. Vuelve a generarlos
              antes de llevarlos a campo.
            </p>
          ) : null}
          {juzgados.map(({ material: artifact, desfasado }) => (
            <article
              key={artifact.receipt_id}
              className={desfasado ? "is-desfasado" : undefined}
              data-desfasado={desfasado || undefined}
            >
              <FileCheck2 size={17} />
              <div>
                <strong>{artifact.filename}</strong>
                <span>
                  {artifact.media_type} · {artifact.page_count} páginas · {artifact.size_bytes} bytes
                  {desfasado ? <em className="rec-artifact-stale"> · de un plan anterior</em> : null}
                </span>
                <code>{shortFingerprint(artifact.sha256)}</code>
              </div>
              <a href={downloadUrl(artifact.file_id)} aria-label={`Descargar ${artifact.filename}`}><Download size={15} /></a>
            </article>
          ))}
          {!artifacts.length ? (
            <div className="rec-contained-empty" data-qa-geometry-capacity="owned">
              Todavía no se ha generado ningún material en esta sesión.
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
