import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../../../api/estudio";
import {
  CAUSA_SIN_OTRA_FUENTE,
  baseDelInspector,
  baseEnfocada,
  cifrasDeLaColeccion,
  coleccionDeUnaBase,
  coleccionDelEstudio,
  descripcionDeRelacion,
  esIdentificador,
  estadoDeCarga,
  etiquetaDeBase,
  identificadorLegible,
  formularioDeBase,
  origenDeCarga,
  reemplazaArchivosDe,
  recibeNuevaVersionDe,
  rotuloRespuestas,
  textoDeRelacion,
} from "./basesModel";

function base(nombre: string, cambios: Partial<EstudioBase> = {}): EstudioBase {
  return {
    nombre,
    xlsform_file_id: `x-${nombre}`,
    xlsform_file_name: `${nombre}.xlsx`,
    data_file_id: `d-${nombre}`,
    data_file_name: `${nombre}-respuestas.xlsx`,
    data_ext: "xlsx",
    n_filas: 421,
    n_columnas: 141,
    added_at: "2026-01-02T00:00:00Z",
    source_kind: "manual",
    ...cambios,
  };
}

describe("origenDeCarga", () => {
  it("nombra cada origen como lo ve el usuario y no inventa uno para lo que no reconoce", () => {
    expect(origenDeCarga({ source_kind: "manual" })).toBe("Archivos");
    expect(origenDeCarga({ source_kind: null })).toBe("Archivos");
    expect(origenDeCarga({ source_kind: "NA" })).toBe("Archivos");
    expect(origenDeCarga({ source_kind: "surveymonkey" })).toBe("SurveyMonkey");
    expect(origenDeCarga({ source_kind: "surveymonkey_workbook" })).toBe("SurveyMonkey");
    expect(origenDeCarga({ source_kind: "kobo_api" })).toBe("KoboToolbox");
    expect(origenDeCarga({ source_kind: "monitoreo_territorial" })).toBe("Monitoreo");
    expect(origenDeCarga({ source_kind: "formulario_publicado_sav" })).toBe("Formulario publicado");
    expect(origenDeCarga({ source_kind: "matriz_pulso" })).toBe("Otro origen");
  });
});

