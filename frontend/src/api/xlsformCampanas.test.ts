import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  apiCampanaDeclarar,
  apiCampanaQuitar,
  apiCampanaSugerir,
  apiCampanaVistaPrevia,
  campanasDeFuente,
  normalizeCampanaDeclarada,
  normalizeCampanaSugerencia,
  normalizeCampanaVistaPrevia,
} from "./xlsformCampanas";

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => { store.clear(); }),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const CAMPANA_ARTE = {
  schema: "survey_campaign/v1",
  rol: "campana_complementaria",
  survey_id: "423593924",
  survey_title: "Acreditación Arte y Diseño PUCP a Estudiantes",
  n_emparejadas: 73,
  n_preguntas_base: 74,
  cobertura: 0.986,
  sin_par_base: [{ variable: "p4", etiqueta: "¿Cuál es su código PUCP?" }],
  declarada_en: "2026-10-14T12:00:00Z",
  review_status: "confirmed",
};

describe("normalizadores de campañas (ADR 0101)", () => {
  test("lee la vista previa con escalares de largo uno, como los manda R", () => {
    const vista = normalizeCampanaVistaPrevia({
      ok: [true],
      survey_id: ["423593924"],
      titulo: ["Estudiantes por correo"],
      n_emparejadas: [73],
      n_preguntas_base: [74],
      cobertura: [0.986],
      cobertura_texto: ["98.6 %"],
      instrumento_distinto: [false],
      faltan: { variable: "p4", etiqueta: "¿Cuál es su código PUCP?" },
      extra: [],
      ambiguas: [],
    });
    expect(vista).toMatchObject({
      survey_id: "423593924",
      titulo: "Estudiantes por correo",
      n_emparejadas: 73,
      n_preguntas_base: 74,
      cobertura: 0.986,
      cobertura_texto: "98.6 %",
      instrumento_distinto: false,
    });
    // Un único objeto desenrollado por R sigue siendo una lista de uno.
    expect(vista.faltan).toEqual([{ variable: "p4", etiqueta: "¿Cuál es su código PUCP?" }]);
    expect(vista.extra).toEqual([]);
  });

  test("sin cobertura del servidor la deriva de los conteos; un payload vacío no revienta", () => {
    expect(normalizeCampanaVistaPrevia({ n_emparejadas: 1, n_preguntas_base: 4 }).cobertura).toBe(0.25);
    const vacia = normalizeCampanaVistaPrevia(null);
    expect(vacia).toMatchObject({ n_emparejadas: 0, n_preguntas_base: 0, cobertura: null, instrumento_distinto: false });
  });

  test("la sugerencia nula o sin formulario es «no hay sugerencia»", () => {
    expect(normalizeCampanaSugerencia(null)).toBeNull();
    expect(normalizeCampanaSugerencia({ form_name: "Estudiantes" })).toBeNull();
    expect(normalizeCampanaSugerencia({
      form_id: ["f-1"],
      form_name: ["Estudiantes"],
      survey_id_principal: ["528294775"],
      cobertura: [0.986],
      cobertura_texto: ["98.6 %"],
      n_emparejadas: [73],
      n_preguntas_base: [74],
    })).toEqual({
      form_id: "f-1",
      form_name: "Estudiantes",
      survey_id_principal: "528294775",
      cobertura: 0.986,
      cobertura_texto: "98.6 %",
      n_emparejadas: 73,
      n_preguntas_base: 74,
    });
  });

  test("sólo las variantes con rol de campaña son campañas, sin repetidas", () => {
    expect(normalizeCampanaDeclarada({ survey_id: "1", review_status: "confirmed" })).toBeNull();
    const campanas = campanasDeFuente({
      kind: "surveymonkey",
      original_name: "Estudiantes",
      survey_id: "528294775",
      variants: [
        CAMPANA_ARTE,
        { ...CAMPANA_ARTE, survey_title: "repetida" },
        { survey_id: "999", variant_map_draft: [] },
      ],
    });
    expect(campanas).toHaveLength(1);
    expect(campanas[0]).toMatchObject({
      survey_id: "423593924",
      survey_title: "Acreditación Arte y Diseño PUCP a Estudiantes",
      n_emparejadas: 73,
      n_preguntas_base: 74,
      cobertura: 0.986,
    });
    expect(campanas[0].sin_par_base).toEqual([{ variable: "p4", etiqueta: "¿Cuál es su código PUCP?" }]);
    expect(campanasDeFuente(null)).toEqual([]);
  });
});

describe("endpoints de campañas", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("usa las rutas, métodos y cuerpos del contrato", async () => {
    const llamadas: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      llamadas.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("/vista-previa")) return json({ ok: true, survey_id: "423593924", n_emparejadas: 73, n_preguntas_base: 74 });
      if (url.endsWith("/sugerir")) return json({ ok: true, sugerencia: null });
      return json({
        ok: true,
        form: { id: "f 1", name: "Estudiantes", source: { kind: "surveymonkey", survey_id: "528294775", variants: [CAMPANA_ARTE] } },
        campana: CAMPANA_ARTE,
      });
    }));

    await apiCampanaVistaPrevia("f 1", "423593924");
    const declarada = await apiCampanaDeclarar("f 1", "423593924");
    await apiCampanaQuitar("f 1", "423593924");
    const sugerencia = await apiCampanaSugerir("423593924");

    expect(llamadas.map(({ url, method }) => `${method} ${url}`)).toEqual([
      "POST /api/xlsform-editor/forms/f%201/campanas/vista-previa",
      "POST /api/xlsform-editor/forms/f%201/campanas",
      "DELETE /api/xlsform-editor/forms/f%201/campanas/423593924",
      "POST /api/xlsform-editor/campanas/sugerir",
    ]);
    expect(llamadas[0].body).toEqual({ survey_id: "423593924" });
    expect(llamadas[2].body).toBeNull();
    expect(declarada.campana?.survey_id).toBe("423593924");
    expect(declarada.form?.id).toBe("f 1");
    expect(campanasDeFuente(declarada.form?.source)).toHaveLength(1);
    expect(sugerencia).toBeNull();
  });

  test("un 409 llega con el mensaje del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      error: { code: "E_CAMPANA_REPETIDA", message: "Esa encuesta ya está declarada como campaña de este formulario." },
    }, 409)));
    await expect(apiCampanaDeclarar("f-1", "423593924")).rejects.toThrow(/ya está declarada/);
  });
});
