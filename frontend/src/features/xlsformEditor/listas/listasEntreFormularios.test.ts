import { describe, expect, test } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import {
  nombresCortos,
  aplicarNombresComunes,
  compararListasEntreFormularios,
  describirAdvertencia,
  describirDondeSeRepite,
  describirNombresAlla,
  esNombrePosicional,
  renombresSugeridos,
  type FormularioHermano,
} from "./listasEntreFormularios";
import { nombresDeListas } from "./listasModel";

const GENERO = [["1", "Masculino"], ["2", "Femenino"], ["3", "Prefiero no responder"], ["4", "Otro (especifique)"]];
const ACUERDO = [["1", "En desacuerdo"], ["2", "De acuerdo"]];

function wb(listas: Record<string, string[][]>): XlsformEditorWorkbook {
  const choices = Object.entries(listas).flatMap(([nombre, ops]) => ops.map(([c, l]) => [nombre, c, l]));
  const survey = Object.keys(listas).map((nombre) => [`select_one ${nombre}`, `q_${nombre}`, ""]);
  return {
    survey: { columns: ["type", "name", "label"], rows: survey },
    choices: { columns: ["list_name", "name", "label"], rows: choices },
    settings: { columns: [], rows: [] },
  };
}

function hermano(id: string, nombre: string, listas: Record<string, string[][]>): FormularioHermano {
  return { id, nombre, workbook: wb(listas) };
}

describe("esNombrePosicional", () => {
  test.each(["lst_p3", "lst_q0001", "lst_p3_ln", "list_12", "LST_P10"])("%s es posicional", (n) => {
    expect(esNombrePosicional(n)).toBe(true);
  });
  test.each(["genero", "acuerdo", "lst_genero", "si_no"])("%s es legible", (n) => {
    expect(esNombrePosicional(n)).toBe(false);
  });
});

describe("compararListasEntreFormularios", () => {
  test("género posicional en los tres: propone «genero» por contenido", () => {
    const activo = wb({ lst_p3: GENERO });
    const otros = [
      hermano("doc", "Docentes", { lst_p3: GENERO }),
      hermano("adm", "Administrativos", { lst_p4: GENERO }),
    ];
    const { coincidencias, advertencias } = compararListasEntreFormularios(activo, otros);
    expect(advertencias).toEqual([]);
    expect(coincidencias).toHaveLength(1);
    expect(coincidencias[0]).toMatchObject({ lista: "lst_p3", nombreComun: "genero", estado: "renombrar", motivo: null });
    expect(describirDondeSeRepite(coincidencias[0].copias)).toBe("Igual en Docentes y Administrativos");
    expect(describirNombresAlla(coincidencias[0].copias)).toBe("se llama «lst_p3» en Docentes y «lst_p4» en Administrativos");
  });

  test("si otro formulario ya le dio un nombre legible, se sugiere ese", () => {
    const activo = wb({ lst_p3: GENERO });
    const otros = [hermano("doc", "Docentes", { sexo_resp: GENERO }), hermano("adm", "Administrativos", { lst_p3: GENERO })];
    const [c] = compararListasEntreFormularios(activo, otros).coincidencias;
    expect(c.nombreComun).toBe("sexo_resp");
    expect(c.estado).toBe("renombrar");
  });

  test("ya coincide el nombre: ✓ sin acción", () => {
    const activo = wb({ acuerdo: ACUERDO });
    const otros = [hermano("doc", "Docentes", { acuerdo: ACUERDO })];
    const [c] = compararListasEntreFormularios(activo, otros).coincidencias;
    expect(c.estado).toBe("coincide");
    expect(describirNombresAlla(c.copias)).toBe("se llama «acuerdo» allí");
  });

  test("el activo ya tiene el nombre común y los otros no: referencia", () => {
    const activo = wb({ genero: GENERO });
    const otros = [hermano("doc", "Docentes", { lst_p3: GENERO })];
    expect(compararListasEntreFormularios(activo, otros).coincidencias[0].estado).toBe("referencia");
  });

  test("el nombre común es determinista: desde cualquier formulario converge", () => {
    const a = { genero: GENERO };
    const b = { sexo: GENERO };
    const desdeA = compararListasEntreFormularios(wb(a), [hermano("b", "B", b)]).coincidencias[0].nombreComun;
    const desdeB = compararListasEntreFormularios(wb(b), [hermano("a", "A", a)]).coincidencias[0].nombreComun;
    expect(desdeA).toBe(desdeB);
  });

  test("nombre común ocupado por otra lista del activo: bloqueado con motivo", () => {
    const activo = wb({ lst_p3: GENERO, acuerdo: [["1", "Rojo"], ["2", "Verde"]] });
    const otros = [hermano("doc", "Docentes", { acuerdo: GENERO })];
    const [c] = compararListasEntreFormularios(activo, otros).coincidencias;
    expect(c.estado).toBe("bloqueado");
    expect(c.motivo).toMatch(/Ya existe otra lista llamada «acuerdo»/);
  });

  test("lista con gemela en el mismo formulario: primero unificar", () => {
    const activo = wb({ lst_p1: ACUERDO, lst_p2: ACUERDO });
    const otros = [hermano("doc", "Docentes", { acuerdo: ACUERDO })];
    const estados = compararListasEntreFormularios(activo, otros).coincidencias.map((c) => c.estado);
    expect(estados).toEqual(["unificar-primero", "unificar-primero"]);
  });

  test("misma escala con códigos distintos: advertencia sin coincidencia", () => {
    const activo = wb({ lst_p9: [["1", "Sí"], ["2", "No"], ["5", "SIN INF"]] });
    const otros = [hermano("doc", "Docentes", { lst_p9: [["1", "Sí"], ["2", "No"], ["99", "SIN INF"]] })];
    const { coincidencias, advertencias } = compararListasEntreFormularios(activo, otros);
    expect(coincidencias).toEqual([]);
    expect(advertencias).toHaveLength(1);
    expect(describirAdvertencia(advertencias[0])).toBe(
      "Misma escala con códigos distintos en Docentes (SIN INF: 5 aquí, 99 allá)",
    );
  });

  test("las etiquetas se comparan sin tildes ni mayúsculas", () => {
    const activo = wb({ lst_p1: [["1", "Sí"], ["2", "No"]] });
    const otros = [hermano("doc", "Docentes", { si_no: [["1", "SI"], ["2", "no"]] })];
    expect(compararListasEntreFormularios(activo, otros).coincidencias[0].nombreComun).toBe("si_no");
  });

  test("otras etiquetas u otro orden: no coincide ni advierte", () => {
    const activo = wb({ lst_p1: GENERO });
    const otros = [hermano("doc", "Docentes", { lst_p1: [...GENERO].reverse(), x: ACUERDO })];
    const r = compararListasEntreFormularios(activo, otros);
    expect(r.coincidencias).toEqual([]);
    // Mismo par código–etiqueta en otro orden: no hay códigos distintos.
    expect(r.advertencias).toEqual([]);
  });
});