describe("coleccionDelEstudio", () => {
  it("anida la hija de grupo repetido en su madre y no la cuenta como base", () => {
    const c = coleccionDelEstudio({
      bases: {
        hogares: base("hogares", { source_kind: "kobo" }),
        miembros: base("miembros", { source_kind: "kobo_repeat", parent_base: "hogares", n_filas: 900 }),
      },
    });
    expect(c.nBases).toBe(1);
    expect(c.nGruposRepetidos).toBe(1);
    expect(c.bases.map((b) => b.nombre)).toEqual(["hogares"]);
    expect(c.bases[0].hijas).toEqual([{ nombre: "miembros", etiqueta: "miembros", filas: 900, madre: "hogares", estado: null }]);
  });

  it("una hija cuya madre no está en el estudio no se pierde: queda como tarjeta propia", () => {
    const c = coleccionDelEstudio({ bases: { suelta: base("suelta", { parent_base: "no_existe" }) } });
    expect(c.bases.map((b) => b.nombre)).toEqual(["suelta"]);
    expect(c.nBases).toBe(0);
  });

  it("sigue el orden de la serie y deja al final, en su orden de alta, lo que la serie no nombra", () => {
    const c = coleccionDelEstudio(
      { bases: { b2026: base("b2026"), extra: base("extra"), b2024: base("b2024"), b2025: base("b2025") } },
      ["b2024", "b2025", "b2026"],
    );
    expect(c.bases.map((b) => b.nombre)).toEqual(["b2024", "b2025", "b2026", "extra"]);
  });

  it("solo una base de SurveyMonkey clásica recibe otra fuente; las de archivos reciben versión nueva", () => {
    const c = coleccionDelEstudio({
      bases: {
        sm: base("sm", { source_kind: "surveymonkey" }),
        fp: base("fp", { source_kind: "formulario_publicado_surveymonkey" }),
        arch: base("arch"),
      },
    });
    const por = Object.fromEntries(c.bases.map((b) => [b.nombre, b]));
    expect(por.sm.puedeAgregarFuente).toBe(true);
    expect(por.fp.puedeAgregarFuente).toBe(false);
    expect(por.arch.puedeAgregarFuente).toBe(false);
    expect(por.arch.recibeNuevaVersion).toBe(true);
    expect(por.sm.recibeNuevaVersion).toBe(false);
    expect(CAUSA_SIN_OTRA_FUENTE).toBe("Todavía no se pueden unir más fuentes a una base de este origen.");
  });

  it("lista las fuentes de una base integrada y la columna que las distingue", () => {
    const c = coleccionDelEstudio({
      bases: {
        integrada: base("integrada", {
          multi_integrated: {
            version: 1,
            kind: "manual",
            origin_key_name: "publico",
            origins: [
              { id: "o1", key_value: "docentes", label: "Docentes", data_file_name: "docentes.xlsx" },
              { id: "o2", key_value: "estudiantes", label: "", data_file_name: "estudiantes.xlsx" },
            ],
          },
        }),
      },
    });
    expect(c.bases[0].unidasPor).toBe("publico");
    // Una integrada no recibe "Nueva versión": se rehace desde su asistente.
    expect(c.bases[0].recibeNuevaVersion).toBe(false);
    expect(c.bases[0].fuentes.map((f) => f.titulo)).toEqual(["Docentes", "estudiantes"]);
  });

  it("lista las encuestas de SurveyMonkey unidas en una base, cada una con su vía", () => {
    const c = coleccionDelEstudio({
      bases: {
        docentes: base("docentes", {
          source_kind: "surveymonkey",
          surveymonkey_sources: [
            { survey_id: "1", source_title: "Docentes QR", channel: "QR en aula" },
            { survey_id: "2", source_title: "Docentes correo", channel: "correo" },
          ],
        }),
      },
    });
    expect(c.bases[0].fuentes.map((f) => [f.titulo, f.canal])).toEqual([["Docentes QR", "QR en aula"], ["Docentes correo", "correo"]]);
  });

  it("dice qué le falta a una base sin respuestas", () => {
    const c = coleccionDelEstudio({ bases: { nueva: base("nueva", { data_file_id: "" }) } });
    expect(c.bases[0].falta).toBe("respuestas");
  });
});

describe("coleccionDeUnaBase", () => {
  const sinNada = { tieneFormulario: false, tieneRespuestas: false, registrada: null, respuestasSubidas: null, columnasSubidas: null };

  it("sin formulario ni respuestas no hay tarjeta", () => {
    expect(coleccionDeUnaBase(sinNada)).toEqual({ bases: [], nBases: 0, nGruposRepetidos: 0 });
  });

  it("con solo el formulario la tarjeta dice que faltan las respuestas", () => {
    const c = coleccionDeUnaBase({ ...sinNada, tieneFormulario: true });
    expect(c.bases).toHaveLength(1);
    expect(c.bases[0]).toMatchObject({ nombre: "default", etiqueta: "Base única", falta: "respuestas", enEstudio: false });
  });

  it("con la base registrada toma su origen y su cifra; la subida de esta sesión manda sobre lo leído", () => {
    const registrada = base("default", { source_kind: "surveymonkey", n_filas: 300 });
    const leida = coleccionDeUnaBase({ ...sinNada, tieneFormulario: true, tieneRespuestas: true, registrada });
    expect(leida.bases[0]).toMatchObject({ etiqueta: "Base única", origen: "SurveyMonkey", respuestas: 300, falta: null, puedeAgregarFuente: false });
    const subida = coleccionDeUnaBase({ ...sinNada, tieneFormulario: true, tieneRespuestas: true, registrada, respuestasSubidas: 421 });
    expect(subida.bases[0].respuestas).toBe(421);
  });
});

