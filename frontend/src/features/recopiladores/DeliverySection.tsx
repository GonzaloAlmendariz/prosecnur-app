import { useMemo, useState } from "react";

import {
  apiRecopiladoresHandoff,
  normalizeHandoffReceipt,
  type CollectionArtifactReceipt,
  type CollectionStatePayload,
} from "../../api/recopiladores";
import { downloadUrl } from "../../api/core";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { serializarDireccion } from "../../lib/navegacion/direccion";
import { Archive, CheckCircle2, Download, FileCheck2, FileWarning, Loader2, Send, ShieldCheck } from "../../vendor/lucide-react";
import { handoffReadiness, type HandoffReadiness } from "./handoffModel";
import { juzgarMaterialesDelPlan } from "./materialesDelPlanVigente";
import { providerLabel } from "./providerRules";
import { VacioSinPlanCard } from "./VacioSinPlanCard";
import { vacioSinPlan } from "./vacioSinPlan";
import { ConstruirTablasEnSheets } from "./ConstruirTablasEnSheets";
import "./styles/delivery.css";
import { CifrasEnTarjeta } from "../../components/CifrasEnTarjeta";
import { EstadoVacio } from "../../components/EstadoVacio";
import { RecorridoDelTraspaso, ReciboPendiente } from "./TraspasoTablero";
import { enumerar } from "../../lib/enumerar";

type Props = {
  payload: CollectionStatePayload | null;
  latestArtifact: CollectionArtifactReceipt | null;
  onState: (payload: CollectionStatePayload) => void;
  /** Navega a una dirección de la app (la acción del vacío sin plan). */
  onIr?: (to: string) => void;
  /** Abre Accesos en la campaña abierta (lo que falta cuando la entrega está bloqueada). */
  onIrAAccesos?: () => void;
};

/** Donde se regenera un material cuyo archivo ya no está en la sesión. */
const A_PAQUETES = serializarDireccion({ modulo: "material-campo", seccion: "paquetes" });

/** Donde sigue el trabajo: Monitoreo trae la entrega desde Insumos › Fuentes y desde ahí hace el seguimiento. */
const A_MONITOREO_FUENTES = serializarDireccion({ modulo: "monitoreo", seccion: "insumos", pestana: "fuentes" });

function paginas(n: number): string {
  return n === 1 ? "1 página" : `${n.toLocaleString("es-PE")} páginas`;
}

function shortFingerprint(value: string | null | undefined) {
  if (!value) return "—";
  return value.length > 24 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value;
}

/**
 * Qué falta para que exista el recibo, dicho en el vacío que lo espera.
 *
 * Sin traspaso no hay Fecha, Revisión, Plan ni Accesos que mostrar: pintar
 * «Recibo firmado» con cuatro «—» afirmaba una entrega que no ocurrió (H25).
 */
export function faltaParaElRecibo(readiness: HandoffReadiness): string {
  if (readiness.ready && !readiness.delivered) {
    return "Los accesos están listos: el recibo aparece aquí al pulsar «Entregar a Monitoreo».";
  }
  return `${readiness.reason} El recibo aparece aquí cuando se entreguen.`;
}

