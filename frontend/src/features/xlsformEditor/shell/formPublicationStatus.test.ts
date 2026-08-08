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
    bound_bases: [],
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
      label: "Disponible · revisión 2",
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
      label: "Revisión 1 disponible",
      actionLabel: "Publicar nueva revisión",
      reason: "El borrador tiene cambios, pero no reemplaza la revisión disponible hasta que lo publiques.",
    });

    expect(getFormPublicationView(publication({
      status: "blocked",
      blockers: [{ id: "missing_name", title: "Falta name", detail: "Fila 3" }],
      can_publish: false,
    }))).toMatchObject({
      status: "blocked",
      label: "Falta 1 corrección para publicar",
      actionDisabled: true,
    });
  });

  test("expone todos los bloqueos, no solo el primero", () => {
    // El defecto que esto fija: la vista resumía "corrige X" con el primer
    // blocker y contaba el resto ("hay 2 observaciones adicionales"), así que
    // la tarjeta quedaba en rojo permanente sin decir qué más había que
    // arreglar ni en qué filas estaba.
    const view = getFormPublicationView(publication({
      status: "blocked",
      can_publish: false,
      blockers: [
        { id: "name-duplicate-p1", title: "Nombre duplicado", detail: "p1 se usa dos veces", rowIndex: 4 },
        { id: "select-missing-list-7-sexo", title: "Catálogo no existe", detail: "sexo no está en choices", rowIndex: 7 },
        { id: "settings-form-id-empty", title: "Formulario sin ID", detail: "Define un form_id" },
      ],
    }));

    expect(view.label).toBe("Faltan 3 correcciones para publicar");
    expect(view.blockers.map((blocker) => blocker.id)).toEqual([
      "name-duplicate-p1",
      "select-missing-list-7-sexo",
      "settings-form-id-empty",
    ]);
    expect(view.blockers[0]?.rowIndex).toBe(4);
    expect(view.blockers[1]?.detail).toBe("sexo no está en choices");
  });

  test("un bloqueo con revisión publicada aclara que la anterior sigue sirviendo", () => {
    const view = getFormPublicationView(publication({
      status: "blocked",
      can_publish: false,
      blockers: [{ id: "unclosed-2", title: "Grupo sin cierre", detail: "Falta end_group" }],
      latest_revision: {
        schema: "instrument_revision/v1",
        revision_id: "rev-3",
        form_id: "actor-b",
        revision_no: 3,
        content_sha256: "hash-3",
        xlsform_file_id: "file-3",
        published_at: "2026-08-01T12:00:00Z",
      },
    }));

    expect(view.reason).toMatch(/revisión 3 sigue disponible/i);
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
    });
    expect(view.blockers).toEqual([{
      id: "logic_pending_manual_confirmation",
      title: "Lógica pendiente de confirmación",
      detail: "Confirma manualmente la lógica antes de publicar.",
      rowIndex: undefined,
    }]);
  });

  test("expone estado aria-live mientras publica sin cambiar la revisión local", () => {
    const view = getFormPublicationView(publication(), true);

    expect(view.actionLabel).toBe("Publicando…");
    expect(view.actionDisabled).toBe(true);
  });
});
