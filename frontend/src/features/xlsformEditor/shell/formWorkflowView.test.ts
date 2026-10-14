import { describe, expect, test } from "vitest";
import type { XlsformFormPublication } from "../../../api/client";
import { getFormWorkflowView, suggestAudienceFromTitle } from "./formWorkflowView";

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
    "el público es opcional: sin él (%s) la acción sigue siendo publicar",
    (actorKey) => {
      // Decisión del usuario (2026-10-14): el público nunca es obligatorio.
      const view = getFormWorkflowView(publication(), actors, actorKey);

      expect(view.primaryAction).toBe("publish");
      expect(view.audience?.label).toBe("Opcional");
      expect(view.audience?.tone).toBe("neutral");
      expect(view.audience?.detail).not.toMatch(/antes de publicar/i);
      expect(view.processing.label).toBe("Aún no disponible");
      expect([
        view.logic.label,
        view.logic.detail,
        view.audience?.label,
        view.audience?.detail,
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
    expect(view.audience?.label).toContain("Docentes");
    expect([
      view.logic.label,
      view.logic.detail,
      view.audience?.label,
      view.audience?.detail,
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
    // Publicada pero sin consumidor: el hito no puede decir "Disponible" como
    // si Procesamiento ya la estuviera usando.
    expect(view.processing.label).toBe("Publicada · revisión 2");
    expect(view.processing.detail).toMatch(/ninguna base la usa todavía/i);
  });

  test("una revisión en uso nombra la base que la consume", () => {
    // El lazo que faltaba: publicar era un acto sin consecuencia observable.
    const view = getFormWorkflowView(publication({
      status: "published",
      latest_revision: revision,
      can_publish: false,
      can_delete: false,
      bound_bases: [{
        base: "default",
        revision_id: "revision-docentes-2",
        revision_no: 2,
        is_latest: true,
      }],
    }), actors, "docentes_acreditacion");

    expect(view.processing.label).toBe("En uso por «default»");
    expect(view.processing.tone).toBe("success");
  });

  test("una base pegada a una revisión anterior queda advertida", () => {
    const view = getFormWorkflowView(publication({
      status: "published",
      latest_revision: revision,
      can_publish: false,
      can_delete: false,
      bound_bases: [{
        base: "docentes",
        revision_id: "revision-docentes-1",
        revision_no: 1,
        is_latest: false,
      }],
    }), actors, "docentes_acreditacion");

    expect(view.processing.tone).toBe("warning");
    expect(view.processing.label).toBe("«docentes» usa una revisión anterior");
    expect(view.processing.detail).toMatch(/revisión 2/);
  });

  test("con varias bases al día resume el conteo y señala la rezagada", () => {
    const view = getFormWorkflowView(publication({
      status: "published",
      latest_revision: revision,
      can_publish: false,
      can_delete: false,
      bound_bases: [
        { base: "docentes", revision_id: "revision-docentes-2", revision_no: 2, is_latest: true },
        { base: "egresados", revision_id: "revision-docentes-2", revision_no: 2, is_latest: true },
        { base: "piloto", revision_id: "revision-docentes-1", revision_no: 1, is_latest: false },
      ],
    }), actors, "docentes_acreditacion");

    expect(view.processing.label).toBe("En uso por 2 bases");
    expect(view.processing.detail).toMatch(/«piloto» sigue con una revisión anterior/);
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

  test("fuera de un estudio con públicos no hay etapa de público", () => {
    const view = getFormWorkflowView(
      publication(),
      [],
      null,
      false,
    );

    expect(view.audience).toBeNull();
    expect(view.primaryAction).toBe("publish");
  });

  test("nunca emite «Elegir público» como acción primaria", () => {
    for (const actorKey of [null, "docentes_acreditacion", "fantasma"]) {
      for (const applies of [true, false]) {
        const view = getFormWorkflowView(publication({ can_publish: false }), actors, actorKey, applies);
        expect(view.primaryAction).not.toBe("assign_audience");
      }
    }
  });

  test("un borrador vacío no es un error: lo marca como tal", () => {
    const vacio = getFormWorkflowView(publication({
      status: "blocked",
      can_publish: false,
      blockers: [
        { id: "no_substantive_questions", title: "Instrumento sin preguntas sustantivas", detail: "" },
        { id: "logic_pending_manual_confirmation", title: "Lógica pendiente", detail: "" },
      ],
    }), actors, null);
    expect(vacio.emptyDraft).toBe(true);

    const conOtroBloqueo = getFormWorkflowView(publication({
      status: "blocked",
      can_publish: false,
      blockers: [
        { id: "no_substantive_questions", title: "Instrumento sin preguntas sustantivas", detail: "" },
        { id: "name-duplicate-p1", title: "Nombre duplicado", detail: "" },
      ],
    }), actors, null);
    expect(conOtroBloqueo.emptyDraft).toBe(false);
  });
});

describe("suggestAudienceFromTitle", () => {
  const catalogo = [
    { actor_key: "estudiantes_pregrado", actor: "Estudiantes" },
    { actor_key: "docentes_acreditacion", actor: "Docentes" },
    { actor_key: "administrativos", actor: "Administrativos" },
    { actor_key: "egresados", actor: "Egresados" },
  ];

  test("lee el público del título si existe en el catálogo", () => {
    expect(suggestAudienceFromTitle("Acreditación Arte y Diseño PUCP - Estudiantes", catalogo)?.actor_key)
      .toBe("estudiantes_pregrado");
    expect(suggestAudienceFromTitle("Copia de Acreditación - Egresados Personalizado", catalogo)?.actor_key)
      .toBe("egresados");
    expect(suggestAudienceFromTitle("ADMINISTRATIVOS 2026", catalogo)?.actor_key).toBe("administrativos");
  });

  test("no sugiere si el título no nombra ninguno, nombra dos o el catálogo no lo tiene", () => {
    expect(suggestAudienceFromTitle("Nuevo formulario", catalogo)).toBeNull();
    expect(suggestAudienceFromTitle("Docentes y estudiantes", catalogo)).toBeNull();
    expect(suggestAudienceFromTitle("Estudiantes", [{ actor_key: "docentes", actor: "Docentes" }])).toBeNull();
  });
});

describe("getFormWorkflowView con la lógica hecha fuera", () => {
  const externa = { herramienta: "SPSS", nota: "", declaradaEn: "2026-10-14" };

  test("etapa neutra con el programa y publicar como acción", () => {
    const view = getFormWorkflowView(publication(), [], null, false, externa);
    expect(view.logic).toMatchObject({ label: "Fuera de Prosecnur · SPSS", tone: "neutral" });
    expect(view.logic.detail).toContain("la base limpia se carga en Procesamiento");
    expect(view.primaryAction).toBe("publish");
  });

  test("manda sobre un bloqueo de lógica de una publicación anterior", () => {
    const view = getFormWorkflowView(publication({
      status: "blocked",
      blockers: [{ id: "logic_pending_manual_confirmation", title: "Lógica", detail: "" }],
      can_publish: false,
    }), [], null, false, externa);
    expect(view.primaryAction).not.toBe("review_logic");
    expect(view.logic.tone).toBe("neutral");
  });
});

