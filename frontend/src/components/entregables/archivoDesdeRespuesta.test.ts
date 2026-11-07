import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/core";
import { archivoDesdeRespuesta, formatoDelNombre } from "./archivoDesdeRespuesta";
import {
  avanceDelJob, carpetaDeRuta, coincideDescarga, errorDelResultado, errorLegible, jobIdDeInicio, nombreDelFallo, pesoLegible,
  textoDelAvance,
} from "./generacionModelo";

const CARPETA = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Procesamiento";

describe("archivoDesdeRespuesta", () => {
  it("una base: lee el archivo de la raíz con su copia junto al proyecto", () => {
    expect(archivoDesdeRespuesta({
      ok: true, file_id: "f1", filename: "HSVG2026_Frecuencias_07_11_26.xlsx", size: 49152,
      modulo: "Procesamiento", rotulo: "Frecuencias", guardado_en: `${CARPETA}\\HSVG2026_Frecuencias_07_11_26.xlsx`, aviso_guardado: null,
    })).toEqual([{
      fileId: "f1",
      nombre: "HSVG2026_Frecuencias_07_11_26.xlsx",
      formato: "xlsx",
      tamano: 49152,
      guardadoEn: `${CARPETA}\\HSVG2026_Frecuencias_07_11_26.xlsx`,
      avisoGuardado: null,
      modulo: "Procesamiento",
      rotulo: "Frecuencias",
    }]);
  });

  it("varias bases: el entregable es el ZIP (lo único que se copia)", () => {
    const [zip, ...resto] = archivoDesdeRespuesta({
      ok: true, n_bases: 2,
      zip: { file_id: "z", filename: "HSVG2026_Frecuencias_por_base_07_11_26.zip", size: 10, guardado_en: `${CARPETA}\\a.zip`, modulo: "Procesamiento" },
      bases: [{ nombre: "Docentes", file_id: "b1", filename: "b1.xlsx", size: 1, guardado_en: null }],
    });
    expect(resto).toEqual([]);
    expect(zip).toMatchObject({ fileId: "z", formato: "zip", guardadoEn: `${CARPETA}\\a.zip`, modulo: "Procesamiento" });
  });

  it("el NULL de R como {} o arreglo vacío es ausente; un escalar en arreglo se lee", () => {
    const [a] = archivoDesdeRespuesta({
      file_id: ["f2"], filename: ["Informe.PPTX"], size: ["120"], guardado_en: {}, aviso_guardado: [], modulo: {}, rotulo: [],
    });
    expect(a).toEqual({
      fileId: "f2", nombre: "Informe.PPTX", formato: "pptx", tamano: 120,
      guardadoEn: null, avisoGuardado: null, modulo: null, rotulo: null,
    });
  });

  it("sin file_id no hay archivo; formas raras devuelven []", () => {
    expect(archivoDesdeRespuesta({ ok: true, job_id: "j" })).toEqual([]);
    expect(archivoDesdeRespuesta(null)).toEqual([]);
    expect(archivoDesdeRespuesta([{ file_id: "x" }])).toEqual([]);
    expect(archivoDesdeRespuesta("f1")).toEqual([]);
    expect(archivoDesdeRespuesta({ zip: {}, file_id: "raiz" })).toEqual([]);
  });

  it("sin filename cae al rótulo; tamaño inválido queda null", () => {
    const [a] = archivoDesdeRespuesta({ file_id: "f3", rotulo: "Ficha técnica", size: -1 });
    expect(a).toMatchObject({ nombre: "Ficha técnica", formato: "", tamano: null });
  });

  it("formatoDelNombre", () => {
    expect(formatoDelNombre("a.b.DOCX")).toBe("docx");
    expect(formatoDelNombre("sin_extension")).toBe("");
    expect(formatoDelNombre("replicar_base.R")).toBe("r");
  });
});