describe("aplicarNombresComunes", () => {
  test("renombra todas las sugeridas en una sola edición", () => {
    const activo = wb({ lst_p3: GENERO, lst_p7: ACUERDO });
    const otros = [hermano("doc", "Docentes", { lst_p3: GENERO, acuerdo: ACUERDO })];
    const renombres = renombresSugeridos(compararListasEntreFormularios(activo, otros));
    expect(renombres).toEqual([{ lista: "lst_p3", nombre: "genero" }, { lista: "lst_p7", nombre: "acuerdo" }]);
    const res = aplicarNombresComunes(activo, renombres);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(nombresDeListas(res.workbook)).toEqual(["genero", "acuerdo"]);
    expect(res.workbook.survey.rows.map((r) => r[0])).toEqual(["select_one genero", "select_one acuerdo"]);
    // Tras aplicar, todo coincide.
    const despues = compararListasEntreFormularios(res.workbook, otros).coincidencias.map((c) => c.estado);
    expect(despues).toEqual(["referencia", "coincide"]);
  });

  test("si un renombre falla, no cambia nada", () => {
    const activo = wb({ lst_p3: GENERO, acuerdo: ACUERDO });
    const res = aplicarNombresComunes(activo, [{ lista: "lst_p3", nombre: "genero" }, { lista: "lst_p3", nombre: "x" }]);
    expect(res.ok).toBe(false);
  });
});

describe("nombresCortos", () => {
  test("quita el prefijo común hasta el separador", () => {
    expect(nombresCortos([
      "Acreditación Arte y Diseño PUCP - Docentes",
      "Acreditación Arte y Diseño PUCP - Administrativos",
    ])).toEqual(["Docentes", "Administrativos"]);
  });
  test("con un solo nombre toma lo que va tras el último separador", () => {
    expect(nombresCortos(["Acreditación Arte y Diseño PUCP - Docentes"])).toEqual(["Docentes"]);
    expect(nombresCortos(["Encuesta"])).toEqual(["Encuesta"]);
  });
  test("sin prefijo común conserva los nombres", () => {
    expect(nombresCortos(["Docentes", "Egresados"])).toEqual(["Docentes", "Egresados"]);
  });
});
