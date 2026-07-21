import { describe, expect, test } from "vitest";
import type { XlsformFormPublication } from "../../../api/client";
import {
  getFormPublicationView,
  isConfirmableLogicBlocker,
} from "./formPublicationView";

function publication(
  overrides: Partial<XlsformFormPublication> = {},
): XlsformFormPublication {
  return {
    status: "draft",
    draft_content_sha256: "draft-hash",
    latest_revision: null,
    blockers: [],
    warnings: [],
    can_publish: true,
    can_delete: true,
    ...overrides,
  };
}

describe("getFormPublicationView", () => {
  test("solo clasifica los cuatro blockers metodológicos como confirmables", () => {
    expect([
      "logic_pending_manual_confirmation",
      "logic_confirmation_stale",
      "logic_variant_pending_manual_confirmation",
      "logic_variant_confirmation_stale",
    ].every(isConfirmableLogicBlocker)).toBe(true);
    expect(isConfirmableLogicBlocker("invalid_relevant_expression")).toBe(false);
  });

  test("presenta los cuatro estados del contrato remoto", () => {
    expect(getFormPublicationView(publication())).toMatchObject({
      status: "draft",
      label: "Borrador",
      actionLabel: "Publicar",
      actionDisabled: false,
    });

    expect(getFormPublicationView(publication({
      status: "published",
      latest_revision: {
        schema: "instrument_revision/v1",
        revision_id: "rev-2",
        form_id: "actor-b",
        revision_no: 2,
        content_sha256: "draft-hash",
        xlsform_file_id: "file-2",
        published_at: "2026-07-20T12:00:00Z",
      },
      can_publish: false,
      can_delete: false,
    }))).toMatchObject({
      status: "published",
      label: "Publicado · rev. 2",
      actionLabel: null,
    });

    expect(getFormPublicationView(publication({
      status: "changes_pending",
      latest_revision: {
        schema: "instrument_revision/v1",
        revision_id: "rev-1",
        form_id: "actor-b",
        revision_no: 1,
        content_sha256: "old-hash",
        xlsform_file_id: "file-1",
        published_at: "2026-07-19T12:00:00Z",
      },
    }))).toMatchObject({
      status: "changes_pending",
      label: "Cambios sin publicar",
      actionLabel: "Publicar nueva revisión",
    });

    expect(getFormPublicationView(publication({
      status: "blocked",
      blockers: [{ id: "missing_name", title: "Falta name", detail: "Fila 3" }],
      can_publish: false,
    }))).toMatchObject({
      status: "blocked",
      label: "Bloqueado",
      actionDisabled: true,
      reason: "Falta name: Fila 3",
    });
  });

  test("un blocker prevalece sobre un status draft contradictorio", () => {
    const view = getFormPublicationView(publication({
      status: "draft",
      blockers: [{ id: "invalid", title: "Lógica inválida", detail: "Revisa relevant" }],
    }));

    expect(view.status).toBe("blocked");
    expect(view.actionDisabled).toBe(true);
  });

  test("explica el bloqueo por lógica pendiente de confirmación manual", () => {
    const view = getFormPublicationView(publication({
      status: "draft",
      blockers: [{
        id: "logic_pending_manual_confirmation",
        title: "Lógica pendiente de confirmación",
        detail: "Confirma manualmente la lógica antes de publicar.",
      }],
      can_publish: false,
    }));

    expect(view).toMatchObject({
      status: "blocked",
      actionDisabled: true,
      reason: "Lógica pendiente de confirmación: Confirma manualmente la lógica antes de publicar.",
    });
  });

  test("expone estado aria-live mientras publica sin cambiar la revisión local", () => {
    const view = getFormPublicationView(publication(), true);

    expect(view.actionLabel).toBe("Publicando…");
    expect(view.actionDisabled).toBe(true);
  });
});
