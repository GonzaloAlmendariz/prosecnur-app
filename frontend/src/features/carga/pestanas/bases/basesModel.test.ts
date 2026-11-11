import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../../../api/estudio";
import {
  CAUSA_SIN_OTRA_FUENTE,
  baseEnfocada,
  coleccionDeUnaBase,
  coleccionDelEstudio,
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
    expect(c.bases[0].hijas).toEqual([{ nombre: "miembros", etiqueta: "miembros", filas: 900, madre: "hogares" }]);
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
    expect(rotuloRespuestas(1)).toBe("respuesta recibida");
    expect(rotuloRespuestas(421)).toBe("respuestas recibidas");
    expect(rotuloRespuestas(0)).toBe("respuestas recibidas");
  });

  it("dice la relación entre las bases en una línea", () => {
    const una = { mode: "single" as const, strategy: null };
    const varias = (strategy: "separate" | "integrated" | "independent" | null) => ({ mode: "multi" as const, strategy });
    expect(textoDeRelacion(una, null)).toBe("Una base");
    expect(textoDeRelacion({ mode: "undecided", strategy: null }, null)).toBe("Una base");
    expect(textoDeRelacion(varias("separate"), null)).toBe("Bases separadas, cada una con su formulario");
    expect(textoDeRelacion(varias("integrated"), null)).toBe("Una base con varias fuentes");
    expect(textoDeRelacion(varias("independent"), null)).toBe("Bases independientes");
    expect(textoDeRelacion(varias(null), "multi")).toBe("Varias bases, falta decidir cómo se relacionan");
    // La intención elegida, todavía sin estudio, ya se dice.
    expect(textoDeRelacion({ mode: "multi", strategy: null }, "integrated")).toBe("Una base con varias fuentes");
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
