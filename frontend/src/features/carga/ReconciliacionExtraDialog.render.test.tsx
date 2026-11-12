// @vitest-environment happy-dom
// Ítem 32 del checklist de Validación (QA2, 2026-11-12): el diálogo de columnas
// fuera del formulario recibe la revisión adaptada por `reviewReconciliationInfo`.
// Antes esa adaptación descartaba `personal`: el diálogo no avisaba "Dato
// potencialmente personal identificado" y la columna venía marcada.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { CargaReviewPayload, CargaReviewReconciliationExtra } from "../../api/client";
import { reviewReconciliationInfo } from "./pestanas/cargaPaginaModelo";
import { ReconciliacionExtraDialog } from "./ReconciliacionExtraDialog";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

const extra = (name: string, cambios: Partial<CargaReviewReconciliationExtra> = {}): CargaReviewReconciliationExtra => ({
  name, fill_pct: 99, n_fill: 990, kind: "con_datos", incluida: false, decision: "pending", ...cambios,
});

const revision = {
  reconciliation: {
    extra: [
      extra("dni_entrevistador", { personal: { sospecha: true, causa: "Parece DNI: 8 dígitos en el 100 % de los casos con dato." } }),
      extra("fecha"),
    ],
    n_extra: 2,
    n_incluidas: 0,
    n_excluidas: 0,
    n_pendientes: 2,
    reviewed: false,
  },
} as unknown as CargaReviewPayload;

test("avisa el dato personal con su causa y lo deja sin marcar", () => {
  act(() => root.render(
    <ReconciliacionExtraDialog info={reviewReconciliationInfo(revision)} onSave={async (i) => reviewReconciliationInfo({ ...revision, reconciliation: { ...revision.reconciliation, extra: revision.reconciliation.extra.map((e) => ({ ...e, incluida: i.includes(e.name) })) } })} onClose={() => undefined} />,
  ));
  const dialogo = document.querySelector<HTMLElement>("[role='dialog']");
  expect(dialogo?.textContent).toContain("Dato potencialmente personal identificado");
  expect(dialogo?.textContent).toContain("Parece DNI: 8 dígitos en el 100 % de los casos con dato.");
  const casillas = [...document.querySelectorAll<HTMLInputElement>(".pulso-recon-check")];
  expect(casillas.map((c) => [c.id, c.checked])).toEqual([
    ["pulso-recon-row-dni_entrevistador", false],
    ["pulso-recon-row-fecha", true],
  ]);
});
