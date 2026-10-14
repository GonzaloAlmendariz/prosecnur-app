import { renderToStaticMarkup } from "react-dom/server";
import * as Dialog from "@radix-ui/react-dialog";
import { describe, expect, test, vi } from "vitest";
import type { XlsformFormPublication } from "../../../api/client";
import { FormCard } from "./FormCard";
import { FormularioLogicaExterna, LogicaExternaDeshacer, LogicaExternaDisparador } from "./LogicaExterna";
import type { AccionesLogicaExterna } from "./useLogicaExterna";

function acciones(enCursoId: string | null = null): AccionesLogicaExterna {
  return { enCursoId, abrirPara: vi.fn(), declarar: vi.fn(async () => true), retirar: vi.fn(async () => true) };
}

function publication(overrides: Partial<XlsformFormPublication> = {}): XlsformFormPublication {
  return {
    status: "draft",
    draft_content_sha256: "h",
    latest_revision: null,
    blockers: [],
    warnings: [],
    bound_bases: [],
    can_publish: true,
    can_delete: true,
    ...overrides,
  };
}

const PENDIENTE = publication({
  status: "blocked",
  blockers: [{ id: "logic_pending_manual_confirmation", title: "Lógica pendiente", detail: "" }],
  can_publish: false,
});

function card(pub: XlsformFormPublication, source: Record<string, unknown>, conAcciones = true): string {
  return renderToStaticMarkup(
    <FormCard
      entry={{ id: "f-1", name: "Arte al día", savedAt: Date.now(), source: { kind: "surveymonkey", original_name: "Arte", ...source } }}
      metrics={{ questions: 12, sections: 2 }}
      isActive={false}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      publication={pub}
      isPublishing={false}
      isConfirmingLogic={false}
      onPublish={vi.fn()}
      onConfirmLogic={vi.fn()}
      actorOptions={[]}
      onActorChange={vi.fn()}
      logicaExterna={conAcciones ? acciones() : undefined}
    />,
  );
}

describe("diálogo «se hizo fuera»", () => {
  test("programa con sugerencias, nota opcional, consecuencia y botón de declarar", () => {
    const html = renderToStaticMarkup(
      <Dialog.Root open>
        <FormularioLogicaExterna formId="f-1" formName="Arte al día" control={{ ...acciones(), cerrar: vi.fn() }} />
      </Dialog.Root>,
    );
    expect(html).toContain("La lógica y la limpieza se hicieron fuera");
    expect(html).toContain(">Programa</label>");
    for (const p of ["SPSS", "R", "Stata", "Excel"]) expect(html).toContain(`aria-pressed="false">${p}</button>`);
    expect(html).toContain("opcional");
    expect(html).toContain("Prosecnur no aplicará reglas de salto ni de limpieza a este formulario; la base limpia se carga en Procesamiento.");
    expect(html).toContain(">Declarar y continuar<");
    expect(html).toContain("Arte al día");
    expect(html).not.toContain('role="alert"');
  });

  test("en vuelo: «Guardando…» y controles deshabilitados", () => {
    const html = renderToStaticMarkup(
      <Dialog.Root open>
        <FormularioLogicaExterna formId="f-1" formName={null} control={{ ...acciones("f-1"), cerrar: vi.fn() }} />
      </Dialog.Root>,
    );
    expect(html).toContain("Guardando…");
    expect(html).toContain('aria-busy="true"');
  });
});

describe("piezas sueltas", () => {
  test("disparador: nombre accesible completo y abre un diálogo", () => {
    const html = renderToStaticMarkup(<LogicaExternaDisparador formId="f-1" acciones={acciones()} />);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-label="La lógica y la limpieza se hicieron fuera de Prosecnur (p. ej., SPSS)"');
    expect(html).toContain(">Se hizo fuera (p. ej., SPSS)<");
  });

  test("deshacer: discreto, sin confirmar todavía", () => {
    const html = renderToStaticMarkup(<LogicaExternaDeshacer formId="f-1" acciones={acciones()} />);
    expect(html).toContain(">Deshacer<");
    expect(html).not.toContain("Confirmar deshacer");
  });
});

describe("tarjeta", () => {
  test("lógica pendiente: «Revisar lógica» y la segunda vía, lado a lado", () => {
    const html = card(PENDIENTE, { logic_status: "pending_manual_confirmation" });
    expect(html).toContain(">Revisar lógica<");
    expect(html).toContain(">Se hizo fuera (p. ej., SPSS)<");
  });

  test("sin acciones conectadas no se ofrece la segunda vía", () => {
    expect(card(PENDIENTE, { logic_status: "pending_manual_confirmation" }, false)).not.toContain("Se hizo fuera");
  });

  test("declarada: etapa neutra con el programa, «Publicar» habilitado y «Deshacer»", () => {
    const html = card(publication(), {
      logic_status: "external_declared",
      logic_confirmed_at: "2026-10-14",
      logic_external: { herramienta: "SPSS", nota: "", declarada_en: "2026-10-14" },
    });
    expect(html).toContain('pulso-xf-home-card-stage is-neutral');
    expect(html).toContain("Fuera de Prosecnur · SPSS");
    expect(html).not.toContain("Revisión necesaria");
    expect(html).not.toContain("Revisa la lógica");
    expect(html).toMatch(/<button[^>]*class="pulso-xf-publication-action"[^>]*>Publicar</);
    expect(html).not.toMatch(/class="pulso-xf-publication-action"[^>]*disabled/);
    expect(html).toContain(">Deshacer<");
    expect(html).not.toContain("Se hizo fuera");
  });
});
