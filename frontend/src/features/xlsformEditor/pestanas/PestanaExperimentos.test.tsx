// Pestaña Experimentos y ficha de la tabla de un par (elección por pares C8 y C9, 2026-11-07). Mata: un formulario con
// experimento que abre en «nuevo» en vez de editar el suyo, un diseño que no viene del formulario, y una tabla de par
// que en la ficha se edita como markdown crudo en vez de verse como la ve el encuestado.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProveedorReglas } from "../kit";
import { alcanceDeLectura } from "../kit/alcanceLectura";
import { buildXlsformIndex } from "../parsing/buildIndex";
import { insertRecord, makeSheet } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { FichaConstructor, type AccionesFicha } from "../canvas/ficha/FichaConstructor";
import { generarConjoint, type DisenoConjoint } from "../conjoint/modeloConjoint";
import { generarVinetas, vinetasIniciales } from "../conjoint/modeloVinetas";
import { PestanaExperimentos } from "./PestanaExperimentos";

const diseno: DisenoConjoint = {
  prefijo: "cj",
  tareas: 2,
  rotulosPerfil: ["Persona A", "Persona B"],
  pregunta: "¿A cuál preferiría?",
  atributos: [
    { clave: "edad", rotulo: "Edad", niveles: [{ codigo: "1", texto: "35 años" }, { codigo: "2", texto: "50 años" }] },
    { clave: "genero", rotulo: "Género", niveles: [{ codigo: "1", texto: "Hombre" }, { codigo: "2", texto: "Mujer" }] },
  ],
};

function formulario(conExperimento: boolean): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", ["type", "name", "label", "calculation", "appearance", "required"]),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  insertRecord(wb.survey, 0, { type: "integer", name: "edad_resp", label: "Edad" });
  if (conExperimento) {
    const { survey, choices } = generarConjoint(diseno);
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
  }
  return wb;
}

const pintar = (wb: XlsformEditorWorkbook, foco: string | null = null) => {
  const idx = buildXlsformIndex(wb);
  return renderToStaticMarkup(
    <PestanaExperimentos workbook={wb} structure={idx.structure} selection={null} updateWorkbook={() => {}} seleccionada={foco} onSeleccionar={() => {}} onEditar={() => {}} />,
  );
};

describe("pestaña Experimentos", () => {
  test("con un experimento en el formulario abre el suyo, con su diseño, para aplicar cambios", () => {
    const html = pintar(formulario(true));
    expect(html).toContain("2 pares, 2 atributos");
    expect(html).toContain("Aplicar cambios");
    expect(html).toContain("35 años");
    expect(html).toContain("Ver en el Constructor");
  });

  test("con viñetas en el formulario las lista y abre su diseño; también se pueden agregar", () => {
    const wb = formulario(false);
    const { survey, choices } = generarVinetas(vinetasIniciales("vi"));
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
    const html = pintar(wb);
    expect(html).toContain("4 viñetas, 2 atributos");
    expect(html).toContain("Escenario");
    expect(html).toContain("Aplicar cambios");
    expect(html).toContain("Un escenario con atributos sorteados; se califica");
  });

  test("sin experimento abre uno nuevo para insertar", () => {
    const html = pintar(formulario(false));
    expect(html).toContain("Ninguno en el formulario");
    expect(html).toContain("Insertar en el formulario");
  });
});

describe("ficha de la tabla de un par", () => {
  test("se ve como tabla con un sorteo de ejemplo y se edita en Experimentos, no como markdown", () => {
    const wb = formulario(true);
    const idx = buildXlsformIndex(wb);
    const node = idx.structure.outline.find((n) => n.name === "cj_t1_tabla")!;
    const nada = () => undefined;
    const acciones: AccionesFicha = {
      campo: nada, tipo: nada, obligatoria: nada, asignarLista: nada, crearLista: nada, duplicar: nada, moverASeccion: nada,
      eliminar: nada, alternarRepeticion: nada, seleccionarFila: nada, irPestana: nada, ajuste: nada, editarFormulario: nada,
    };
    const html = renderToStaticMarkup(
      <ProveedorReglas structure={idx.structure} scope={alcanceDeLectura(idx.structure, idx.catalogs)} survey={wb.survey}>
        <FichaConstructor workbook={wb} structure={idx.structure} selection={{ kind: "survey", rowIndex: node.rowIndex }} node={node}
          settingsRecord={null} choices={[]} catalogs={idx.catalogs} usosPorLista={new Map()} diagnostics={[]} acciones={acciones} />
      </ProveedorReglas>,
    );
    expect(html).toContain("Tabla del par 1");
    expect(html).toContain("Editar en Experimentos");
    expect(html).toContain("<table");
    expect(html).not.toContain("Texto de la nota");
  });

  test("el escenario de una viñeta también se ve como lo ve el encuestado (C11)", () => {
    const wb = formulario(false);
    const { survey, choices } = generarVinetas(vinetasIniciales("vi"));
    survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
    choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
    const idx = buildXlsformIndex(wb);
    const node = idx.structure.outline.find((n) => n.name === "vi_v2_texto")!;
    const nada = () => undefined;
    const acciones: AccionesFicha = {
      campo: nada, tipo: nada, obligatoria: nada, asignarLista: nada, crearLista: nada, duplicar: nada, moverASeccion: nada,
      eliminar: nada, alternarRepeticion: nada, seleccionarFila: nada, irPestana: nada, ajuste: nada, editarFormulario: nada,
    };
    const html = renderToStaticMarkup(
      <ProveedorReglas structure={idx.structure} scope={alcanceDeLectura(idx.structure, idx.catalogs)} survey={wb.survey}>
        <FichaConstructor workbook={wb} structure={idx.structure} selection={{ kind: "survey", rowIndex: node.rowIndex }} node={node}
          settingsRecord={null} choices={[]} catalogs={idx.catalogs} usosPorLista={new Map()} diagnostics={[]} acciones={acciones} />
      </ProveedorReglas>,
    );
    expect(html).toContain("Escenario de la viñeta 2");
    expect(html).toMatch(/Una persona de (25|60) años pide un préstamo para/);
    expect(html).not.toContain("Texto de la nota");
  });
});
