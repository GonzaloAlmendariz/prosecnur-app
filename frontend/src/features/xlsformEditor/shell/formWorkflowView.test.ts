import { describe, expect, test } from "vitest";
import type { XlsformFormPublication } from "../../../api/client";
import { getFormWorkflowView } from "./formWorkflowView";

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

const actors = [
  { actor_key: "docentes_acreditacion", actor: "Docentes" },
  { actor_key: "estudiantes_pregrado", actor: "Estudiantes" },
];

const revision = {
  schema: "instrument_revision/v1",
  revision_id: "revision-docentes-2",
  form_id: "form-docentes",
  revision_no: 2,
  content_sha256: "published-hash",
  xlsform_file_id: "xlsform-docentes-2",
  published_at: "2026-07-21T12:00:00Z",
};

describe("getFormWorkflowView", () => {
  test("prioritizes reviewing pending logic over publishing", () => {
    const view = getFormWorkflowView(publication({
      status: "blocked",
      blockers: [{
        id: "logic_pending_manual_confirmation",
        title: "Lógica pendiente de confirmación",
        detail: "Revisa los saltos importados.",
      }],
      can_publish: false,
    }), actors, "docentes_acreditacion");

    expect(view.primaryAction).toBe("review_logic");
    expect(view.logic.label).toMatch(/revis/i);
    expect(view.logic).toMatchObject({
      label: expect.any(String),
      tone: expect.any(String),
      detail: expect.any(String),
    });
  });

  test.each([null, "", "actor_que_ya_no_existe"])(
    "asks for a valid audience before publication when actor is %s",
    (actorKey) => {
      const view = getFormWorkflowView(publication(), actors, actorKey);

      expect(view.primaryAction).toBe("assign_audience");
      expect(view.audience.label).toMatch(/sin (público|asignar)|elige/i);
      expect(view.processing.label).toBe("Aún no disponible");
      expect([
        view.logic.label,
        view.logic.detail,
        view.audience.label,
        view.audience.detail,
        view.processing.label,
        view.processing.detail,
      ].join(" ")).not.toContain("actor_que_ya_no_existe");
    },
  );

  test("uses the human actor name and never exposes its technical key", () => {
    const view = getFormWorkflowView(
      publication(),
      actors,
      "docentes_acreditacion",
    );

    expect(view.primaryAction).toBe("publish");
    expect(view.audience.label).toContain("Docentes");
    expect([
      view.logic.label,
      view.logic.detail,
      view.audience.label,
      view.audience.detail,
      view.processing.label,
      view.processing.detail,
    ].join(" ")).not.toContain("docentes_acreditacion");
    expect(view.audience).toMatchObject({
      label: expect.any(String),
      tone: expect.any(String),
      detail: expect.any(String),
    });
  });

  test("a published revision remains available to processing", () => {
    const view = getFormWorkflowView(publication({
      status: "published",
      latest_revision: revision,
      can_publish: false,
      can_delete: false,
    }), actors, "docentes_acreditacion");

    expect(view.primaryAction).toBe("open");
    expect(view.processing.label).toBe("Disponible · revisión 2");
  });

  test("pending changes preserve the currently available revision", () => {
    const view = getFormWorkflowView(publication({
      status: "changes_pending",
      latest_revision: revision,
    }), actors, "docentes_acreditacion");

    expect(view.primaryAction).toBe("publish");
    expect(view.processing.label).toBe(
      "Revisión 2 disponible; hay cambios sin publicar",
    );
  });

  test("a generic project can publish without an audience catalog", () => {
    const view = getFormWorkflowView(
      publication(),
      [],
      null,
      false,
    );

    expect(view.audience.label).toBe("No requerido");
    expect(view.primaryAction).toBe("publish");
  });
});
