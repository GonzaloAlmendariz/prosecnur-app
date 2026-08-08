import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { XlsformFormPublication } from "../../../api/client";
import { FormCard } from "./FormCard";

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

function renderCard(
  publicationState: XlsformFormPublication = publication(),
  options: {
    actorOptions?: Array<{ actor_key: string; actor: string }>;
    actorKey?: string | null;
    actorCatalogStatus?: "loading" | "ready" | "empty" | "error";
  } = {},
): string {
  return renderToStaticMarkup(
    <FormCard
      entry={{
        id: "form-docentes",
        name: "Encuesta docentes",
        savedAt: Date.now(),
        source: {
          kind: "surveymonkey",
          original_name: "Docentes",
          actor_key: options.actorKey === undefined ? "docentes" : options.actorKey,
        },
      }}
      metrics={{ questions: 10, sections: 2 }}
      isActive={false}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      publication={publicationState}
      isPublishing={false}
      isConfirmingLogic={false}
      onPublish={vi.fn()}
      onConfirmLogic={vi.fn()}
      actorOptions={options.actorOptions ?? [{ actor_key: "docentes", actor: "Docentes" }]}
      actorCatalogStatus={options.actorCatalogStatus}
      onActorChange={vi.fn()}
    />,
  );
}

describe("FormCard workflow", () => {
  test("communicates logic, audience and processing with human-facing names", () => {
    const markup = renderCard(publication({
      status: "published",
      latest_revision: {
        schema: "instrument_revision/v1",
        revision_id: "rev-1",
        form_id: "form-docentes",
        revision_no: 1,
        content_sha256: "draft-hash",
        xlsform_file_id: "file-1",
        published_at: "2026-07-21T12:00:00Z",
      },
      can_publish: false,
      can_delete: false,
    }));

    expect(markup).toContain("Lógica");
    expect(markup).toContain("Público");
    expect(markup).toContain("Procesamiento");
    expect(markup).toContain("Docentes");
    expect(markup).not.toContain("Docentes · docentes");
    expect(markup).not.toContain("actor_key");
  });

  test("a logic blocker offers review instead of direct confirmation", () => {
    const markup = renderCard(publication({
      status: "blocked",
      blockers: [{
        id: "logic_pending_manual_confirmation",
        title: "Lógica pendiente de confirmación",
        detail: "Revisa la lógica importada antes de publicar.",
      }],
      can_publish: false,
    }));

    expect(markup).toContain("Abrir y revisar lógica");
    expect(markup).not.toContain("Confirmar lógica revisada");
  });

  test("uses article semantics and names the card actions accessibly", () => {
    const markup = renderCard();

    expect(markup).toMatch(/<article\b/);
    expect(markup).toMatch(/aria-label="Acciones [^"]*Encuesta docentes"/);
    expect(markup).toMatch(/aria-label="Abrir [^"]*Encuesta docentes"/);
  });

  test("un bloqueo estructural lista todo y deja una salida", () => {
    // Antes, un bloqueo que no era de lógica ni de público dejaba
    // `primaryAction = "open"` con `actionLabel = null`: la tarjeta quedaba en
    // rojo, citando solo el primer blocker, y sin un solo control que tocar.
    const markup = renderCard(publication({
      status: "blocked",
      can_publish: false,
      blockers: [
        { id: "name-duplicate-p1", title: "Nombre duplicado", detail: "p1 se usa en 2 filas", rowIndex: 4 },
        { id: "settings-form-id-empty", title: "Formulario sin ID", detail: "Define un form_id" },
      ],
    }));

    expect(markup).toContain("Faltan 2 correcciones para publicar");
    expect(markup).toContain("Nombre duplicado");
    expect(markup).toContain("Formulario sin ID");
    expect(markup).toContain("Abrir y corregir");
  });

  test("keeps Publish available for a generic form without an audience catalog", () => {
    const markup = renderCard(publication(), {
      actorOptions: [],
      actorKey: null,
      actorCatalogStatus: "empty",
    });

    expect(markup).toContain("No requerido");
    expect(markup).toContain(">Publicar<");
    expect(markup).not.toContain("Público del instrumento");
  });
});
