// H9: `sm-fetch-survey-info` trae lo que no entra al formulario y el resumen
// previo al import lo muestra.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiXlsformEditorSmFetchSurveyInfo } from "./multiIntegrado";
import { FinalImportReviewModal } from "../features/xlsformEditor/shell/SmImportResumen";

const DETALLE = "La variable personalizada «id» no es una pregunta: llega en los datos como la columna «cv_id» (metadato).";

function respuesta(extra: Record<string, unknown>) {
  return new Response(JSON.stringify({
    ok: true,
    paginas: {},
    pages: [],
    summary: { title: "Arte", language: "es", n_paginas: 0, n_preguntas: 0, n_required: 0, n_validation: 0 },
    style: { prefix: "p", pad: 0 },
    definition: null,
    ...extra,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sm-fetch-survey-info → fuera_del_formulario", () => {
  test("normaliza la lista y la entrega al resumen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({
      fuera_del_formulario: [{ tipo: "variable_personalizada", nombre: "id", detalle: DETALLE }],
    })));
    const info = await apiXlsformEditorSmFetchSurveyInfo(null, "1");
    expect(info.fuera_del_formulario).toEqual([{ tipo: "variable_personalizada", nombre: "id", detalle: DETALLE }]);

    const html = renderToStaticMarkup(
      <FinalImportReviewModal
        surveyId="1"
        sectionCount={1}
        questionCount={1}
        fieldCount={1}
        visualRuleCount={0}
        advancedRuleCount={0}
        overrideCount={0}
        fueraDelFormulario={info.fuera_del_formulario}
        checked={false}
        submitting={false}
        onCheckedChange={() => undefined}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(html).toContain("No entra al formulario");
    expect(html).toContain("«cv_id» (metadato)");
  });

  test("objeto suelto (auto_unbox) y ausencia", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({
      fuera_del_formulario: { tipo: "imagen", nombre: "Página 2", detalle: "La imagen de la página 2 no se importa." },
    })));
    expect((await apiXlsformEditorSmFetchSurveyInfo(null, "1")).fuera_del_formulario).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({})));
    expect((await apiXlsformEditorSmFetchSurveyInfo(null, "1")).fuera_del_formulario).toEqual([]);
  });
});
