import { describe, expect, it } from "vitest";

import { normalizeMaterialCatalogPreset, type MaterialCatalogPreset } from "../../../api/materialCatalog";
import {
  FAMILIA_TODOS,
  chipsDelTipo,
  etiquetaDeFamilia,
  familiasDelCatalogo,
  filtrarPorFamilia,
  motivoIncompatible,
  paginasDeLaTarjeta,
  paginasDelTipo,
  seleccionInicial,
  textoDeCopias,
  textoDeFormato,
  textoDeImpresion,
  textoDeLectura,
} from "./modeloCatalogo";

function preset(over: Record<string, unknown>): MaterialCatalogPreset {
  return normalizeMaterialCatalogPreset({
    preset_id: "p",
    title: "Tipo",
    family: "identifica_unidad",
    pages_per_unit: 1,
    orientation: "portrait",
    faces: 1,
    copies_per: "unit",
    compatible_unit_types: ["classroom_course_schedule"],
    compatible: true,
    active: false,
    ...over,
  })!;
}

const FICHA = preset({ preset_id: "ficha", paper: "A4" });
const AFICHE = preset({ preset_id: "afiche", family: "va_al_participante", orientation: "landscape" });
const CROQUIS = preset({ preset_id: "croquis", faces: 2, pages_per_unit: 2, active: true });
const VIVIENDA = preset({
  preset_id: "vivienda", family: "nueva_familia", compatible: false, compatible_unit_types: ["household"],
});

describe("familias", () => {
  it("«Todos» primero con el total y cada familia con su conteo", () => {
    expect(familiasDelCatalogo([FICHA, AFICHE, CROQUIS, VIVIENDA])).toEqual([
      { id: FAMILIA_TODOS, label: "Todos", count: 4 },
      { id: "identifica_unidad", label: "Identifica la unidad", count: 2 },
      { id: "va_al_participante", label: "Va al participante", count: 1 },
      { id: "nueva_familia", label: "nueva_familia", count: 1 },
    ]);
  });

  it("prefiere el rótulo del backend", () => {
    expect(etiquetaDeFamilia({ family: "x", family_label: "Para el aula" })).toBe("Para el aula");
    expect(etiquetaDeFamilia({ family: "", family_label: null })).toBe("Sin familia");
  });

  it("filtra por familia y «Todos» devuelve todo", () => {
    const todos = [FICHA, AFICHE, CROQUIS];
    expect(filtrarPorFamilia(todos, FAMILIA_TODOS)).toHaveLength(3);
    expect(filtrarPorFamilia(todos, "va_al_participante").map((p) => p.preset_id)).toEqual(["afiche"]);
  });
});

describe("textos de la tarjeta y del inspector", () => {
  it("chips: papel solo si se declara, páginas y copias", () => {
    expect(chipsDelTipo(FICHA)).toEqual(["A4", "1 página", "1 por unidad"]);
    expect(chipsDelTipo(CROQUIS)).toEqual(["2 páginas", "1 por unidad"]);
  });

  it("copias, formato, impresión y lectura", () => {
    expect(textoDeCopias("unidad")).toBe("1 por unidad");
    expect(textoDeCopias("survey")).toBe("1 por encuesta");
    expect(textoDeCopias("once")).toBe("Una sola vez");
    expect(textoDeCopias(2)).toBe("2 por unidad");
    expect(textoDeCopias("por_lote")).toBe("por_lote");
    expect(textoDeCopias(null)).toBeNull();
    expect(textoDeFormato(FICHA)).toBe("A4 · vertical");
    expect(textoDeFormato(AFICHE)).toBe("Apaisado");
    expect(textoDeImpresion(2)).toBe("Frente y dorso");
    expect(textoDeImpresion(1)).toBe("Una cara");
    expect(textoDeLectura(["classroom_course_schedule", "zzz"])).toBe("Cursos-horario · zzz");
    expect(textoDeLectura([])).toBe("Cualquier unidad");
  });
});

describe("compatibilidad", () => {
  it("un tipo compatible no tiene motivo", () => {
    expect(motivoIncompatible(FICHA, "classroom_course_schedule")).toBeNull();
  });

  it("el motivo nombra lo que el tipo espera y lo que el plan tiene", () => {
    expect(motivoIncompatible(VIVIENDA, "classroom_course_schedule"))
      .toBe("Es para viviendas; el plan tiene cursos-horario.");
    expect(motivoIncompatible(VIVIENDA, null)).toBe("Es para viviendas.");
    expect(motivoIncompatible({ compatible: false, compatible_unit_types: [] }, null))
      .toBe("No aplica a estas unidades.");
  });
});

describe("páginas y selección", () => {
  it("las páginas del tipo cubren sus caras y lo que dijo la vista previa", () => {
    expect(paginasDelTipo(FICHA)).toBe(1);
    expect(paginasDelTipo(CROQUIS)).toBe(2);
    expect(paginasDelTipo(FICHA, 3)).toBe(3);
    expect(paginasDeLaTarjeta(FICHA)).toEqual([1]);
    expect(paginasDeLaTarjeta(CROQUIS)).toEqual([1, 2]);
  });

  it("abre en el tipo en uso; si no hay, en el primero compatible", () => {
    expect(seleccionInicial([FICHA, CROQUIS])).toBe("croquis");
    expect(seleccionInicial([VIVIENDA, FICHA])).toBe("ficha");
    expect(seleccionInicial([VIVIENDA])).toBe("vivienda");
    expect(seleccionInicial([])).toBeNull();
  });
});