describe("modelo de la generación", () => {
  it("avanceDelJob traduce progress del job; sin percent es indeterminada", () => {
    expect(avanceDelJob({ phase: "workbook", step: 2, steps: 4, percent: 55.4, message: "Calculando cruces..." }))
      .toEqual({ paso: 2, pasos: 4, porcentaje: 55, mensaje: "Calculando cruces..." });
    expect(avanceDelJob({ phase: "writing" })).toEqual({ porcentaje: null });
    expect(avanceDelJob({})).toEqual({ porcentaje: null });
    expect(avanceDelJob(null)).toEqual({ porcentaje: null });
    expect(avanceDelJob({ percent: 140, step: 0, steps: 3 })).toEqual({ porcentaje: 100 });
  });

  it("textoDelAvance dice el paso y la fase sin la elipsis del motor", () => {
    expect(textoDelAvance({ paso: 2, pasos: 4, mensaje: "Calculando cruces..." })).toBe("Paso 2 de 4: calculando cruces");
    expect(textoDelAvance({ mensaje: "Empaquetando archivos…" })).toBe("Empaquetando archivos");
    expect(textoDelAvance({})).toBe("Generando");
  });

  it("errorLegible separa la causa y el código E_* de ApiError, nunca el cuerpo crudo", () => {
    expect(errorLegible(new ApiError("E_ANALITICA_SIN_BASE", "No hay base activa."))).toEqual({
      causa: "No hay base activa.", codigo: "E_ANALITICA_SIN_BASE",
    });
    expect(errorLegible(new Error("Falló la red"))).toEqual({ causa: "Falló la red", codigo: null });
    expect(errorLegible(undefined).causa).toMatch(/sin detalle/);
  });

  it("errorDelResultado lee el error de dominio dentro de result_data", () => {
    expect(errorDelResultado({ ok: false, error: { code: "E_X", message: "No hay variables." } }))
      .toEqual({ causa: "No hay variables.", codigo: "E_X" });
    expect(errorDelResultado({ ok: true, file_id: "f" })).toBeNull();
  });

  it("jobIdDeInicio reconoce el arranque de un job y no un archivo", () => {
    expect(jobIdDeInicio({ ok: true, job_id: "j1", kind: "analitica.cruces" })).toBe("j1");
    expect(jobIdDeInicio({ ok: true, job_id: "j1", file_id: "f" })).toBeNull();
    expect(jobIdDeInicio({ file_id: "f" })).toBeNull();
    expect(jobIdDeInicio(null)).toBeNull();
  });

  it("coincideDescarga acepta el _N que Electron agrega sin pisar, sin distinguir mayúsculas", () => {
    expect(coincideDescarga("HSVG_Frecuencias.xlsx", "HSVG_Frecuencias.xlsx")).toBe(true);
    expect(coincideDescarga("HSVG_Frecuencias.xlsx", "hsvg_frecuencias_2.XLSX")).toBe(true);
    expect(coincideDescarga("HSVG_Frecuencias.xlsx", "HSVG_Frecuencias_por_base.xlsx")).toBe(false);
    expect(coincideDescarga("HSVG_Frecuencias.xlsx", "HSVG_Frecuencias.pdf")).toBe(false);
    expect(coincideDescarga("", "a.xlsx")).toBe(false);
  });

  it("nombreDelFallo concuerda en número y respeta las mayúsculas de siglas", () => {
    expect(nombreDelFallo("Frecuencias", "las")).toBe("No se pudieron generar las frecuencias");
    expect(nombreDelFallo("Cruces", "los")).toBe("No se pudieron generar los cruces");
    expect(nombreDelFallo("Informe en PowerPoint", "el")).toBe("No se pudo generar el informe en PowerPoint");
    expect(nombreDelFallo("Ficha técnica", "la")).toBe("No se pudo generar la ficha técnica");
    expect(nombreDelFallo("SAV del panel", "el")).toBe("No se pudo generar el SAV del panel");
    expect(nombreDelFallo("Frecuencias")).toBe("No se pudo generar: Frecuencias");
  });

  it("pesoLegible y carpetaDeRuta", () => {
    expect(pesoLegible(820)).toBe("820 B");
    expect(pesoLegible(49152)).toBe("48 KB");
    expect(pesoLegible(1.4 * 1024 * 1024)).toBe("1.4 MB");
    expect(pesoLegible(null)).toBeNull();
    expect(carpetaDeRuta("C:\\Users\\ana\\Downloads\\a.xlsx")).toBe("C:\\Users\\ana\\Downloads");
    expect(carpetaDeRuta("/Users/ana/Downloads/a.xlsx")).toBe("/Users/ana/Downloads");
  });
});
