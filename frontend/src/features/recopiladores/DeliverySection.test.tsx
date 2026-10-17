import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CollectionArtifactReceipt, CollectionDeployment, CollectionStatePayload } from "../../api/recopiladores";
import { DeliverySection } from "./DeliverySection";

function payloadWithDeployment(deployment: CollectionDeployment | null): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 1,
    plan: null,
    deployment,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state };
}

const BASE_DEPLOYMENT: CollectionDeployment = {
  schema: "collection_deployment/v1",
  deployment_id: "dep-1",
  plan_id: "plan-1",
  plan_fingerprint: "fp",
  deployment_fingerprint: "fp-dep",
  target: { provider: "kobo" },
  capabilities: {},
  bindings: [],
  coverage: { units_total: 12, units_with_access: 12, units_missing_access: 0 },
  sensitivity: { access_urls: "operational" },
  status: "prepared",
};

describe("proveedor del target, capitalizado igual que en Accesos", () => {
  it("traduce kobo/surveymonkey a su nombre de marca, no la clave cruda", () => {
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(BASE_DEPLOYMENT)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain(">Kobo<");
    expect(markup).not.toContain(">kobo<");
  });

  it("manual no es una marca, se muestra tal cual", () => {
    const deployment = { ...BASE_DEPLOYMENT, target: { provider: "manual" } };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(deployment)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain(">manual<");
  });

  it("un proveedor no mapeado se muestra tal cual, no se inventa una etiqueta", () => {
    const deployment = { ...BASE_DEPLOYMENT, target: { provider: "un_proveedor_futuro" } };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(deployment)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain(">un_proveedor_futuro<");
  });
});

/**
 * H23 — un recibo cuyo archivo ya no está en la sesión no promete descarga.
 *
 * `build_pulso` sólo copia inputs: al reabrir el proyecto, el recibo sigue en
 * `artifact_receipts` y el archivo no (GET /api/files/<id>/download → 404
 * E_NO_FILE). El backend marca cada recibo con `file_available` (derivado, no
 * persistido); la UI lo muestra como evidencia «no disponible en esta sesión»
 * que se regenera desde Paquetes, sin enlace de descarga.
 */
function receipt(id: string, overrides: Partial<CollectionArtifactReceipt> & { file_available?: boolean } = {}) {
  return {
    schema: "collection_artifact_receipt/v1",
    receipt_id: `receipt-${id}`,
    artifact_id: `artifact-${id}`,
    deployment_id: "dep-1",
    plan_fingerprint: "fp",
    deployment_fingerprint: "fp-dep",
    file_id: `file-${id}`,
    media_type: "application/pdf",
    filename: `fichas-${id}.pdf`,
    sha256: `sha256:${"a".repeat(64)}`,
    size_bytes: 2048,
    page_count: 1,
    ...overrides,
  } as CollectionArtifactReceipt;
}

function payloadWithReceipts(receipts: CollectionArtifactReceipt[]): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 4,
    plan: null,
    deployment: BASE_DEPLOYMENT,
    artifact_receipts: receipts,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state } as unknown as CollectionStatePayload;
}

function renderReceipts(receipts: CollectionArtifactReceipt[]) {
  return renderToStaticMarkup(
    <DeliverySection payload={payloadWithReceipts(receipts)} latestArtifact={null} onState={() => undefined} />,
  );
}

describe("H23 — recibo sin archivo en la sesión", () => {
  // `downloadUrl` lee el sid de localStorage; en node no hay uno usable.
  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("file_available:false no pinta enlace de descarga y dice que se regenera", () => {
    const markup = renderReceipts([receipt("viejo", { file_available: false })]);
    expect(markup).toContain("fichas-viejo.pdf");
    expect(markup).not.toContain("file-viejo");
    expect(markup).not.toContain('aria-label="Descargar fichas-viejo.pdf"');
    expect(markup).toMatch(/no disponible en esta sesi[oó]n/i);
    expect(markup).toMatch(/regener/i);
  });

  it("el recibo disponible conserva su descarga", () => {
    const markup = renderReceipts([receipt("nuevo", { file_available: true })]);
    expect(markup).toContain('aria-label="Descargar fichas-nuevo.pdf"');
    expect(markup).toContain("file-nuevo");
  });

  it("page_count 1 dice «1 página», en singular", () => {
    const markup = renderReceipts([receipt("uno", { file_available: true, page_count: 1 })]);
    expect(markup).toContain("1 página");
    expect(markup).not.toContain("1 páginas");
  });
});

/**
 * H25 — «Recibo firmado» con Fecha/Revisión/Plan/Accesos en «—» sin traspaso.
 *
 * El despliegue real de hsvg2026_con_plan_v2.pulso llega `prepared` con
 * `handoff: {}` (el NULL de R serializado). Sin traspaso, la tarjeta es un vacío
 * que dice qué falta; con traspaso, muestra los datos del recibo.
 */
describe("H25 — el recibo sólo se firma si hubo traspaso", () => {
  const RECIBO = {
    schema: "collection_handoff/v1" as const,
    deployment_id: "dep-1",
    deployment_fingerprint: "fp-dep",
    plan_fingerprint: "fp-plan",
    handed_off_at: "2026-10-16T10:00:00Z",
    state_revision: 5,
  };
  const VACIO = {} as unknown as CollectionDeployment["handoff"];

  it("sin traspaso ({} como handoff) no firma nada y dice qué falta", () => {
    const deployment: CollectionDeployment = { ...BASE_DEPLOYMENT, handoff: VACIO };
    const payload = { ...payloadWithDeployment(deployment), handoff: VACIO };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payload} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).not.toContain("Recibo firmado");
    expect(markup).toContain("Aún no se entrega a Monitoreo");
    expect(markup).toContain("«Entregar a Monitoreo»");
  });

  it("sin accesos preparados, el vacío dice que faltan los accesos", () => {
    const deployment: CollectionDeployment = { ...BASE_DEPLOYMENT, status: "draft" };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(deployment)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain("Aún no se entrega a Monitoreo");
    expect(markup).toContain("Los accesos todavía no están preparados.");
  });

  it("con traspaso, el recibo muestra fecha, revisión, plan y accesos", () => {
    const deployment: CollectionDeployment = { ...BASE_DEPLOYMENT, status: "handed_off", handoff: RECIBO };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(deployment)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain("Recibo firmado");
    expect(markup).not.toContain("Aún no se entrega a Monitoreo");
    expect(markup).toContain("2026-10-16T10:00:00Z");
    expect(markup).toContain("<dd>5</dd>");
    expect(markup).toContain(">fp-plan<");
  });
});