describe("baseEnfocada", () => {
  const c = coleccionDelEstudio({
    bases: {
      hogares: base("hogares"),
      miembros: base("miembros", { source_kind: "kobo_repeat", parent_base: "hogares" }),
    },
  });

  it("encuentra la base o la hija que nombra el foco", () => {
    expect(baseEnfocada(c, "hogares")).toMatchObject({ base: { nombre: "hogares" }, hija: null });
    expect(baseEnfocada(c, "miembros")).toMatchObject({ base: { nombre: "hogares" }, hija: { nombre: "miembros" } });
  });

  it("un foco que no es una base no abre nada", () => {
    expect(baseEnfocada(c, "docentes~estudiantes")).toBeNull();
    expect(baseEnfocada(c, null)).toBeNull();
    expect(baseEnfocada(c, " ")).toBeNull();
  });
});

describe("textos", () => {
  it("concuerda la cifra de la tarjeta con su número", () => {
    expect(rotuloRespuestas(1)).toBe("respuesta");
    expect(rotuloRespuestas(421)).toBe("respuestas");
    expect(rotuloRespuestas(0)).toBe("respuestas");
  });

  it("dice la relación entre las bases en una línea", () => {
    const una = { mode: "single" as const, strategy: null };
    const varias = (strategy: "separate" | "integrated" | "independent" | null) => ({ mode: "multi" as const, strategy });
    expect(textoDeRelacion(una, null)).toBe("Una base");
    expect(textoDeRelacion({ mode: "undecided", strategy: null }, null)).toBe("Una base");
    expect(textoDeRelacion(varias("separate"), null)).toBe("Bases separadas");
    expect(textoDeRelacion(varias("integrated"), null)).toBe("Una base con varias fuentes");
    expect(textoDeRelacion(varias("independent"), null)).toBe("Bases independientes");
    expect(textoDeRelacion(varias(null), "multi")).toBe("Varias bases, falta decidir cómo se relacionan");
    // La intención elegida, todavía sin estudio, ya se dice.
    expect(textoDeRelacion({ mode: "multi", strategy: null }, "integrated")).toBe("Una base con varias fuentes");
  });

  it("cada relación tiene su frase, y la de una base dice cómo se agrega otra", () => {
    for (const r of ["Una base", "Bases separadas", "Una base con varias fuentes", "Bases independientes", "Varias bases, falta decidir cómo se relacionan"]) {
      expect(descripcionDeRelacion(r).length).toBeGreaterThan(0);
    }
    expect(descripcionDeRelacion("Una base")).toBe("Un formulario y sus respuestas. Al agregar otra base se elige cómo se relacionan.");
    expect(descripcionDeRelacion("Bases separadas")).not.toBe(descripcionDeRelacion("Bases independientes"));
  });
});

describe("alcance de HEAD para cambiar respuestas y archivos", () => {
  it.each([
    ["manual", true],
    [null, true],
    ["NA", true],
    ["local", true],
    ["existing_project", true],
    ["formulario_publicado_excel", true],
    ["surveymonkey_workbook", true],
    ["surveymonkey_sav_bundle", true],
    ["monitoreo_kobo", true],
    ["monitoreo_territorial", true],
    ["matriz_pulso", true],
    ["surveymonkey", false],
    ["formulario_publicado_surveymonkey", false],
    ["formulario_publicado_sav", false],
    ["kobo", false],
    ["kobo_api", false],
    ["kobo_repeat", false],
  ] as const)("Nueva versión de respuestas con source_kind %s: %s", (sourceKind, esperado) => {
    expect(recibeNuevaVersionDe(sourceKind)).toBe(esperado);
  });

  it("Reemplazar archivos solo en bases de archivos sin integrar ni grupo repetido", () => {
    expect(reemplazaArchivosDe({ source_kind: "manual" })).toBe(true);
    expect(reemplazaArchivosDe({ source_kind: null })).toBe(true);
    expect(reemplazaArchivosDe({ source_kind: "surveymonkey" })).toBe(false);
    expect(reemplazaArchivosDe({ source_kind: "kobo" })).toBe(false);
    expect(reemplazaArchivosDe({ source_kind: "formulario_publicado_excel" })).toBe(false);
    expect(reemplazaArchivosDe({ source_kind: "manual", multi_integrated: { version: 1 } })).toBe(false);
    expect(reemplazaArchivosDe({ source_kind: "manual", parent_base: "hogares" })).toBe(false);
  });
});