export function DeliverySection({ payload, latestArtifact, onState, onIr, onIrAAccesos }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deployment = payload?.state.deployment ?? null;
  const readiness = handoffReadiness(deployment);
  // Mismo filtro que el normalizador: un `{}` (el NULL de R) no es recibo.
  const receipt = normalizeHandoffReceipt(payload?.handoff) ?? normalizeHandoffReceipt(readiness.receipt);
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
  // Pasada de diseño (2 nov 2026): lo que antes eran cuatro filas de «—» se lee como cifras y recorrido.
  const plan = payload?.state.plan ?? null;
  const conAcceso = deployment?.coverage.units_with_access ?? 0;
  const totalAcceso = deployment?.coverage.units_total ?? 0;
  const accesosListos = deployment?.status === "prepared" || deployment?.status === "handed_off";
  const sinAccesos = !deployment;

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

  // Sin plan, sin accesos, sin recibo y sin materiales no hay nada que
  // entregar ni que mostrar: el vacío lo dice y lleva a Unidades. Con
  // cualquiera de ellos se pinta la mesa, porque hay algo que leer.
  if (!payload?.state.plan && !deployment && !receipt && !artifacts.length) {
    return <VacioSinPlanCard vacio={vacioSinPlan("entrega")} icono={<Send size={18} />} onIr={onIr} />;
  }

  return (
    <div className="rec-delivery">
    {/* Revamp v5: lo que bloquea la entrega va arriba, con su acción, y no al pie del recibo. */}
    {desfasados ? (
      <div className="rec-delivery-bloqueo" role="status">
        <span>
          <strong>{desfasados} {desfasados === 1 ? "material salió" : "materiales salieron"} de un plan anterior</strong>
          {" "}Vuelve a generarlos antes de llevarlos a campo.
        </span>
        {onIr ? <PulsoButton variant="secondary" size="sm" onClick={() => onIr(A_PAQUETES)}>Regenerar en Paquetes</PulsoButton> : null}
      </div>
    ) : null}
    <CifrasEnTarjeta
      cifras={[
        {
          id: "entrega", rotulo: "Entrega",
          valor: readiness.delivered ? "Registrada" : readiness.ready ? "Lista" : "Bloqueada",
          nota: readiness.delivered ? "Monitoreo ya puede traerla" : readiness.ready ? "falta pulsar «Entregar»" : "falta un paso del recorrido",
          tono: readiness.delivered || readiness.ready ? "listo" : "aviso",
        },
        deployment
          ? {
            id: "cobertura", rotulo: "Cobertura", valor: conAcceso.toLocaleString("es-PE"), de: totalAcceso,
            avance: { valor: conAcceso, total: totalAcceso, etiqueta: "Aulas con enlace" },
          }
          : { id: "cobertura", rotulo: "Cobertura", valor: "—", nota: "sin accesos preparados" },
        { id: "plataforma", rotulo: "Plataforma", valor: deployment ? providerLabel(deployment.target.provider) : "—", nota: "donde se responde" },
        {
          id: "material", rotulo: "Material generado", valor: artifacts.length.toLocaleString("es-PE"),
          nota: desfasados ? "de un plan anterior: regenerar" : artifacts.length ? "al día con el plan" : "todavía ninguno",
          tono: desfasados ? "aviso" : undefined,
        },
      ]}
    />
    <div className="rec-delivery-layout">
      {/* La columna de lo que hace Material: entregar y, con lo entregado, armar las tablas (R13). */}
      <div className="rec-delivery-columna">
      <Panel
        className="rec-handoff-card"
        eyebrow="Entrega"
        title={<><Send size={18} aria-hidden /> Lo que se entrega a Monitoreo</>}
        hint="El registro que campo llena al inicio. Las metas salen de Cálculo de muestra y el seguimiento lo hace Monitoreo."
      >
        <RecorridoDelTraspaso
          pasos={[
            {
              id: "plan", titulo: "Plan congelado", hecho: Boolean(plan),
              detalle: plan ? `${plan.units.length.toLocaleString("es-PE")} unidades, con sus reservas y el banco` : "Falta sembrar el plan en Unidades.",
            },
            {
              id: "accesos", titulo: "Accesos preparados", hecho: accesosListos,
              detalle: deployment
                ? <span title={deployment.deployment_id}>{`${conAcceso.toLocaleString("es-PE")} de ${totalAcceso.toLocaleString("es-PE")} aulas con enlace`}</span>
                : "Falta preparar los accesos.",
              // Revisión con ojo de usuario (2 nov 2026): «Falta preparar los accesos» no llevaba a ningún lado.
              accion: sinAccesos && onIrAAccesos
                ? <PulsoButton variant="secondary" size="sm" onClick={onIrAAccesos}>Ir a Accesos</PulsoButton>
                : undefined,
            },
            {
              id: "material", titulo: "Material generado", hecho: artifacts.length > 0 && !desfasados,
              detalle: !artifacts.length
                ? "Opcional. Todavía no se genera ninguna ficha."
                : desfasados
                  ? `${desfasados.toLocaleString("es-PE")} de ${artifacts.length.toLocaleString("es-PE")} salieron de un plan anterior.`
                  : `${artifacts.length.toLocaleString("es-PE")} ${artifacts.length === 1 ? "archivo" : "archivos"} al día con el plan.`,
            },
            {
              id: "entrega", titulo: "Entregado a Monitoreo", hecho: readiness.delivered,
              // Regla P9: el motivo del bloqueo ya lo dicen el paso de accesos y el recibo.
              detalle: <span title={readiness.fingerprint}>{readiness.delivered
                ? "Monitoreo ya puede traerla desde Insumos › Fuentes."
                : readiness.ready ? "Lista: falta pulsar «Entregar a Monitoreo»." : "Se habilita cuando los pasos anteriores están hechos."}</span>,
            },
          ]}
        />
        <PulsoButton variant="primary" onClick={() => { void handoff(); }} disabled={!readiness.ready || readiness.delivered || busy}>
          {busy ? <Loader2 size={15} className="pulso-spin" /> : <Send size={15} />}
          {readiness.delivered ? "Entregado" : "Entregar a Monitoreo"}
        </PulsoButton>
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </Panel>
      <ConstruirTablasEnSheets entregado={Boolean(receipt)} />
      <ConstruirTablasEnSheets entregado={Boolean(receipt)} tabla="distribucion" />
      </div>

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
            {/* El traspaso enlaza al que recibe: Material entrega y no hace seguimiento. */}
            <p className="rec-receipt-siguiente">
              Monitoreo la trae en Insumos › Fuentes y la sigue contra las metas de Cálculo de muestra.{" "}
              {onIr ? <PulsoButton variant="link" size="sm" onClick={() => onIr(A_MONITOREO_FUENTES)}>Abrir Monitoreo</PulsoButton> : null}
            </p>
          </article>
        ) : (
          <ReciboPendiente motivo={faltaParaElRecibo(readiness)} />
        )}

        <h4 className="rec-tras-materiales-titulo">Material generado</h4>
        <div className="rec-artifact-list" data-qa-geometry-group="material-campo/artefactos" data-qa-geometry-contract="intrinsic">
          {/* El aviso va ARRIBA de la lista: se descarga desde cada fila, así que
              enterarse después de haber bajado el archivo no sirve de nada. */}
          {/* El aviso de desfase vive arriba, junto a su acción (revamp v5); cada fila desfasada lo marca. */}
          {juzgados.map(({ material: artifact, desfasado }) => {
            // El `.pulso` guarda el recibo, no el archivo: al reabrir, el
            // recibo queda como evidencia y su descarga daría 404. Sólo un
            // `false` explícito lo apaga; un payload viejo no lo dice.
            const disponible = artifact.file_available !== false;
            const clases = [desfasado ? "is-desfasado" : "", disponible ? "" : "is-no-disponible"].filter(Boolean).join(" ");
            return (
              <article
                key={artifact.receipt_id}
                className={clases || undefined}
                data-desfasado={desfasado || undefined}
                data-disponible={disponible ? undefined : "false"}
              >
                {disponible ? <FileCheck2 size={17} aria-hidden /> : <FileWarning size={17} aria-hidden />}
                <div>
                  <strong>{artifact.filename}</strong>
                  <span>
                    {enumerar([artifact.media_type, paginas(artifact.page_count), `${artifact.size_bytes.toLocaleString("es-PE")} bytes`])}
                    {desfasado ? <em className="rec-artifact-stale">, de un plan anterior</em> : null}
                  </span>
                  {disponible ? null : (
                    <span className="rec-artifact-no-disponible">
                      No disponible en esta sesión: el archivo no viaja en el proyecto. Se regenera desde Paquetes.
                    </span>
                  )}
                  <code>{shortFingerprint(artifact.sha256)}</code>
                </div>
                {disponible ? (
                  <a href={downloadUrl(artifact.file_id)} aria-label={`Descargar ${artifact.filename}`}><Download size={15} /></a>
                ) : onIr ? (
                  <PulsoButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onIr(A_PAQUETES)}
                    aria-label={`Regenerar ${artifact.filename} en Paquetes`}
                  >
                    Ir a Paquetes
                  </PulsoButton>
                ) : null}
              </article>
            );
          })}
          {!artifacts.length ? (
            <EstadoVacio icono={<Archive size={16} aria-hidden />} titulo="Todavía no se ha generado material en esta sesión" />
          ) : null}
        </div>
      </Panel>
    </div>
    </div>
  );
}
