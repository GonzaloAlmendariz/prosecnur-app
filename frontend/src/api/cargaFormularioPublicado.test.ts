import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiCargaFormularioPublicadoImportar,
  apiCargaFormularioPublicadoVistaPrevia,
  apiCargaFormulariosPublicados,
  normalizeFormulariosPublicados,
  normalizeImportarRespuesta,
  normalizeVistaPreviaFormularioPublicado,
} from "./cargaFormularioPublicado";

const fetchMock = vi.hoisted(() => vi.fn<(input: string, init?: RequestInit) => Promise<Response>>());

vi.mock("./core", () => ({
  apiFetch: fetchMock,
  headers: (extra: Record<string, string> = {}) => extra,
  handle: async (res: Response) => res.json(),
}));

function responde(body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
}

// Forma en que R serializa: escalares de largo uno, lista de uno como objeto suelto, NULL como {}.
const CATALOGO_R = {
  ok: [true],
  formularios: [
    {
      form_id: ["f1"],
      form_name: ["Estudiantes Arte 2026"],
      revision_id: ["rev-3"],
      revision_no: [3],
      published_at: ["2026-10-14T10:00:00Z"],
      survey_id: ["5001"],
      campanas: { survey_id: ["5002"], titulo: ["Correo"] },
      logic_status: ["external_declared"],
      logic_external: [true],
      n_campos: [42],
    },
    { form_id: ["f2"], form_name: ["Docentes"], revision_id: ["rev-9"], revision_no: [1], campanas: {}, logic_status: ["app"], n_campos: [10] },
    { form_id: ["f3"], form_name: ["Sin revisión"] },
  ],
};

describe("normalizeFormulariosPublicados", () => {
  it("lee el catálogo con la forma de R y descarta lo que no trae revisión", () => {
    const out = normalizeFormulariosPublicados(CATALOGO_R);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      form_name: "Estudiantes Arte 2026",
      revision_id: "rev-3",
      revision_no: 3,
      survey_id: "5001",
      campanas: [{ survey_id: "5002", titulo: "Correo" }],
      logic_external: true,
      n_campos: 42,
    });
    expect(out[1]).toMatchObject({ revision_id: "rev-9", campanas: [], logic_external: false, survey_id: "" });
  });

  it("un solo formulario desenrollado como objeto también cuenta", () => {
    const out = normalizeFormulariosPublicados({ formularios: { form_name: "Uno", revision_id: "r1", logic_status: "external_declared" } });
    expect(out).toHaveLength(1);
    expect(out[0].logic_external).toBe(true);
  });

  it("sin formularios o con {} queda vacío", () => {
    expect(normalizeFormulariosPublicados({ ok: true, formularios: {} })).toEqual([]);
    expect(normalizeFormulariosPublicados(null)).toEqual([]);
  });
});

describe("normalizeVistaPreviaFormularioPublicado", () => {
  it("separa código y etiqueta en las recodificaciones y lee bloqueo {} como nulo", () => {
    const vp = normalizeVistaPreviaFormularioPublicado({
      ok: [true],
      n_filas: [120],
      fuentes: { tipo: ["sav"], titulo: ["arte.sav"], n_filas: [120] },
      n_emparejadas: [38],
      n_variables_instrumento: [42],
      cobertura: [0.905],
      cobertura_texto: ["38 de 42 variables calzan"],
      sin_par_instrumento: [{ variable: ["p40"], etiqueta: ["Comentario"] }],
      sin_par_fuente: { variable: ["q0099"], etiqueta: ["Respondent ID"] },
      recodificaciones: [{ variable: ["p10_1"], etiqueta: ["SIN INF"], desde: [5], hacia: [99] }],
      opciones_sin_par: [{ variable: ["p12"], n: [3], etiquetas: { etiqueta: ["No binario"], n: [3] } }, { variable: ["p13"], n: [0] }],
      bloqueo: {},
    });
    expect(vp.recodificaciones).toEqual([{ variable: "p10_1", etiqueta: "SIN INF", desde: "5", hacia: "99" }]);
    expect(vp.fuentes).toHaveLength(1);
    expect(vp.sin_par_fuente).toEqual([{ variable: "q0099", etiqueta: "Respondent ID" }]);
    expect(vp.opciones_sin_par).toEqual([{ variable: "p12", n: 3, etiquetas: [{ etiqueta: "No binario", n: 3 }] }]);
    expect(vp.cobertura).toBeCloseTo(0.905);
    expect(vp.bloqueo).toBeNull();
  });

  it("deduce la cobertura si no viene y tolera porcentajes", () => {
    expect(normalizeVistaPreviaFormularioPublicado({ n_emparejadas: 3, n_variables_instrumento: 4 }).cobertura).toBe(0.75);
    expect(normalizeVistaPreviaFormularioPublicado({ cobertura: 62 }).cobertura).toBeCloseTo(0.62);
  });

  it("conserva el bloqueo con su mensaje", () => {
    const vp = normalizeVistaPreviaFormularioPublicado({ bloqueo: { codigo: ["E_FUENTE_NO_CALZA"], mensaje: ["Esa base no es de este formulario"] } });
    expect(vp.bloqueo).toEqual({ codigo: "E_FUENTE_NO_CALZA", mensaje: "Esa base no es de este formulario" });
  });
});

describe("normalizeImportarRespuesta", () => {
  it("distingue el job de SurveyMonkey del resultado inmediato", () => {
    expect(normalizeImportarRespuesta({ job_id: ["j-1"] })).toEqual({ tipo: "job", job_id: "j-1" });
    expect(normalizeImportarRespuesta({ ok: [true], base_name: ["arte"], n_filas: [120], n_columnas: [44], instrument_revision_id: ["rev-3"], origen_declarado: [true] }))
      .toEqual({ tipo: "listo", resultado: { base_name: "arte", n_filas: 120, n_columnas: 44, instrument_revision_id: "rev-3", origen_declarado: true } });
  });
});

describe("llamadas", () => {
  beforeEach(() => fetchMock.mockReset());

  it("pide el catálogo por GET", async () => {
    responde(CATALOGO_R);
    const out = await apiCargaFormulariosPublicados();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/carga/formularios-publicados");
    expect(out).toHaveLength(2);
  });

  it("la vista previa de SurveyMonkey no manda file_id y sí las campañas", async () => {
    responde({ n_emparejadas: 1, n_variables_instrumento: 1 });
    await apiCargaFormularioPublicadoVistaPrevia({ revision_id: "rev-3", fuente: "surveymonkey", incluir_campanas: true, file_id: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/carga/formulario-publicado/vista-previa");
    expect(JSON.parse(String(init?.body))).toEqual({ revision_id: "rev-3", fuente: "surveymonkey", incluir_campanas: true });
  });

  it("un .sav sin archivo subido no llega al backend", async () => {
    await expect(apiCargaFormularioPublicadoVistaPrevia({ revision_id: "rev-3", fuente: "sav" })).rejects.toThrow(/Sube primero/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("importar manda el nombre de la base y el file_id", async () => {
    responde({ ok: true, base_name: "arte", instrument_revision_id: "rev-3" });
    const r = await apiCargaFormularioPublicadoImportar({ revision_id: "rev-3", fuente: "excel", file_id: "f-9", base_name: " arte " });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ revision_id: "rev-3", fuente: "excel", file_id: "f-9", base_name: "arte" });
    expect(r.tipo).toBe("listo");
  });
});