describe("nombre de la base (oleada 15-B)", () => {
  it("el identificador que puso el motor se lee por el título de su encuesta", () => {
    const pdm = { nombre: "post_distribution_monitoring_espacios_de_protecci_on_2026_q2", source_alias: null, source_title: "Post-Distribution Monitoring - Espacios de Protección 2026 Q2" };
    expect(esIdentificador(pdm.nombre)).toBe(true);
    expect(etiquetaDeBase(pdm)).toBe("Post-Distribution Monitoring - Espacios de Protección 2026 Q2");
    // El alias gana al título, como en el selector de bases.
    expect(etiquetaDeBase({ ...pdm, source_alias: "PDM espacios" })).toBe("PDM espacios");
  });

  it("un nombre elegido por el usuario se respeta aunque la encuesta tenga título", () => {
    expect(esIdentificador("docentes")).toBe(false);
    expect(esIdentificador("Estudiantes 2026")).toBe(false);
    expect(etiquetaDeBase({ nombre: "docentes", source_title: "Encuesta a docentes 2026" })).toBe("docentes");
    expect(etiquetaDeBase({ nombre: "Docentes PDM", source_title: "Post-Distribution Monitoring" })).toBe("Docentes PDM");
  });

  it("un título que es un nombre de archivo o repite el identificador no sirve de nombre", () => {
    expect(etiquetaDeBase({ nombre: "base_2026_q2", source_title: "respuestas_2026.xlsx" })).toBe("Base 2026 q2");
    expect(etiquetaDeBase({ nombre: "base_2026_q2", source_title: "base_2026_q2" })).toBe("Base 2026 q2");
  });

  it("sin título, el identificador se lee en palabras y la hija por su grupo repetido, sin inventar", () => {
    expect(etiquetaDeBase({ nombre: "auditoria_ola2" })).toBe("Auditoria ola2");
    expect(etiquetaDeBase({ nombre: "base_1" })).toBe("Base 1");
    expect(etiquetaDeBase({ nombre: "rep_servicios", repeat_group: "servicios" })).toBe("Servicios");
    expect(etiquetaDeBase({ nombre: "rep_servicios", repeat_group: "rep_servicios" })).toBe("Rep servicios");
    expect(identificadorLegible("post_distribution__monitoring")).toBe("Post distribution monitoring");
  });

  it("la base única se llama por su encuesta si la tiene y si no \"Base única\", nunca default", () => {
    expect(etiquetaDeBase({ nombre: "default" })).toBe("Base única");
    expect(etiquetaDeBase({ nombre: "default", source_title: "default" })).toBe("Base única");
    expect(etiquetaDeBase({ nombre: "default", source_title: "Encuesta a hogares" })).toBe("Encuesta a hogares");
  });
});

describe("fila de la base (oleada 15-B)", () => {
  it("el estado de Carga usa la misma lectura y las mismas palabras que Estado del estudio", () => {
    expect(estadoDeCarga(null)).toBeNull();
    expect(estadoDeCarga({ imported: true })).toMatchObject({ estado: "Cargada", tono: "success" });
    expect(estadoDeCarga({ imported: false })).toMatchObject({ estado: "Incompleta", tono: "warn" });
  });

  it("dice de dónde sale el formulario", () => {
    expect(formularioDeBase({ source_kind: "manual", xlsform_file_id: "x" })).toBe("Formulario cargado (XLSForm)");
    expect(formularioDeBase({ source_kind: "surveymonkey", xlsform_file_id: "x" })).toBe("Formulario leído de la encuesta");
    expect(formularioDeBase({ source_kind: "kobo", xlsform_file_id: "x" })).toBe("Formulario leído de la plataforma");
    expect(formularioDeBase({ source_kind: "monitoreo_territorial", xlsform_file_id: "x" })).toBe("Formulario leído de la plataforma");
    expect(formularioDeBase({ source_kind: "formulario_publicado_sav", xlsform_file_id: "x" })).toBe("Formulario publicado");
    expect(formularioDeBase({ source_kind: "manual", xlsform_file_id: "x", multi_integrated: { version: 1 } })).toBe("Formulario integrado");
    expect(formularioDeBase({ source_kind: "manual", xlsform_file_id: "" })).toBe("Sin formulario");
  });

  it("cada encuesta de SurveyMonkey trae sus respuestas y la última lectura; la integrada no inventa la cifra por origen", () => {
    const c = coleccionDelEstudio({
      bases: {
        est: base("est", {
          source_kind: "surveymonkey",
          surveymonkey_refreshed_at: "2026-11-09T16:40:00Z",
          surveymonkey_sources: [
            { survey_id: "1", source_title: "En línea", included_records: 265 },
            { survey_id: "2", source_title: "En aula", included_records: 28 },
          ],
        }),
        int: base("int", { multi_integrated: { version: 1, origins: [{ key_value: "a", label: "A", source_kind: "surveymonkey" }] } }),
        arch: base("arch", { n_filas: 85 }),
      },
    });
    const por = Object.fromEntries(c.bases.map((b) => [b.nombre, b]));
    expect(por.est.fuentes.map((f) => [f.origen, f.respuestas, f.leidaEl])).toEqual([
      ["SurveyMonkey", 265, "2026-11-09T16:40:00Z"],
      ["SurveyMonkey", 28, "2026-11-09T16:40:00Z"],
    ]);
    expect(por.int.fuentes.map((f) => [f.origen, f.respuestas, f.llave])).toEqual([["SurveyMonkey", null, "a"]]);
    // Una base de archivos no publica fecha de lectura: queda vacía.
    expect(por.arch.fuentes[0]).toMatchObject({ origen: "Archivos", respuestas: 85, leidaEl: null });
  });
});

describe("cifras de la cabecera y base del inspector (oleada 15-B)", () => {
  const c = coleccionDelEstudio({
    bases: {
      hogares: base("hogares", { n_filas: 293 }),
      miembros: base("miembros", { source_kind: "kobo_repeat", parent_base: "hogares", n_filas: 1104 }),
      docentes: base("docentes", { n_filas: 115 }),
    },
  });

  it("suma las respuestas de las bases madre; las filas del grupo repetido no son respuestas", () => {
    expect(cifrasDeLaColeccion(c)).toEqual({ nBases: 2, nGruposRepetidos: 1, nFuentes: 2, respuestas: 408 });
  });

  it("si una base no tiene cifra, no se publica una suma parcial", () => {
    const sinCifra = coleccionDelEstudio({ bases: { a: base("a", { n_filas: 10 }), b: base("b", { n_filas: null }) } });
    expect(cifrasDeLaColeccion(sinCifra).respuestas).toBeNull();
    expect(cifrasDeLaColeccion({ bases: [], nBases: 0, nGruposRepetidos: 0 }).respuestas).toBeNull();
  });

  it("el inspector muestra la base del foco, la hija del foco o, sin foco, la primera", () => {
    expect(baseDelInspector(c, null)).toMatchObject({ base: { nombre: "hogares" }, hija: null });
    expect(baseDelInspector(c, "docentes")).toMatchObject({ base: { nombre: "docentes" }, hija: null });
    expect(baseDelInspector(c, "miembros")).toMatchObject({ base: { nombre: "hogares" }, hija: { nombre: "miembros" } });
    expect(baseDelInspector(c, "surveymonkey")).toMatchObject({ base: { nombre: "hogares" } });
    expect(baseDelInspector({ bases: [], nBases: 0, nGruposRepetidos: 0 }, null)).toBeNull();
  });
});
